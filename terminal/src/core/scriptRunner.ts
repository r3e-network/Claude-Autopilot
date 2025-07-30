import { spawn } from 'child_process';
import { Config } from './config';
import { Logger } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export interface CheckResult {
    script: string;
    passed: boolean;
    output: string;
    duration: number;
}

export interface CheckResults {
    hasIssues: boolean;
    totalIssues: number;
    results: CheckResult[];
}

export class ScriptRunner {
    private config: Config;
    private logger: Logger;
    private scriptsDir: string;
    private messageQueue?: any; // Import proper type when available

    constructor(config: Config, logger: Logger) {
        this.config = config;
        this.logger = logger;
        this.scriptsDir = config.get('paths', 'scriptsDir');
    }
    
    setMessageQueue(queue: any): void {
        this.messageQueue = queue;
    }
    
    private getMessageQueue(): any {
        return this.messageQueue;
    }

    async runChecks(projectDir: string): Promise<CheckResults> {
        this.logger.info('Running quality checks...');
        
        // Ensure scripts directory exists
        await this.ensureScriptsExist();
        
        // Get all check scripts
        const scripts = await this.getCheckScripts();
        const results: CheckResult[] = [];
        let totalIssues = 0;

        for (const script of scripts) {
            const result = await this.runScript(script, projectDir);
            results.push(result);
            
            if (!result.passed) {
                totalIssues++;
                console.log(chalk.red(`✗ ${script}: FAILED`));
                console.log(chalk.gray(result.output.substring(0, 200) + '...'));
            } else {
                console.log(chalk.green(`✓ ${script}: PASSED`));
            }
        }

        return {
            hasIssues: totalIssues > 0,
            totalIssues,
            results
        };
    }

    async runLoop(projectDir: string, maxIterations: number): Promise<void> {
        this.logger.info(`Running check loop (max ${maxIterations} iterations)...`);
        
        for (let i = 1; i <= maxIterations; i++) {
            console.log(chalk.cyan(`\n--- Iteration ${i}/${maxIterations} ---`));
            
            const results = await this.runChecks(projectDir);
            
            if (!results.hasIssues) {
                console.log(chalk.green('\n✅ All checks passed!'));
                break;
            }
            
            console.log(chalk.yellow(`\n⚠️  Found ${results.totalIssues} issues`));
            
            if (i < maxIterations) {
                console.log(chalk.blue('Running Claude to fix issues...'));
                
                // Create fix message for Claude
                const fixMessage = this.createFixMessage(results);
                
                // Add message to queue for Claude to process
                const messageQueue = this.getMessageQueue();
                if (messageQueue) {
                    await messageQueue.addMessage({
                        text: fixMessage,
                        status: 'pending',
                        timestamp: new Date().toISOString()
                    });
                    
                    // Wait for Claude to process the fix
                    await this.waitForClaudeProcessing(30000); // 30 second timeout
                } else {
                    console.log(chalk.red('Message queue not available for fixes'));
                    break;
                }
            }
        }
    }

    private async runScript(scriptName: string, projectDir: string): Promise<CheckResult> {
        const scriptPath = path.join(this.scriptsDir, scriptName);
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const child = spawn('bash', [scriptPath], {
                cwd: projectDir,
                env: { ...process.env, PROJECT_DIR: projectDir }
            });
            
            let output = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                output += data.toString();
            });
            
            child.on('close', (code) => {
                const duration = Date.now() - startTime;
                resolve({
                    script: scriptName,
                    passed: code === 0,
                    output: output.trim(),
                    duration
                });
            });
        });
    }

    private async getCheckScripts(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.scriptsDir);
            return files
                .filter(f => f.endsWith('.sh'))
                .filter(f => !f.includes('fix'))
                .sort();
        } catch (error) {
            return [];
        }
    }

    private async ensureScriptsExist(): Promise<void> {
        try {
            await fs.access(this.scriptsDir);
        } catch (error) {
            // Create scripts directory and default scripts
            await fs.mkdir(this.scriptsDir, { recursive: true });
            await this.createDefaultScripts();
        }
    }

    private async createDefaultScripts(): Promise<void> {
        const defaultScripts = {
            '01-production-readiness.sh': `#!/bin/bash
echo "Checking for TODOs and FIXMEs..."
if grep -r "TODO\\|FIXME" --include="*.js" --include="*.ts" --include="*.py" . 2>/dev/null | grep -v node_modules; then
    echo "Found TODOs or FIXMEs that need to be addressed"
    exit 1
fi
echo "No TODOs or FIXMEs found"
exit 0`,
            
            '02-build-check.sh': `#!/bin/bash
echo "Running build check..."
if [ -f "package.json" ]; then
    if command -v npm &> /dev/null; then
        npm run build || exit 1
    fi
elif [ -f "Cargo.toml" ]; then
    if command -v cargo &> /dev/null; then
        cargo build || exit 1
    fi
elif [ -f "setup.py" ] || [ -f "pyproject.toml" ]; then
    echo "Python project detected"
fi
echo "Build check completed"
exit 0`,
            
            '03-test-check.sh': `#!/bin/bash
echo "Running tests..."
if [ -f "package.json" ]; then
    if npm run test 2>/dev/null; then
        echo "Tests passed"
        exit 0
    else
        echo "Tests failed or no tests found"
        exit 1
    fi
elif [ -f "Cargo.toml" ]; then
    cargo test || exit 1
elif [ -f "pytest.ini" ] || [ -f "setup.cfg" ]; then
    pytest || exit 1
fi
exit 0`,
            
            '04-lint-check.sh': `#!/bin/bash
echo "Running lint check..."
if [ -f "package.json" ]; then
    if npm run lint 2>/dev/null; then
        exit 0
    fi
elif [ -f ".flake8" ] || [ -f "setup.cfg" ]; then
    flake8 . || exit 1
elif [ -f ".golangci.yml" ]; then
    golangci-lint run || exit 1
fi
echo "Lint check completed"
exit 0`
        };

        for (const [filename, content] of Object.entries(defaultScripts)) {
            const filepath = path.join(this.scriptsDir, filename);
            await fs.writeFile(filepath, content, { mode: 0o755 });
        }
        
        this.logger.info('Created default check scripts');
    }
    
    private createFixMessage(results: CheckResults): string {
        let message = 'Please fix the following issues found by automated quality checks:\n\n';
        
        for (const result of results.results) {
            if (!result.passed) {
                message += `**${result.script}:**\n`;
                message += '```\n';
                message += result.output;
                message += '\n```\n\n';
            }
        }
        
        message += '\nPlease ensure all fixes are complete and the code is production-ready.';
        return message;
    }
    
    private async waitForClaudeProcessing(timeout: number): Promise<boolean> {
        const startTime = Date.now();
        const checkInterval = 2000; // Check every 2 seconds
        
        while (Date.now() - startTime < timeout) {
            // Check if Claude has processed the message
            // This would integrate with the actual Claude session status
            const isProcessing = await this.checkClaudeProcessingStatus();
            
            if (!isProcessing) {
                return true;
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        return false; // Timed out
    }
    
    private async checkClaudeProcessingStatus(): Promise<boolean> {
        // Check if Claude is still processing
        // This would check the actual Claude session state
        // For now, return a simple check based on queue status
        if (this.messageQueue) {
            const pendingMessages = await this.messageQueue.getPendingCount();
            return pendingMessages > 0;
        }
        return false;
    }
}