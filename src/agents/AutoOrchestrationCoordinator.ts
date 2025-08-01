import * as vscode from 'vscode';
import * as path from 'path';
import { ParallelAgentOrchestrator } from './ParallelAgentOrchestrator';
import { AgentMonitor } from '../monitoring/AgentMonitor';
import { WorkDistributor } from './WorkDistributor';
import { AutoWorkDetector } from './AutoWorkDetector';
import { CoordinationProtocol } from '../coordination/CoordinationProtocol';
import { debugLog } from '../utils/logging';

export interface AutoOrchestrationConfig {
    enabled: boolean;
    autoStart: boolean;
    autoDetectWork: boolean;
    autoScale: boolean;
    autoShutdown: boolean;
    maxAgents: number;
    workDetectionInterval: number;
    coordinationEnabled: boolean;
}

export class AutoOrchestrationCoordinator {
    private orchestrator: ParallelAgentOrchestrator;
    private monitor: AgentMonitor;
    private workDistributor: WorkDistributor;
    private workDetector: AutoWorkDetector;
    private coordinationProtocol: CoordinationProtocol | null = null;
    private config: AutoOrchestrationConfig;
    private workspacePath: string;
    private orchestrationInterval: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;
    private completionCheckInterval: NodeJS.Timeout | null = null;

    constructor(workspacePath: string, config: AutoOrchestrationConfig) {
        this.workspacePath = workspacePath;
        this.config = config;
        
        // Initialize components
        this.orchestrator = new ParallelAgentOrchestrator(workspacePath, {
            maxAgents: config.maxAgents,
            autoRestart: true
        });
        
        this.monitor = new AgentMonitor(this.orchestrator, workspacePath);
        this.workDistributor = new WorkDistributor(workspacePath);
        this.workDetector = new AutoWorkDetector(workspacePath);
        
        if (config.coordinationEnabled) {
            this.coordinationProtocol = new CoordinationProtocol(workspacePath);
        }
    }

    async initialize(): Promise<void> {
        debugLog('Initializing Auto Orchestration Coordinator');
        
        // Initialize all components
        await this.orchestrator.initialize();
        await this.monitor.initialize();
        await this.workDistributor.initialize();
        await this.workDetector.initialize();
        
        if (this.coordinationProtocol) {
            await this.coordinationProtocol.initialize();
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            debugLog('Auto orchestration already running');
            return;
        }
        
        this.isRunning = true;
        debugLog('Starting automatic orchestration');
        
        // Detect initial work
        const detection = await this.workDetector.detectWork();
        
        if (detection.hasWork) {
            // Start agents based on workload
            const agentCount = Math.min(detection.suggestedAgents, this.config.maxAgents);
            await this.orchestrator.startAgents(agentCount);
            
            // Show monitoring dashboard
            await this.monitor.showDashboard();
            
            // Start automatic work distribution
            await this.startWorkDistribution();
            
            // Start completion monitoring
            this.startCompletionMonitoring();
            
            vscode.window.showInformationMessage(
                `🚀 Auto-orchestration started with ${agentCount} agents for ${detection.workCount} tasks`
            );
        } else {
            vscode.window.showInformationMessage('No work detected. Auto-orchestration standing by.');
            
            // Start periodic work detection
            if (this.config.autoDetectWork) {
                this.startPeriodicDetection();
            }
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) return;
        
        debugLog('Stopping automatic orchestration');
        this.isRunning = false;
        
        // Stop all intervals
        if (this.orchestrationInterval) {
            clearInterval(this.orchestrationInterval);
            this.orchestrationInterval = null;
        }
        
        if (this.completionCheckInterval) {
            clearInterval(this.completionCheckInterval);
            this.completionCheckInterval = null;
        }
        
        // Stop work detection
        this.workDetector.stopAutoDetection();
        
        // Stop agents
        await this.orchestrator.stopAgents();
        
        // Dispose monitor
        this.monitor.dispose();
        
        vscode.window.showInformationMessage('Auto-orchestration stopped');
    }

    private async startWorkDistribution(): Promise<void> {
        debugLog('Starting automatic work distribution');
        
        // Load detected problems
        const problemsFile = path.join(this.workspacePath, '.autoclaude', 'detected_problems.txt');
        await this.workDistributor.loadWorkFromFile(problemsFile);
        
        // Initial distribution
        await this.distributeWork();
        
        // Set up periodic redistribution
        this.orchestrationInterval = setInterval(async () => {
            await this.distributeWork();
            await this.checkAndScale();
        }, 30000); // Every 30 seconds
    }

    private async distributeWork(): Promise<void> {
        const idleAgents = await this.orchestrator.getIdleAgents();
        
        for (const agent of idleAgents) {
            const chunk = await this.workDistributor.getWorkChunk(agent.id);
            
            if (chunk) {
                // Format work description
                const workDescription = chunk.items
                    .map(item => `- ${item.file}:${item.line || '?'} - ${item.type}: ${item.message}`)
                    .join('\n');
                
                // Send work to agent
                await this.orchestrator.sendWorkToAgent(agent.id, workDescription);
                
                debugLog(`Distributed ${chunk.items.length} items to ${agent.name}`);
            }
        }
        
        // Release stale chunks
        await this.workDistributor.releaseStaleChunks();
    }

    private async checkAndScale(): Promise<void> {
        if (!this.config.autoScale) return;
        
        const stats = this.workDistributor.getStatistics();
        const agents = this.orchestrator.getAgentStatuses();
        const idleCount = agents.filter(a => a.status === 'idle' || a.status === 'ready').length;
        
        // Scale up if too much pending work and no idle agents
        if (stats.pending > 50 && idleCount === 0) {
            const currentCount = agents.length;
            const targetCount = Math.min(currentCount + 5, this.config.maxAgents);
            
            if (targetCount > currentCount) {
                debugLog(`Auto-scaling up from ${currentCount} to ${targetCount} agents`);
                await this.orchestrator.scaleAgents(targetCount);
            }
        }
        
        // Scale down if many idle agents
        if (idleCount > agents.length / 2 && agents.length > 5) {
            const targetCount = Math.max(5, agents.length - idleCount + 2);
            debugLog(`Auto-scaling down from ${agents.length} to ${targetCount} agents`);
            await this.orchestrator.scaleAgents(targetCount);
        }
    }

    private startCompletionMonitoring(): void {
        if (!this.config.autoShutdown) return;
        
        this.completionCheckInterval = setInterval(async () => {
            const stats = this.workDistributor.getStatistics();
            
            // Check if all work is complete
            if (stats.pending === 0 && stats.assigned === 0) {
                debugLog('All work completed, initiating auto-shutdown');
                
                // Generate final report
                const reportPath = await this.monitor.generateHtmlReport();
                
                // Show completion message
                const action = await vscode.window.showInformationMessage(
                    `✅ All ${stats.completed} tasks completed! View report?`,
                    'View Report', 'Close'
                );
                
                if (action === 'View Report') {
                    const reportUri = vscode.Uri.file(reportPath);
                    await vscode.env.openExternal(reportUri);
                }
                
                // Stop orchestration
                await this.stop();
            }
        }, 60000); // Check every minute
    }

    private startPeriodicDetection(): void {
        this.orchestrationInterval = setInterval(async () => {
            if (!this.isRunning) return;
            
            const detection = await this.workDetector.detectWork();
            
            if (detection.hasWork && this.orchestrator.getAgentStatuses().length === 0) {
                debugLog(`Detected new work: ${detection.workCount} items`);
                
                // Restart orchestration
                await this.start();
            }
        }, this.config.workDetectionInterval * 1000);
    }

    async getStatus(): Promise<{
        isRunning: boolean;
        agents: number;
        workPending: number;
        workCompleted: number;
        uptime: number;
    }> {
        const stats = this.workDistributor.getStatistics();
        const agents = this.orchestrator.getAgentStatuses();
        
        return {
            isRunning: this.isRunning,
            agents: agents.length,
            workPending: stats.pending,
            workCompleted: stats.completed,
            uptime: this.isRunning ? Date.now() - (this as any).startTime : 0
        };
    }

    async emergencyStop(): Promise<void> {
        debugLog('Emergency stop initiated');
        
        // Force stop all components
        this.isRunning = false;
        
        if (this.orchestrationInterval) {
            clearInterval(this.orchestrationInterval);
        }
        
        if (this.completionCheckInterval) {
            clearInterval(this.completionCheckInterval);
        }
        
        // Kill tmux session immediately
        await this.orchestrator.stopAgents();
        
        vscode.window.showWarningMessage('Emergency stop completed');
    }
}