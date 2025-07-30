import blessed from 'blessed';
import contrib from 'blessed-contrib';
import chalk from 'chalk';
import { EventEmitter } from 'eventemitter3';
import { Config } from './config';
import { Logger } from '../utils/logger';
import { ClaudeSession } from './session';
import { MessageQueue } from '../queue/messageQueue';
import { ParallelAgentManager } from '../agents/parallelAgentManager';
import { UIManager } from '../ui/uiManager';
import { ScriptRunner } from './scriptRunner';
import fs from 'fs/promises';
import path from 'path';

export interface CLIOptions {
    message?: string;
    skipPermissions?: boolean;
    autoStart?: boolean;
    output?: string;
    parallel?: string;
}

export class ClaudeAutopilotCLI extends EventEmitter {
    private config: Config;
    private logger: Logger;
    private session: ClaudeSession | null = null;
    private queue: MessageQueue;
    private agentManager: ParallelAgentManager;
    private ui: UIManager | null = null;
    private scriptRunner: ScriptRunner;
    private isRunning: boolean = false;

    constructor(config: Config, logger: Logger) {
        super();
        this.config = config;
        this.logger = logger;
        this.queue = new MessageQueue(config, logger);
        this.agentManager = new ParallelAgentManager(config, logger);
        this.scriptRunner = new ScriptRunner(config, logger);
    }

    async start(options: CLIOptions): Promise<void> {
        try {
            this.logger.info('Starting Claude Autopilot in interactive mode...');
            
            // Initialize UI
            this.ui = new UIManager(this.config, this.logger);
            await this.ui.initialize();
            
            // Set up event handlers
            this.setupEventHandlers();
            
            // Initialize components
            await this.initialize();
            
            // Add initial message if provided
            if (options.message) {
                await this.queue.addMessage({
                    text: options.message,
                    timestamp: Date.now(),
                    status: 'pending'
                });
            }
            
            // Start Claude session
            this.session = new ClaudeSession(this.config, this.logger);
            await this.session.start(options.skipPermissions);
            
            // Auto-start processing if requested
            if (options.autoStart) {
                await this.startProcessing();
            }
            
            // Keep the process running
            await this.ui.run();
            
        } catch (error) {
            this.logger.error('Failed to start CLI:', error);
            process.exit(1);
        }
    }

    async runSingle(message: string, options: CLIOptions): Promise<void> {
        try {
            this.logger.info('Running single message...');
            
            // Initialize session
            this.session = new ClaudeSession(this.config, this.logger);
            await this.session.start(options.skipPermissions);
            
            // Send message
            const output = await this.session.sendMessage(message);
            
            // Save output if requested
            if (options.output) {
                await fs.writeFile(options.output, output, 'utf-8');
                this.logger.info(`Output saved to: ${options.output}`);
            } else {
                console.log(output);
            }
            
            // Clean up
            await this.session.stop();
            process.exit(0);
            
        } catch (error) {
            this.logger.error('Failed to run single message:', error);
            process.exit(1);
        }
    }

    async runBatch(file: string, options: CLIOptions): Promise<void> {
        try {
            this.logger.info(`Processing batch file: ${file}`);
            
            // Read messages from file
            const content = await fs.readFile(file, 'utf-8');
            const messages = content.split('\\n').filter(line => line.trim());
            
            this.logger.info(`Found ${messages.length} messages to process`);
            
            // Initialize queue
            for (const message of messages) {
                await this.queue.addMessage({
                    text: message,
                    timestamp: Date.now(),
                    status: 'pending'
                });
            }
            
            // Start parallel agents if requested
            const parallelCount = parseInt(options.parallel || '1');
            if (parallelCount > 1) {
                await this.agentManager.startAgents(parallelCount);
                await this.agentManager.distributeWork(this.queue);
            } else {
                // Single agent processing
                this.session = new ClaudeSession(this.config, this.logger);
                await this.session.start(options.skipPermissions);
                await this.processQueue();
            }
            
        } catch (error) {
            this.logger.error('Failed to run batch:', error);
            process.exit(1);
        }
    }

    async manageAgents(options: any): Promise<void> {
        try {
            if (options.start) {
                const count = parseInt(options.start);
                await this.agentManager.startAgents(count);
                this.logger.info(`Started ${count} parallel agents`);
            }
            
            if (options.list) {
                const agents = this.agentManager.getAgentStatuses();
                console.log(chalk.cyan('\\nRunning Agents:'));
                agents.forEach(agent => {
                    console.log(`  ${agent.id}: ${agent.status} (${agent.messagesProcessed} processed)`);
                });
            }
            
            if (options.stop) {
                await this.agentManager.stopAllAgents();
                this.logger.info('All agents stopped');
            }
            
            if (options.monitor) {
                const monitor = new UIManager(this.config, this.logger);
                await monitor.showAgentDashboard(this.agentManager);
            }
            
        } catch (error) {
            this.logger.error('Failed to manage agents:', error);
            process.exit(1);
        }
    }

    async manageQueue(options: any): Promise<void> {
        try {
            if (options.list) {
                const messages = await this.queue.getAllMessages();
                console.log(chalk.cyan(`\\nMessage Queue (${messages.length} items):`));
                messages.forEach((msg, index) => {
                    console.log(`  ${index + 1}. [${msg.status}] ${msg.text.substring(0, 50)}...`);
                });
            }
            
            if (options.add) {
                await this.queue.addMessage({
                    text: options.add,
                    timestamp: Date.now(),
                    status: 'pending'
                });
                this.logger.info('Message added to queue');
            }
            
            if (options.clear) {
                await this.queue.clear();
                this.logger.info('Queue cleared');
            }
            
            if (options.remove) {
                await this.queue.removeMessage(options.remove);
                this.logger.info('Message removed');
            }
            
        } catch (error) {
            this.logger.error('Failed to manage queue:', error);
            process.exit(1);
        }
    }

    async manageConfig(options: any): Promise<void> {
        try {
            if (options.list) {
                const settings = this.config.getAll();
                console.log(chalk.cyan('\\nConfiguration Settings:'));
                Object.entries(settings).forEach(([key, value]) => {
                    console.log(`  ${key}: ${JSON.stringify(value)}`);
                });
            }
            
            if (options.set) {
                const [key, value] = options.set.split('=');
                this.config.set(key, value);
                this.logger.info(`Set ${key} = ${value}`);
            }
            
            if (options.get) {
                const value = this.config.get(options.get);
                console.log(`${options.get}: ${JSON.stringify(value)}`);
            }
            
            if (options.reset) {
                this.config.reset();
                this.logger.info('Configuration reset to defaults');
            }
            
            if (options.edit) {
                const editor = process.env.EDITOR || 'nano';
                const { spawn } = require('child_process');
                spawn(editor, [this.config.getConfigPath()], { stdio: 'inherit' });
            }
            
        } catch (error) {
            this.logger.error('Failed to manage config:', error);
            process.exit(1);
        }
    }

    async runChecks(options: any): Promise<void> {
        try {
            this.logger.info('Running quality checks...');
            
            const results = await this.scriptRunner.runChecks(options.dir);
            
            if (results.hasIssues) {
                this.logger.warn(`Found ${results.totalIssues} issues`);
                
                if (options.loop) {
                    const maxIterations = parseInt(options.maxIterations);
                    await this.scriptRunner.runLoop(options.dir, maxIterations);
                }
            } else {
                this.logger.info('No issues found!');
            }
            
        } catch (error) {
            this.logger.error('Failed to run checks:', error);
            process.exit(1);
        }
    }

    private async initialize(): Promise<void> {
        await this.queue.initialize();
        await this.agentManager.initialize();
    }

    private setupEventHandlers(): void {
        if (!this.ui) return;
        
        // UI events
        this.ui.on('addMessage', async (text: string) => {
            await this.queue.addMessage({
                text,
                timestamp: Date.now(),
                status: 'pending'
            });
        });
        
        this.ui.on('startProcessing', async () => {
            await this.startProcessing();
        });
        
        this.ui.on('stopProcessing', async () => {
            await this.stopProcessing();
        });
        
        this.ui.on('quit', async () => {
            await this.cleanup();
            process.exit(0);
        });
        
        // Queue events
        this.queue.on('messageAdded', (message) => {
            this.ui?.updateQueue(this.queue.getAllMessages());
        });
        
        this.queue.on('messageUpdated', (message) => {
            this.ui?.updateQueue(this.queue.getAllMessages());
        });
        
        // Session events
        if (this.session) {
            this.session.on('output', (output: string) => {
                this.ui?.appendClaudeOutput(output);
            });
            
            this.session.on('error', (error: Error) => {
                this.ui?.showError(error.message);
            });
        }
    }

    private async startProcessing(): Promise<void> {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.logger.info('Starting message processing...');
        
        while (this.isRunning) {
            const message = await this.queue.getNextMessage();
            if (!message) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            
            try {
                await this.queue.updateMessageStatus(message.id!, 'processing');
                
                if (this.session) {
                    const output = await this.session.sendMessage(message.text);
                    message.output = output;
                    await this.queue.updateMessageStatus(message.id!, 'completed');
                }
            } catch (error) {
                this.logger.error('Error processing message:', error);
                await this.queue.updateMessageStatus(message.id!, 'error');
            }
        }
    }

    private async stopProcessing(): Promise<void> {
        this.isRunning = false;
        this.logger.info('Stopped message processing');
    }

    private async processQueue(): Promise<void> {
        while (true) {
            const message = await this.queue.getNextMessage();
            if (!message) break;
            
            try {
                const output = await this.session!.sendMessage(message.text);
                console.log(chalk.green('Output:'), output);
            } catch (error) {
                this.logger.error('Error processing message:', error);
            }
        }
    }

    private async cleanup(): Promise<void> {
        await this.session?.stop();
        await this.agentManager.stopAllAgents();
        await this.queue.save();
    }
}