import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { debugLog } from '../utils/logging';
import { generateId } from '../utils/id-generator';

export interface PersistedTask {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'critical';
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    context: TaskContext;
    history: TaskHistoryEntry[];
    dependencies?: string[]; // Task IDs this task depends on
    subtasks?: string[]; // Task IDs that are subtasks of this
    tags?: string[];
    assignedTo?: string; // For future multi-user support
}

export interface TaskContext {
    files: string[]; // Files involved in this task
    commands: string[]; // Commands executed
    errors: string[]; // Errors encountered
    outputs: string[]; // Key outputs or results
    claudeMessages: ClaudeMessage[]; // Related Claude interactions
    codeChanges: CodeChange[]; // Track what was changed
}

export interface ClaudeMessage {
    id: string;
    timestamp: Date;
    role: 'user' | 'assistant';
    content: string;
    tokenCount?: number;
}

export interface CodeChange {
    file: string;
    type: 'create' | 'modify' | 'delete';
    linesBefore?: number;
    linesAfter?: number;
    summary?: string;
}

export interface TaskHistoryEntry {
    timestamp: Date;
    action: string;
    details?: string;
    previousStatus?: string;
    newStatus?: string;
}

export interface TaskSession {
    id: string;
    startedAt: Date;
    endedAt?: Date;
    taskIds: string[];
    summary?: string;
}

export class TaskPersistenceManager {
    private static instance: TaskPersistenceManager;
    private tasks: Map<string, PersistedTask> = new Map();
    private sessions: Map<string, TaskSession> = new Map();
    private currentSession: TaskSession | null = null;
    private readonly storageDir: string;
    private readonly tasksFile: string;
    private readonly sessionsFile: string;
    private autoSaveInterval: NodeJS.Timeout | null = null;

    private constructor(private workspaceRoot: string) {
        this.storageDir = path.join(workspaceRoot, '.autoclaude', 'tasks');
        this.tasksFile = path.join(this.storageDir, 'tasks.json');
        this.sessionsFile = path.join(this.storageDir, 'sessions.json');
        this.ensureStorageDir();
    }

    static getInstance(workspaceRoot: string): TaskPersistenceManager {
        if (!TaskPersistenceManager.instance || TaskPersistenceManager.instance.workspaceRoot !== workspaceRoot) {
            TaskPersistenceManager.instance = new TaskPersistenceManager(workspaceRoot);
        }
        return TaskPersistenceManager.instance;
    }

    private ensureStorageDir(): void {
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    async initialize(): Promise<void> {
        debugLog('Initializing task persistence manager...');
        
        // Load existing tasks and sessions
        await this.loadTasks();
        await this.loadSessions();
        
        // Start new session
        this.startNewSession();
        
        // Setup auto-save
        this.startAutoSave();
        
        // Check for unfinished tasks
        const unfinishedTasks = this.getUnfinishedTasks();
        if (unfinishedTasks.length > 0) {
            debugLog(`Found ${unfinishedTasks.length} unfinished tasks from previous sessions`);
        }
    }

    private async loadTasks(): Promise<void> {
        try {
            if (fs.existsSync(this.tasksFile)) {
                const data = fs.readFileSync(this.tasksFile, 'utf8');
                const parsed = JSON.parse(data);
                
                // Convert dates back from JSON
                for (const task of parsed) {
                    task.createdAt = new Date(task.createdAt);
                    task.updatedAt = new Date(task.updatedAt);
                    if (task.completedAt) {
                        task.completedAt = new Date(task.completedAt);
                    }
                    
                    // Convert dates in history
                    for (const entry of task.history) {
                        entry.timestamp = new Date(entry.timestamp);
                    }
                    
                    // Convert dates in Claude messages
                    for (const msg of task.context.claudeMessages) {
                        msg.timestamp = new Date(msg.timestamp);
                    }
                    
                    this.tasks.set(task.id, task);
                }
                
                debugLog(`Loaded ${this.tasks.size} tasks`);
            }
        } catch (error) {
            debugLog(`Failed to load tasks: ${error}`);
        }
    }

    private async loadSessions(): Promise<void> {
        try {
            if (fs.existsSync(this.sessionsFile)) {
                const data = fs.readFileSync(this.sessionsFile, 'utf8');
                const parsed = JSON.parse(data);
                
                for (const session of parsed) {
                    session.startedAt = new Date(session.startedAt);
                    if (session.endedAt) {
                        session.endedAt = new Date(session.endedAt);
                    }
                    this.sessions.set(session.id, session);
                }
                
                debugLog(`Loaded ${this.sessions.size} sessions`);
            }
        } catch (error) {
            debugLog(`Failed to load sessions: ${error}`);
        }
    }

    private async saveTasks(): Promise<void> {
        try {
            const tasksArray = Array.from(this.tasks.values());
            fs.writeFileSync(this.tasksFile, JSON.stringify(tasksArray, null, 2));
            debugLog('Tasks saved');
        } catch (error) {
            debugLog(`Failed to save tasks: ${error}`);
        }
    }

    private async saveSessions(): Promise<void> {
        try {
            const sessionsArray = Array.from(this.sessions.values());
            fs.writeFileSync(this.sessionsFile, JSON.stringify(sessionsArray, null, 2));
            debugLog('Sessions saved');
        } catch (error) {
            debugLog(`Failed to save sessions: ${error}`);
        }
    }

    private startAutoSave(): void {
        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            this.saveTasks();
            this.saveSessions();
        }, 30000);
    }

    private startNewSession(): void {
        // End previous session if any
        if (this.currentSession && !this.currentSession.endedAt) {
            this.endSession();
        }
        
        this.currentSession = {
            id: generateId(),
            startedAt: new Date(),
            taskIds: []
        };
        
        this.sessions.set(this.currentSession.id, this.currentSession);
        debugLog(`Started new session: ${this.currentSession.id}`);
    }

    createTask(title: string, description: string, priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'): PersistedTask {
        const task: PersistedTask = {
            id: generateId(),
            title,
            description,
            status: 'pending',
            priority,
            createdAt: new Date(),
            updatedAt: new Date(),
            context: {
                files: [],
                commands: [],
                errors: [],
                outputs: [],
                claudeMessages: [],
                codeChanges: []
            },
            history: [{
                timestamp: new Date(),
                action: 'created',
                details: `Task created: ${title}`
            }]
        };
        
        this.tasks.set(task.id, task);
        
        if (this.currentSession) {
            this.currentSession.taskIds.push(task.id);
        }
        
        debugLog(`Created task: ${task.id} - ${title}`);
        return task;
    }

    updateTask(taskId: string, updates: Partial<PersistedTask>): PersistedTask | null {
        const task = this.tasks.get(taskId);
        if (!task) return null;
        
        const previousStatus = task.status;
        
        // Update task
        Object.assign(task, updates, {
            updatedAt: new Date()
        });
        
        // Add history entry
        const historyEntry: TaskHistoryEntry = {
            timestamp: new Date(),
            action: 'updated'
        };
        
        if (updates.status && updates.status !== previousStatus) {
            historyEntry.previousStatus = previousStatus;
            historyEntry.newStatus = updates.status;
            historyEntry.action = 'status_changed';
            
            if (updates.status === 'completed') {
                task.completedAt = new Date();
            }
        }
        
        task.history.push(historyEntry);
        
        debugLog(`Updated task: ${taskId}`);
        return task;
    }

    addTaskContext(taskId: string, contextUpdate: Partial<TaskContext>): void {
        const task = this.tasks.get(taskId);
        if (!task) return;
        
        // Merge context updates
        if (contextUpdate.files) {
            task.context.files.push(...contextUpdate.files);
        }
        if (contextUpdate.commands) {
            task.context.commands.push(...contextUpdate.commands);
        }
        if (contextUpdate.errors) {
            task.context.errors.push(...contextUpdate.errors);
        }
        if (contextUpdate.outputs) {
            task.context.outputs.push(...contextUpdate.outputs);
        }
        if (contextUpdate.claudeMessages) {
            task.context.claudeMessages.push(...contextUpdate.claudeMessages);
        }
        if (contextUpdate.codeChanges) {
            task.context.codeChanges.push(...contextUpdate.codeChanges);
        }
        
        task.updatedAt = new Date();
        
        task.history.push({
            timestamp: new Date(),
            action: 'context_updated',
            details: 'Added context information'
        });
    }

    getTask(taskId: string): PersistedTask | null {
        return this.tasks.get(taskId) || null;
    }

    getAllTasks(): PersistedTask[] {
        return Array.from(this.tasks.values());
    }

    getUnfinishedTasks(): PersistedTask[] {
        return Array.from(this.tasks.values()).filter(
            task => task.status === 'pending' || task.status === 'in_progress'
        );
    }

    getTasksByStatus(status: PersistedTask['status']): PersistedTask[] {
        return Array.from(this.tasks.values()).filter(task => task.status === status);
    }

    getTasksByPriority(priority: PersistedTask['priority']): PersistedTask[] {
        return Array.from(this.tasks.values()).filter(task => task.priority === priority);
    }

    getSessionTasks(sessionId?: string): PersistedTask[] {
        const session = sessionId ? this.sessions.get(sessionId) : this.currentSession;
        if (!session) return [];
        
        return session.taskIds
            .map(id => this.tasks.get(id))
            .filter(task => task !== undefined) as PersistedTask[];
    }

    searchTasks(query: string): PersistedTask[] {
        const queryLower = query.toLowerCase();
        return Array.from(this.tasks.values()).filter(task => 
            task.title.toLowerCase().includes(queryLower) ||
            task.description.toLowerCase().includes(queryLower) ||
            task.tags?.some(tag => tag.toLowerCase().includes(queryLower))
        );
    }

    linkTasks(parentId: string, childId: string): void {
        const parent = this.tasks.get(parentId);
        const child = this.tasks.get(childId);
        
        if (!parent || !child) return;
        
        // Add to parent's subtasks
        if (!parent.subtasks) {
            parent.subtasks = [];
        }
        if (!parent.subtasks.includes(childId)) {
            parent.subtasks.push(childId);
        }
        
        // Add to child's dependencies
        if (!child.dependencies) {
            child.dependencies = [];
        }
        if (!child.dependencies.includes(parentId)) {
            child.dependencies.push(parentId);
        }
        
        parent.updatedAt = new Date();
        child.updatedAt = new Date();
    }

    getTaskHierarchy(taskId: string): { task: PersistedTask; subtasks: PersistedTask[] } | null {
        const task = this.tasks.get(taskId);
        if (!task) return null;
        
        const subtasks = (task.subtasks || [])
            .map(id => this.tasks.get(id))
            .filter(t => t !== undefined) as PersistedTask[];
        
        return { task, subtasks };
    }

    getTaskSummary(): string {
        const total = this.tasks.size;
        const pending = this.getTasksByStatus('pending').length;
        const inProgress = this.getTasksByStatus('in_progress').length;
        const completed = this.getTasksByStatus('completed').length;
        const failed = this.getTasksByStatus('failed').length;
        
        return `# Task Summary

## Overall Statistics
- **Total Tasks**: ${total}
- **Pending**: ${pending}
- **In Progress**: ${inProgress}
- **Completed**: ${completed}
- **Failed**: ${failed}

## Current Session
- **Session ID**: ${this.currentSession?.id || 'None'}
- **Started**: ${this.currentSession?.startedAt.toISOString() || 'N/A'}
- **Tasks in Session**: ${this.currentSession?.taskIds.length || 0}

## Recent Tasks
${this.getAllTasks()
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, 10)
    .map(task => `- [${task.status}] **${task.title}** (${task.priority})`)
    .join('\n')}
`;
    }

    exportTasksToMarkdown(): string {
        const tasks = this.getAllTasks().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        let markdown = '# AutoClaude Task History\n\n';
        
        for (const task of tasks) {
            markdown += `## ${task.title}\n\n`;
            markdown += `- **ID**: ${task.id}\n`;
            markdown += `- **Status**: ${task.status}\n`;
            markdown += `- **Priority**: ${task.priority}\n`;
            markdown += `- **Created**: ${task.createdAt.toISOString()}\n`;
            markdown += `- **Updated**: ${task.updatedAt.toISOString()}\n`;
            
            if (task.completedAt) {
                markdown += `- **Completed**: ${task.completedAt.toISOString()}\n`;
            }
            
            markdown += `\n### Description\n${task.description}\n`;
            
            if (task.context.files.length > 0) {
                markdown += `\n### Files Involved\n${task.context.files.map(f => `- ${f}`).join('\n')}\n`;
            }
            
            if (task.context.errors.length > 0) {
                markdown += `\n### Errors Encountered\n${task.context.errors.map(e => `- ${e}`).join('\n')}\n`;
            }
            
            if (task.context.codeChanges.length > 0) {
                markdown += `\n### Code Changes\n`;
                for (const change of task.context.codeChanges) {
                    markdown += `- **${change.type}** ${change.file}`;
                    if (change.summary) {
                        markdown += `: ${change.summary}`;
                    }
                    markdown += '\n';
                }
            }
            
            markdown += '\n---\n\n';
        }
        
        return markdown;
    }

    endSession(summary?: string): void {
        if (!this.currentSession) return;
        
        this.currentSession.endedAt = new Date();
        if (summary) {
            this.currentSession.summary = summary;
        }
        
        debugLog(`Ended session: ${this.currentSession.id}`);
        
        // Save immediately
        this.saveSessions();
        
        this.currentSession = null;
    }

    dispose(): void {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.endSession();
        this.saveTasks();
        this.saveSessions();
    }
}