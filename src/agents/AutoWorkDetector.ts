import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { debugLog } from '../utils/logging';
import { WorkDistributor } from './WorkDistributor';
import { TechStackManager } from '../config/TechStackManager';
import { ParallelAgentOrchestrator } from './ParallelAgentOrchestrator';

const execAsync = promisify(exec);
const fsAsync = fs.promises;

export interface WorkDetectionResult {
    hasWork: boolean;
    workCount: number;
    workTypes: string[];
    suggestedAgents: number;
    techStack: string | null;
}

export class AutoWorkDetector {
    private workspacePath: string;
    private techStackManager: TechStackManager;
    private workDistributor: WorkDistributor;
    private detectionInterval: NodeJS.Timeout | null = null;
    private isDetecting: boolean = false;
    private orchestrator: ParallelAgentOrchestrator | null = null;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.techStackManager = new TechStackManager(workspacePath);
        this.workDistributor = new WorkDistributor(workspacePath);
    }

    async initialize(): Promise<void> {
        await this.workDistributor.initialize();
        await this.techStackManager.loadCustomStacks();
        
        // Auto-detect tech stack
        const detectedStack = await this.techStackManager.detectTechStack();
        if (detectedStack) {
            debugLog(`Auto-detected tech stack: ${detectedStack}`);
        }
    }

    async detectWork(): Promise<WorkDetectionResult> {
        debugLog('Auto-detecting work in workspace');
        
        const result: WorkDetectionResult = {
            hasWork: false,
            workCount: 0,
            workTypes: [],
            suggestedAgents: 0,
            techStack: this.techStackManager.getCurrentStack()?.name || null
        };
        
        // Get problem commands from tech stack
        const commands = await this.techStackManager.generateProblemCommands();
        if (commands.length === 0) {
            debugLog('No problem commands configured for current tech stack');
            return result;
        }
        
        // Run problem detection commands
        const problems: string[] = [];
        const workTypes = new Set<string>();
        
        for (const command of commands) {
            try {
                const { stdout, stderr } = await execAsync(command.join(' '), {
                    cwd: this.workspacePath,
                    timeout: 60000
                });
                
                const output = stdout + stderr;
                const lines = output.split('\n').filter(line => line.trim());
                
                // Detect work types
                for (const line of lines) {
                    if (line.includes('error:')) {
                        workTypes.add('errors');
                        problems.push(line);
                    } else if (line.includes('warning:')) {
                        workTypes.add('warnings');
                        problems.push(line);
                    } else if (line.includes('TODO') || line.includes('FIXME')) {
                        workTypes.add('todos');
                        problems.push(line);
                    }
                }
            } catch (error) {
                // Command failed, which likely means there are problems
                debugLog(`Problem detection command failed: ${error}`);
                workTypes.add('build-errors');
            }
        }
        
        // Check for test failures
        try {
            const testCommand = this.getTestCommand();
            if (testCommand) {
                await execAsync(testCommand, {
                    cwd: this.workspacePath,
                    timeout: 120000
                });
            }
        } catch (error) {
            workTypes.add('test-failures');
            problems.push('Test failures detected');
        }
        
        result.workCount = problems.length;
        result.hasWork = problems.length > 0;
        result.workTypes = Array.from(workTypes);
        
        // Calculate suggested agent count based on workload
        if (result.hasWork) {
            result.suggestedAgents = this.calculateSuggestedAgents(result.workCount);
        }
        
        // Save detected problems for distribution
        if (problems.length > 0) {
            const problemsFile = path.join(this.workspacePath, '.autoclaude', 'detected_problems.txt');
            await fsAsync.mkdir(path.dirname(problemsFile), { recursive: true });
            await fsAsync.writeFile(problemsFile, problems.join('\n'));
        }
        
        debugLog(`Work detection complete: ${result.workCount} items found`);
        return result;
    }

    private calculateSuggestedAgents(workCount: number): number {
        // Dynamic agent calculation based on workload
        if (workCount <= 10) return 1;
        if (workCount <= 50) return Math.min(5, Math.ceil(workCount / 10));
        if (workCount <= 200) return Math.min(10, Math.ceil(workCount / 20));
        if (workCount <= 500) return Math.min(20, Math.ceil(workCount / 25));
        return Math.min(50, Math.ceil(workCount / 30));
    }

    private getTestCommand(): string | null {
        const stack = this.techStackManager.getCurrentStack();
        if (!stack) return null;
        
        // Common test commands by tech stack
        const testCommands: Record<string, string> = {
            'nextjs': 'npm test',
            'python': 'pytest',
            'rust': 'cargo test',
            'go': 'go test ./...',
            'java': './gradlew test',
            'angular': 'ng test --watch=false',
            'flutter': 'flutter test'
        };
        
        return testCommands[stack.name] || null;
    }

    async startAutoDetection(orchestrator: ParallelAgentOrchestrator): Promise<void> {
        if (this.isDetecting) return;
        
        this.orchestrator = orchestrator;
        this.isDetecting = true;
        
        const config = vscode.workspace.getConfiguration('autoclaude.parallelAgents');
        const interval = config.get<number>('workDetectionInterval', 60) * 1000;
        
        debugLog('Starting automatic work detection');
        
        // Initial detection
        await this.checkAndDistributeWork();
        
        // Set up interval
        this.detectionInterval = setInterval(async () => {
            await this.checkAndDistributeWork();
        }, interval);
    }

    stopAutoDetection(): void {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
        }
        this.isDetecting = false;
        debugLog('Stopped automatic work detection');
    }

    private async checkAndDistributeWork(): Promise<void> {
        if (!this.orchestrator) return;
        
        try {
            const detection = await this.detectWork();
            
            if (detection.hasWork) {
                const config = vscode.workspace.getConfiguration('autoclaude.parallelAgents');
                const autoScale = config.get<boolean>('autoScale', true);
                const autoShutdown = config.get<boolean>('autoShutdown', true);
                
                // Show notification about detected work
                const action = await vscode.window.showInformationMessage(
                    `Detected ${detection.workCount} items to fix (${detection.workTypes.join(', ')}). Start ${detection.suggestedAgents} agents?`,
                    'Yes', 'No', 'Configure'
                );
                
                if (action === 'Yes') {
                    // Auto-scale agents if needed
                    const currentAgents = this.orchestrator.getAgentStatuses().length;
                    
                    if (autoScale && currentAgents < detection.suggestedAgents) {
                        debugLog(`Auto-scaling from ${currentAgents} to ${detection.suggestedAgents} agents`);
                        await this.orchestrator.startAgents(detection.suggestedAgents - currentAgents);
                    }
                    
                    // Load and distribute work
                    const problemsFile = path.join(this.workspacePath, '.autoclaude', 'detected_problems.txt');
                    await this.workDistributor.loadWorkFromFile(problemsFile);
                    
                    // Distribute work to agents
                    const agents = this.orchestrator.getAgentStatuses();
                    for (const agent of agents) {
                        if (agent.status === 'idle' || agent.status === 'ready') {
                            const chunk = await this.workDistributor.getWorkChunk(agent.id);
                            if (chunk) {
                                // Send work to agent via orchestrator
                                debugLog(`Distributing ${chunk.items.length} items to ${agent.name}`);
                            }
                        }
                    }
                } else if (action === 'Configure') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'autoclaude.parallelAgents');
                }
                
                // Check for completion and auto-shutdown
                if (autoShutdown) {
                    const stats = this.workDistributor.getStatistics();
                    if (stats.pending === 0 && stats.assigned === 0) {
                        debugLog('All work completed, auto-shutting down agents');
                        await this.orchestrator.stopAgents();
                        this.stopAutoDetection();
                    }
                }
            } else {
                debugLog('No work detected in workspace');
            }
        } catch (error) {
            debugLog(`Error in work detection: ${error}`);
        }
    }

    async generateWorkReport(): Promise<string> {
        const detection = await this.detectWork();
        const stats = this.workDistributor.getStatistics();
        
        const report = `# Automatic Work Detection Report

Generated: ${new Date().toLocaleString()}

## Current Status
- Tech Stack: ${detection.techStack || 'Unknown'}
- Total Work Items: ${detection.workCount}
- Work Types: ${detection.workTypes.join(', ')}
- Suggested Agents: ${detection.suggestedAgents}

## Work Distribution
- Pending: ${stats.pending}
- Assigned: ${stats.assigned}
- Completed: ${stats.completed}
- Failed: ${stats.failed}

## Recommendations
${this.generateRecommendations(detection, stats)}
`;
        
        return report;
    }

    private generateRecommendations(detection: WorkDetectionResult, stats: any): string {
        const recommendations: string[] = [];
        
        if (detection.workCount > 100) {
            recommendations.push('- Consider running agents overnight for large workload');
        }
        
        if (detection.workTypes.includes('test-failures')) {
            recommendations.push('- Fix test failures first to ensure code stability');
        }
        
        if (detection.workTypes.includes('errors')) {
            recommendations.push('- Address compilation errors before warnings');
        }
        
        if (!detection.techStack) {
            recommendations.push('- Configure tech stack for better problem detection');
        }
        
        if (stats.failed > 0) {
            recommendations.push('- Review failed items for manual intervention');
        }
        
        return recommendations.length > 0 ? recommendations.join('\n') : '- No specific recommendations';
    }
}