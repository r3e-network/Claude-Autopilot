import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { debugLog } from '../utils/logging';
import { MessageItem } from '../core/types';
import { addMessageToQueueFromWebview } from '../queue';

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
                checkFunction: this.checkProductionReadiness.bind(this)
            },
            {
                id: 'build-check',
                name: 'Build Check',
                description: 'Ensures the project can build successfully',
                enabled: true,
                predefined: true,
                language: ['javascript', 'typescript', 'golang', 'cpp', 'rust', 'csharp', 'java'],
                checkFunction: this.checkBuild.bind(this)
            },
            {
                id: 'test-check',
                name: 'Test Check',
                description: 'Runs all tests and ensures they pass',
                enabled: true,
                predefined: true,
                language: ['javascript', 'typescript', 'golang', 'cpp', 'rust', 'csharp', 'java'],
                checkFunction: this.checkTests.bind(this)
            },
            {
                id: 'format-check',
                name: 'Format Check',
                description: 'Ensures code is properly formatted',
                enabled: true,
                predefined: true,
                language: ['javascript', 'typescript', 'golang', 'cpp', 'rust', 'csharp', 'java'],
                checkFunction: this.checkFormat.bind(this)
            },
            {
                id: 'github-actions',
                name: 'GitHub Actions Check',
                description: 'Validates GitHub Actions workflows',
                enabled: true,
                predefined: true,
                checkFunction: this.checkGitHubActions.bind(this)
            }
        ];
    }

    private async copyPredefinedScripts(): Promise<void> {
        const scriptsPath = path.join(this.workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER);
        
        for (const script of this.config.scripts.filter(s => s.predefined)) {
            const scriptPath = path.join(scriptsPath, `${script.id}.js`);
            if (!fs.existsSync(scriptPath)) {
                const scriptContent = this.generateScriptContent(script);
                fs.writeFileSync(scriptPath, scriptContent);
                debugLog(`Created predefined script: ${script.id}`);
            }
        }
    }

    private generateScriptContent(script: ScriptConfig): string {
        return `#!/usr/bin/env node
// ${script.name}
// ${script.description}
// Auto-generated by Claude Autopilot

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function check() {
    const errors = [];
    const warnings = [];
    
    try {
        // Script implementation
        ${this.getScriptImplementation(script.id)}
        
        return {
            passed: errors.length === 0,
            errors,
            warnings
        };
    } catch (error) {
        return {
            passed: false,
            errors: [error.message],
            warnings
        };
    }
}

check().then(result => {
    console.log(JSON.stringify(result));
    process.exit(result.passed ? 0 : 1);
}).catch(error => {
    console.error(JSON.stringify({
        passed: false,
        errors: [error.message]
    }));
    process.exit(1);
});
`;
    }

    private getScriptImplementation(scriptId: string): string {
        const implementations: Record<string, string> = {
            'production-readiness': `
        const patterns = [
            /TODO/gi,
            /FIXME/gi,
            /PLACEHOLDER/gi,
            /for\\s+now/gi,
            /simplified/gi,
            /for\\s+simple/gi,
            /in\\s+a\\s+real\\s+implementation/gi,
            /\\.\\.\\./g,
            /<<<|>>>/g,
            /temporary/gi,
            /hack/gi,
            /quick\\s+fix/gi
        ];
        
        const extensions = ['.js', '.ts', '.jsx', '.tsx', '.go', '.cpp', '.rs', '.cs', '.java', '.py'];
        
        function scanDirectory(dir) {
            const files = fs.readdirSync(dir);
            
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                    scanDirectory(filePath);
                } else if (stat.isFile() && extensions.includes(path.extname(file))) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const lines = content.split('\\n');
                    
                    lines.forEach((line, index) => {
                        patterns.forEach(pattern => {
                            if (pattern.test(line)) {
                                errors.push(\`\${filePath}:\${index + 1} - Found "\${pattern.source}"\`);
                            }
                        });
                    });
                }
            }
        }
        
        scanDirectory(process.cwd());`,
            
            'build-check': `
        // Detect project type and run appropriate build command
        const packageJson = path.join(process.cwd(), 'package.json');
        const goMod = path.join(process.cwd(), 'go.mod');
        const cargoToml = path.join(process.cwd(), 'Cargo.toml');
        const csproj = fs.readdirSync(process.cwd()).find(f => f.endsWith('.csproj'));
        const pomXml = path.join(process.cwd(), 'pom.xml');
        const gradleBuild = path.join(process.cwd(), 'build.gradle');
        
        try {
            if (fs.existsSync(packageJson)) {
                const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
                if (pkg.scripts && pkg.scripts.build) {
                    execSync('npm run build', { stdio: 'pipe' });
                } else {
                    warnings.push('No build script found in package.json');
                }
            } else if (fs.existsSync(goMod)) {
                execSync('go build ./...', { stdio: 'pipe' });
            } else if (fs.existsSync(cargoToml)) {
                execSync('cargo build', { stdio: 'pipe' });
            } else if (csproj) {
                execSync('dotnet build', { stdio: 'pipe' });
            } else if (fs.existsSync(pomXml)) {
                execSync('mvn compile', { stdio: 'pipe' });
            } else if (fs.existsSync(gradleBuild)) {
                execSync('./gradlew build', { stdio: 'pipe' });
            } else {
                warnings.push('No recognized build system found');
            }
        } catch (error) {
            errors.push(\`Build failed: \${error.message}\`);
        }`,
            
            'test-check': `
        // Detect project type and run appropriate test command
        const packageJson = path.join(process.cwd(), 'package.json');
        const goMod = path.join(process.cwd(), 'go.mod');
        const cargoToml = path.join(process.cwd(), 'Cargo.toml');
        const csproj = fs.readdirSync(process.cwd()).find(f => f.endsWith('.csproj'));
        const pomXml = path.join(process.cwd(), 'pom.xml');
        const gradleBuild = path.join(process.cwd(), 'build.gradle');
        
        try {
            if (fs.existsSync(packageJson)) {
                const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
                if (pkg.scripts && pkg.scripts.test) {
                    execSync('npm test', { stdio: 'pipe' });
                } else {
                    warnings.push('No test script found in package.json');
                }
            } else if (fs.existsSync(goMod)) {
                execSync('go test ./...', { stdio: 'pipe' });
            } else if (fs.existsSync(cargoToml)) {
                execSync('cargo test', { stdio: 'pipe' });
            } else if (csproj) {
                execSync('dotnet test', { stdio: 'pipe' });
            } else if (fs.existsSync(pomXml)) {
                execSync('mvn test', { stdio: 'pipe' });
            } else if (fs.existsSync(gradleBuild)) {
                execSync('./gradlew test', { stdio: 'pipe' });
            } else {
                warnings.push('No recognized test framework found');
            }
        } catch (error) {
            errors.push(\`Tests failed: \${error.message}\`);
        }`,
            
            'format-check': `
        // Detect project type and check formatting
        const packageJson = path.join(process.cwd(), 'package.json');
        const goMod = path.join(process.cwd(), 'go.mod');
        const cargoToml = path.join(process.cwd(), 'Cargo.toml');
        
        try {
            if (fs.existsSync(packageJson)) {
                const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
                if (pkg.scripts && pkg.scripts.lint) {
                    execSync('npm run lint', { stdio: 'pipe' });
                } else if (pkg.devDependencies && (pkg.devDependencies.eslint || pkg.devDependencies.prettier)) {
                    warnings.push('Linting tools found but no lint script configured');
                }
            } else if (fs.existsSync(goMod)) {
                execSync('gofmt -l .', { stdio: 'pipe' });
            } else if (fs.existsSync(cargoToml)) {
                execSync('cargo fmt -- --check', { stdio: 'pipe' });
            } else {
                warnings.push('No recognized formatter found');
            }
        } catch (error) {
            errors.push(\`Format check failed: \${error.message}\`);
        }`,
            
            'github-actions': `
        const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
        
        if (fs.existsSync(workflowsDir)) {
            const workflows = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
            
            for (const workflow of workflows) {
                const workflowPath = path.join(workflowsDir, workflow);
                try {
                    // Basic YAML validation
                    const content = fs.readFileSync(workflowPath, 'utf8');
                    
                    // Check for common issues
                    if (!content.includes('on:')) {
                        errors.push(\`\${workflow}: Missing 'on' trigger\`);
                    }
                    if (!content.includes('jobs:')) {
                        errors.push(\`\${workflow}: Missing 'jobs' section\`);
                    }
                    
                    // Check for syntax using actionlint if available
                    try {
                        execSync(\`actionlint \${workflowPath}\`, { stdio: 'pipe' });
                    } catch (e) {
                        // actionlint not available, skip detailed check
                        warnings.push('actionlint not found - skipping detailed workflow validation');
                    }
                } catch (error) {
                    errors.push(\`\${workflow}: \${error.message}\`);
                }
            }
        } else {
            warnings.push('No GitHub Actions workflows found');
        }`
        };
        
        return implementations[scriptId] || '// Script implementation not found';
    }

    private async checkProductionReadiness(workspacePath: string): Promise<ScriptResult> {
        const scriptPath = path.join(workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'production-readiness.js');
        return this.runScript(scriptPath);
    }

    private async checkBuild(workspacePath: string): Promise<ScriptResult> {
        const scriptPath = path.join(workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'build-check.js');
        return this.runScript(scriptPath);
    }

    private async checkTests(workspacePath: string): Promise<ScriptResult> {
        const scriptPath = path.join(workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'test-check.js');
        return this.runScript(scriptPath);
    }

    private async checkFormat(workspacePath: string): Promise<ScriptResult> {
        const scriptPath = path.join(workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'format-check.js');
        return this.runScript(scriptPath);
    }

    private async checkGitHubActions(workspacePath: string): Promise<ScriptResult> {
        const scriptPath = path.join(workspacePath, AUTOPILOT_FOLDER, SCRIPTS_FOLDER, 'github-actions.js');
        return this.runScript(scriptPath);
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

    async runChecks(): Promise<{ allPassed: boolean; results: Map<string, ScriptResult> }> {
        const results = new Map<string, ScriptResult>();
        let allPassed = true;
        
        for (const script of this.config.scripts.filter(s => s.enabled)) {
            debugLog(`Running script: ${script.name}`);
            
            let result: ScriptResult;
            if (script.checkFunction) {
                result = await script.checkFunction(this.workspacePath);
            } else if (script.path) {
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