import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
    ClaudeAutopilotError, 
    ErrorManager, 
    CommonErrors, 
    ErrorCategory, 
    ErrorSeverity 
} from '../../../src/core/errors';

// Mock VS Code
const mockShowErrorMessage = jest.fn();
const mockShowWarningMessage = jest.fn();
const mockShowInformationMessage = jest.fn();
const mockOpenTextDocument = jest.fn();
const mockShowTextDocument = jest.fn();

jest.mock('vscode', () => ({
    window: {
        showErrorMessage: mockShowErrorMessage,
        showWarningMessage: mockShowWarningMessage,
        showInformationMessage: mockShowInformationMessage,
        showTextDocument: mockShowTextDocument
    },
    workspace: {
        openTextDocument: mockOpenTextDocument
    }
}));

describe('ClaudeAutopilotError', () => {
    it('should create error with all details', () => {
        const error = new ClaudeAutopilotError(
            'TEST_ERROR',
            'Test error message',
            ErrorCategory.CONFIGURATION,
            ErrorSeverity.HIGH,
            { key: 'value' },
            true,
            'User friendly message',
            ['Action 1', 'Action 2']
        );

        expect(error.name).toBe('ClaudeAutopilotError');
        expect(error.message).toBe('Test error message');
        expect(error.details.code).toBe('TEST_ERROR');
        expect(error.details.category).toBe(ErrorCategory.CONFIGURATION);
        expect(error.details.severity).toBe(ErrorSeverity.HIGH);
        expect(error.details.context).toEqual({ key: 'value' });
        expect(error.details.recoverable).toBe(true);
        expect(error.details.userMessage).toBe('User friendly message');
        expect(error.details.suggestedActions).toEqual(['Action 1', 'Action 2']);
        expect(error.details.timestamp).toBeDefined();
    });

    it('should use defaults for optional parameters', () => {
        const error = new ClaudeAutopilotError(
            'SIMPLE_ERROR',
            'Simple message',
            ErrorCategory.INTERNAL
        );

        expect(error.details.severity).toBe(ErrorSeverity.MEDIUM);
        expect(error.details.recoverable).toBe(true);
        expect(error.details.userMessage).toBe('Simple message');
        expect(error.details.suggestedActions).toEqual([]);
    });
});

describe('ErrorManager', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        ErrorManager.clearErrorHistory();
    });

    afterEach(() => {
        ErrorManager.clearErrorHistory();
    });

    describe('logError', () => {
        it('should log ClaudeAutopilotError', () => {
            const error = CommonErrors.CLAUDE_NOT_INSTALLED();
            ErrorManager.logError(error);

            const history = ErrorManager.getErrorHistory();
            expect(history).toHaveLength(1);
            expect(history[0].code).toBe('CLAUDE_NOT_INSTALLED');
            expect(history[0].category).toBe(ErrorCategory.DEPENDENCY);
        });

        it('should log generic Error', () => {
            const error = new Error('Generic error');
            ErrorManager.logError(error, { context: 'test' });

            const history = ErrorManager.getErrorHistory();
            expect(history).toHaveLength(1);
            expect(history[0].code).toBe('UNKNOWN_ERROR');
            expect(history[0].message).toBe('Generic error');
            expect(history[0].context).toEqual({ context: 'test' });
        });

        it('should show appropriate notification based on severity', () => {
            // Critical error
            const criticalError = new ClaudeAutopilotError(
                'CRITICAL',
                'Critical issue',
                ErrorCategory.INTERNAL,
                ErrorSeverity.CRITICAL
            );
            ErrorManager.logError(criticalError);
            expect(mockShowErrorMessage).toHaveBeenCalledWith(
                'Critical Error: Critical issue',
                'View Details'
            );

            // Warning
            const warningError = new ClaudeAutopilotError(
                'WARNING',
                'Warning issue',
                ErrorCategory.CONFIGURATION,
                ErrorSeverity.MEDIUM
            );
            ErrorManager.logError(warningError);
            expect(mockShowWarningMessage).toHaveBeenCalledWith(
                'Warning: Warning issue'
            );
        });
    });

    describe('error history management', () => {
        it('should maintain error history', () => {
            const error1 = CommonErrors.CLAUDE_NOT_INSTALLED();
            const error2 = CommonErrors.QUEUE_SIZE_EXCEEDED(100, 50);

            ErrorManager.logError(error1);
            ErrorManager.logError(error2);

            const history = ErrorManager.getErrorHistory();
            expect(history).toHaveLength(2);
            expect(history[0].code).toBe('QUEUE_SIZE_EXCEEDED'); // Most recent first
            expect(history[1].code).toBe('CLAUDE_NOT_INSTALLED');
        });

        it('should limit error history size', () => {
            // Log more than MAX_ERROR_HISTORY (100) errors
            for (let i = 0; i < 110; i++) {
                const error = new Error(`Error ${i}`);
                ErrorManager.logError(error);
            }

            const history = ErrorManager.getErrorHistory();
            expect(history.length).toBe(100);
            expect(history[0].message).toBe('Error 109'); // Most recent
            expect(history[99].message).toBe('Error 10'); // Oldest kept
        });

        it('should filter errors by category', () => {
            const configError = CommonErrors.INVALID_CONFIGURATION('test', 'invalid', 'valid');
            const depError = CommonErrors.CLAUDE_NOT_INSTALLED();

            ErrorManager.logError(configError);
            ErrorManager.logError(depError);

            const configErrors = ErrorManager.getErrorsByCategory(ErrorCategory.CONFIGURATION);
            const depErrors = ErrorManager.getErrorsByCategory(ErrorCategory.DEPENDENCY);

            expect(configErrors).toHaveLength(1);
            expect(depErrors).toHaveLength(1);
            expect(configErrors[0].code).toBe('INVALID_CONFIGURATION');
            expect(depErrors[0].code).toBe('CLAUDE_NOT_INSTALLED');
        });

        it('should filter errors by severity', () => {
            const highError = new ClaudeAutopilotError(
                'HIGH',
                'High severity',
                ErrorCategory.INTERNAL,
                ErrorSeverity.HIGH
            );
            const lowError = new ClaudeAutopilotError(
                'LOW',
                'Low severity',
                ErrorCategory.INTERNAL,
                ErrorSeverity.LOW
            );

            ErrorManager.logError(highError);
            ErrorManager.logError(lowError);

            const highErrors = ErrorManager.getErrorsBySeverity(ErrorSeverity.HIGH);
            const lowErrors = ErrorManager.getErrorsBySeverity(ErrorSeverity.LOW);

            expect(highErrors).toHaveLength(1);
            expect(lowErrors).toHaveLength(1);
        });

        it('should filter recent errors', () => {
            const oldError = new ClaudeAutopilotError(
                'OLD',
                'Old error',
                ErrorCategory.INTERNAL
            );
            
            // Manually set old timestamp
            ErrorManager.logError(oldError);
            const history = ErrorManager.getErrorHistory();
            history[0].timestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago

            const newError = new Error('New error');
            ErrorManager.logError(newError);

            const recentErrors = ErrorManager.getRecentErrors(24); // Last 24 hours
            expect(recentErrors).toHaveLength(1);
            expect(recentErrors[0].message).toBe('New error');
        });

        it('should clear error history', () => {
            ErrorManager.logError(new Error('Test error'));
            expect(ErrorManager.getErrorHistory()).toHaveLength(1);

            ErrorManager.clearErrorHistory();
            expect(ErrorManager.getErrorHistory()).toHaveLength(0);
        });
    });
});

describe('CommonErrors', () => {
    it('should create CLAUDE_NOT_INSTALLED error', () => {
        const error = CommonErrors.CLAUDE_NOT_INSTALLED({ version: 'test' });
        
        expect(error.details.code).toBe('CLAUDE_NOT_INSTALLED');
        expect(error.details.category).toBe(ErrorCategory.DEPENDENCY);
        expect(error.details.severity).toBe(ErrorSeverity.CRITICAL);
        expect(error.details.context).toEqual({ version: 'test' });
        expect(error.details.suggestedActions).toContain('Install Claude CLI from https://www.anthropic.com/claude-code');
    });

    it('should create QUEUE_SIZE_EXCEEDED error', () => {
        const error = CommonErrors.QUEUE_SIZE_EXCEEDED(150, 100);
        
        expect(error.details.code).toBe('QUEUE_SIZE_EXCEEDED');
        expect(error.details.category).toBe(ErrorCategory.QUEUE_MANAGEMENT);
        expect(error.details.context).toEqual({ currentSize: 150, maxSize: 100 });
        expect(error.details.suggestedActions).toContain('Process or remove some messages from the queue');
    });

    it('should create INVALID_CONFIGURATION error', () => {
        const error = CommonErrors.INVALID_CONFIGURATION('testSetting', 'invalid', 'string');
        
        expect(error.details.code).toBe('INVALID_CONFIGURATION');
        expect(error.details.category).toBe(ErrorCategory.CONFIGURATION);
        expect(error.details.context).toEqual({ 
            setting: 'testSetting', 
            value: 'invalid', 
            expected: 'string' 
        });
    });

    it('should create SCRIPT_EXECUTION_FAILED error', () => {
        const error = CommonErrors.SCRIPT_EXECUTION_FAILED('test-script', 1, 'Error output');
        
        expect(error.details.code).toBe('SCRIPT_EXECUTION_FAILED');
        expect(error.details.category).toBe(ErrorCategory.SCRIPT_EXECUTION);
        expect(error.details.context).toEqual({ 
            scriptName: 'test-script', 
            exitCode: 1, 
            stderr: 'Error output' 
        });
    });

    it('should create FILE_ACCESS_DENIED error', () => {
        const error = CommonErrors.FILE_ACCESS_DENIED('/test/path', 'read');
        
        expect(error.details.code).toBe('FILE_ACCESS_DENIED');
        expect(error.details.category).toBe(ErrorCategory.FILE_SYSTEM);
        expect(error.details.context).toEqual({ 
            filePath: '/test/path', 
            operation: 'read' 
        });
    });
});