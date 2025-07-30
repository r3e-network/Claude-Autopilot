import * as vscode from 'vscode';
import { ContextProvider } from './contextProvider';
import { debugLog } from '../utils/logging';

/**
 * Integrates Claude messages with the context system
 */
export class ClaudeContextIntegration {
    private contextProvider: ContextProvider | null = null;
    private messageBuffer: string[] = [];
    private lastMessageTime: number = 0;
    private readonly MESSAGE_BATCH_DELAY = 2000; // 2 seconds

    constructor() {
        // Will be initialized when context provider is ready
    }

    initialize(contextProvider: ContextProvider): void {
        this.contextProvider = contextProvider;
        debugLog('Claude context integration initialized');
    }

    /**
     * Track a Claude message (user or assistant)
     */
    async trackMessage(message: string, role: 'user' | 'assistant'): Promise<void> {
        if (!this.contextProvider) {
            debugLog('Context provider not initialized, cannot track message');
            return;
        }

        try {
            // Add message to context
            await this.contextProvider.addMessageToCurrentTask(message, role);

            // For user messages, try to detect intent and create tasks
            if (role === 'user') {
                await this.detectAndCreateTask(message);
            }

            // For assistant messages, track any files or commands mentioned
            if (role === 'assistant') {
                await this.extractAndTrackResources(message);
            }

            debugLog(`Tracked ${role} message in context system`);
        } catch (error) {
            debugLog(`Failed to track message: ${error}`);
        }
    }

    /**
     * Detect task intent from user message and create if appropriate
     */
    private async detectAndCreateTask(message: string): Promise<void> {
        if (!this.contextProvider) return;

        const taskKeywords = [
            'implement', 'fix', 'create', 'add', 'update', 'refactor',
            'optimize', 'debug', 'test', 'document', 'deploy', 'setup',
            'configure', 'install', 'remove', 'delete', 'improve', 'enhance'
        ];

        const lowerMessage = message.toLowerCase();
        const hasTaskKeyword = taskKeywords.some(keyword => lowerMessage.includes(keyword));

        if (hasTaskKeyword && message.length > 20) {
            // Buffer messages to avoid creating too many tasks
            this.messageBuffer.push(message);
            const now = Date.now();

            if (now - this.lastMessageTime > this.MESSAGE_BATCH_DELAY) {
                // Process buffered messages
                const combinedMessage = this.messageBuffer.join('\n');
                this.messageBuffer = [];
                this.lastMessageTime = now;

                // Let the context provider handle task creation
                debugLog('Potential task detected from user message');
            }
        }
    }

    /**
     * Extract file paths and commands from assistant messages
     */
    private async extractAndTrackResources(message: string): Promise<void> {
        if (!this.contextProvider) return;

        // Extract file paths (common patterns)
        const filePathRegex = /(?:^|\s)([\.\/\w-]+\/[\w\.-]+\.\w+)/gm;
        const matches = message.matchAll(filePathRegex);

        for (const match of matches) {
            const filePath = match[1];
            if (this.isValidFilePath(filePath)) {
                await this.contextProvider.trackFileChange(filePath, 'modify');
            }
        }

        // Extract commands (common shell command patterns)
        const commandRegex = /(?:^|\s)(?:npm|yarn|git|python|node|cargo|go|make|docker|kubectl)\s+[\w\s\-\.]+/gm;
        const commandMatches = message.matchAll(commandRegex);

        for (const match of commandMatches) {
            const command = match[0].trim();
            await this.contextProvider.trackCommand(command);
        }
    }

    private isValidFilePath(path: string): boolean {
        // Basic validation for file paths
        const invalidPatterns = [
            /^https?:\/\//,  // URLs
            /^[a-z]+:\/\//,  // Protocol URLs
            /\.\.\//,        // Parent directory traversal
            /^\/etc/,        // System paths
            /^\/usr/,
            /^\/bin/,
            /^\/sbin/,
        ];

        return !invalidPatterns.some(pattern => pattern.test(path)) &&
               path.includes('.') && // Has extension
               path.length < 200;    // Reasonable length
    }

    /**
     * Generate context for Claude based on current state
     */
    async generateClaudeContext(options?: {
        includeFullProject?: boolean;
        includeCurrentFile?: boolean;
        includeUnfinishedTasks?: boolean;
    }): Promise<string> {
        if (!this.contextProvider) {
            return 'Context system not initialized';
        }

        const opts = {
            includeFullProject: false,
            includeCurrentFile: true,
            includeUnfinishedTasks: true,
            ...options
        };

        if (opts.includeFullProject) {
            const context = await this.contextProvider.generateFullContext();
            return context.fullContext;
        } else {
            // Generate targeted context
            const parts: string[] = [];

            // Quick context always included
            parts.push(this.contextProvider.getQuickContext());

            if (opts.includeCurrentFile) {
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor) {
                    const fileContext = await this.contextProvider.getContextForFile(
                        activeEditor.document.uri.fsPath
                    );
                    if (fileContext) {
                        parts.push('\n## Current File Context\n' + fileContext);
                    }
                }
            }

            if (opts.includeUnfinishedTasks) {
                const context = await this.contextProvider.generateFullContext({
                    includeProjectOverview: false,
                    includeTaskHistory: false,
                    includeFileContext: false,
                    includeRecentChanges: false,
                    includeUnfinishedTasks: true
                });
                if (context.unfinishedTasks) {
                    parts.push('\n' + context.unfinishedTasks);
                }
            }

            return parts.join('\n');
        }
    }

    /**
     * Handle Claude session end - finalize current task
     */
    async onSessionEnd(): Promise<void> {
        if (!this.contextProvider) return;

        try {
            // Process any remaining buffered messages
            if (this.messageBuffer.length > 0) {
                const combinedMessage = this.messageBuffer.join('\n');
                this.messageBuffer = [];
                await this.contextProvider.addMessageToCurrentTask(combinedMessage, 'user');
            }

            debugLog('Claude session ended, context finalized');
        } catch (error) {
            debugLog(`Error finalizing context on session end: ${error}`);
        }
    }

    /**
     * Search project for symbols or patterns
     */
    async searchProject(query: string): Promise<string> {
        if (!this.contextProvider) {
            return 'Context system not initialized';
        }

        return await this.contextProvider.searchProjectSymbols(query);
    }
}

// Global instance
let claudeIntegration: ClaudeContextIntegration | null = null;

export function getClaudeIntegration(): ClaudeContextIntegration {
    if (!claudeIntegration) {
        claudeIntegration = new ClaudeContextIntegration();
    }
    return claudeIntegration;
}

/**
 * Hook into Claude message handling
 */
export function setupClaudeMessageHooks(): void {
    // This would be called from the main Claude session handler
    debugLog('Setting up Claude message hooks for context integration');
    
    // The actual integration would happen in the Claude session module
    // by calling trackMessage() for each message
}