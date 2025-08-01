import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectIndexer } from './projectIndexer';
import { TaskPersistenceManager, PersistedTask, TaskContext } from './taskPersistence';
import { debugLog } from '../utils/logging';

export interface ContextOptions {
    includeProjectOverview: boolean;
    includeTaskHistory: boolean;
    includeFileContext: boolean;
    includeRecentChanges: boolean;
    includeUnfinishedTasks: boolean;
    maxContextLength?: number;
}

export interface EnhancedContext {
    projectContext: string;
    taskContext: string;
    fileContext: string;
    recentChanges: string;
    unfinishedTasks: string;
    fullContext: string;
}

export class ContextProvider {
    private static instance: ContextProvider;
    private projectIndexer: ProjectIndexer;
    private taskManager: TaskPersistenceManager;
    private contextCache: Map<string, { context: string; timestamp: number }> = new Map();
    private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes
    private readonly contextFile: string;

    private constructor(private workspaceRoot: string) {
        this.projectIndexer = ProjectIndexer.getInstance(workspaceRoot);
        this.taskManager = TaskPersistenceManager.getInstance(workspaceRoot);
        this.contextFile = path.join(workspaceRoot, '.autoclaude', 'CLAUDE_CONTEXT.md');
        this.ensureContextDir();
    }

    static getInstance(workspaceRoot: string): ContextProvider {
        if (!ContextProvider.instance || ContextProvider.instance.workspaceRoot !== workspaceRoot) {
            ContextProvider.instance = new ContextProvider(workspaceRoot);
        }
        return ContextProvider.instance;
    }

    private ensureContextDir(): void {
        const dir = path.dirname(this.contextFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async initialize(): Promise<void> {
        debugLog('Initializing context provider...');
        
        // Initialize sub-components
        await this.projectIndexer.initialize();
        await this.taskManager.initialize();
        
        // Generate initial context
        await this.generateFullContext();
        
        debugLog('Context provider initialized');
    }

    async generateFullContext(options?: Partial<ContextOptions>): Promise<EnhancedContext> {
        const defaultOptions: ContextOptions = {
            includeProjectOverview: true,
            includeTaskHistory: true,
            includeFileContext: true,
            includeRecentChanges: true,
            includeUnfinishedTasks: true,
            maxContextLength: 50000 // ~50KB default
        };
        
        const opts = { ...defaultOptions, ...options };
        
        const context: EnhancedContext = {
            projectContext: '',
            taskContext: '',
            fileContext: '',
            recentChanges: '',
            unfinishedTasks: '',
            fullContext: ''
        };
        
        // Generate each context section
        if (opts.includeProjectOverview) {
            context.projectContext = this.projectIndexer.getProjectContext();
        }
        
        if (opts.includeTaskHistory) {
            context.taskContext = this.taskManager.getTaskSummary();
        }
        
        if (opts.includeFileContext) {
            context.fileContext = await this.getCurrentFileContext();
        }
        
        if (opts.includeRecentChanges) {
            context.recentChanges = await this.getRecentChanges();
        }
        
        if (opts.includeUnfinishedTasks) {
            context.unfinishedTasks = this.getUnfinishedTasksContext();
        }
        
        // Combine all contexts
        const sections = [
            '# AutoClaude Project Context\n',
            `Generated at: ${new Date().toISOString()}\n`,
            '---\n',
            context.projectContext,
            '\n---\n',
            context.taskContext,
            '\n---\n',
            context.unfinishedTasks,
            '\n---\n',
            context.recentChanges,
            '\n---\n',
            context.fileContext
        ];
        
        context.fullContext = sections.filter(s => s.trim()).join('\n');
        
        // Truncate if needed
        if (opts.maxContextLength && context.fullContext.length > opts.maxContextLength) {
            context.fullContext = this.truncateContext(context.fullContext, opts.maxContextLength);
        }
        
        // Save to file
        await this.saveContextToFile(context.fullContext);
        
        return context;
    }

    private async getCurrentFileContext(): Promise<string> {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            return '## Current File\nNo file currently open';
        }
        
        const document = activeEditor.document;
        const filePath = document.uri.fsPath;
        const fileContext = await this.projectIndexer.getFileContext(filePath);
        
        if (!fileContext) {
            return '## Current File\nFile not indexed';
        }
        
        return `## Current File Context\n${fileContext}\n\n### Visible Content (first 50 lines)\n\`\`\`${document.languageId}\n${document.getText().split('\n').slice(0, 50).join('\n')}\n\`\`\``;
    }

    private async getRecentChanges(): Promise<string> {
        try {
            // Get git status and recent commits
            const gitStatus = await this.executeCommand('git status --short');
            const recentCommits = await this.executeCommand('git log --oneline -10');
            
            return `## Recent Changes

### Git Status
\`\`\`
${gitStatus || 'No changes detected'}
\`\`\`

### Recent Commits
\`\`\`
${recentCommits || 'No commits found'}
\`\`\``;
        } catch (error) {
            return '## Recent Changes\nUnable to retrieve git information';
        }
    }

    private getUnfinishedTasksContext(): string {
        const unfinishedTasks = this.taskManager.getUnfinishedTasks();
        
        if (unfinishedTasks.length === 0) {
            return '## Unfinished Tasks\nNo unfinished tasks';
        }
        
        const context = ['## Unfinished Tasks\n'];
        
        // Group by priority
        const byPriority = {
            critical: unfinishedTasks.filter(t => t.priority === 'critical'),
            high: unfinishedTasks.filter(t => t.priority === 'high'),
            medium: unfinishedTasks.filter(t => t.priority === 'medium'),
            low: unfinishedTasks.filter(t => t.priority === 'low')
        };
        
        for (const [priority, tasks] of Object.entries(byPriority)) {
            if (tasks.length === 0) continue;
            
            context.push(`\n### ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority\n`);
            
            for (const task of tasks) {
                context.push(`#### ${task.title}`);
                context.push(`- **Status**: ${task.status}`);
                context.push(`- **Created**: ${task.createdAt.toISOString()}`);
                context.push(`- **Description**: ${task.description.substring(0, 200)}...`);
                
                if (task.context.errors.length > 0) {
                    context.push(`- **Recent Errors**: ${task.context.errors[task.context.errors.length - 1]}`);
                }
                
                if (task.context.files.length > 0) {
                    context.push(`- **Files**: ${task.context.files.slice(-3).join(', ')}`);
                }
                
                context.push('');
            }
        }
        
        return context.join('\n');
    }

    async getContextForFile(filePath: string): Promise<string> {
        // Check cache first
        const cached = this.contextCache.get(filePath);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.context;
        }
        
        const fileContext = await this.projectIndexer.getFileContext(filePath);
        if (!fileContext) {
            return `File ${filePath} not found in project index`;
        }
        
        // Get related tasks
        const relatedTasks = this.taskManager.getAllTasks().filter(task => 
            task.context.files.includes(filePath)
        );
        
        let context = fileContext;
        
        if (relatedTasks.length > 0) {
            context += '\n\n## Related Tasks\n';
            for (const task of relatedTasks) {
                context += `- [${task.status}] ${task.title}\n`;
            }
        }
        
        // Cache the result
        this.contextCache.set(filePath, { context, timestamp: Date.now() });
        
        return context;
    }

    async addMessageToCurrentTask(message: string, role: 'user' | 'assistant'): Promise<void> {
        // Find current in-progress task or create new one
        let currentTask = this.taskManager.getTasksByStatus('in_progress')[0];
        
        if (!currentTask) {
            // Try to infer task from message
            const taskTitle = this.inferTaskTitle(message);
            currentTask = this.taskManager.createTask(
                taskTitle,
                `Task inferred from Claude interaction: ${message.substring(0, 200)}...`,
                'medium'
            );
            this.taskManager.updateTask(currentTask.id, { status: 'in_progress' });
        }
        
        // Add Claude message to task context
        this.taskManager.addTaskContext(currentTask.id, {
            claudeMessages: [{
                id: this.generateMessageId(),
                timestamp: new Date(),
                role,
                content: message
            }]
        });
    }

    private inferTaskTitle(message: string): string {
        // Simple heuristics to infer task title
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('fix')) return 'Fix issue';
        if (lowerMessage.includes('implement')) return 'Implement feature';
        if (lowerMessage.includes('refactor')) return 'Refactor code';
        if (lowerMessage.includes('test')) return 'Add tests';
        if (lowerMessage.includes('document')) return 'Update documentation';
        if (lowerMessage.includes('optimize')) return 'Optimize performance';
        if (lowerMessage.includes('debug')) return 'Debug issue';
        
        // Extract first meaningful part
        const firstLine = message.split('\n')[0];
        if (firstLine.length < 100) {
            return firstLine;
        }
        
        return 'General development task';
    }

    async trackFileChange(filePath: string, changeType: 'create' | 'modify' | 'delete'): Promise<void> {
        const currentTask = this.taskManager.getTasksByStatus('in_progress')[0];
        if (!currentTask) return;
        
        const relativePath = path.relative(this.workspaceRoot, filePath);
        
        this.taskManager.addTaskContext(currentTask.id, {
            files: [relativePath],
            codeChanges: [{
                file: relativePath,
                type: changeType,
                summary: `File ${changeType}d`
            }]
        });
    }

    async trackCommand(command: string, output?: string, error?: string): Promise<void> {
        const currentTask = this.taskManager.getTasksByStatus('in_progress')[0];
        if (!currentTask) return;
        
        const context: Partial<TaskContext> = {
            commands: [command]
        };
        
        if (output) {
            context.outputs = [output.substring(0, 500)]; // Limit output size
        }
        
        if (error) {
            context.errors = [error];
        }
        
        this.taskManager.addTaskContext(currentTask.id, context);
    }

    private truncateContext(context: string, maxLength: number): string {
        if (context.length <= maxLength) return context;
        
        // Try to truncate at a section boundary
        const truncated = context.substring(0, maxLength);
        const lastSectionIndex = truncated.lastIndexOf('\n##');
        
        if (lastSectionIndex > maxLength * 0.8) {
            return truncated.substring(0, lastSectionIndex) + '\n\n[Context truncated due to size limits]';
        }
        
        return truncated + '\n\n[Context truncated due to size limits]';
    }

    private async saveContextToFile(context: string): Promise<void> {
        try {
            fs.writeFileSync(this.contextFile, context);
            debugLog('Context saved to CLAUDE_CONTEXT.md');
        } catch (error) {
            debugLog(`Failed to save context: ${error}`);
        }
    }

    private async executeCommand(command: string): Promise<string> {
        return new Promise((resolve) => {
            const cp = require('child_process');
            cp.exec(command, { cwd: this.workspaceRoot }, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    resolve('');
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async searchProjectSymbols(query: string): Promise<string> {
        const symbols = await this.projectIndexer.searchSymbols(query);
        
        if (symbols.length === 0) {
            return `No symbols found matching "${query}"`;
        }
        
        const results = [`## Symbol Search Results for "${query}"\n`];
        
        for (const symbol of symbols.slice(0, 20)) { // Limit to 20 results
            results.push(`- **${symbol.name}** (${vscode.SymbolKind[symbol.kind]})`);
        }
        
        if (symbols.length > 20) {
            results.push(`\n... and ${symbols.length - 20} more results`);
        }
        
        return results.join('\n');
    }

    getQuickContext(): string {
        // Provide a minimal context for quick operations
        const activeFile = vscode.window.activeTextEditor?.document.uri.fsPath;
        const currentTask = this.taskManager.getTasksByStatus('in_progress')[0];
        
        let context = '## Quick Context\n\n';
        
        if (activeFile) {
            context += `**Active File**: ${path.relative(this.workspaceRoot, activeFile)}\n`;
        }
        
        if (currentTask) {
            context += `**Current Task**: ${currentTask.title} (${currentTask.status})\n`;
        }
        
        const unfinishedCount = this.taskManager.getUnfinishedTasks().length;
        context += `**Unfinished Tasks**: ${unfinishedCount}\n`;
        
        return context;
    }

    dispose(): void {
        this.projectIndexer.dispose();
        this.taskManager.dispose();
        this.contextCache.clear();
    }
}