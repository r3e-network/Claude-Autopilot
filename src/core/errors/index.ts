import * as vscode from 'vscode';
import { debugLog } from '../../utils/logging';

export enum ErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export enum ErrorCategory {
    CONFIGURATION = 'configuration',
    DEPENDENCY = 'dependency',
    CLAUDE_SESSION = 'claude_session',
    QUEUE_MANAGEMENT = 'queue_management',
    SCRIPT_EXECUTION = 'script_execution',
    FILE_SYSTEM = 'file_system',
    NETWORK = 'network',
    USER_INPUT = 'user_input',
    INTERNAL = 'internal'
}

export interface ErrorDetails {
    code: string;
    message: string;
    category: ErrorCategory;
    severity: ErrorSeverity;
    context?: Record<string, any>;
    timestamp: string;
    stack?: string;
    recoverable: boolean;
    userMessage?: string;
    suggestedActions?: string[];
}

export class ClaudeAutopilotError extends Error {
    public readonly details: ErrorDetails;

    constructor(
        code: string,
        message: string,
        category: ErrorCategory,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        context?: Record<string, any>,
        recoverable: boolean = true,
        userMessage?: string,
        suggestedActions?: string[]
    ) {
        super(message);
        this.name = 'ClaudeAutopilotError';

        this.details = {
            code,
            message,
            category,
            severity,
            context,
            timestamp: new Date().toISOString(),
            stack: this.stack,
            recoverable,
            userMessage: userMessage || message,
            suggestedActions: suggestedActions || []
        };
    }
}

export class ErrorManager {
    private static errorHistory: ErrorDetails[] = [];
    private static readonly MAX_ERROR_HISTORY = 100;

    static logError(error: ClaudeAutopilotError | Error, context?: Record<string, any>): void {
        let errorDetails: ErrorDetails;

        if (error instanceof ClaudeAutopilotError) {
            errorDetails = error.details;
        } else {
            errorDetails = {
                code: 'UNKNOWN_ERROR',
                message: error.message,
                category: ErrorCategory.INTERNAL,
                severity: ErrorSeverity.MEDIUM,
                context,
                timestamp: new Date().toISOString(),
                stack: error.stack,
                recoverable: true,
                userMessage: 'An unexpected error occurred',
                suggestedActions: ['Try the operation again', 'Check the logs for more details']
            };
        }

        // Add to error history
        this.errorHistory.unshift(errorDetails);
        if (this.errorHistory.length > this.MAX_ERROR_HISTORY) {
            this.errorHistory = this.errorHistory.slice(0, this.MAX_ERROR_HISTORY);
        }

        // Log to console
        debugLog(`❌ Error [${errorDetails.code}]: ${errorDetails.message}`, errorDetails.context);

        // Show user notification based on severity
        this.showUserNotification(errorDetails);
    }

    private static showUserNotification(error: ErrorDetails): void {
        const message = error.userMessage || error.message;
        const actions = error.suggestedActions?.slice(0, 2) || []; // Limit to 2 actions for UI

        switch (error.severity) {
            case ErrorSeverity.CRITICAL:
                vscode.window.showErrorMessage(
                    `Critical Error: ${message}`,
                    ...actions,
                    'View Details'
                ).then(action => {
                    if (action === 'View Details') {
                        this.showErrorDetails(error);
                    }
                });
                break;
            case ErrorSeverity.HIGH:
                vscode.window.showErrorMessage(
                    `Error: ${message}`,
                    ...actions
                );
                break;
            case ErrorSeverity.MEDIUM:
                vscode.window.showWarningMessage(
                    `Warning: ${message}`,
                    ...actions
                );
                break;
            case ErrorSeverity.LOW:
                vscode.window.showInformationMessage(
                    `Notice: ${message}`,
                    ...actions
                );
                break;
        }
    }

    private static showErrorDetails(error: ErrorDetails): void {
        const details = [
            `Error Code: ${error.code}`,
            `Category: ${error.category}`,
            `Severity: ${error.severity}`,
            `Time: ${error.timestamp}`,
            `Message: ${error.message}`,
            '',
            'Context:',
            JSON.stringify(error.context || {}, null, 2),
            '',
            'Suggested Actions:',
            ...(error.suggestedActions || []).map(action => `• ${action}`)
        ].join('\n');

        vscode.workspace.openTextDocument({
            content: details,
            language: 'plaintext'
        }).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }

    static getErrorHistory(): ErrorDetails[] {
        return [...this.errorHistory];
    }

    static clearErrorHistory(): void {
        this.errorHistory = [];
    }

    static getErrorsByCategory(category: ErrorCategory): ErrorDetails[] {
        return this.errorHistory.filter(error => error.category === category);
    }

    static getErrorsBySeverity(severity: ErrorSeverity): ErrorDetails[] {
        return this.errorHistory.filter(error => error.severity === severity);
    }

    static getRecentErrors(hours: number = 24): ErrorDetails[] {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        return this.errorHistory.filter(error => new Date(error.timestamp) > cutoff);
    }
}

// Pre-defined error types for common scenarios
export const CommonErrors = {
    CLAUDE_NOT_INSTALLED: (context?: any) => new ClaudeAutopilotError(
        'CLAUDE_NOT_INSTALLED',
        'Claude CLI is not installed or not found in PATH',
        ErrorCategory.DEPENDENCY,
        ErrorSeverity.CRITICAL,
        context,
        true,
        'Claude CLI is required but not found on your system',
        [
            'Install Claude CLI from https://www.anthropic.com/claude-code',
            'Ensure Claude CLI is in your system PATH',
            'Restart VS Code after installation'
        ]
    ),

    CLAUDE_SESSION_FAILED: (reason?: string, context?: any) => new ClaudeAutopilotError(
        'CLAUDE_SESSION_FAILED',
        `Claude session failed to start: ${reason || 'Unknown reason'}`,
        ErrorCategory.CLAUDE_SESSION,
        ErrorSeverity.HIGH,
        context,
        true,
        'Failed to start Claude session',
        [
            'Check if Claude CLI is working correctly',
            'Verify your API key is valid',
            'Try restarting VS Code'
        ]
    ),

    QUEUE_SIZE_EXCEEDED: (currentSize: number, maxSize: number) => new ClaudeAutopilotError(
        'QUEUE_SIZE_EXCEEDED',
        `Queue size ${currentSize} exceeds maximum ${maxSize}`,
        ErrorCategory.QUEUE_MANAGEMENT,
        ErrorSeverity.MEDIUM,
        { currentSize, maxSize },
        true,
        'Message queue is full',
        [
            'Process or remove some messages from the queue',
            'Increase queue size limit in settings',
            'Enable automatic queue cleanup'
        ]
    ),

    INVALID_CONFIGURATION: (setting: string, value: any, expected: string) => new ClaudeAutopilotError(
        'INVALID_CONFIGURATION',
        `Invalid configuration for ${setting}: ${value} (expected: ${expected})`,
        ErrorCategory.CONFIGURATION,
        ErrorSeverity.MEDIUM,
        { setting, value, expected },
        true,
        `Configuration error in ${setting}`,
        [
            'Check your VS Code settings',
            'Reset to default values',
            'Consult documentation for valid values'
        ]
    ),

    SCRIPT_EXECUTION_FAILED: (scriptName: string, exitCode: number, stderr?: string) => new ClaudeAutopilotError(
        'SCRIPT_EXECUTION_FAILED',
        `Script ${scriptName} failed with exit code ${exitCode}`,
        ErrorCategory.SCRIPT_EXECUTION,
        ErrorSeverity.MEDIUM,
        { scriptName, exitCode, stderr },
        true,
        `Quality check script failed: ${scriptName}`,
        [
            'Check script output for specific errors',
            'Verify script dependencies are installed',
            'Disable the script if it\'s not needed'
        ]
    ),

    FILE_ACCESS_DENIED: (filePath: string, operation: string) => new ClaudeAutopilotError(
        'FILE_ACCESS_DENIED',
        `Access denied for ${operation} operation on ${filePath}`,
        ErrorCategory.FILE_SYSTEM,
        ErrorSeverity.MEDIUM,
        { filePath, operation },
        true,
        'File access permission denied',
        [
            'Check file permissions',
            'Run VS Code as administrator if needed',
            'Verify the file path exists'
        ]
    )
};

// Global error handler for uncaught errors
export function setupGlobalErrorHandler(): void {
    process.on('uncaughtException', (error) => {
        ErrorManager.logError(error, { source: 'uncaughtException' });
    });

    process.on('unhandledRejection', (reason, promise) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        ErrorManager.logError(error, { source: 'unhandledRejection', promise });
    });
}