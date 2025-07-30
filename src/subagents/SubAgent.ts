import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
    SubAgentConfig, 
    SubAgentExecutor, 
    SubAgentRequest, 
    SubAgentResponse, 
    SubAgentCapability,
    SubAgentContext,
    SubAgentAction 
} from './types';
import { ScriptResult } from '../scripts';
import { debugLog } from '../utils/logging';

const execAsync = promisify(exec);

// Message handler to avoid circular dependency
let messageHandler: ((message: string) => void) | null = null;

export function setSubAgentMessageHandler(handler: (message: string) => void) {
    messageHandler = handler;
}

export abstract class SubAgent implements SubAgentExecutor {
    protected config: SubAgentConfig;
    protected workspacePath: string;

    constructor(config: SubAgentConfig, workspacePath: string) {
        this.config = config;
        this.workspacePath = workspacePath;
    }

    get id(): string {
        return this.config.id;
    }

    getCapabilities(): SubAgentCapability[] {
        return this.config.capabilities;
    }

    async runCheck(): Promise<ScriptResult> {
        if (!this.config.checkScript) {
            return {
                passed: true,
                errors: [],
                warnings: ['No check script configured for this sub-agent']
            };
        }

        try {
            // Make sure script is executable
            await execAsync(`chmod +x "${this.config.checkScript}"`, {
                cwd: this.workspacePath
            });
            
            // Execute the shell script
            const { stdout } = await execAsync(`bash "${this.config.checkScript}"`, {
                cwd: this.workspacePath,
                timeout: 60000,
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });
            
            // Parse JSON output
            try {
                const result = JSON.parse(stdout);
                // Validate result structure
                if (typeof result.passed !== 'boolean') {
                    throw new Error('Invalid script output: missing "passed" field');
                }
                if (!Array.isArray(result.errors)) {
                    result.errors = [];
                }
                return result;
            } catch (parseError) {
                debugLog(`Failed to parse script output: ${parseError}`);
                return {
                    passed: false,
                    errors: [`Script output is not valid JSON: ${parseError}`]
                };
            }
        } catch (error: any) {
            // Check if script produced output before failing
            if (error.stdout) {
                try {
                    const result = JSON.parse(error.stdout);
                    if (typeof result.passed === 'boolean') {
                        return result;
                    }
                } catch {
                    // Fall through to error handling
                }
            }
            
            debugLog(`Script execution error: ${error.message}`);
            return {
                passed: false,
                errors: [`Script execution failed: ${error.message}`]
            };
        }
    }

    async execute(request: SubAgentRequest): Promise<SubAgentResponse> {
        debugLog(`🤖 SubAgent ${this.config.name} executing action: ${request.action}`);
        
        try {
            // Build the Claude message with sub-agent context
            const message = this.buildClaudeMessage(request);
            
            // Add to Claude queue
            if (messageHandler) {
                messageHandler(message);
            } else {
                debugLog('Warning: No message handler set for SubAgent');
            }
            
            return {
                success: true,
                message: `${this.config.name} is analyzing and will provide recommendations`,
                confidence: request.confidence || 'medium',
                suggestedActions: this.getSuggestedNextActions(request.action)
            };
        } catch (error) {
            debugLog(`❌ SubAgent ${this.config.name} error: ${error}`);
            return {
                success: false,
                message: `Error executing ${this.config.name}: ${error instanceof Error ? error.message : String(error)}`,
                confidence: 'low'
            };
        }
    }

    protected buildClaudeMessage(request: SubAgentRequest): string {
        const parts: string[] = [];
        
        // Add sub-agent context
        parts.push(`[${this.config.name} Sub-Agent Analysis]`);
        parts.push(`Action: ${request.action}`);
        parts.push('');
        
        // Add system prompt context
        parts.push('Context:');
        parts.push(this.config.systemPrompt);
        parts.push('');
        
        // Add script results if available
        if (request.context.scriptResult) {
            parts.push('Check Results:');
            if (request.context.scriptResult.passed) {
                parts.push('✅ All checks passed');
            } else {
                parts.push('❌ Issues found:');
                request.context.scriptResult.errors.forEach(error => {
                    parts.push(`- ${error}`);
                });
            }
            parts.push('');
        }
        
        // Add the specific prompt
        parts.push('Task:');
        parts.push(request.prompt);
        
        // Add iteration context
        if (request.context.iterationCount > 0) {
            parts.push('');
            parts.push(`Note: This is iteration ${request.context.iterationCount} of ${request.context.maxIterations}`);
        }
        
        return parts.join('\n');
    }

    protected getSuggestedNextActions(currentAction: SubAgentAction): SubAgentAction[] {
        // Default implementation - subclasses can override
        const actionFlow: Record<SubAgentAction, SubAgentAction[]> = {
            'analyze': ['fix', 'suggest', 'refactor'],
            'fix': ['validate', 'test', 'document'],
            'suggest': ['fix', 'refactor', 'optimize'],
            'refactor': ['validate', 'test', 'document'],
            'generate': ['validate', 'test'],
            'validate': ['fix', 'optimize'],
            'optimize': ['validate', 'test'],
            'secure': ['validate', 'test'],
            'test': ['document'],
            'document': []
        };
        
        return actionFlow[currentAction] || [];
    }

    // Abstract method that subclasses must implement
    abstract analyzeResults(context: SubAgentContext): Promise<string>;
}