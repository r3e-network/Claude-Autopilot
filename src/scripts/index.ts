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

const AUTOPILOT_FOLDER = '.autopilot';
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
        const autopilotPath = path.join(this.workspacePath, AUTOPILOT_FOLDER);
        const scriptsPath = path.join(autopilotPath, SCRIPTS_FOLDER);

        if (!fs.existsSync(autopilotPath)) {
            fs.mkdirSync(autopilotPath, { recursive: true });
            debugLog(`Created ${AUTOPILOT_FOLDER} folder`);
        }

        if (!fs.existsSync(scriptsPath)) {
            fs.mkdirSync(scriptsPath, { recursive: true });
            debugLog(`Created ${SCRIPTS_FOLDER} folder`);
        }
    }

    private async loadConfig(): Promise<void> {
        const configPath = path.join(this.workspacePath, AUTOPILOT_FOLDER, CONFIG_FILE);
        
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
        const configPath = path.join(this.workspacePath, AUTOPILOT_FOLDER, CONFIG_FILE);
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
                path: path.join(this.workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'production-readiness.js')
            },
            {
                id: 'build-check',
                name: 'Build Check',
                description: 'Ensures the project can build successfully',
                enabled: true,
                predefined: true,
                path: path.join(this.workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'build-check.js')
            },
            {
                id: 'test-check',
                name: 'Test Check',
                description: 'Runs all tests and ensures they pass',
                enabled: true,
                predefined: true,
                path: path.join(this.workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'test-check.js')
            },
            {
                id: 'format-check',
                name: 'Format Check',
                description: 'Ensures code is properly formatted',
                enabled: true,
                predefined: true,
                path: path.join(this.workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'format-check.js')
            },
            {
                id: 'github-actions',
                name: 'GitHub Actions Check',
                description: 'Validates GitHub Actions workflows',
                enabled: true,
                predefined: true,
                path: path.join(this.workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'github-actions.js')
            }
        ];
    }

    private async copyPredefinedScripts(): Promise<void> {
        const scriptsPath = path.join(this.workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER);
        
        // Write all built-in scripts to the .autopilot/scripts folder
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
        const configPath = path.join(this.workspacePath, AUTOPILOT_FOLDER, CONFIG_FILE);
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
        const scriptsPath = path.join(this.workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER);
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

    async runChecks(): Promise<{ allPassed: boolean; results: Map<string, ScriptResult> }> {
        const results = new Map<string, ScriptResult>();
        let allPassed = true;
        
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
            
            results.set(script.id, result);
            if (!result.passed) {
                allPassed = false;
            }
            
            // Log results
            if (result.passed) {
                debugLog(`✅ ${script.name}: Passed`);
            } else {
                debugLog(`❌ ${script.name}: Failed`);
                debugLog(`   Errors: ${result.errors.join(', ')}`);
            }
        }
        
        return { allPassed, results };
    }

    async runCheckLoop(): Promise<void> {
        this.iteration = 0;
        
        // Initial check
        debugLog(`\n=== Initial Script Check ===`);
        const initialCheck = await this.runChecks();
        
        if (initialCheck.allPassed) {
            vscode.window.showInformationMessage('All checks already pass! No fixes needed.');
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

    async runMessageLoop(message: MessageItem): Promise<void> {
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
        while (this.iteration < this.config.maxIterations) {
            this.iteration++;
            debugLog(`\n=== Message Loop Iteration ${this.iteration}/${this.config.maxIterations} ===`);
            
            // Run checks
            const { allPassed, results } = await this.runChecks();
            
            if (allPassed) {
                vscode.window.showInformationMessage(`✅ All checks passed after ${this.iteration} iteration(s)!`);
                return;
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
        
        for (const [scriptId, result] of results) {
            if (!result.passed) {
                const script = this.config.scripts.find(s => s.id === scriptId);
                if (script) {
                    instructions.push(`## ${script.name}`);
                    instructions.push(`Errors found:`);
                    result.errors.forEach(error => {
                        instructions.push(`- ${error}`);
                    });
                    
                    if (result.fixInstructions) {
                        instructions.push(`\nSuggested fixes:`);
                        instructions.push(result.fixInstructions);
                    }
                    
                    instructions.push('');
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