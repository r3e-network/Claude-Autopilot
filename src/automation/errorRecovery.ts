import * as vscode from 'vscode';
import { debugLog } from '../utils/logging';
import { ContextManager } from './contextManager';

interface ErrorPattern {
    pattern: RegExp;
    type: ErrorType;
    solution: string;
    contextFiles?: string[];
    priority: number;
}

enum ErrorType {
    ImportError = 'import_error',
    TypeScript = 'typescript_error',
    TestFailure = 'test_failure',
    BuildError = 'build_error',
    LintError = 'lint_error',
    RuntimeError = 'runtime_error',
    DependencyError = 'dependency_error',
    ApiLimit = 'api_limit',
    Unknown = 'unknown'
}

interface RecoveryStrategy {
    type: ErrorType;
    action: () => Promise<boolean>;
    description: string;
}

export class ErrorRecoverySystem {
    // Configuration constants
    private readonly RETRY_DELAY_MS = 5000;
    private readonly SHORT_DELAY_MS = 3000;
    private readonly API_LIMIT_DELAY_MS = 3600000; // 1 hour
    
    private errorPatterns: ErrorPattern[] = [
        // TypeScript errors
        {
            pattern: /Cannot find module '(.+?)'/,
            type: ErrorType.ImportError,
            solution: 'Check if the module exists or needs to be installed. Verify the import path.',
            priority: 1
        },
        {
            pattern: /Property '(.+?)' does not exist on type/,
            type: ErrorType.TypeScript,
            solution: 'Add the missing property to the type definition or interface.',
            priority: 2
        },
        {
            pattern: /Argument of type '(.+?)' is not assignable to parameter of type '(.+?)'/,
            type: ErrorType.TypeScript,
            solution: 'Fix the type mismatch by updating the argument or parameter type.',
            priority: 2
        },
        
        // Test failures
        {
            pattern: /Expected (.+?) to (equal|be) (.+?)/,
            type: ErrorType.TestFailure,
            solution: 'Update the test expectation or fix the implementation to match.',
            priority: 3
        },
        {
            pattern: /Test suite failed to run/,
            type: ErrorType.TestFailure,
            solution: 'Check test setup and dependencies. Ensure all imports are correct.',
            priority: 1
        },
        
        // Build errors
        {
            pattern: /Module not found: Error: Can't resolve '(.+?)'/,
            type: ErrorType.BuildError,
            solution: 'Install missing dependency or fix import path.',
            priority: 1
        },
        {
            pattern: /SyntaxError: (.+)/,
            type: ErrorType.BuildError,
            solution: 'Fix syntax error in the code.',
            priority: 1
        },
        
        // Lint errors
        {
            pattern: /(.+?) is defined but never used/,
            type: ErrorType.LintError,
            solution: 'Remove unused variable or use it in the code.',
            priority: 4
        },
        {
            pattern: /Missing semicolon/,
            type: ErrorType.LintError,
            solution: 'Add missing semicolon.',
            priority: 5
        },
        
        // Claude API limits
        {
            pattern: /usage limits|rate limit|try again later/i,
            type: ErrorType.ApiLimit,
            solution: 'Wait for API limits to reset or reduce request frequency.',
            priority: 0
        }
    ];
    
    private errorHistory: Map<string, number> = new Map();
    private readonly MAX_RETRIES = 3;
    
    constructor(
        private contextManager: ContextManager,
        private workspacePath: string
    ) {}
    
    /**
     * Analyze error and determine recovery strategy
     */
    async analyzeError(error: string, context?: any): Promise<RecoveryStrategy | null> {
        debugLog(`Analyzing error: ${error.substring(0, 200)}...`);
        
        // Find matching error pattern
        const match = this.findErrorPattern(error);
        if (!match) {
            return this.handleUnknownError(error);
        }
        
        // Check retry count
        const errorKey = `${match.type}:${error.substring(0, 50)}`;
        const retryCount = this.errorHistory.get(errorKey) || 0;
        
        if (retryCount >= this.MAX_RETRIES) {
            debugLog(`Max retries reached for error type: ${match.type}`);
            return null;
        }
        
        this.errorHistory.set(errorKey, retryCount + 1);
        
        // Generate recovery strategy
        return this.generateRecoveryStrategy(match, error, context);
    }
    
    /**
     * Execute recovery strategy
     */
    async executeRecovery(strategy: RecoveryStrategy): Promise<boolean> {
        debugLog(`Executing recovery strategy: ${strategy.description}`);
        
        try {
            const success = await strategy.action();
            
            if (success) {
                vscode.window.showInformationMessage(`✅ Recovery successful: ${strategy.description}`);
            } else {
                vscode.window.showWarningMessage(`⚠️ Recovery failed: ${strategy.description}`);
            }
            
            return success;
        } catch (error) {
            debugLog(`Recovery execution failed: ${error}`);
            return false;
        }
    }
    
    /**
     * Find matching error pattern
     */
    private findErrorPattern(error: string): ErrorPattern | null {
        // Sort by priority
        const sorted = [...this.errorPatterns].sort((a, b) => a.priority - b.priority);
        
        for (const pattern of sorted) {
            if (pattern.pattern.test(error)) {
                return pattern;
            }
        }
        
        return null;
    }
    
    /**
     * Generate recovery strategy based on error type
     */
    private async generateRecoveryStrategy(
        pattern: ErrorPattern,
        error: string,
        context?: any
    ): Promise<RecoveryStrategy> {
        switch (pattern.type) {
            case ErrorType.ImportError:
                return this.createImportErrorStrategy(error, pattern);
                
            case ErrorType.TypeScript:
                return this.createTypeScriptErrorStrategy(error, pattern);
                
            case ErrorType.TestFailure:
                return this.createTestFailureStrategy(error, pattern);
                
            case ErrorType.BuildError:
                return this.createBuildErrorStrategy(error, pattern);
                
            case ErrorType.LintError:
                return this.createLintErrorStrategy(error, pattern);
                
            case ErrorType.ApiLimit:
                return this.createApiLimitStrategy();
                
            default:
                return this.createGenericStrategy(pattern);
        }
    }
    
    /**
     * Create import error recovery strategy
     */
    private createImportErrorStrategy(error: string, pattern: ErrorPattern): RecoveryStrategy {
        const match = error.match(pattern.pattern);
        const moduleName = match ? match[1] : 'unknown';
        
        return {
            type: ErrorType.ImportError,
            description: `Fix import error for module: ${moduleName}`,
            action: async () => {
                // Try to install missing module
                if (!moduleName.startsWith('.') && !moduleName.startsWith('/')) {
                    const terminal = vscode.window.createTerminal('Install Dependencies');
                    terminal.show();
                    terminal.sendText(`npm install ${moduleName}`);
                    
                    // Wait for installation
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
                    
                    return true;
                }
                
                // For local imports, suggest creating the file
                const suggestion = `Create missing file: ${moduleName}`;
                vscode.window.showInformationMessage(suggestion);
                
                return false;
            }
        };
    }
    
    /**
     * Create TypeScript error recovery strategy
     */
    private createTypeScriptErrorStrategy(error: string, pattern: ErrorPattern): RecoveryStrategy {
        return {
            type: ErrorType.TypeScript,
            description: 'Fix TypeScript type errors',
            action: async () => {
                // Generate fix instructions for Claude
                const fixPrompt = `Fix the following TypeScript error:\n${error}\n\n${pattern.solution}`;
                
                // Add to Claude queue
                const { addMessageToQueueFromWebview } = await import('../queue');
                addMessageToQueueFromWebview(fixPrompt);
                
                return true;
            }
        };
    }
    
    /**
     * Create test failure recovery strategy
     */
    private createTestFailureStrategy(error: string, pattern: ErrorPattern): RecoveryStrategy {
        return {
            type: ErrorType.TestFailure,
            description: 'Fix failing tests',
            action: async () => {
                // Extract test details
                const testInfo = this.extractTestInfo(error);
                
                // Generate fix prompt
                const fixPrompt = `Fix the failing test:\n${error}\n\nTest file: ${testInfo.file}\nTest name: ${testInfo.name}\n\n${pattern.solution}`;
                
                // Add to Claude queue
                const { addMessageToQueueFromWebview } = await import('../queue');
                addMessageToQueueFromWebview(fixPrompt);
                
                return true;
            }
        };
    }
    
    /**
     * Create build error recovery strategy
     */
    private createBuildErrorStrategy(error: string, pattern: ErrorPattern): RecoveryStrategy {
        return {
            type: ErrorType.BuildError,
            description: 'Fix build errors',
            action: async () => {
                // Try auto-fix for common issues
                if (error.includes('Module not found')) {
                    // Try installing dependencies
                    const terminal = vscode.window.createTerminal('Fix Build');
                    terminal.show();
                    terminal.sendText('npm install');
                    
                    await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
                    
                    // Try building again
                    terminal.sendText('npm run build');
                    
                    return true;
                }
                
                // For other errors, request Claude fix
                const fixPrompt = `Fix the build error:\n${error}\n\n${pattern.solution}`;
                const { addMessageToQueueFromWebview } = await import('../queue');
                addMessageToQueueFromWebview(fixPrompt);
                
                return true;
            }
        };
    }
    
    /**
     * Create lint error recovery strategy
     */
    private createLintErrorStrategy(error: string, pattern: ErrorPattern): RecoveryStrategy {
        return {
            type: ErrorType.LintError,
            description: 'Auto-fix lint errors',
            action: async () => {
                // Try auto-fix
                const terminal = vscode.window.createTerminal('Fix Lint');
                terminal.show();
                terminal.sendText('npm run lint -- --fix');
                
                await new Promise(resolve => setTimeout(resolve, this.SHORT_DELAY_MS));
                
                return true;
            }
        };
    }
    
    /**
     * Create API limit recovery strategy
     */
    private createApiLimitStrategy(): RecoveryStrategy {
        return {
            type: ErrorType.ApiLimit,
            description: 'Wait for API limits to reset',
            action: async () => {
                const waitTime = this.API_LIMIT_DELAY_MS;
                const waitMinutes = Math.round(waitTime / 60000);
                
                vscode.window.showInformationMessage(
                    `API limit reached. Waiting ${waitMinutes} minutes before retrying...`
                );
                
                // Schedule retry
                setTimeout(() => {
                    vscode.commands.executeCommand('claude-autopilot.start');
                }, waitTime);
                
                return true;
            }
        };
    }
    
    /**
     * Create generic recovery strategy
     */
    private createGenericStrategy(pattern: ErrorPattern): RecoveryStrategy {
        return {
            type: pattern.type,
            description: pattern.solution,
            action: async () => {
                const fixPrompt = `Fix the following error:\n${pattern.solution}`;
                const { addMessageToQueueFromWebview } = await import('../queue');
                addMessageToQueueFromWebview(fixPrompt);
                
                return true;
            }
        };
    }
    
    /**
     * Handle unknown errors
     */
    private handleUnknownError(error: string): RecoveryStrategy {
        return {
            type: ErrorType.Unknown,
            description: 'Handle unknown error',
            action: async () => {
                // Log for analysis
                debugLog(`Unknown error: ${error}`);
                
                // Try generic fix
                const fixPrompt = `Fix the following error:\n${error}\n\nPlease analyze the error and provide a solution.`;
                const { addMessageToQueueFromWebview } = await import('../queue');
                addMessageToQueueFromWebview(fixPrompt);
                
                return true;
            }
        };
    }
    
    /**
     * Extract test information from error
     */
    private extractTestInfo(error: string): { file: string; name: string } {
        const fileMatch = error.match(/at\s+(.+?):\d+:\d+/);
        const nameMatch = error.match(/(?:test|it|describe)\(['"](.+?)['"]/);
        
        return {
            file: fileMatch ? fileMatch[1] : 'unknown',
            name: nameMatch ? nameMatch[1] : 'unknown'
        };
    }
    
    /**
     * Clear error history
     */
    clearHistory() {
        this.errorHistory.clear();
    }
    
    /**
     * Get error statistics
     */
    getStatistics() {
        const stats = new Map<ErrorType, number>();
        
        for (const [key, count] of this.errorHistory) {
            const type = key.split(':')[0] as ErrorType;
            stats.set(type, (stats.get(type) || 0) + count);
        }
        
        return stats;
    }
}