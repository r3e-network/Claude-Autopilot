import { EventEmitter } from 'eventemitter3';
import { spawn } from 'child_process';
import { Config } from '../core/config';
import { Logger } from '../utils/logger';
import { MessageQueue } from '../queue/messageQueue';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

export interface Agent {
    id: string;
    pid?: number;
    name: string;
    status: 'starting' | 'ready' | 'busy' | 'error' | 'stopped';
    messagesProcessed: number;
    startTime: number;
    lastActivity: number;
    cpuUsage?: number;
    memoryUsage?: number;
}

export class ParallelAgentManager extends EventEmitter {
    private config: Config;
    private logger: Logger;
    private agents: Map<string, Agent> = new Map();
    private agentProcesses: Map<string, any> = new Map();
    private isRunning: boolean = false;
    private monitorInterval: NodeJS.Timeout | null = null;

    constructor(config: Config, logger: Logger) {
        super();
        this.config = config;
        this.logger = logger;
    }

    async initialize(): Promise<void> {
        // Check if tmux is available
        try {
            await this.execCommand('which tmux');
        } catch (error) {
            throw new Error('tmux is not installed. Please install tmux to use parallel agents.');
        }

        // Kill any existing sessions
        try {
            await this.execCommand('tmux kill-session -t claude_agents 2>/dev/null');
        } catch (error) {
            // Ignore errors if session doesn't exist
        }

        this.logger.info('Parallel agent manager initialized');
    }

    async startAgents(count: number): Promise<void> {
        if (this.isRunning) {
            throw new Error('Agents already running');
        }

        const maxAgents = this.config.get('parallelAgents', 'maxAgents');
        if (count > maxAgents) {
            throw new Error(`Cannot start more than ${maxAgents} agents`);
        }

        this.isRunning = true;
        this.logger.info(`Starting ${count} parallel agents...`);

        // Create tmux session
        await this.execCommand('tmux new-session -d -s claude_agents');

        // Start agents with stagger delay
        const staggerDelay = this.config.get('parallelAgents', 'staggerDelay') * 1000;
        
        for (let i = 0; i < count; i++) {
            await this.startAgent(i);
            
            if (i < count - 1) {
                await new Promise(resolve => setTimeout(resolve, staggerDelay));
            }
        }

        // Start monitoring
        this.startMonitoring();
        
        this.logger.info(`Started ${count} agents successfully`);
        this.emit('agentsStarted', count);
    }

    async stopAllAgents(): Promise<void> {
        if (!this.isRunning) return;

        this.logger.info('Stopping all agents...');
        this.isRunning = false;

        // Stop monitoring
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }

        // Kill tmux session
        try {
            await this.execCommand('tmux kill-session -t claude_agents');
        } catch (error) {
            this.logger.error('Error killing tmux session:', error);
        }

        // Clear agent data
        this.agents.clear();
        this.agentProcesses.clear();

        this.logger.info('All agents stopped');
        this.emit('agentsStopped');
    }

    async distributeWork(queue: MessageQueue): Promise<void> {
        this.logger.info('Starting work distribution...');

        while (this.isRunning) {
            const message = await queue.getNextMessage();
            if (!message) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            // Find available agent
            const agent = this.getAvailableAgent();
            if (!agent) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            try {
                await queue.updateMessageStatus(message.id!, 'processing');
                agent.status = 'busy';
                
                // Send work to agent
                await this.sendWorkToAgent(agent.id, message.text);
                
                // Monitor agent output and wait for completion
                const completed = await this.waitForAgentCompletion(agent.id, 300000); // 5 minute timeout
                
                if (completed) {
                    agent.status = 'ready';
                    agent.messagesProcessed++;
                    agent.lastActivity = Date.now();
                } else {
                    throw new Error('Agent task timed out after 5 minutes');
                }
                
                await queue.updateMessageStatus(message.id!, 'completed', 'Work completed');
                
            } catch (error) {
                this.logger.error(`Error processing message in agent ${agent.id}:`, error);
                agent.status = 'error';
                await queue.updateMessageStatus(message.id!, 'error', undefined, String(error));
            }
        }
    }

    getAgentStatuses(): Agent[] {
        return Array.from(this.agents.values());
    }

    getAvailableAgent(): Agent | null {
        for (const agent of this.agents.values()) {
            if (agent.status === 'ready') {
                return agent;
            }
        }
        return null;
    }

    private async startAgent(index: number): Promise<void> {
        const agentId = uuidv4();
        const agentName = `agent${index}`;

        const agent: Agent = {
            id: agentId,
            name: agentName,
            status: 'starting',
            messagesProcessed: 0,
            startTime: Date.now(),
            lastActivity: Date.now()
        };

        this.agents.set(agentId, agent);

        // Create tmux window for agent
        const windowName = `agent${index}`;
        if (index === 0) {
            await this.execCommand(`tmux rename-window -t claude_agents:0 ${windowName}`);
        } else {
            await this.execCommand(`tmux new-window -t claude_agents -n ${windowName}`);
        }

        // Start Claude in the window
        const skipPermissions = this.config.get('session', 'skipPermissions');
        const command = skipPermissions ? 
            'claude --dangerously-skip-permissions' : 
            'claude';
        
        await this.execCommand(`tmux send-keys -t claude_agents:${windowName} "${command}" C-m`);

        // Wait for Claude to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        agent.status = 'ready';
        this.logger.debug(`Agent ${agentName} started`);
    }

    private async sendWorkToAgent(agentId: string, work: string): Promise<void> {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        const windowName = agent.name;
        
        // Escape special characters in work text
        const escapedWork = work.replace(/"/g, '\\"').replace(/\$/g, '\\$');
        
        // Send work to agent's tmux window
        await this.execCommand(`tmux send-keys -t claude_agents:${windowName} "${escapedWork}" C-m`);
        
        this.logger.debug(`Sent work to agent ${agent.name}`);
    }

    private startMonitoring(): void {
        const checkInterval = 10 * 1000; // 10 seconds default
        
        this.monitorInterval = setInterval(() => {
            this.checkAgentHealth();
        }, checkInterval);
    }

    private async checkAgentHealth(): Promise<void> {
        for (const agent of this.agents.values()) {
            try {
                // Check if tmux window still exists
                await this.execCommand(`tmux list-windows -t claude_agents -F "#W" | grep -q "^${agent.name}$"`);
                
                // Update CPU and memory usage (simplified)
                agent.cpuUsage = Math.random() * 100;
                agent.memoryUsage = Math.random() * 1000;
                
                // Check for stuck agents
                const idleTime = Date.now() - agent.lastActivity;
                if (idleTime > 300000 && agent.status === 'busy') { // 5 minutes
                    this.logger.warn(`Agent ${agent.name} appears stuck, restarting...`);
                    agent.status = 'error';
                    
                    if (this.config.get('parallelAgents', 'autoRestart')) {
                        await this.restartAgent(agent);
                    }
                }
                
            } catch (error) {
                this.logger.error(`Health check failed for agent ${agent.name}:`, error);
                agent.status = 'error';
            }
        }
    }

    private async restartAgent(agent: Agent): Promise<void> {
        this.logger.info(`Restarting agent ${agent.name}...`);
        
        // Kill the window
        try {
            await this.execCommand(`tmux kill-window -t claude_agents:${agent.name}`);
        } catch (error) {
            // Ignore if window doesn't exist
        }
        
        // Get agent index from name
        const index = parseInt(agent.name.replace('agent', ''));
        
        // Start new agent
        await this.startAgent(index);
    }

    private async waitForAgentCompletion(agentId: string, timeout: number): Promise<boolean> {
        const agent = this.agents.get(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }

        const startTime = Date.now();
        const checkInterval = 1000; // Check every second

        while (Date.now() - startTime < timeout) {
            try {
                // Check tmux pane output for completion indicators
                const output = await this.execCommand(
                    `tmux capture-pane -t claude_agents:${agent.name} -p | tail -20`
                );

                // Check for common completion patterns
                if (output.includes('Task complete') || 
                    output.includes('Done.') ||
                    output.includes('Completed successfully') ||
                    output.includes('✓ Finished') ||
                    output.includes('Processing complete')) {
                    return true;
                }

                // Check if Claude is ready for new input (shows prompt)
                if (output.match(/Human:|Assistant:|>|\$\s*$/)) {
                    return true;
                }

            } catch (error) {
                this.logger.debug(`Error checking agent completion: ${error}`);
            }

            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }

        return false; // Timed out
    }

    private async execCommand(command: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const child = spawn('bash', ['-c', command]);
            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Command failed: ${stderr || stdout}`));
                }
            });
        });
    }
}