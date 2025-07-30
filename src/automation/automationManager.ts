import * as vscode from 'vscode';
import { ContextManager } from './contextManager';
import { ErrorRecoverySystem } from './errorRecovery';
import { SelfHealingSystem } from './selfHealing';
import { CommandOrchestrator } from './commandOrchestrator';
import { debugLog } from '../utils/logging';
import { addMessageToQueueFromWebview } from '../queue';
import { ScriptRunner } from '../scripts/index';

export class AutomationManager {
    private contextManager: ContextManager;
    private errorRecovery: ErrorRecoverySystem;
    private selfHealing: SelfHealingSystem;
    private scriptRunner: ScriptRunner;
    private _commandOrchestrator: CommandOrchestrator | null = null;
    private isEnabled: boolean = true;
    
    constructor(private workspacePath: string) {
        this.contextManager = new ContextManager(workspacePath);
        this.errorRecovery = new ErrorRecoverySystem(this.contextManager, workspacePath);
        this.selfHealing = new SelfHealingSystem(workspacePath);
        this.scriptRunner = new ScriptRunner(workspacePath);
    }
    
    /**
     * Initialize automation features
     */
    async initialize() {
        try {
            debugLog('Initializing automation manager...');
            await this.scriptRunner.initialize();
            await this.scriptRunner.loadUserScripts();
            
            // Initialize command orchestrator if context system is available
            const contextProvider = (global as any).contextProvider;
            if (contextProvider) {
                const taskManager = contextProvider.taskManager;
                this._commandOrchestrator = new CommandOrchestrator(
                    contextProvider,
                    taskManager,
                    this.workspacePath
                );
                debugLog('Command orchestrator initialized');
            }
        } catch (error) {
            debugLog(`Failed to initialize automation manager: ${error}`);
            vscode.window.showErrorMessage(`Automation initialization failed: ${error instanceof Error ? error.message : String(error)}`);
            // Continue without automation rather than blocking the extension
            this.isEnabled = false;
        }
    }
    
    /**
     * Process message with enhanced automation
     */
    async processMessage(message: string, currentFile?: string): Promise<string> {
        if (!this.isEnabled) {
            return message;
        }
        
        try {
            debugLog('Processing message with automation...');
            
            // 1. Get relevant context files
            const relevantFiles = await this.contextManager.getRelevantFiles(
                currentFile || '',
                message
            );
            
            // 2. Track file modifications
            if (currentFile) {
                this.contextManager.trackFileModification(currentFile);
            }
            
            // 3. Generate enhanced prompt with context
            const enhancedPrompt = await this.contextManager.generateContextPrompt(
                relevantFiles,
                message
            );
            
            // 4. Add automation instructions
            const automatedPrompt = this.addAutomationInstructions(enhancedPrompt);
            
            debugLog(`Enhanced message with ${relevantFiles.length} context files`);
            
            return automatedPrompt;
        } catch (error) {
            debugLog(`Error processing message with automation: ${error}`);
            // Fallback to original message if automation fails
            return message;
        }
    }
    
    /**
     * Handle errors with recovery system
     */
    async handleError(error: string, context?: any): Promise<boolean> {
        try {
            debugLog('Handling error with automation...');
            
            // 1. Try self-healing first
            const healed = await this.selfHealing.diagnoseAndHeal(error);
            if (healed) {
                return true;
            }
            
            // 2. Use error recovery system
            const strategy = await this.errorRecovery.analyzeError(error, context);
            if (strategy) {
                return await this.errorRecovery.executeRecovery(strategy);
            }
            
            return false;
        } catch (recoveryError) {
            debugLog(`Error during error recovery: ${recoveryError}`);
            // Don't throw to avoid cascading failures
            return false;
        }
    }
    
    /**
     * Run comprehensive validation
     */
    async runValidation(): Promise<void> {
        try {
            debugLog('Running comprehensive validation...');
            
            // Run all enabled scripts
            const { allPassed, results } = await this.scriptRunner.runChecks();
            
            if (!allPassed) {
                // Generate fix instructions
                const failedScripts = Array.from(results.entries())
                    .filter(([_, result]) => !result.passed);
                
                const fixPrompt = this.generateValidationFixPrompt(failedScripts);
                addMessageToQueueFromWebview(fixPrompt);
            }
        } catch (error) {
            debugLog(`Validation error: ${error}`);
            vscode.window.showErrorMessage(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Add automation instructions to prompt
     */
    private addAutomationInstructions(prompt: string): string {
        const instructions = `
=== Automation Instructions ===
1. Ensure all code is production-ready with no TODOs or placeholders
2. Include comprehensive error handling
3. Add appropriate documentation for all public functions/classes
4. Follow the existing code style and conventions
5. Write tests for new functionality
6. Ensure changes maintain backward compatibility
7. Optimize for performance where applicable
8. Consider security implications of changes

${prompt}`;
        
        return instructions;
    }
    
    /**
     * Generate fix prompt for validation failures
     */
    private generateValidationFixPrompt(failures: Array<[string, any]>): string {
        let prompt = 'Please fix the following validation issues:\n\n';
        
        for (const [scriptId, result] of failures) {
            prompt += `**${scriptId}**:\n`;
            result.errors.forEach((error: string) => {
                prompt += `- ${error}\n`;
            });
            prompt += '\n';
        }
        
        prompt += '\nEnsure all fixes are complete and the code passes all validation checks.';
        
        return prompt;
    }
    
    /**
     * Enable/disable automation
     */
    setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        debugLog(`Automation ${enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Execute high-level command with intelligent task decomposition
     */
    async executeCommand(command: string): Promise<string> {
        if (!this._commandOrchestrator) {
            return 'Command orchestrator not initialized. Please ensure the context system is running.';
        }
        
        try {
            debugLog(`Executing high-level command: ${command}`);
            
            // Execute command through orchestrator
            const result = await this._commandOrchestrator.executeCommand(command);
            
            if (result.success) {
                // Add follow-up message to queue if needed
                if (result.taskId) {
                    const followUp = `Task created: ${result.taskId}\n\n${result.message}`;
                    await addMessageToQueueFromWebview(followUp);
                }
                
                return result.message;
            } else {
                return `Command execution failed: ${result.message}`;
            }
        } catch (error) {
            debugLog(`Command execution error: ${error}`);
            return `Error executing command: ${error instanceof Error ? error.message : String(error)}`;
        }
    }
    
    /**
     * Get command suggestions based on current context
     */
    async getCommandSuggestions(): Promise<string[]> {
        if (!this._commandOrchestrator) {
            return [];
        }
        
        return await this._commandOrchestrator.getCommandSuggestions();
    }
    
    /**
     * Get active workflow status
     */
    getActiveWorkflows() {
        if (!this._commandOrchestrator) {
            return [];
        }
        
        return this._commandOrchestrator.getActiveWorkflows();
    }
    
    /**
     * Get automation statistics
     */
    getStatistics() {
        return {
            errorRecoveryStats: this.errorRecovery.getStatistics(),
            contextFilesTracked: this.contextManager['recentFiles'].length,
            scriptsAvailable: this.scriptRunner['config'].scripts.length,
            activeWorkflows: this._commandOrchestrator ? this._commandOrchestrator.getActiveWorkflows().length : 0
        };
    }
    
    /**
     * Get the command orchestrator instance
     */
    get commandOrchestrator(): CommandOrchestrator | null {
        return this._commandOrchestrator;
    }
}