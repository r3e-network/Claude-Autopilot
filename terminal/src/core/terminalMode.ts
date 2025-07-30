import readline from 'readline';
import { EventEmitter } from 'eventemitter3';
import chalk from 'chalk';
import { Config } from './config';
import { Logger } from '../utils/logger';
import { MessageQueue } from '../queue/messageQueue';
import { ParallelAgentManager } from '../agents/parallelAgentManager';
import { ClaudeSession } from './session';

export interface TerminalModeOptions {
    skipPermissions?: boolean;
    autoStart?: boolean;
    enableSubagents?: boolean;
}

export class TerminalMode extends EventEmitter {
    private config: Config;
    private logger: Logger;
    private rl: readline.Interface | null = null;
    private queue: MessageQueue;
    private agentManager: ParallelAgentManager;
    private session: ClaudeSession | null = null;
    private isRunning: boolean = false;
    private processingQueue: boolean = false;
    private activeAgents: number = 0;

    constructor(config: Config, logger: Logger) {
        super();
        this.config = config;
        this.logger = logger;
        this.queue = new MessageQueue(config, logger);
        this.agentManager = new ParallelAgentManager(config, logger);
    }

    async initialize(): Promise<void> {
        // Initialize components
        await this.queue.initialize();
        
        if (this.config.get('parallelAgents', 'enabled')) {
            try {
                await this.agentManager.initialize();
                this.logger.info(`Parallel agents initialized with ${this.config.get('parallelAgents', 'defaultAgents')} agents`);
            } catch (error) {
                this.logger.warn('Parallel agents unavailable, continuing in single-agent mode');
                this.config.set('parallelAgents', 'enabled', false);
            }
        }

        // Initialize Claude session
        this.session = new ClaudeSession(this.config, this.logger);
        await this.session.start(this.config.get('session', 'skipPermissions'));

        // Setup readline interface
        this.setupReadline();
        
        this.logger.info('AutoClaude terminal mode initialized');
    }

    private setupReadline(): void {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.cyan('AutoClaude> '),
            historySize: 100
        });

        this.rl.on('line', (input: string) => {
            this.handleInput(input.trim());
        });

        this.rl.on('close', () => {
            this.shutdown();
        });

        // Handle Ctrl+C gracefully
        this.rl.on('SIGINT', () => {
            console.log(chalk.yellow('\\n\\nShutting down AutoClaude...'));
            this.shutdown();
        });
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
        console.log(chalk.cyan('\\n🤖 AutoClaude Terminal Mode'));
        console.log(chalk.gray('Type your message and press Enter to send'));
        console.log(chalk.gray('Use slash commands like /status, /agents, /queue for information'));
        console.log(chalk.gray('Press Ctrl+C to exit\\n'));

        // Auto-start processing if enabled
        if (this.config.get('session', 'autoStart')) {
            await this.startProcessing();
        }

        this.rl?.prompt();
    }

    private async handleInput(input: string): Promise<void> {
        if (!input) {
            this.rl?.prompt();
            return;
        }

        // Handle slash commands
        if (input.startsWith('/')) {
            await this.handleSlashCommand(input);
            this.rl?.prompt();
            return;
        }

        // Regular message - add to queue and process
        console.log(chalk.blue('📝 Adding message to queue...'));
        
        try {
            const messageId = await this.queue.addMessage({
                text: input,
                timestamp: Date.now(),
                status: 'pending'
            });

            console.log(chalk.green(`✅ Message added (ID: ${messageId})`));

            // Auto-process if not already processing
            if (!this.processingQueue) {
                await this.processQueue();
            }

        } catch (error) {
            console.log(chalk.red(`❌ Error adding message: ${error}`));
        }

        this.rl?.prompt();
    }

    private async handleSlashCommand(command: string): Promise<void> {
        const [cmd, ...args] = command.slice(1).split(' ');

        switch (cmd.toLowerCase()) {
            case 'status':
                await this.showStatus();
                break;
            
            case 'agents':
                await this.showAgents();
                break;
            
            case 'queue':
                await this.showQueue();
                break;
            
            case 'config':
                await this.showConfig();
                break;
            
            case 'start':
                await this.startProcessing();
                break;
            
            case 'stop':
                await this.stopProcessing();
                break;
            
            case 'clear':
                await this.clearQueue();
                break;
            
            case 'help':
                this.showHelp();
                break;
            
            default:
                console.log(chalk.red(`❌ Unknown command: /${cmd}`));
                console.log(chalk.gray('Type /help for available commands'));
        }
    }

    private async showStatus(): Promise<void> {
        console.log(chalk.cyan('\\n📊 AutoClaude Status'));
        console.log(`├─ Processing: ${this.processingQueue ? chalk.green('Active') : chalk.red('Stopped')}`);
        console.log(`├─ Queue Size: ${chalk.yellow(this.queue.getPendingMessages().length)}`);
        console.log(`├─ Active Agents: ${chalk.yellow(this.activeAgents)}`);
        console.log(`├─ Parallel Agents: ${this.config.get('parallelAgents', 'enabled') ? chalk.green('Enabled') : chalk.red('Disabled')}`);
        console.log(`└─ Claude Session: ${this.session ? chalk.green('Connected') : chalk.red('Disconnected')}\\n`);
    }

    private async showAgents(): Promise<void> {
        if (!this.config.get('parallelAgents', 'enabled')) {
            console.log(chalk.yellow('📋 Parallel agents are disabled'));
            return;
        }

        console.log(chalk.cyan('\\n🤖 Agent Status'));
        // TODO: Get actual agent status from agentManager
        console.log(`├─ Total Agents: ${this.config.get('parallelAgents', 'defaultAgents')}`);
        console.log(`├─ Active: ${chalk.green(this.activeAgents)}`);
        console.log(`├─ Max Agents: ${this.config.get('parallelAgents', 'maxAgents')}`);
        console.log(`└─ Auto Restart: ${this.config.get('parallelAgents', 'autoRestart') ? chalk.green('On') : chalk.red('Off')}\\n`);
    }

    private async showQueue(): Promise<void> {
        const pending = this.queue.getPendingMessages().length;
        const processing = this.queue.getProcessingMessages().length;
        const completed = this.queue.getCompletedMessages().length;
        const total = pending + processing + completed;
        
        console.log(chalk.cyan(`\\n📋 Message Queue (${total} items)`));
        
        if (total === 0) {
            console.log(chalk.gray('└─ Queue is empty\\n'));
            return;
        }

        console.log(`├─ Pending: ${chalk.yellow(pending)}`);
        console.log(`├─ Processing: ${chalk.blue(processing)}`);
        console.log(`└─ Completed: ${chalk.green(completed)}\\n`);
        
        // Show recent messages
        const recentMessages = this.queue.getAllMessages().slice(-3);
        if (recentMessages.length > 0) {
            console.log(chalk.gray('Recent messages:'));
            recentMessages.forEach((msg, i) => {
                const status = msg.status === 'completed' ? chalk.green('✓') :
                              msg.status === 'processing' ? chalk.blue('⏳') :
                              msg.status === 'error' ? chalk.red('✗') : chalk.yellow('⏸');
                console.log(chalk.gray(`  ${status} ${msg.text.substring(0, 50)}...`));
            });
            console.log('');
        }
    }

    private async showConfig(): Promise<void> {
        console.log(chalk.cyan('\\n⚙️  Configuration'));
        console.log(`├─ Skip Permissions: ${this.config.get('session', 'skipPermissions') ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`├─ Auto Start: ${this.config.get('session', 'autoStart') ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`├─ Queue Max Size: ${chalk.yellow(this.config.get('queue', 'maxSize'))}`);
        console.log(`├─ Default Agents: ${chalk.yellow(this.config.get('parallelAgents', 'defaultAgents'))}`);
        console.log(`└─ Data Dir: ${chalk.gray(this.config.get('paths', 'dataDir'))}\\n`);
    }

    private async startProcessing(): Promise<void> {
        if (this.processingQueue) {
            console.log(chalk.yellow('⚠️  Processing already active'));
            return;
        }

        this.processingQueue = true;
        console.log(chalk.green('▶️  Started processing queue'));
        
        // Start processing queue in background
        this.processQueue();
    }

    private async stopProcessing(): Promise<void> {
        if (!this.processingQueue) {
            console.log(chalk.yellow('⚠️  Processing already stopped'));
            return;
        }

        this.processingQueue = false;
        console.log(chalk.red('⏹️  Stopped processing queue'));
    }

    private async clearQueue(): Promise<void> {
        await this.queue.clear();
        console.log(chalk.green('🗑️  Queue cleared'));
    }

    private showHelp(): void {
        console.log(chalk.cyan('\\n📖 Available Commands'));
        console.log(chalk.gray('├─ /status    - Show system status'));
        console.log(chalk.gray('├─ /agents    - Show agent information'));
        console.log(chalk.gray('├─ /queue     - Show queue status'));
        console.log(chalk.gray('├─ /config    - Show configuration'));
        console.log(chalk.gray('├─ /start     - Start processing'));
        console.log(chalk.gray('├─ /stop      - Stop processing'));
        console.log(chalk.gray('├─ /clear     - Clear queue'));
        console.log(chalk.gray('└─ /help      - Show this help\\n'));
    }

    private async processQueue(): Promise<void> {
        while (this.processingQueue && this.isRunning) {
            try {
                const messages = this.queue.getPendingMessages();
                if (messages.length === 0) {
                    // No messages, wait a bit
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                for (const message of messages) {
                    if (!this.processingQueue) break;

                    // Mark as processing
                    await this.queue.updateMessageStatus(message.id!, 'processing');
                    console.log(chalk.blue(`🔄 Processing: ${message.text.substring(0, 50)}...`));

                    try {
                        // Check if this is a complex task that needs subagents
                        const needsSubagents = await this.shouldUseSubagents(message.text);
                        
                        if (needsSubagents && this.config.get('parallelAgents', 'enabled')) {
                            console.log(chalk.cyan('🤖 Invoking subagents for complex task...'));
                            await this.processWithSubagents(message.text);
                        } else {
                            // Process with main Claude session
                            await this.processWithClaude(message.text);
                        }

                        // Mark message as completed
                        await this.queue.updateMessageStatus(message.id!, 'completed');
                        console.log(chalk.green('✅ Task completed successfully'));

                    } catch (error) {
                        console.log(chalk.red(`❌ Error processing message: ${error}`));
                        await this.queue.updateMessageStatus(message.id!, 'error', undefined, error.toString());
                    }
                }

            } catch (error) {
                console.log(chalk.red(`❌ Queue processing error: ${error}`));
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retry
            }
        }
    }

    private async shouldUseSubagents(text: string): Promise<boolean> {
        // Simple heuristics to determine if task needs subagents
        const complexTaskIndicators = [
            'implement', 'create', 'build', 'develop', 'design',
            'refactor', 'optimize', 'test', 'deploy', 'analyze',
            'multiple', 'complex', 'system', 'architecture'
        ];

        const lowerText = text.toLowerCase();
        const complexity = complexTaskIndicators.filter(indicator => 
            lowerText.includes(indicator)
        ).length;

        return complexity >= 2 || text.length > 200;
    }

    private async processWithClaude(text: string): Promise<void> {
        if (!this.session) {
            throw new Error('Claude session not initialized');
        }

        console.log(chalk.blue('💭 Thinking...'));
        
        // Send message to Claude
        const response = await this.session.sendMessage(text);
        
        // Display response with nice formatting
        console.log(chalk.cyan('\\n🤖 Claude:'));
        console.log(chalk.white(response));
        console.log('');
    }

    private async processWithSubagents(text: string): Promise<void> {
        // Decompose task into subtasks
        const subtasks = await this.decomposeTask(text);
        
        console.log(chalk.cyan(`📋 Task decomposed into ${subtasks.length} subtasks:`));
        subtasks.forEach((task, i) => {
            console.log(chalk.gray(`  ${i + 1}. ${task.substring(0, 60)}...`));
        });

        // Process subtasks with parallel agents
        const results: string[] = [];
        this.activeAgents = Math.min(subtasks.length, this.config.get('parallelAgents', 'defaultAgents'));

        for (let i = 0; i < subtasks.length; i += this.activeAgents) {
            const batch = subtasks.slice(i, i + this.activeAgents);
            const batchResults = await Promise.all(
                batch.map(subtask => this.processSubtask(subtask))
            );
            results.push(...batchResults);
        }

        // Combine results
        console.log(chalk.cyan('🔗 Combining results...'));
        const finalResult = await this.combineResults(text, results);
        
        console.log(chalk.cyan('\\n🤖 AutoClaude (with subagents):'));
        console.log(chalk.white(finalResult));
        console.log('');
    }

    private async decomposeTask(text: string): Promise<string[]> {
        // Simple task decomposition - in reality this would use Claude
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        if (sentences.length <= 1) {
            // Break down by keywords
            return [
                `Analyze the requirements: ${text}`,
                `Plan the implementation approach`,
                `Execute the task: ${text}`,
                `Review and validate the results`
            ];
        }
        
        return sentences.map(s => s.trim());
    }

    private async processSubtask(subtask: string): Promise<string> {
        if (!this.session) {
            throw new Error('Claude session not initialized');
        }

        // Process subtask with Claude
        return await this.session.sendMessage(subtask);
    }

    private async combineResults(originalTask: string, results: string[]): Promise<string> {
        if (!this.session) {
            throw new Error('Claude session not initialized');
        }

        const combinePrompt = `
Original task: ${originalTask}

Subtask results:
${results.map((result, i) => `${i + 1}. ${result}`).join('\\n\\n')}

Please combine these results into a coherent, complete response to the original task.
`;

        return await this.session.sendMessage(combinePrompt);
    }

    async shutdown(): Promise<void> {
        this.isRunning = false;
        this.processingQueue = false;

        if (this.rl) {
            this.rl.close();
        }

        if (this.session) {
            await this.session.stop();
        }

        console.log(chalk.gray('\\n👋 AutoClaude terminal mode stopped'));
        process.exit(0);
    }
}