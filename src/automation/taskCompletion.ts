import * as vscode from 'vscode';
import { debugLog } from '../utils/logging';
import { analyzeClaudeOutput, checkAndResumeTasks } from '../claude/analyzer';
import { ScriptRunner } from '../scripts';
import { SubAgentRunner } from '../subagents/SubAgentRunner';
import { addMessageToQueueFromWebview } from '../queue';
import { WorkflowOrchestrator } from './workflowOrchestrator';

export interface TaskCompletionContext {
    workspacePath: string;
    currentFiles?: string[];
    activeEditor?: vscode.TextEditor;
    userIntent?: string;
    priority: 'low' | 'medium' | 'high';
}

export interface TaskSuggestion {
    id: string;
    title: string;
    description: string;
    category: 'fix' | 'improve' | 'create' | 'analyze' | 'optimize';
    confidence: number;
    estimatedTime: string;
    actions: TaskAction[];
    priority: number;
}

export interface TaskAction {
    type: 'script' | 'subagent' | 'claude' | 'workflow' | 'command';
    description: string;
    config: any;
}

export class TaskCompletionEngine {
    private workspacePath: string;
    private scriptRunner?: ScriptRunner;
    private subAgentRunner?: SubAgentRunner;
    private orchestrator?: WorkflowOrchestrator;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
    }

    async initialize(): Promise<void> {
        this.scriptRunner = new ScriptRunner(this.workspacePath);
        this.subAgentRunner = new SubAgentRunner(this.workspacePath);
        this.orchestrator = new WorkflowOrchestrator(this.workspacePath);

        await Promise.all([
            this.scriptRunner.initialize(),
            this.subAgentRunner.initialize(),
            this.orchestrator.initialize()
        ]);
    }

    async analyzeCurrentContext(): Promise<TaskCompletionContext> {
        const activeEditor = vscode.window.activeTextEditor;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }

        // Get recent files
        const recentFiles = await this.getRecentlyModifiedFiles();
        
        // Determine user intent from recent activity
        const userIntent = await this.inferUserIntent(activeEditor, recentFiles);

        return {
            workspacePath: this.workspacePath,
            currentFiles: recentFiles,
            activeEditor,
            userIntent,
            priority: 'medium'
        };
    }

    async suggestTasks(context: TaskCompletionContext): Promise<TaskSuggestion[]> {
        const suggestions: TaskSuggestion[] = [];

        // Run parallel analysis
        const [scriptResults, claudeAnalysis, projectHealth] = await Promise.all([
            this.analyzeWithScripts(),
            this.analyzeCurrentState(),
            this.assessProjectHealth()
        ]);

        // Generate suggestions based on script results
        if (scriptResults) {
            suggestions.push(...this.generateScriptBasedSuggestions(scriptResults));
        }

        // Generate suggestions based on Claude analysis
        if (claudeAnalysis?.hasUnfinishedTasks) {
            suggestions.push(...this.generateClaudeBasedSuggestions(claudeAnalysis));
        }

        // Generate suggestions based on project health
        suggestions.push(...this.generateHealthBasedSuggestions(projectHealth));

        // Generate context-aware suggestions
        suggestions.push(...this.generateContextualSuggestions(context));

        // Sort by priority and confidence
        return suggestions
            .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
            .slice(0, 8); // Top 8 suggestions
    }

    async autoCompleteTask(context: TaskCompletionContext): Promise<void> {
        debugLog('🤖 Starting automatic task completion...');

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'AutoClaude: Analyzing and completing tasks...',
            cancellable: true
        }, async (progress, token) => {
            // Step 1: Analyze current state
            progress.report({ increment: 20, message: 'Analyzing current state...' });
            const suggestions = await this.suggestTasks(context);

            if (suggestions.length === 0) {
                vscode.window.showInformationMessage('✅ No immediate tasks detected. Your project looks good!');
                return;
            }

            // Step 2: Select high-confidence automatic tasks
            progress.report({ increment: 20, message: 'Identifying automatic tasks...' });
            const autoTasks = suggestions.filter(s => s.confidence > 0.8 && s.category === 'fix');
            const manualTasks = suggestions.filter(s => s.confidence <= 0.8 || s.category !== 'fix');

            // Step 3: Execute automatic tasks
            if (autoTasks.length > 0) {
                progress.report({ increment: 30, message: 'Executing automatic fixes...' });
                
                for (const task of autoTasks) {
                    if (token.isCancellationRequested) return;
                    
                    debugLog(`Executing automatic task: ${task.title}`);
                    await this.executeTask(task);
                }

                vscode.window.showInformationMessage(
                    `✅ Completed ${autoTasks.length} automatic task(s)!`
                );
            }

            // Step 4: Present manual tasks for user choice
            if (manualTasks.length > 0) {
                progress.report({ increment: 20, message: 'Preparing suggestions...' });
                await this.presentTaskChoices(manualTasks);
            }

            progress.report({ increment: 10, message: 'Complete!' });
        });
    }

    private async analyzeWithScripts(): Promise<Map<string, any> | null> {
        if (!this.scriptRunner) return null;

        try {
            const results = await this.scriptRunner.runChecks(false);
            return results.results;
        } catch (error) {
            debugLog(`Script analysis failed: ${error}`);
            return null;
        }
    }

    private async analyzeCurrentState(): Promise<any> {
        try {
            const analysis = analyzeClaudeOutput();
            return analysis;
        } catch (error) {
            debugLog(`Claude analysis failed: ${error}`);
            return null;
        }
    }

    private async assessProjectHealth(): Promise<'excellent' | 'good' | 'needs-work' | 'critical'> {
        if (!this.scriptRunner) return 'good';

        const results = await this.scriptRunner.runChecks(false);
        const failedCount = Array.from(results.results.values()).filter(r => !r.passed).length;
        const totalCount = results.results.size;

        if (failedCount === 0) return 'excellent';
        if (failedCount / totalCount < 0.3) return 'good';
        if (failedCount / totalCount < 0.7) return 'needs-work';
        return 'critical';
    }

    private generateScriptBasedSuggestions(results: Map<string, any>): TaskSuggestion[] {
        const suggestions: TaskSuggestion[] = [];

        for (const [scriptId, result] of results) {
            if (!result.passed && result.errors?.length > 0) {
                suggestions.push({
                    id: `fix-${scriptId}`,
                    title: `🔧 Fix ${this.getScriptDisplayName(scriptId)} Issues`,
                    description: `Automatically fix ${result.errors.length} issue(s) found by ${scriptId}`,
                    category: 'fix',
                    confidence: 0.9,
                    estimatedTime: '1-3 minutes',
                    priority: result.errors.length > 5 ? 90 : 70,
                    actions: [{
                        type: 'claude',
                        description: `Fix issues found by ${scriptId}`,
                        config: {
                            prompt: `Please fix the following issues found by ${scriptId}:\n${result.errors.slice(0, 10).join('\n')}\n\nFocus on safe, automated fixes that don't change business logic.`
                        }
                    }]
                });
            }
        }

        return suggestions;
    }

    private generateClaudeBasedSuggestions(analysis: any): TaskSuggestion[] {
        const suggestions: TaskSuggestion[] = [];

        if (analysis.unfinishedTodos?.length > 0) {
            suggestions.push({
                id: 'complete-todos',
                title: '✅ Complete Unfinished TODOs',
                description: `Complete ${analysis.unfinishedTodos.length} pending TODO item(s)`,
                category: 'create',
                confidence: 0.8,
                estimatedTime: '5-15 minutes',
                priority: 80,
                actions: [{
                    type: 'claude',
                    description: 'Complete pending TODOs',
                    config: {
                        prompt: `Please complete the following TODO items:\n${analysis.unfinishedTodos.slice(0, 5).join('\n')}`
                    }
                }]
            });
        }

        if (analysis.incompleteSteps?.length > 0) {
            suggestions.push({
                id: 'complete-steps',
                title: '🚶 Complete Incomplete Steps',
                description: `Finish ${analysis.incompleteSteps.length} incomplete step(s)`,
                category: 'create',
                confidence: 0.85,
                estimatedTime: '3-10 minutes',
                priority: 85,
                actions: [{
                    type: 'claude',
                    description: 'Complete incomplete steps',
                    config: {
                        prompt: `Please complete the following incomplete steps:\n${analysis.incompleteSteps.slice(0, 5).join('\n')}`
                    }
                }]
            });
        }

        return suggestions;
    }

    private generateHealthBasedSuggestions(health: string): TaskSuggestion[] {
        const suggestions: TaskSuggestion[] = [];

        switch (health) {
            case 'critical':
                suggestions.push({
                    id: 'emergency-fixes',
                    title: '🚨 Emergency Project Fixes',
                    description: 'Your project has critical issues that need immediate attention',
                    category: 'fix',
                    confidence: 0.95,
                    estimatedTime: '10-30 minutes',
                    priority: 100,
                    actions: [{
                        type: 'workflow',
                        description: 'Run emergency fix workflow',
                        config: { workflowId: 'auto-fix-workflow' }
                    }]
                });
                break;

            case 'needs-work':
                suggestions.push({
                    id: 'quality-improvements',
                    title: '🔧 Quality Improvements',
                    description: 'Several issues found that should be addressed',
                    category: 'improve',
                    confidence: 0.8,
                    estimatedTime: '5-15 minutes',
                    priority: 75,
                    actions: [{
                        type: 'workflow',
                        description: 'Run quality improvement workflow',
                        config: { workflowId: 'quick-quality-check' }
                    }]
                });
                break;

            case 'good':
                suggestions.push({
                    id: 'optimization',
                    title: '⚡ Performance Optimization',
                    description: 'Optimize your code for better performance',
                    category: 'optimize',
                    confidence: 0.7,
                    estimatedTime: '5-10 minutes',
                    priority: 50,
                    actions: [{
                        type: 'subagent',
                        description: 'Run performance optimization analysis',
                        config: { agentId: 'performance-optimization' }
                    }]
                });
                break;

            case 'excellent':
                suggestions.push({
                    id: 'comprehensive-review',
                    title: '🎯 Comprehensive Code Review',
                    description: 'Get detailed insights and suggestions for your excellent code',
                    category: 'analyze',
                    confidence: 0.6,
                    estimatedTime: '5-10 minutes',
                    priority: 30,
                    actions: [{
                        type: 'workflow',
                        description: 'Run comprehensive analysis',
                        config: { workflowId: 'comprehensive-analysis' }
                    }]
                });
                break;
        }

        return suggestions;
    }

    private generateContextualSuggestions(context: TaskCompletionContext): TaskSuggestion[] {
        const suggestions: TaskSuggestion[] = [];

        // Suggestions based on active editor
        if (context.activeEditor) {
            const document = context.activeEditor.document;
            const fileName = document.fileName;

            if (fileName.endsWith('.test.ts') || fileName.endsWith('.spec.ts')) {
                suggestions.push({
                    id: 'improve-tests',
                    title: '🧪 Improve Test Coverage',
                    description: 'Enhance your test file with better coverage and practices',
                    category: 'improve',
                    confidence: 0.7,
                    estimatedTime: '3-10 minutes',
                    priority: 60,
                    actions: [{
                        type: 'claude',
                        description: 'Improve test file',
                        config: {
                            prompt: `Please analyze and improve this test file. Look for missing test cases, better assertions, and testing best practices.\n\nCurrent file: ${fileName}`
                        }
                    }]
                });
            }

            if (fileName.endsWith('.md') || fileName.endsWith('.README')) {
                suggestions.push({
                    id: 'improve-documentation',
                    title: '📚 Improve Documentation',
                    description: 'Enhance your documentation with better structure and content',
                    category: 'improve',
                    confidence: 0.6,
                    estimatedTime: '2-8 minutes',
                    priority: 40,
                    actions: [{
                        type: 'claude',
                        description: 'Improve documentation',
                        config: {
                            prompt: `Please improve this documentation file. Add missing sections, improve clarity, and ensure it follows best practices.\n\nCurrent file: ${fileName}`
                        }
                    }]
                });
            }
        }

        // Always include general suggestions
        suggestions.push({
            id: 'security-check',
            title: '🔒 Security Audit',
            description: 'Run a comprehensive security audit on your codebase',
            category: 'analyze',
            confidence: 0.5,
            estimatedTime: '3-7 minutes',
            priority: 65,
            actions: [{
                type: 'subagent',
                description: 'Run security audit',
                config: { agentId: 'security-audit' }
            }]
        });

        return suggestions;
    }

    private async presentTaskChoices(tasks: TaskSuggestion[]): Promise<void> {
        const items = tasks.map(task => ({
            label: task.title,
            description: task.description,
            detail: `⏱️ ${task.estimatedTime} | 🎯 ${Math.round(task.confidence * 100)}% confidence`,
            task
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a task to execute (or press Escape to skip)',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            await this.executeTask(selected.task);
        }
    }

    private async executeTask(task: TaskSuggestion): Promise<void> {
        debugLog(`Executing task: ${task.title}`);

        for (const action of task.actions) {
            try {
                await this.executeAction(action);
            } catch (error) {
                debugLog(`Action failed: ${error}`);
                vscode.window.showWarningMessage(
                    `Task "${task.title}" partially failed: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        vscode.window.showInformationMessage(`✅ Completed: ${task.title}`);
    }

    private async executeAction(action: TaskAction): Promise<void> {
        switch (action.type) {
            case 'script':
                if (!this.scriptRunner) throw new Error('Script runner not initialized');
                await this.scriptRunner.runSingleCheck(action.config.scriptId);
                break;

            case 'subagent':
                if (!this.subAgentRunner) throw new Error('Sub-agent runner not initialized');
                await this.subAgentRunner.runSingleAgent(action.config.agentId);
                break;

            case 'claude':
                addMessageToQueueFromWebview(action.config.prompt);
                break;

            case 'workflow':
                if (!this.orchestrator) throw new Error('Orchestrator not initialized');
                await this.orchestrator.executeWorkflow(action.config.workflowId);
                break;

            case 'command':
                await vscode.commands.executeCommand(action.config.command, ...action.config.args || []);
                break;

            default:
                throw new Error(`Unknown action type: ${(action as any).type}`);
        }
    }

    private async getRecentlyModifiedFiles(): Promise<string[]> {
        // Get recently modified files (simplified implementation)
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return [];

        try {
            const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx,py,go,rs,java}', '**/node_modules/**', 20);
            return files.map(file => vscode.workspace.asRelativePath(file));
        } catch (error) {
            debugLog(`Failed to get recent files: ${error}`);
            return [];
        }
    }

    private async inferUserIntent(activeEditor?: vscode.TextEditor, recentFiles?: string[]): Promise<string> {
        if (activeEditor) {
            const document = activeEditor.document;
            const fileName = document.fileName;

            if (fileName.includes('test')) return 'testing';
            if (fileName.includes('component') || fileName.includes('ui')) return 'ui-development';
            if (fileName.includes('api') || fileName.includes('service')) return 'backend-development';
            if (fileName.includes('config') || fileName.includes('setup')) return 'configuration';
        }

        return 'general-development';
    }

    private getScriptDisplayName(scriptId: string): string {
        const displayNames: Record<string, string> = {
            'production-readiness': 'Production Readiness',
            'build-check': 'Build',
            'test-check': 'Testing',
            'format-check': 'Code Format',
            'github-actions': 'GitHub Actions'
        };

        return displayNames[scriptId] || scriptId;
    }
}