import * as vscode from 'vscode';
import { debugLog } from '../utils/logging';
import { TaskPersistenceManager, PersistedTask } from '../context/taskPersistence';
import { ContextProvider } from '../context/contextProvider';
import { TaskDecomposer, DecomposedTask, WorkflowStep } from './taskDecomposer';
import { SubAgentRunner } from '../subagents/SubAgentRunner';
import * as fs from 'fs';
import * as path from 'path';

export interface ResumptionState {
    taskId: string;
    lastActivity: Date;
    currentStep: string | null;
    progress: number; // 0-100
    blockers: string[];
    resumptionStrategy: string;
}

export interface TaskMonitor {
    taskId: string;
    startTime: Date;
    lastCheckTime: Date;
    healthStatus: 'healthy' | 'warning' | 'critical';
    metrics: TaskMetrics;
}

export interface TaskMetrics {
    stepsCompleted: number;
    totalSteps: number;
    errorsEncountered: number;
    retriesAttempted: number;
    estimatedTimeRemaining: number; // minutes
}

export class TaskResumptionEngine {
    private activeMonitors: Map<string, TaskMonitor> = new Map();
    private resumptionStates: Map<string, ResumptionState> = new Map();
    private monitoringInterval: NodeJS.Timeout | null = null;
    private readonly stateFile: string;
    
    constructor(
        private taskManager: TaskPersistenceManager,
        private contextProvider: ContextProvider,
        private taskDecomposer: TaskDecomposer,
        private workspaceRoot: string
    ) {
        this.stateFile = path.join(workspaceRoot, '.autopilot', 'resumption-state.json');
        this.loadResumptionStates();
    }

    /**
     * Start monitoring a task for automatic resumption
     */
    async startMonitoring(task: PersistedTask, workflow?: any): Promise<void> {
        debugLog(`Starting monitoring for task: ${task.id} - ${task.title}`);

        const monitor: TaskMonitor = {
            taskId: task.id,
            startTime: new Date(),
            lastCheckTime: new Date(),
            healthStatus: 'healthy',
            metrics: {
                stepsCompleted: 0,
                totalSteps: workflow?.steps.length || 1,
                errorsEncountered: 0,
                retriesAttempted: 0,
                estimatedTimeRemaining: workflow?.estimatedTotalTime || 60
            }
        };

        this.activeMonitors.set(task.id, monitor);

        // Create resumption state
        const resumptionState: ResumptionState = {
            taskId: task.id,
            lastActivity: new Date(),
            currentStep: null,
            progress: 0,
            blockers: [],
            resumptionStrategy: 'continue'
        };

        this.resumptionStates.set(task.id, resumptionState);

        // Start periodic monitoring if not already running
        if (!this.monitoringInterval) {
            this.startPeriodicMonitoring();
        }
    }

    /**
     * Resume an interrupted task
     */
    async resumeTask(taskId: string): Promise<string> {
        debugLog(`Attempting to resume task: ${taskId}`);

        const task = this.taskManager.getTask(taskId);
        if (!task) {
            return 'Task not found';
        }

        const resumptionState = this.resumptionStates.get(taskId);
        if (!resumptionState) {
            return 'No resumption state found';
        }

        // Analyze task state
        const analysis = await this.analyzeTaskState(task, resumptionState);
        
        // Generate resumption plan
        const plan = this.generateResumptionPlan(task, analysis);

        // Update task with resumption attempt
        this.taskManager.addTaskContext(taskId, {
            outputs: [`Resuming task after interruption. Strategy: ${analysis.strategy}`]
        });

        return plan;
    }

    /**
     * Analyze current task state to determine resumption strategy
     */
    private async analyzeTaskState(task: PersistedTask, state: ResumptionState): Promise<{
        canResume: boolean;
        strategy: 'continue' | 'retry' | 'skip' | 'restart';
        reason: string;
        nextSteps: string[];
    }> {
        const analysis = {
            canResume: true,
            strategy: 'continue' as 'continue' | 'retry' | 'skip' | 'restart',
            reason: '',
            nextSteps: [] as string[]
        };

        // Check task status
        if (task.status === 'completed') {
            analysis.canResume = false;
            analysis.reason = 'Task already completed';
            return analysis;
        }

        if (task.status === 'failed' && task.context.errors.length > 3) {
            analysis.strategy = 'restart';
            analysis.reason = 'Multiple failures detected, restart recommended';
        }

        // Check for blockers
        if (state.blockers.length > 0) {
            analysis.strategy = 'skip';
            analysis.reason = `Blockers present: ${state.blockers.join(', ')}`;
        }

        // Check last activity
        const timeSinceLastActivity = Date.now() - state.lastActivity.getTime();
        if (timeSinceLastActivity > 30 * 60 * 1000) { // 30 minutes
            analysis.strategy = 'retry';
            analysis.reason = 'Task inactive for too long';
        }

        // Determine next steps based on strategy
        switch (analysis.strategy) {
            case 'continue':
                analysis.nextSteps = await this.getNextStepsForContinuation(task);
                break;
            case 'retry':
                analysis.nextSteps = await this.getRetrySteps(task);
                break;
            case 'restart':
                analysis.nextSteps = await this.getRestartSteps(task);
                break;
            case 'skip':
                analysis.nextSteps = ['Mark current step as skipped', 'Move to next available task'];
                break;
        }

        return analysis;
    }

    /**
     * Generate a resumption plan for Claude
     */
    private generateResumptionPlan(task: PersistedTask, analysis: any): string {
        const plan = [`# Task Resumption Plan

## Task: ${task.title}
**Status**: ${task.status}
**Progress**: ${this.calculateProgress(task)}%
**Strategy**: ${analysis.strategy}
**Reason**: ${analysis.reason}

## Context Summary
`];

        // Add recent context
        if (task.context.errors.length > 0) {
            plan.push(`### Recent Errors
${task.context.errors.slice(-3).map(e => `- ${e}`).join('\n')}
`);
        }

        if (task.context.files.length > 0) {
            plan.push(`### Files Involved
${task.context.files.slice(-5).map(f => `- ${f}`).join('\n')}
`);
        }

        if (task.context.commands.length > 0) {
            plan.push(`### Recent Commands
${task.context.commands.slice(-5).map(c => `- \`${c}\``).join('\n')}
`);
        }

        // Add next steps
        plan.push(`## Next Steps
${analysis.nextSteps.map((step: string, i: number) => `${i + 1}. ${step}`).join('\n')}

## Execution Instructions
1. Review the context above
2. Continue from the last successful step
3. If errors are encountered, try alternative approaches
4. Update task progress after each significant step
`);

        return plan.join('\n');
    }

    /**
     * Get next steps for task continuation
     */
    private async getNextStepsForContinuation(task: PersistedTask): Promise<string[]> {
        const steps: string[] = [];

        // Check if this is a decomposed task with subtasks
        if (task.subtasks && task.subtasks.length > 0) {
            const incompleteSubtasks = this.taskDecomposer.getIncompleteSubtasks(task.id);
            
            if (incompleteSubtasks.length > 0) {
                steps.push(`Resume with subtask: ${incompleteSubtasks[0].title}`);
                steps.push(`Execute: ${incompleteSubtasks[0].description}`);
            }
        } else {
            // Single task - analyze what needs to be done
            steps.push('Analyze current project state');
            steps.push('Identify remaining work for task completion');
            steps.push('Execute next logical step');
        }

        // Add validation step
        steps.push('Validate progress and update task status');

        return steps;
    }

    /**
     * Get retry steps for failed operations
     */
    private async getRetrySteps(task: PersistedTask): Promise<string[]> {
        const steps: string[] = [];

        // Analyze last error
        const lastError = task.context.errors[task.context.errors.length - 1];
        if (lastError) {
            steps.push(`Analyze error: ${lastError.substring(0, 100)}...`);
            steps.push('Identify root cause of failure');
        }

        // Common retry strategies
        if (lastError?.includes('ENOENT') || lastError?.includes('not found')) {
            steps.push('Verify file paths and create missing files/directories');
        } else if (lastError?.includes('permission') || lastError?.includes('EACCES')) {
            steps.push('Check and fix file permissions');
        } else if (lastError?.includes('dependency') || lastError?.includes('module')) {
            steps.push('Install missing dependencies');
        }

        steps.push('Retry the failed operation with fixes applied');
        steps.push('Implement error handling to prevent future failures');

        return steps;
    }

    /**
     * Get restart steps for tasks that need complete redo
     */
    private async getRestartSteps(task: PersistedTask): Promise<string[]> {
        return [
            'Clean up any partial work from previous attempts',
            'Reset to initial state',
            'Review task requirements and approach',
            'Start fresh with improved implementation',
            'Add proper error handling and validation'
        ];
    }

    /**
     * Start periodic monitoring of active tasks
     */
    private startPeriodicMonitoring(): void {
        this.monitoringInterval = setInterval(() => {
            this.checkAllMonitors();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Check all active monitors for issues
     */
    private async checkAllMonitors(): Promise<void> {
        for (const [taskId, monitor] of this.activeMonitors) {
            await this.checkTaskHealth(taskId, monitor);
        }

        // Save state
        this.saveResumptionStates();
    }

    /**
     * Check health of a specific task
     */
    private async checkTaskHealth(taskId: string, monitor: TaskMonitor): Promise<void> {
        const task = this.taskManager.getTask(taskId);
        if (!task) {
            this.activeMonitors.delete(taskId);
            return;
        }

        const timeSinceLastCheck = Date.now() - monitor.lastCheckTime.getTime();
        monitor.lastCheckTime = new Date();

        // Update metrics
        if (task.subtasks) {
            const completedSubtasks = task.subtasks.filter(id => {
                const subtask = this.taskManager.getTask(id);
                return subtask && subtask.status === 'completed';
            }).length;
            monitor.metrics.stepsCompleted = completedSubtasks;
        }

        monitor.metrics.errorsEncountered = task.context.errors.length;

        // Determine health status
        if (task.status === 'failed' || monitor.metrics.errorsEncountered > 5) {
            monitor.healthStatus = 'critical';
            await this.handleCriticalTask(task, monitor);
        } else if (timeSinceLastCheck > 5 * 60 * 1000) { // 5 minutes inactive
            monitor.healthStatus = 'warning';
            await this.handleWarningTask(task, monitor);
        } else {
            monitor.healthStatus = 'healthy';
        }

        // Update progress
        const state = this.resumptionStates.get(taskId);
        if (state) {
            state.progress = this.calculateProgress(task);
            state.lastActivity = new Date();
        }
    }

    /**
     * Handle task in critical state
     */
    private async handleCriticalTask(task: PersistedTask, monitor: TaskMonitor): Promise<void> {
        debugLog(`Task ${task.id} in critical state: ${task.title}`);

        // Attempt automatic recovery
        const resumptionPlan = await this.resumeTask(task.id);
        
        // Notify about critical task
        vscode.window.showWarningMessage(
            `Task "${task.title}" is in critical state. Would you like to review the resumption plan?`,
            'View Plan',
            'Ignore'
        ).then(choice => {
            if (choice === 'View Plan') {
                vscode.workspace.openTextDocument({
                    content: resumptionPlan,
                    language: 'markdown'
                }).then(doc => {
                    vscode.window.showTextDocument(doc);
                });
            }
        });
    }

    /**
     * Handle task in warning state
     */
    private async handleWarningTask(task: PersistedTask, monitor: TaskMonitor): Promise<void> {
        debugLog(`Task ${task.id} in warning state: ${task.title}`);

        // Update resumption state
        const state = this.resumptionStates.get(task.id);
        if (state) {
            state.blockers.push('Inactive for extended period');
        }
    }

    /**
     * Calculate task progress percentage
     */
    private calculateProgress(task: PersistedTask): number {
        if (task.status === 'completed') return 100;
        if (task.status === 'pending') return 0;

        if (task.subtasks && task.subtasks.length > 0) {
            const completed = task.subtasks.filter(id => {
                const subtask = this.taskManager.getTask(id);
                return subtask && subtask.status === 'completed';
            }).length;
            return Math.round((completed / task.subtasks.length) * 100);
        }

        // Estimate based on task age and status
        if (task.status === 'in_progress') {
            const age = Date.now() - task.createdAt.getTime();
            const estimatedDuration = 30 * 60 * 1000; // 30 minutes default
            return Math.min(Math.round((age / estimatedDuration) * 50), 50);
        }

        return 0;
    }

    /**
     * Get all tasks that can be resumed
     */
    async getResumableTasks(): Promise<{
        task: PersistedTask;
        state: ResumptionState;
        recommendation: string;
    }[]> {
        const resumableTasks: any[] = [];

        for (const [taskId, state] of this.resumptionStates) {
            const task = this.taskManager.getTask(taskId);
            if (!task || task.status === 'completed') continue;

            const analysis = await this.analyzeTaskState(task, state);
            if (analysis.canResume) {
                resumableTasks.push({
                    task,
                    state,
                    recommendation: `${analysis.strategy}: ${analysis.reason}`
                });
            }
        }

        return resumableTasks;
    }

    /**
     * Generate automatic recovery script
     */
    async generateRecoveryScript(taskId: string): Promise<string> {
        const task = this.taskManager.getTask(taskId);
        if (!task) return '';

        const script = [`#!/bin/bash
# Auto-generated recovery script for: ${task.title}
# Generated: ${new Date().toISOString()}

echo "Starting recovery for task: ${task.title}"
`];

        // Add error checks from task context
        if (task.context.errors.length > 0) {
            script.push('\n# Known errors to handle:');
            task.context.errors.forEach(error => {
                script.push(`# - ${error.substring(0, 80)}...`);
            });
        }

        // Add recovery commands based on error patterns
        const lastError = task.context.errors[task.context.errors.length - 1];
        if (lastError) {
            if (lastError.includes('npm') || lastError.includes('node_modules')) {
                script.push('\n# Fix npm issues');
                script.push('rm -rf node_modules package-lock.json');
                script.push('npm install');
            }
            
            if (lastError.includes('permission')) {
                script.push('\n# Fix permission issues');
                script.push('chmod -R 755 .');
            }
            
            if (lastError.includes('git')) {
                script.push('\n# Fix git issues');
                script.push('git status');
                script.push('git add -A');
            }
        }

        // Add task-specific recovery
        if (task.subtasks && task.subtasks.length > 0) {
            const incompleteSubtasks = this.taskDecomposer.getIncompleteSubtasks(taskId);
            if (incompleteSubtasks.length > 0) {
                script.push(`\n# Resume from subtask: ${incompleteSubtasks[0].title}`);
            }
        }

        script.push('\necho "Recovery complete"');

        return script.join('\n');
    }

    /**
     * Load resumption states from disk
     */
    private loadResumptionStates(): void {
        try {
            if (fs.existsSync(this.stateFile)) {
                const data = fs.readFileSync(this.stateFile, 'utf8');
                const states = JSON.parse(data);
                
                for (const state of states) {
                    state.lastActivity = new Date(state.lastActivity);
                    this.resumptionStates.set(state.taskId, state);
                }
                
                debugLog(`Loaded ${this.resumptionStates.size} resumption states`);
            }
        } catch (error) {
            debugLog(`Failed to load resumption states: ${error}`);
        }
    }

    /**
     * Save resumption states to disk
     */
    private saveResumptionStates(): void {
        try {
            const states = Array.from(this.resumptionStates.values());
            fs.writeFileSync(this.stateFile, JSON.stringify(states, null, 2));
        } catch (error) {
            debugLog(`Failed to save resumption states: ${error}`);
        }
    }

    /**
     * Clean up monitoring for completed tasks
     */
    cleanupCompletedTasks(): void {
        const completedTasks = Array.from(this.activeMonitors.keys()).filter(taskId => {
            const task = this.taskManager.getTask(taskId);
            return !task || task.status === 'completed';
        });

        for (const taskId of completedTasks) {
            this.activeMonitors.delete(taskId);
            this.resumptionStates.delete(taskId);
        }

        debugLog(`Cleaned up ${completedTasks.length} completed tasks`);
    }

    /**
     * Stop monitoring
     */
    dispose(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        this.saveResumptionStates();
    }
}