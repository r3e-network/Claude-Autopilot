import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { debugLog } from '../utils/logging';
import { MessageItem } from '../core/types';
import { addMessageToQueueFromWebview } from '../queue';
import { BUILTIN_SCRIPTS, DEFAULT_CONFIG, SCRIPTS_README } from './builtinScripts';

const execAsync = promisify(exec);

export interface ScriptConfig {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    predefined: boolean;
    path?: string;
    command?: string;
    language?: string[];
    checkFunction?: (workspacePath: string) => Promise<ScriptResult>;
}

export interface ScriptResult {
    passed: boolean;
    errors: string[];
    warnings?: string[];
    fixInstructions?: string;
}

export interface ScriptRunnerConfig {
    scripts: ScriptConfig[];
    maxIterations: number;
    continueOnError: boolean;
}

const AUTOCLAUDE_FOLDER = '.autoclaude';
const SCRIPTS_FOLDER = 'scripts';
const CONFIG_FILE = 'config.json';

export class ScriptRunner {
    private workspacePath: string;
    private config: ScriptRunnerConfig;
    private iteration: number = 0;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.config = {
            scripts: [],
            maxIterations: 5,
            continueOnError: false
        };
    }

    async initialize(): Promise<void> {
        await this.ensureAutopilotFolder();
        await this.loadConfig();
        await this.copyPredefinedScripts();
    }

    private async ensureAutopilotFolder(): Promise<void> {
        const autopilotPath = path.join(this.workspacePath, AUTOCLAUDE_FOLDER);
        const scriptsPath = path.join(autopilotPath, SCRIPTS_FOLDER);

        if (!fs.existsSync(autopilotPath)) {
            fs.mkdirSync(autopilotPath, { recursive: true });
            debugLog(`Created ${AUTOCLAUDE_FOLDER} folder`);
        }

        if (!fs.existsSync(scriptsPath)) {
            fs.mkdirSync(scriptsPath, { recursive: true });
            debugLog(`Created ${SCRIPTS_FOLDER} folder`);
        }
    }

    private async loadConfig(): Promise<void> {
        const configPath = path.join(this.workspacePath, AUTOCLAUDE_FOLDER, CONFIG_FILE);
        
        if (fs.existsSync(configPath)) {
            try {
                const configData = fs.readFileSync(configPath, 'utf8');
                const savedConfig = JSON.parse(configData);
                this.config = { ...this.config, ...savedConfig };
                debugLog('Loaded script runner configuration');
            } catch (error) {
                debugLog(`Error loading config: ${error}`);
                await this.createDefaultConfig();
            }
        } else {
            await this.createDefaultConfig();
        }
    }

    private async createDefaultConfig(): Promise<void> {
        this.config.scripts = this.getPredefinedScripts();
        await this.saveConfig();
    }

    private async saveConfig(): Promise<void> {
        const configPath = path.join(this.workspacePath, AUTOCLAUDE_FOLDER, CONFIG_FILE);
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
        debugLog('Saved script runner configuration');
    }

    private getPredefinedScripts(): ScriptConfig[] {
        return [
            {
                id: 'production-readiness',
                name: 'Production Readiness Check',
                description: 'Checks for TODO, FIXME, placeholders, and incomplete implementations',
                enabled: true,
                predefined: true,
                path: path.join(this.workspacePath, AUTOCLAUDE_FOLDER, SCRIPTS_FOLDER, 'production-readiness.js')
            },
            {
                id: 'build-check',
                name: 'Build Check',
                description: 'Ensures the project can build successfully',
                enabled: true,
                predefined: true,
                path: path.join(this.workspacePath, AUTOCLAUDE_FOLDER, SCRIPTS_FOLDER, 'build-check.js')
            },
            {
                id: 'test-check',
                name: 'Test Check',
                description: 'Runs all tests and ensures they pass',
                enabled: true,
                predefined: true,
                path: path.join(this.workspacePath, AUTOCLAUDE_FOLDER, SCRIPTS_FOLDER, 'test-check.js')
            },
            {
                id: 'format-check',
                name: 'Format Check',
                description: 'Ensures code is properly formatted',
                enabled: true,
                predefined: true,
                path: path.join(this.workspacePath, AUTOCLAUDE_FOLDER, SCRIPTS_FOLDER, 'format-check.js')
            },
            {
                id: 'github-actions',
                name: 'GitHub Actions Check',
                description: 'Validates GitHub Actions workflows',
                enabled: true,
                predefined: true,
                path: path.join(this.workspacePath, AUTOCLAUDE_FOLDER, SCRIPTS_FOLDER, 'github-actions.js')
            }
        ];
    }

    private async copyPredefinedScripts(): Promise<void> {
        const scriptsPath = path.join(this.workspacePath, AUTOCLAUDE_FOLDER, SCRIPTS_FOLDER);
        
        // Write all built-in scripts to the .autoclaude/scripts folder
        for (const [filename, content] of Object.entries(BUILTIN_SCRIPTS)) {
            const scriptPath = path.join(scriptsPath, filename);
            
            if (!fs.existsSync(scriptPath)) {
                fs.writeFileSync(scriptPath, content, { mode: 0o755 });
                debugLog(`Created built-in script: ${filename}`);
            }
        }
        
        // Create README if it doesn't exist
        const readmePath = path.join(scriptsPath, 'README.md');
        if (!fs.existsSync(readmePath)) {
            fs.writeFileSync(readmePath, SCRIPTS_README);
            debugLog('Created scripts README.md');
        }
        
        // Create default config if it doesn't exist
        const configPath = path.join(this.workspacePath, AUTOCLAUDE_FOLDER, CONFIG_FILE);
        if (!fs.existsSync(configPath)) {
            fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
            debugLog('Created default config.json');
        }
    }



    private async runScript(scriptPath: string): Promise<ScriptResult> {
        try {
            const { stdout } = await execAsync(`node "${scriptPath}"`, {
                cwd: this.workspacePath,
                timeout: 60000
            });
            
            return JSON.parse(stdout);
        } catch (error: any) {
            if (error.stdout) {
                try {
                    return JSON.parse(error.stdout);
                } catch {
                    // Fall through to error handling
                }
            }
            
            return {
                passed: false,
                errors: [`Script execution failed: ${error.message}`]
            };
        }
    }

    async loadUserScripts(): Promise<void> {
        const scriptsPath = path.join(this.workspacePath, AUTOCLAUDE_FOLDER, SCRIPTS_FOLDER);
        const files = fs.readdirSync(scriptsPath).filter(f => f.endsWith('.js'));
        
        for (const file of files) {
            const scriptId = path.basename(file, '.js');
            
            // Skip if it's a predefined script already in config
            if (this.config.scripts.find(s => s.id === scriptId && s.predefined)) {
                continue;
            }
            
            // Check if user script already exists in config
            if (!this.config.scripts.find(s => s.id === scriptId)) {
                this.config.scripts.push({
                    id: scriptId,
                    name: scriptId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    description: `User-defined script: ${file}`,
                    enabled: false,
                    predefined: false,
                    path: path.join(scriptsPath, file)
                });
            }
        }
        
        await this.saveConfig();
    }

    async runSingleCheck(scriptId: string): Promise<ScriptResult | null> {
        const script = this.config.scripts.find(s => s.id === scriptId);
        if (!script) {
            return null;
        }
        
        debugLog(`Running single script: ${script.name}`);
        
        let result: ScriptResult;
        if (script.path) {
            result = await this.runScript(script.path);
        } else {
            result = {
                passed: false,
                errors: ['Script has no implementation']
            };
        }
        
        // Log results
        if (result.passed) {
            debugLog(`✅ ${script.name}: Passed`);
        } else {
            debugLog(`❌ ${script.name}: Failed`);
            debugLog(`   Errors: ${result.errors.join(', ')}`);
        }
        
        return result;
    }

    async runChecks(stopOnFailure: boolean = false): Promise<{ allPassed: boolean; results: Map<string, ScriptResult> }> {
        const results = new Map<string, ScriptResult>();
        let allPassed = true;
        const MAX_ERROR_LINES = 10;
        const MAX_ERROR_LENGTH = 500;
        
        for (const script of this.config.scripts.filter(s => s.enabled)) {
            debugLog(`Running script: ${script.name}`);
            
            let result: ScriptResult;
            if (script.path) {
                result = await this.runScript(script.path);
            } else {
                result = {
                    passed: false,
                    errors: ['Script has no implementation']
                };
            }
            
            // Limit error output
            if (!result.passed && result.errors.length > 0) {
                let limitedErrors = result.errors;
                if (result.errors.length > MAX_ERROR_LINES) {
                    limitedErrors = result.errors.slice(0, MAX_ERROR_LINES);
                    limitedErrors.push(`... and ${result.errors.length - MAX_ERROR_LINES} more errors`);
                }
                
                // Further limit each error line length
                limitedErrors = limitedErrors.map(error => {
                    if (error.length > MAX_ERROR_LENGTH) {
                        return error.substring(0, MAX_ERROR_LENGTH) + '...';
                    }
                    return error;
                });
                
                // Store limited errors in result
                result = { ...result, errors: limitedErrors };
            }
            
            results.set(script.id, result);
            if (!result.passed) {
                allPassed = false;
            }
            
            // Log results
            if (result.passed) {
                debugLog(`✅ ${script.name}: Passed`);
            } else {
                debugLog(`❌ ${script.name}: Failed`);
                debugLog(`   First ${Math.min(MAX_ERROR_LINES, result.errors.length)} errors:`);
                result.errors.slice(0, 5).forEach(error => {
                    debugLog(`   - ${error}`);
                });
                if (result.errors.length > 5) {
                    debugLog(`   ... ${result.errors.length - 5} more errors`);
                }
                
                // Stop on first failure if requested
                if (stopOnFailure) {
                    debugLog(`⛔ Stopping checks on first failure`);
                    break;
                }
            }
        }
        
        return { allPassed, results };
    }

    async runCheckLoop(forceAnalysis: boolean = false): Promise<void> {
        this.iteration = 0;
        
        // Initial check
        debugLog(`\n=== Initial Script Check ===`);
        const initialCheck = await this.runChecks();
        
        if (initialCheck.allPassed && !forceAnalysis) {
            const analyze = await vscode.window.showInformationMessage(
                'All checks already pass! Would you like Claude to analyze for improvements anyway?',
                'Yes, Analyze',
                'No, Exit'
            );
            
            if (analyze !== 'Yes, Analyze') {
                return;
            }
            
            // Send passing results to Claude for improvement analysis
            const passingScripts = Array.from(initialCheck.results.entries())
                .map(([scriptId, _]) => {
                    const script = this.config.scripts.find(s => s.id === scriptId);
                    return script?.name || scriptId;
                });
            
            const message = `All script checks are passing:\n${passingScripts.map(s => `✅ ${s}`).join('\n')}\n\nPlease analyze the codebase to see if there are any improvements, optimizations, or best practices that could be applied even though all checks pass.`;
            
            addMessageToQueueFromWebview(message);
            debugLog('Sent passing results to Claude for improvement analysis');
            vscode.window.showInformationMessage('Sent to Claude for improvement analysis');
            return;
        }
        
        while (this.iteration < this.config.maxIterations) {
            this.iteration++;
            debugLog(`\n=== Script Check Iteration ${this.iteration}/${this.config.maxIterations} ===`);
            
            // Generate fix instructions
            const fixInstructions = this.generateFixInstructions(initialCheck.results);
            
            // Add message to Claude queue to fix issues
            const message = `Please fix the following issues found by automated checks (Iteration ${this.iteration}/${this.config.maxIterations}):\n\n${fixInstructions}\n\nIMPORTANT: Make sure all changes are complete and production-ready. Fix all issues mentioned above.`;
            
            try {
                addMessageToQueueFromWebview(message);
                debugLog('Added fix instructions to Claude queue');
                
                // Show progress
                vscode.window.showInformationMessage(`Script check iteration ${this.iteration}: Waiting for Claude to fix issues...`);
                
                // Wait for Claude to process - in a real implementation this would monitor the queue
                await this.waitForClaudeProcessing();
                
                // Run checks again
                const { allPassed, results } = await this.runChecks();
                
                if (allPassed) {
                    vscode.window.showInformationMessage(`✅ All checks passed after ${this.iteration} iteration(s)!`);
                    return;
                }
                
                // Update results for next iteration
                initialCheck.results = results;
                
            } catch (error) {
                debugLog(`Error in script check loop: ${error}`);
                vscode.window.showErrorMessage(`Script check loop error: ${error instanceof Error ? error.message : String(error)}`);
                return;
            }
        }
        
        vscode.window.showWarningMessage(`⚠️ Maximum iterations (${this.config.maxIterations}) reached. Some checks still failing.`);
        
        // Show final failing checks
        const finalFailures = Array.from(initialCheck.results.entries())
            .filter(([_, result]) => !result.passed)
            .map(([scriptId, _]) => {
                const script = this.config.scripts.find(s => s.id === scriptId);
                return script?.name || scriptId;
            });
        
        vscode.window.showErrorMessage(`Failed checks: ${finalFailures.join(', ')}`);
    }

    private async waitForClaudeProcessing(): Promise<void> {
        // Wait for a reasonable time for Claude to process
        // In a production implementation, this would monitor the message queue
        // and wait for the specific message to be completed
        const waitTime = 60000; // 60 seconds
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    async runMessageLoop(message: MessageItem, forceAnalysis: boolean = false): Promise<void> {
        this.iteration = 0;
        
        debugLog(`\n=== Starting Message Loop for: ${message.text.substring(0, 50)}... ===`);
        
        // Process the message first
        vscode.window.showInformationMessage('Processing message before running checks...');
        
        // Add the message to be processed
        try {
            // Import necessary functions
            const { startProcessingQueue } = await import('../claude');
            const { messageQueue, processingQueue } = await import('../core/state');
            
            // Ensure the message is at the front of the queue
            const messageIndex = messageQueue.findIndex(m => m.id === message.id);
            if (messageIndex > 0) {
                // Move to front
                const [movedMessage] = messageQueue.splice(messageIndex, 1);
                messageQueue.unshift(movedMessage);
            }
            
            // Start processing if not already
            if (!processingQueue) {
                await startProcessingQueue(true);
            }
            
            // Wait for the message to be processed
            await this.waitForMessageCompletion(message.id);
            
        } catch (error) {
            debugLog(`Error processing message: ${error}`);
            throw new Error(`Failed to process message: ${error instanceof Error ? error.message : String(error)}`);
        }
        
        // Now run the check loop
        let iterationCount = 0;
        while (this.iteration < this.config.maxIterations) {
            this.iteration++;
            iterationCount++;
            debugLog(`\n=== Message Loop Iteration ${this.iteration}/${this.config.maxIterations} ===`);
            
            // Run checks
            const { allPassed, results } = await this.runChecks();
            
            if (allPassed) {
                if (iterationCount === 1 && !forceAnalysis) {
                    // First iteration and all passed - ask if we should analyze for improvements
                    const analyze = await vscode.window.showInformationMessage(
                        `✅ All checks passed after processing the message! Would you like Claude to analyze for further improvements?`,
                        'Yes, Continue Analysis',
                        'No, Complete'
                    );
                    
                    if (analyze !== 'Yes, Continue Analysis') {
                        vscode.window.showInformationMessage(`✅ All checks passed!`);
                        return;
                    }
                    
                    // Send results to Claude for improvement analysis
                    const passingScripts = Array.from(results.entries())
                        .map(([scriptId, _]) => {
                            const script = this.config.scripts.find(s => s.id === scriptId);
                            return script?.name || scriptId;
                        });
                    
                    const analysisMessage = `After processing the previous message, all script checks are now passing:\n${passingScripts.map(s => `✅ ${s}`).join('\n')}\n\nPlease analyze the codebase to see if there are any additional improvements, optimizations, or best practices that could be applied.`;
                    
                    addMessageToQueueFromWebview(analysisMessage);
                    debugLog('Sent passing results to Claude for improvement analysis');
                    
                    // Continue the loop to see Claude's improvements
                    await this.waitForClaudeProcessing();
                    continue;
                } else {
                    vscode.window.showInformationMessage(`✅ All checks passed after ${this.iteration} iteration(s)!`);
                    return;
                }
            }
            
            // Generate fix instructions
            const fixInstructions = this.generateFixInstructions(results);
            
            // Create fix message
            const fixMessage = `Please fix the following issues found by automated checks (Message Loop Iteration ${this.iteration}/${this.config.maxIterations}):\n\n${fixInstructions}\n\nIMPORTANT: Make sure all changes are complete and production-ready. Fix all issues mentioned above.`;
            
            try {
                addMessageToQueueFromWebview(fixMessage);
                debugLog('Added fix instructions to Claude queue');
                
                // Show progress
                vscode.window.showInformationMessage(`Message loop iteration ${this.iteration}: Waiting for Claude to fix issues...`);
                
                // Wait for Claude to process the fix
                await this.waitForClaudeProcessing();
                
            } catch (error) {
                debugLog(`Error in message loop: ${error}`);
                vscode.window.showErrorMessage(`Message loop error: ${error instanceof Error ? error.message : String(error)}`);
                return;
            }
        }
        
        vscode.window.showWarningMessage(`⚠️ Maximum iterations (${this.config.maxIterations}) reached. Some checks still failing.`);
        
        // Show final failing checks
        const { results: finalResults } = await this.runChecks();
        const finalFailures = Array.from(finalResults.entries())
            .filter(([_, result]) => !result.passed)
            .map(([scriptId, _]) => {
                const script = this.config.scripts.find(s => s.id === scriptId);
                return script?.name || scriptId;
            });
        
        vscode.window.showErrorMessage(`Failed checks: ${finalFailures.join(', ')}`);
    }

    private async waitForMessageCompletion(messageId: string): Promise<void> {
        const { messageQueue } = await import('../core/state');
        const timeout = 300000; // 5 minutes timeout
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const message = messageQueue.find(m => m.id === messageId);
                
                if (!message) {
                    clearInterval(checkInterval);
                    reject(new Error('Message no longer in queue'));
                    return;
                }
                
                if (message.status === 'completed') {
                    clearInterval(checkInterval);
                    resolve();
                    return;
                }
                
                if (message.status === 'error') {
                    clearInterval(checkInterval);
                    reject(new Error(`Message processing failed: ${message.error}`));
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout waiting for message completion'));
                    return;
                }
            }, 1000);
        });
    }

    private generateFixInstructions(results: Map<string, ScriptResult>): string {
        const instructions: string[] = [];
        const MAX_ERRORS_PER_SCRIPT = 5;
        const MAX_TOTAL_LINES = 50;
        let totalLines = 0;
        
        for (const [scriptId, result] of results) {
            if (!result.passed) {
                const script = this.config.scripts.find(s => s.id === scriptId);
                if (script) {
                    // Check if we've reached the line limit
                    if (totalLines >= MAX_TOTAL_LINES) {
                        instructions.push('\n... Output truncated to prevent overwhelming Claude ...');
                        instructions.push(`Additional failing scripts: ${Array.from(results.entries())
                            .filter(([id, r]) => !r.passed && id !== scriptId)
                            .map(([id]) => this.config.scripts.find(s => s.id === id)?.name || id)
                            .join(', ')}`);
                        break;
                    }
                    
                    instructions.push(`## ${script.name}`);
                    instructions.push(`Errors found:`);
                    totalLines += 2;
                    
                    // Limit errors per script
                    const errorsToShow = Math.min(result.errors.length, MAX_ERRORS_PER_SCRIPT);
                    result.errors.slice(0, errorsToShow).forEach(error => {
                        instructions.push(`- ${error}`);
                        totalLines++;
                    });
                    
                    if (result.errors.length > MAX_ERRORS_PER_SCRIPT) {
                        instructions.push(`- ... and ${result.errors.length - MAX_ERRORS_PER_SCRIPT} more errors`);
                        totalLines++;
                    }
                    
                    if (result.fixInstructions) {
                        instructions.push(`\nSuggested fixes:`);
                        instructions.push(result.fixInstructions);
                        totalLines += 2;
                    }
                    
                    instructions.push('');
                    totalLines++;
                }
            }
        }
        
        return instructions.join('\n');
    }

    getConfig(): ScriptRunnerConfig {
        return this.config;
    }

    async updateConfig(config: Partial<ScriptRunnerConfig>): Promise<void> {
        this.config = { ...this.config, ...config };
        await this.saveConfig();
    }

    async toggleScript(scriptId: string, enabled: boolean): Promise<void> {
        const script = this.config.scripts.find(s => s.id === scriptId);
        if (script) {
            script.enabled = enabled;
            await this.saveConfig();
        }
    }
}