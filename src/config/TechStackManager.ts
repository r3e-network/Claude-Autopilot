import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { debugLog } from '../utils/logging';

const fsAsync = fs.promises;

export interface TechStackConfig {
    name: string;
    displayName: string;
    fileExtensions: string[];
    problemCommands: {
        typeCheck?: string[];
        lint?: string[];
        test?: string[];
        build?: string[];
    };
    bestPracticesFile?: string;
    chunkSize: number;
    promptTemplate: string;
    setupScript?: string;
    requiredTools: string[];
    configFiles: string[];
}

export class TechStackManager {
    private techStacks: Map<string, TechStackConfig> = new Map();
    private currentStack: string | null = null;
    private workspacePath: string;
    private configDir: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.configDir = path.join(__dirname, '..', '..', 'tech-stacks');
        this.initializeDefaultStacks();
    }

    private initializeDefaultStacks(): void {
        // Define default tech stacks based on claude_code_agent_farm
        const defaultStacks: TechStackConfig[] = [
            {
                name: 'nextjs',
                displayName: 'Next.js',
                fileExtensions: ['.tsx', '.ts', '.jsx', '.js'],
                problemCommands: {
                    typeCheck: ['npm', 'run', 'type-check'],
                    lint: ['npm', 'run', 'lint'],
                    test: ['npm', 'run', 'test']
                },
                bestPracticesFile: 'NEXTJS15_BEST_PRACTICES.md',
                chunkSize: 50,
                promptTemplate: 'nextjs_prompt.txt',
                requiredTools: ['node', 'npm', 'bun'],
                configFiles: ['next.config.js', 'package.json', 'tsconfig.json']
            },
            {
                name: 'python',
                displayName: 'Python (FastAPI/Django)',
                fileExtensions: ['.py'],
                problemCommands: {
                    typeCheck: ['mypy', '.'],
                    lint: ['ruff', 'check', '.'],
                    test: ['pytest']
                },
                bestPracticesFile: 'PYTHON_FASTAPI_BEST_PRACTICES.md',
                chunkSize: 50,
                promptTemplate: 'python_prompt.txt',
                requiredTools: ['python', 'mypy', 'ruff', 'pytest'],
                configFiles: ['pyproject.toml', 'requirements.txt', 'setup.py']
            },
            {
                name: 'rust',
                displayName: 'Rust',
                fileExtensions: ['.rs'],
                problemCommands: {
                    typeCheck: ['cargo', 'check'],
                    lint: ['cargo', 'clippy', '--', '-D', 'warnings'],
                    test: ['cargo', 'test']
                },
                bestPracticesFile: 'RUST_BEST_PRACTICES.md',
                chunkSize: 30,
                promptTemplate: 'rust_prompt.txt',
                requiredTools: ['cargo', 'rustc'],
                configFiles: ['Cargo.toml']
            },
            {
                name: 'go',
                displayName: 'Go',
                fileExtensions: ['.go'],
                problemCommands: {
                    lint: ['golangci-lint', 'run'],
                    test: ['go', 'test', './...'],
                    build: ['go', 'build', './...']
                },
                bestPracticesFile: 'GO_WEBAPPS_BEST_PRACTICES.md',
                chunkSize: 40,
                promptTemplate: 'go_prompt.txt',
                requiredTools: ['go', 'golangci-lint'],
                configFiles: ['go.mod', 'go.sum']
            },
            {
                name: 'java',
                displayName: 'Java (Spring Boot)',
                fileExtensions: ['.java'],
                problemCommands: {
                    build: ['./gradlew', 'build'],
                    test: ['./gradlew', 'test']
                },
                bestPracticesFile: 'JAVA_ENTERPRISE_BEST_PRACTICES.md',
                chunkSize: 35,
                promptTemplate: 'java_prompt.txt',
                requiredTools: ['java', 'gradle'],
                configFiles: ['build.gradle', 'pom.xml']
            },
            {
                name: 'angular',
                displayName: 'Angular',
                fileExtensions: ['.ts', '.html', '.scss'],
                problemCommands: {
                    typeCheck: ['ng', 'build', '--aot'],
                    lint: ['ng', 'lint'],
                    test: ['ng', 'test', '--watch=false']
                },
                bestPracticesFile: 'ANGULAR_BEST_PRACTICES.md',
                chunkSize: 40,
                promptTemplate: 'angular_prompt.txt',
                requiredTools: ['node', 'npm', 'ng'],
                configFiles: ['angular.json', 'package.json']
            },
            {
                name: 'flutter',
                displayName: 'Flutter',
                fileExtensions: ['.dart'],
                problemCommands: {
                    lint: ['flutter', 'analyze'],
                    test: ['flutter', 'test']
                },
                bestPracticesFile: 'FLUTTER_BEST_PRACTICES.md',
                chunkSize: 35,
                promptTemplate: 'flutter_prompt.txt',
                requiredTools: ['flutter', 'dart'],
                configFiles: ['pubspec.yaml']
            }
        ];

        for (const stack of defaultStacks) {
            this.techStacks.set(stack.name, stack);
        }
    }

    async detectTechStack(): Promise<string | null> {
        debugLog('Detecting technology stack for workspace');

        // Check for config files to determine tech stack
        const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 10);
        
        for (const [name, config] of this.techStacks) {
            for (const configFile of config.configFiles) {
                const found = files.some(file => path.basename(file.fsPath) === configFile);
                if (found) {
                    debugLog(`Detected ${config.displayName} project`);
                    this.currentStack = name;
                    return name;
                }
            }
        }

        // Fallback: check file extensions
        const workspaceFiles = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 100);
        const extensionCounts = new Map<string, number>();

        for (const file of workspaceFiles) {
            const ext = path.extname(file.fsPath);
            extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1);
        }

        // Find tech stack with most matching files
        let bestMatch: string | null = null;
        let bestCount = 0;

        for (const [name, config] of this.techStacks) {
            let count = 0;
            for (const ext of config.fileExtensions) {
                count += extensionCounts.get(ext) || 0;
            }
            if (count > bestCount) {
                bestCount = count;
                bestMatch = name;
            }
        }

        if (bestMatch) {
            debugLog(`Detected ${this.techStacks.get(bestMatch)!.displayName} project based on file extensions`);
            this.currentStack = bestMatch;
        }

        return bestMatch;
    }

    async selectTechStack(): Promise<string | null> {
        const items = Array.from(this.techStacks.entries()).map(([name, config]) => ({
            label: config.displayName,
            description: `Extensions: ${config.fileExtensions.join(', ')}`,
            detail: `Required tools: ${config.requiredTools.join(', ')}`,
            value: name
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select your project\'s technology stack',
            title: 'Technology Stack Selection'
        });

        if (selected) {
            this.currentStack = selected.value;
            return selected.value;
        }

        return null;
    }

    getCurrentStack(): TechStackConfig | null {
        if (!this.currentStack) return null;
        return this.techStacks.get(this.currentStack) || null;
    }

    async generateProblemCommands(): Promise<string[][]> {
        const stack = this.getCurrentStack();
        if (!stack) {
            throw new Error('No tech stack selected');
        }

        const commands: string[][] = [];
        
        if (stack.problemCommands.typeCheck) {
            commands.push(stack.problemCommands.typeCheck);
        }
        if (stack.problemCommands.lint) {
            commands.push(stack.problemCommands.lint);
        }
        if (stack.problemCommands.test) {
            commands.push(stack.problemCommands.test);
        }
        if (stack.problemCommands.build) {
            commands.push(stack.problemCommands.build);
        }

        return commands;
    }

    async checkRequiredTools(): Promise<{ tool: string; installed: boolean }[]> {
        const stack = this.getCurrentStack();
        if (!stack) return [];

        const results: { tool: string; installed: boolean }[] = [];

        for (const tool of stack.requiredTools) {
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(`/usr/bin/${tool}`));
                results.push({ tool, installed: true });
            } catch {
                // Try in PATH
                try {
                    const { exec } = require('child_process');
                    const { promisify } = require('util');
                    const execAsync = promisify(exec);
                    await execAsync(`which ${tool}`);
                    results.push({ tool, installed: true });
                } catch {
                    results.push({ tool, installed: false });
                }
            }
        }

        return results;
    }

    async loadPromptTemplate(): Promise<string | null> {
        const stack = this.getCurrentStack();
        if (!stack) return null;

        try {
            const promptPath = path.join(this.configDir, 'prompts', stack.promptTemplate);
            const content = await fsAsync.readFile(promptPath, 'utf-8');
            return content;
        } catch (error) {
            debugLog(`Failed to load prompt template: ${error}`);
            return null;
        }
    }

    async loadBestPractices(): Promise<string | null> {
        const stack = this.getCurrentStack();
        if (!stack || !stack.bestPracticesFile) return null;

        try {
            const practicesPath = path.join(this.configDir, 'best-practices', stack.bestPracticesFile);
            const content = await fsAsync.readFile(practicesPath, 'utf-8');
            return content;
        } catch (error) {
            debugLog(`Failed to load best practices: ${error}`);
            return null;
        }
    }

    getChunkSize(): number {
        const stack = this.getCurrentStack();
        return stack?.chunkSize || 50;
    }

    async createStackConfig(customStack: Partial<TechStackConfig>): Promise<void> {
        if (!customStack.name) {
            throw new Error('Tech stack name is required');
        }

        const config: TechStackConfig = {
            name: customStack.name,
            displayName: customStack.displayName || customStack.name,
            fileExtensions: customStack.fileExtensions || [],
            problemCommands: customStack.problemCommands || {},
            chunkSize: customStack.chunkSize || 50,
            promptTemplate: customStack.promptTemplate || 'default_prompt.txt',
            requiredTools: customStack.requiredTools || [],
            configFiles: customStack.configFiles || [],
            ...customStack
        };

        this.techStacks.set(config.name, config);
        
        // Save to workspace settings
        const workspaceConfig = vscode.workspace.getConfiguration('autoclaude');
        const customStacks = workspaceConfig.get<Record<string, TechStackConfig>>('customTechStacks', {});
        customStacks[config.name] = config;
        await workspaceConfig.update('customTechStacks', customStacks, vscode.ConfigurationTarget.Workspace);
    }

    async loadCustomStacks(): Promise<void> {
        const workspaceConfig = vscode.workspace.getConfiguration('autoclaude');
        const customStacks = workspaceConfig.get<Record<string, TechStackConfig>>('customTechStacks', {});
        
        for (const [name, config] of Object.entries(customStacks)) {
            this.techStacks.set(name, config);
        }
    }

    getAllStacks(): TechStackConfig[] {
        return Array.from(this.techStacks.values());
    }
}