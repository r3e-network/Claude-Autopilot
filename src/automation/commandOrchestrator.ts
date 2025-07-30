import * as vscode from 'vscode';
import { debugLog } from '../utils/logging';
import { ContextProvider } from '../context/contextProvider';
import { TaskPersistenceManager } from '../context/taskPersistence';
import { TaskDecomposer, DecomposedTask } from './taskDecomposer';
import { TaskResumptionEngine } from './taskResumptionEngine';
import { SubAgentRunner } from '../subagents/SubAgentRunner';
import { getClaudeIntegration } from '../context/claudeIntegration';
import { productionAgents } from '../subagents/productionAgents';
import { creationAgents } from '../subagents/creationAgents';
import { gitAgents } from '../subagents/gitAgents';

export interface CommandExecutionResult {
    success: boolean;
    message: string;
    taskId?: string;
    workflowId?: string;
    outputs?: string[];
}

export class CommandOrchestrator {
    private taskDecomposer: TaskDecomposer;
    private resumptionEngine: TaskResumptionEngine;
    private subAgentRunner: SubAgentRunner;
    private activeWorkflows: Map<string, DecomposedTask> = new Map();
    
    // Register all available sub-agents
    private readonly subAgents = {
        ...productionAgents,
        ...creationAgents,
        ...gitAgents
    };

    constructor(
        private contextProvider: ContextProvider,
        private taskManager: TaskPersistenceManager,
        private workspaceRoot: string
    ) {
        this.taskDecomposer = new TaskDecomposer(taskManager, contextProvider);
        this.resumptionEngine = new TaskResumptionEngine(taskManager, contextProvider, this.taskDecomposer, workspaceRoot);
        this.subAgentRunner = new SubAgentRunner(workspaceRoot);
        
        this.initializeSubAgents();
    }

    private initializeSubAgents(): void {
        // Register all sub-agents
        for (const [id, AgentClass] of Object.entries(this.subAgents)) {
            const agent = new AgentClass(this.workspaceRoot);
            (this.subAgentRunner as any).subAgents.set(id, agent);
        }
        
        debugLog(`Initialized ${Object.keys(this.subAgents).length} sub-agents`);
    }

    /**
     * Execute a high-level command
     */
    async executeCommand(command: string): Promise<CommandExecutionResult> {
        debugLog(`Executing command: ${command}`);
        
        try {
            // Update context with command
            const claudeIntegration = getClaudeIntegration();
            await claudeIntegration.trackMessage(command, 'user');
            
            // Check for resumable tasks first
            const resumableTasks = await this.resumptionEngine.getResumableTasks();
            if (resumableTasks.length > 0 && this.shouldResumeExisting(command)) {
                return await this.resumeExistingTask(resumableTasks[0].task);
            }
            
            // Decompose command into tasks
            const decomposed = await this.taskDecomposer.decomposeCommand(command);
            if (!decomposed) {
                return {
                    success: false,
                    message: 'Unable to understand command. Please be more specific.'
                };
            }
            
            // Store workflow
            this.activeWorkflows.set(decomposed.mainTask.id, decomposed);
            
            // Start monitoring
            await this.resumptionEngine.startMonitoring(decomposed.mainTask, decomposed.workflow);
            
            // Generate execution plan
            const executionPlan = this.taskDecomposer.generateExecutionPlan(decomposed);
            
            // Start execution
            const result = await this.executeWorkflow(decomposed);
            
            return {
                success: true,
                message: executionPlan,
                taskId: decomposed.mainTask.id,
                workflowId: decomposed.mainTask.id,
                outputs: result.outputs
            };
        } catch (error: any) {
            debugLog(`Command execution failed: ${error.message}`);
            return {
                success: false,
                message: `Command execution failed: ${error.message}`
            };
        }
    }

    /**
     * Resume an existing task
     */
    async resumeExistingTask(task: any): Promise<CommandExecutionResult> {
        debugLog(`Resuming task: ${task.id} - ${task.title}`);
        
        const resumptionPlan = await this.resumptionEngine.resumeTask(task.id);
        
        // Get workflow if available
        const workflow = this.activeWorkflows.get(task.id);
        
        if (workflow) {
            const result = await this.executeWorkflow(workflow);
            return {
                success: true,
                message: resumptionPlan,
                taskId: task.id,
                outputs: result.outputs
            };
        } else {
            return {
                success: true,
                message: resumptionPlan,
                taskId: task.id
            };
        }
    }

    /**
     * Execute a decomposed workflow
     */
    private async executeWorkflow(decomposed: DecomposedTask): Promise<{ outputs: string[] }> {
        const outputs: string[] = [];
        const { workflow } = decomposed;
        
        debugLog(`Executing workflow with ${workflow.steps.length} steps`);
        
        // Execute steps in order
        while (true) {
            const nextStep = this.taskDecomposer.getNextExecutableTask(workflow);
            if (!nextStep) {
                break; // All tasks completed or blocked
            }
            
            debugLog(`Executing step: ${nextStep.name}`);
            
            // Update step status
            this.taskDecomposer.updateStepStatus(workflow, nextStep.taskId, 'running');
            
            try {
                // Execute based on type
                let result;
                if (nextStep.command) {
                    result = await this.executeCommand(nextStep.command);
                } else if (nextStep.subAgent) {
                    result = await this.executeSubAgent(nextStep.subAgent, nextStep);
                } else {
                    result = { success: true, message: 'Step requires manual completion' };
                }
                
                if (result.success) {
                    this.taskDecomposer.updateStepStatus(workflow, nextStep.taskId, 'completed');
                    outputs.push(`✓ ${nextStep.name}: ${result.message}`);
                    
                    // Update task
                    const task = this.taskManager.getTask(nextStep.taskId);
                    if (task) {
                        this.taskManager.updateTask(nextStep.taskId, { status: 'completed' });
                    }
                } else {
                    this.taskDecomposer.updateStepStatus(workflow, nextStep.taskId, 'failed');
                    outputs.push(`✗ ${nextStep.name}: ${result.message}`);
                    
                    // Handle failure
                    const recovery = await this.handleStepFailure(nextStep, result.message);
                    if (!recovery.success) {
                        break; // Cannot recover, stop workflow
                    }
                }
            } catch (error: any) {
                this.taskDecomposer.updateStepStatus(workflow, nextStep.taskId, 'failed');
                outputs.push(`✗ ${nextStep.name}: ${error.message}`);
                break;
            }
        }
        
        return { outputs };
    }

    /**
     * Execute a sub-agent
     */
    private async executeSubAgent(agentId: string, step: any): Promise<CommandExecutionResult> {
        const agent = (this.subAgentRunner as any).subAgents.get(agentId);
        if (!agent) {
            return {
                success: false,
                message: `Sub-agent ${agentId} not found`
            };
        }
        
        try {
            const result = await agent.execute();
            
            // Track in task context
            if (step.taskId) {
                this.taskManager.addTaskContext(step.taskId, {
                    outputs: [result.message]
                });
            }
            
            return {
                success: result.success,
                message: result.message
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Sub-agent execution failed: ${error.message}`
            };
        }
    }

    /**
     * Handle step failure with recovery
     */
    private async handleStepFailure(step: any, error: string): Promise<{ success: boolean }> {
        debugLog(`Handling failure for step ${step.name}: ${error}`);
        
        // Add error to task context
        if (step.taskId) {
            this.taskManager.addTaskContext(step.taskId, {
                errors: [error]
            });
        }
        
        // Generate recovery script
        const recoveryScript = await this.resumptionEngine.generateRecoveryScript(step.taskId);
        
        // Try automatic recovery for common issues
        if (error.includes('npm') || error.includes('node_modules')) {
            try {
                await this.executeShellCommand('rm -rf node_modules package-lock.json && npm install');
                return { success: true };
            } catch (e) {
                // Recovery failed
            }
        }
        
        // Ask user for guidance
        const choice = await vscode.window.showWarningMessage(
            `Step "${step.name}" failed. How would you like to proceed?`,
            'Retry',
            'Skip',
            'Abort'
        );
        
        switch (choice) {
            case 'Retry':
                return { success: true }; // Will retry the step
            case 'Skip':
                this.taskDecomposer.updateStepStatus(step.workflow, step.taskId, 'skipped');
                return { success: true }; // Continue with next step
            default:
                return { success: false }; // Abort workflow
        }
    }

    /**
     * Execute shell command
     */
    private async executeShellCommand(command: string): Promise<string> {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        const { stdout, stderr } = await execAsync(command, { cwd: this.workspaceRoot });
        
        if (stderr) {
            throw new Error(stderr);
        }
        
        return stdout;
    }

    /**
     * Check if we should resume existing task
     */
    private shouldResumeExisting(command: string): boolean {
        const resumeKeywords = ['continue', 'resume', 'finish', 'complete'];
        const lowerCommand = command.toLowerCase();
        
        return resumeKeywords.some(keyword => lowerCommand.includes(keyword));
    }

    /**
     * Get command suggestions based on context
     */
    async getCommandSuggestions(): Promise<string[]> {
        const suggestions: string[] = [];
        
        // Add suggestions based on project state
        const context = await this.contextProvider.generateFullContext();
        
        // Check for common needs
        if (!context.projectContext.includes('README')) {
            suggestions.push('Create comprehensive documentation for the project');
        }
        
        if (!context.projectContext.includes('Docker')) {
            suggestions.push('Add Docker configuration to the project');
        }
        
        if (context.unfinishedTasks.includes('failed')) {
            suggestions.push('Fix all failing tests and make them pass');
        }
        
        // Add workflow suggestions
        suggestions.push(
            'Make the project production ready',
            'Add comprehensive unit tests with 80% coverage',
            'Create a beautiful website for the project',
            'Clean up and organize the codebase',
            'Create a pull request with all current changes'
        );
        
        return suggestions;
    }

    /**
     * Get status of active workflows
     */
    getActiveWorkflows(): { id: string; title: string; progress: number }[] {
        const workflows: any[] = [];
        
        for (const [id, decomposed] of this.activeWorkflows) {
            const completedSteps = decomposed.workflow.steps.filter(s => s.status === 'completed').length;
            const totalSteps = decomposed.workflow.steps.length;
            const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
            
            workflows.push({
                id,
                title: decomposed.mainTask.title,
                progress
            });
        }
        
        return workflows;
    }

    /**
     * Stop monitoring and cleanup
     */
    dispose(): void {
        this.resumptionEngine.dispose();
        this.activeWorkflows.clear();
    }
}