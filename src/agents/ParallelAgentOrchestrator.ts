import * as vscode from 'vscode';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { debugLog } from '../utils/logging';
import { SubAgent } from '../subagents/SubAgent';
import { SubAgentRunner } from '../subagents/SubAgentRunner';
import { getValidatedConfig } from '../core';
import { SettingsManager } from '../services/settingsManager';

const execAsync = promisify(exec);
const fsAsync = fs.promises;

export interface AgentConfig {
    id: string;
    name: string;
    paneId: string;
    status: 'starting' | 'ready' | 'working' | 'idle' | 'error' | 'disabled';
    contextUsage: number;
    lastActivity: Date;
    lastHeartbeat: Date;
    restartCount: number;
    errors: number;
    workCycles: number;
}

export interface OrchestrationConfig {
    maxAgents: number;
    defaultAgents: number;
    sessionName: string;
    staggerDelay: number;
    contextThreshold: number;
    idleTimeout: number;
    maxErrors: number;
    autoRestart: boolean;
    tmuxKillOnExit: boolean;
    checkInterval: number;
}

export class ParallelAgentOrchestrator {
    private agents: Map<string, AgentConfig> = new Map();
    private tmuxSession: string;
    private isRunning: boolean = false;
    private monitorInterval: NodeJS.Timeout | null = null;
    private heartbeatDir: string;
    private stateFile: string;
    private workspacePath: string;
    private config: OrchestrationConfig;
    private settingsManager: SettingsManager;
    private adaptiveStagger: number;

    constructor(workspacePath: string, config?: Partial<OrchestrationConfig>) {
        this.workspacePath = workspacePath;
        this.tmuxSession = config?.sessionName || 'claude_agents';
        this.heartbeatDir = path.join(workspacePath, '.heartbeats');
        this.stateFile = path.join(workspacePath, '.claude_agent_farm_state.json');
        
        // Default configuration
        this.config = {
            maxAgents: 50,
            defaultAgents: 5,
            sessionName: this.tmuxSession,
            staggerDelay: 10,
            contextThreshold: 20,
            idleTimeout: 60,
            maxErrors: 3,
            autoRestart: true,
            tmuxKillOnExit: true,
            checkInterval: 10,
            ...config
        };
        
        this.settingsManager = new SettingsManager(workspacePath);
        this.adaptiveStagger = this.config.staggerDelay;
    }

    async initialize(): Promise<void> {
        debugLog('Initializing Parallel Agent Orchestrator');
        
        // Create heartbeat directory
        await fsAsync.mkdir(this.heartbeatDir, { recursive: true });
        
        // Initialize settings manager
        await this.settingsManager.initialize();
        
        // Check for settings corruption and auto-recover
        if (await this.settingsManager.detectCorruption()) {
            debugLog('Settings corruption detected, attempting recovery');
            const recovered = await this.settingsManager.autoRecover();
            if (!recovered) {
                throw new Error('Failed to recover from settings corruption');
            }
        }
        
        // Backup settings before starting
        await this.settingsManager.backupSettings();
        
        // Check tmux availability
        try {
            await execAsync('which tmux');
        } catch (error) {
            throw new Error('tmux is not installed. Please install tmux to use parallel agents.');
        }
        
        // Kill any existing session
        try {
            await execAsync(`tmux kill-session -t ${this.tmuxSession}`);
        } catch {
            // Session doesn't exist, which is fine
        }
    }

    async startAgents(count: number = this.config.defaultAgents): Promise<void> {
        if (this.isRunning) {
            throw new Error('Agents are already running');
        }
        
        if (count > this.config.maxAgents) {
            throw new Error(`Cannot start more than ${this.config.maxAgents} agents`);
        }
        
        debugLog(`Starting ${count} parallel agents`);
        
        // Create tmux session with controller window
        await this.createTmuxSession();
        
        // Launch agents with adaptive stagger delay
        for (let i = 0; i < count; i++) {
            // Acquire lock for safe launch
            const lockAcquired = await this.settingsManager.acquireLock();
            if (!lockAcquired) {
                debugLog(`Waiting for lock to launch agent ${i}`);
                await this.delay(2000);
                i--; // Retry this agent
                continue;
            }
            
            try {
                const launchSuccess = await this.launchAgent(i);
                
                // Adaptive stagger adjustment
                if (launchSuccess) {
                    // Successful launch, reduce stagger time (but not below baseline)
                    this.adaptiveStagger = Math.max(this.config.staggerDelay, this.adaptiveStagger / 2);
                } else {
                    // Failed launch, increase stagger time (max 60s)
                    this.adaptiveStagger = Math.min(60, this.adaptiveStagger * 2);
                }
                
                if (i < count - 1) {
                    await this.delay(this.adaptiveStagger * 1000);
                }
            } finally {
                await this.settingsManager.releaseLock();
            }
        }
        
        this.isRunning = true;
        
        // Start monitoring
        if (this.config.autoRestart) {
            this.startMonitoring();
        }
        
        // Save initial state
        await this.saveState();
        
        vscode.window.showInformationMessage(`Started ${count} parallel Claude agents`);
    }

    async stopAgents(): Promise<void> {
        if (!this.isRunning) {
            return;
        }
        
        debugLog('Stopping all agents');
        
        // Stop monitoring
        this.stopMonitoring();
        
        // Kill tmux session
        if (this.config.tmuxKillOnExit) {
            try {
                await execAsync(`tmux kill-session -t ${this.tmuxSession}`);
            } catch {
                // Session might already be gone
            }
        }
        
        // Clean up
        this.agents.clear();
        this.isRunning = false;
        
        // Remove state file
        try {
            await fsAsync.unlink(this.stateFile);
        } catch {
            // File might not exist
        }
        
        vscode.window.showInformationMessage('Stopped all parallel agents');
    }

    private async createTmuxSession(): Promise<void> {
        // Create session with initial controller window
        await execAsync(`tmux new-session -d -s ${this.tmuxSession} -n controller`);
        
        // Set up controller window for monitoring dashboard
        await execAsync(`tmux send-keys -t ${this.tmuxSession}:controller 'echo "Claude Agent Farm Controller"' C-m`);
        
        // Enable mouse support if configured
        await execAsync(`tmux set -t ${this.tmuxSession} mouse on`);
    }

    private async launchAgent(agentId: number): Promise<boolean> {
        const paneId = `${agentId}`;
        const agentName = `Agent ${agentId.toString().padStart(2, '0')}`;
        
        debugLog(`Launching ${agentName}`);
        
        try {
            // Create new window for agent
            const windowName = `agent${agentId}`;
            await execAsync(`tmux new-window -t ${this.tmuxSession} -n ${windowName}`);
            
            // Initialize agent config
            const agent: AgentConfig = {
                id: agentId.toString(),
                name: agentName,
                paneId: `${this.tmuxSession}:${windowName}.0`,
                status: 'starting',
                contextUsage: 100,
                lastActivity: new Date(),
                lastHeartbeat: new Date(),
                restartCount: 0,
                errors: 0,
                workCycles: 0
            };
            
            this.agents.set(agent.id, agent);
            
            // Launch Claude in the pane
            const claudeCommand = this.buildClaudeCommand(agentId);
            await this.sendToPane(agent.paneId, claudeCommand);
            
            // Create heartbeat file
            const heartbeatFile = path.join(this.heartbeatDir, `agent${agentId.toString().padStart(2, '0')}.heartbeat`);
            await fsAsync.writeFile(heartbeatFile, new Date().toISOString());
            
            // Update pane title
            await this.updatePaneTitle(agent);
            
            return true;
        } catch (error) {
            debugLog(`Failed to launch ${agentName}: ${error}`);
            return false;
        }
    }

    private buildClaudeCommand(agentId: number): string {
        const config = getValidatedConfig();
        const skipPermissions = config.session.skipPermissions ? '--dangerously-skip-permissions' : '';
        
        // Add unique seed for better work distribution
        const seed = Date.now() + agentId;
        
        return `ENABLE_BACKGROUND_TASKS=1 claude ${skipPermissions} --seed ${seed}`;
    }

    private async sendToPane(paneId: string, command: string): Promise<void> {
        await execAsync(`tmux send-keys -t ${paneId} "${command}" C-m`);
    }

    private async updatePaneTitle(agent: AgentConfig): Promise<void> {
        const contextWarning = agent.contextUsage <= this.config.contextThreshold ? '⚠️' : '';
        const title = `${agent.name} | ${contextWarning}${agent.contextUsage}% | ${agent.status}`;
        
        await execAsync(`tmux select-pane -t ${agent.paneId} -T "${title}"`);
    }

    private startMonitoring(): void {
        debugLog('Starting agent monitoring');
        
        this.monitorInterval = setInterval(async () => {
            await this.checkAgentHealth();
            await this.saveState();
        }, this.config.checkInterval * 1000);
    }

    private stopMonitoring(): void {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
    }

    private async checkAgentHealth(): Promise<void> {
        for (const [id, agent] of this.agents) {
            try {
                // Check heartbeat
                const heartbeatFile = path.join(this.heartbeatDir, `agent${agent.id.padStart(2, '0')}.heartbeat`);
                const heartbeatData = await fsAsync.readFile(heartbeatFile, 'utf-8');
                const lastHeartbeat = new Date(heartbeatData);
                const heartbeatAge = Date.now() - lastHeartbeat.getTime();
                
                // Update agent heartbeat
                agent.lastHeartbeat = lastHeartbeat;
                
                // Check if agent is stuck (no heartbeat for 2 minutes)
                if (heartbeatAge > 120000 && agent.status !== 'disabled') {
                    debugLog(`${agent.name} appears stuck (no heartbeat for ${Math.floor(heartbeatAge / 1000)}s)`);
                    agent.status = 'error';
                    agent.errors++;
                    
                    if (this.config.autoRestart && agent.errors < this.config.maxErrors) {
                        await this.restartAgent(agent);
                    } else if (agent.errors >= this.config.maxErrors) {
                        agent.status = 'disabled';
                        debugLog(`${agent.name} disabled after ${agent.errors} errors`);
                    }
                }
                
                // Check context usage from pane content
                const paneContent = await this.capturePaneContent(agent.paneId);
                const contextMatch = paneContent.match(/Context:\s*(\d+)%/);
                if (contextMatch) {
                    agent.contextUsage = parseInt(contextMatch[1]);
                    
                    // Auto-clear context if below threshold
                    if (agent.contextUsage <= this.config.contextThreshold && agent.status === 'working') {
                        debugLog(`${agent.name} context low (${agent.contextUsage}%), clearing...`);
                        await this.sendToPane(agent.paneId, '/clear');
                    }
                }
                
                // Update pane title
                await this.updatePaneTitle(agent);
                
            } catch (error) {
                debugLog(`Error checking health for ${agent.name}: ${error}`);
            }
        }
    }

    private async restartAgent(agent: AgentConfig): Promise<void> {
        debugLog(`Restarting ${agent.name} (attempt ${agent.restartCount + 1})`);
        
        agent.restartCount++;
        agent.status = 'starting';
        
        // Kill current process
        await execAsync(`tmux send-keys -t ${agent.paneId} C-c`);
        await this.delay(1000);
        
        // Clear pane
        await execAsync(`tmux send-keys -t ${agent.paneId} clear C-m`);
        await this.delay(500);
        
        // Restart with exponential backoff
        const backoffDelay = Math.min(10 * Math.pow(2, agent.restartCount - 1), 300) * 1000;
        await this.delay(backoffDelay);
        
        // Launch Claude again
        const claudeCommand = this.buildClaudeCommand(parseInt(agent.id));
        await this.sendToPane(agent.paneId, claudeCommand);
    }

    private async capturePaneContent(paneId: string): Promise<string> {
        const { stdout } = await execAsync(`tmux capture-pane -t ${paneId} -p`);
        return stdout;
    }

    private async saveState(): Promise<void> {
        const state = {
            session: this.tmuxSession,
            numAgents: this.agents.size,
            agents: Object.fromEntries(
                Array.from(this.agents.entries()).map(([id, agent]) => [
                    id,
                    {
                        status: agent.status,
                        contextUsage: agent.contextUsage,
                        lastActivity: agent.lastActivity.toISOString(),
                        lastHeartbeat: agent.lastHeartbeat.toISOString(),
                        restartCount: agent.restartCount,
                        errors: agent.errors,
                        workCycles: agent.workCycles
                    }
                ])
            ),
            timestamp: new Date().toISOString()
        };
        
        await fsAsync.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Public methods for external monitoring
    getAgentStatuses(): AgentConfig[] {
        return Array.from(this.agents.values());
    }

    async sendCommandToAllAgents(command: string): Promise<void> {
        debugLog(`Broadcasting command to all agents: ${command}`);
        
        for (const agent of this.agents.values()) {
            if (agent.status !== 'disabled') {
                await this.sendToPane(agent.paneId, command);
                await this.delay(100); // Small delay between sends
            }
        }
    }
    
    async sendWorkToAgent(agentId: string, workDescription: string): Promise<void> {
        const agent = this.agents.get(agentId);
        if (!agent || agent.status === 'disabled') {
            debugLog(`Cannot send work to agent ${agentId} - not found or disabled`);
            return;
        }
        
        debugLog(`Sending work to ${agent.name}`);
        
        // Update agent status
        agent.status = 'working';
        agent.lastActivity = new Date();
        agent.workCycles++;
        
        // Send work prompt to agent
        const workPrompt = `Please work on the following items:\n\n${workDescription}\n\nFix these issues one by one, testing your changes as you go.`;
        await this.sendToPane(agent.paneId, workPrompt);
        
        // Update pane title
        await this.updatePaneTitle(agent);
    }
    
    async getIdleAgents(): Promise<AgentConfig[]> {
        return Array.from(this.agents.values()).filter(
            agent => agent.status === 'idle' || agent.status === 'ready'
        );
    }
    
    async scaleAgents(targetCount: number): Promise<void> {
        const currentCount = this.agents.size;
        
        if (targetCount > currentCount) {
            // Scale up
            const toAdd = Math.min(targetCount - currentCount, this.config.maxAgents - currentCount);
            debugLog(`Scaling up: adding ${toAdd} agents`);
            
            for (let i = 0; i < toAdd; i++) {
                const newId = currentCount + i;
                await this.launchAgent(newId);
                if (i < toAdd - 1) {
                    await this.delay(this.adaptiveStagger * 1000);
                }
            }
        } else if (targetCount < currentCount) {
            // Scale down - stop excess agents
            const toRemove = currentCount - targetCount;
            debugLog(`Scaling down: removing ${toRemove} agents`);
            
            // Stop agents with least work first
            const sortedAgents = Array.from(this.agents.values())
                .sort((a, b) => a.workCycles - b.workCycles)
                .slice(0, toRemove);
            
            for (const agent of sortedAgents) {
                await this.stopAgent(agent.id);
            }
        }
    }
    
    private async stopAgent(agentId: string): Promise<void> {
        const agent = this.agents.get(agentId);
        if (!agent) return;
        
        debugLog(`Stopping ${agent.name}`);
        
        // Send exit command
        await this.sendToPane(agent.paneId, 'exit');
        await this.delay(500);
        
        // Close window
        const windowName = `agent${agentId}`;
        await execAsync(`tmux kill-window -t ${this.tmuxSession}:${windowName}`);
        
        // Remove from tracking
        this.agents.delete(agentId);
        
        // Clean up heartbeat file
        const heartbeatFile = path.join(this.heartbeatDir, `agent${agentId.padStart(2, '0')}.heartbeat`);
        try {
            await fsAsync.unlink(heartbeatFile);
        } catch {
            // File might not exist
        }
    }

    async attachToSession(): Promise<void> {
        if (!this.isRunning) {
            throw new Error('No active agent session');
        }
        
        // Open terminal and attach to tmux session
        const terminal = vscode.window.createTerminal({
            name: 'Claude Agent Farm',
            cwd: this.workspacePath
        });
        
        terminal.sendText(`tmux attach -t ${this.tmuxSession}`);
        terminal.show();
    }
}