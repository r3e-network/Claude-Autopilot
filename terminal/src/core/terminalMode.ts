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
    
    // Auto-completion state
    private availableCommands: string[] = [
        'status', 'agents', 'queue', 'config', 'start', 'stop', 'clear', 'test', 'log', 
        'enable-agents', 'disable-agents', 'generate-agents', 'list-agents', 'help'
    ];
    private commandDescriptions: Record<string, string> = {
        'status': 'Show system status and processing state',
        'agents': 'Display agent information and activity',
        'queue': 'View message queue status and recent tasks',
        'config': 'Show current configuration settings',
        'start': 'Start processing queue',
        'stop': 'Stop processing queue',
        'clear': 'Clear message queue',
        'test': 'Test terminal functionality',
        'log': 'Show real-time Claude output (press Enter to stop)',
        'enable-agents': 'Enable parallel agents system',
        'disable-agents': 'Disable parallel agents system',
        'generate-agents': 'Generate context-specific agents for current task',
        'list-agents': 'List all active and available agents',
        'help': 'Display available commands'
    };
    
    // Interactive completion state
    private showingCompletions: boolean = false;
    private completionMatches: string[] = [];
    private selectedCompletion: number = 0;
    
    // Logging state
    private isLogging: boolean = false;
    private logOutputListener: ((output: string) => void) | null = null;
    
    // Built-in agent definitions
    private builtInAgentTypes: Record<string, { description: string; specialization: string; promptTemplate: string }> = {
        'code-analyzer': {
            description: 'Analyzes code structure, patterns, and quality',
            specialization: 'Code analysis, architecture review, performance optimization',
            promptTemplate: 'You are a specialized code analyzer. Focus on code structure, patterns, performance, and quality. Provide detailed technical analysis and recommendations.'
        },
        'documentation-writer': {
            description: 'Creates comprehensive documentation and comments',
            specialization: 'Technical writing, API docs, code comments, README files',
            promptTemplate: 'You are a specialized documentation writer. Create clear, comprehensive documentation, comments, and explanations. Focus on clarity and completeness.'
        },
        'test-generator': {
            description: 'Generates comprehensive test suites and test cases',
            specialization: 'Unit tests, integration tests, test automation, edge cases',
            promptTemplate: 'You are a specialized test generator. Create comprehensive test suites with edge cases, mocks, and proper test structure. Follow testing best practices.'
        },
        'refactor-specialist': {
            description: 'Optimizes and refactors code for better maintainability',
            specialization: 'Code refactoring, design patterns, clean code principles',
            promptTemplate: 'You are a specialized refactoring expert. Improve code structure, apply design patterns, and enhance maintainability while preserving functionality.'
        },
        'security-auditor': {
            description: 'Identifies security vulnerabilities and suggests fixes',
            specialization: 'Security analysis, vulnerability assessment, secure coding',
            promptTemplate: 'You are a specialized security auditor. Identify security vulnerabilities, analyze attack vectors, and provide secure coding recommendations.'
        },
        'rust-specialist': {
            description: 'Rust language expert for memory-safe systems programming',
            specialization: 'Rust ownership, lifetimes, async/await, cargo, memory safety',
            promptTemplate: 'You are a Rust specialist. Focus on ownership patterns, lifetime annotations, trait implementations, async programming, and memory safety. Provide idiomatic Rust solutions.'
        },
        'dotnet-expert': {
            description: '.NET framework and C# development specialist',
            specialization: 'C#, ASP.NET Core, Entity Framework, LINQ, .NET ecosystem',
            promptTemplate: 'You are a .NET expert. Specialize in C# best practices, ASP.NET Core APIs, Entity Framework, dependency injection, and the broader .NET ecosystem.'
        },
        'java-architect': {
            description: 'Java enterprise application architect',
            specialization: 'Java, Spring Boot, microservices, JVM optimization, design patterns',
            promptTemplate: 'You are a Java architect. Focus on Spring framework, microservices architecture, JVM tuning, concurrent programming, and enterprise design patterns.'
        },
        'golang-engineer': {
            description: 'Go language specialist for concurrent and cloud-native apps',
            specialization: 'Go concurrency, channels, goroutines, cloud-native development',
            promptTemplate: 'You are a Go specialist. Focus on goroutines, channels, concurrent patterns, error handling, and building efficient cloud-native applications.'
        },
        'c-systems-programmer': {
            description: 'C language expert for low-level systems programming',
            specialization: 'C programming, memory management, pointers, system calls, embedded',
            promptTemplate: 'You are a C systems programmer. Focus on memory management, pointer arithmetic, system calls, performance optimization, and embedded systems.'
        },
        'cpp-performance-expert': {
            description: 'C++ specialist for high-performance applications',
            specialization: 'Modern C++, STL, templates, RAII, performance optimization',
            promptTemplate: 'You are a C++ performance expert. Focus on modern C++ features, template metaprogramming, RAII patterns, STL usage, and performance optimization techniques.'
        }
    };
    
    // Dynamic agent generation state
    private generatedAgents: Array<{ id: string; type: string; context: string; active: boolean }> = [];

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
                
                // Auto-start built-in agents if enabled
                if (this.config.get('parallelAgents').builtInAgents.enabled) {
                    await this.startBuiltInAgents();
                }
                
                // Start default number of agents
                const defaultAgents = this.config.get('parallelAgents', 'defaultAgents');
                await (this.agentManager as any).startAgents(defaultAgents);
                this.logger.info(`Started ${defaultAgents} parallel agents`);
                
            } catch (error) {
                this.logger.warn('Parallel agents unavailable, continuing in single-agent mode');
                this.config.set('parallelAgents', 'enabled', false);
            }
        }

        // Initialize Claude session
        this.session = new ClaudeSession(this.config, this.logger);
        this.logger.info('Starting Claude session...');
        
        try {
            // Add timeout wrapper for the entire session start process
            await Promise.race([
                this.session.start(this.config.get('session', 'skipPermissions')),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Session start timeout')), 10000)
                )
            ]);
            this.logger.info('Claude session ready');
        } catch (error) {
            this.logger.warn(`Claude session initialization failed: ${error}`);
            this.logger.warn('Continuing without Claude session - you can try reconnecting later');
            this.session = null;
        }

        // Setup readline interface
        this.setupReadline();
        
        this.logger.info('AutoClaude terminal mode initialized');
    }

    private setupReadline(): void {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.cyan('AutoClaude> '),
            historySize: 100,
            completer: this.completer.bind(this)
        });

        this.rl.on('line', (input: string) => {
            this.hideCompletions();
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
        
        // Setup key handlers for interactive completion
        this.setupKeyHandlers();
    }
    
    private setupKeyHandlers(): void {
        if (!this.rl) return;
        
        // Enable keypress events
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false); // Keep readline processing
        }
        
        // Handle keypress events for interactive completion
        process.stdin.on('keypress', (str, key) => {
            if (!key || !this.rl) return;
            
            const currentLine = (this.rl as any).line || '';
            
            // Show completions when typing '/'
            if (str === '/' && !this.showingCompletions) {
                setTimeout(() => {
                    this.showCompletionsMenu(currentLine + '/');
                }, 10);
                return;
            }
            
            // Handle completions navigation
            if (this.showingCompletions) {
                if (key.name === 'up') {
                    this.navigateCompletions(-1);
                    return;
                } else if (key.name === 'down') {
                    this.navigateCompletions(1);
                    return;
                } else if (key.name === 'return' || key.name === 'tab') {
                    this.selectCompletion();
                    return;
                } else if (key.name === 'escape') {
                    this.hideCompletions();
                    return;
                }
                
                // Update completions as user types
                if (currentLine.startsWith('/')) {
                    setTimeout(() => {
                        this.updateCompletions(currentLine);
                    }, 10);
                }
            }
        });
    }
    
    private completer(line: string): [string[], string] {
        // If line starts with '/', provide command completion
        if (line.startsWith('/')) {
            const partial = line.slice(1).toLowerCase();
            const matches = this.availableCommands.filter(cmd => cmd.startsWith(partial));
            
            if (matches.length === 0) {
                return [[], line];
            }
            
            // If we have matches, show them with descriptions
            if (partial.length > 0 && matches.length > 1) {
                console.log(chalk.cyan('\\n📋 Available commands:'));
                matches.forEach(cmd => {
                    console.log(chalk.gray(`  /${cmd} - ${this.commandDescriptions[cmd]}`));
                });
                console.log(''); // Empty line for spacing
            }
            
            // Return matches with '/' prefix
            const completions = matches.map(cmd => `/${cmd}`);
            return [completions, line];
        }
        
        return [[], line];
    }
    
    private showCompletionsMenu(line: string): void {
        if (!line.startsWith('/')) return;
        
        const partial = line.slice(1).toLowerCase();
        const matches = this.availableCommands.filter(cmd => cmd.startsWith(partial));
        
        if (matches.length === 0) return;
        
        this.completionMatches = matches;
        this.selectedCompletion = 0;
        this.showingCompletions = true;
        
        this.displayCompletions();
    }
    
    private updateCompletions(line: string): void {
        if (!line.startsWith('/')) {
            this.hideCompletions();
            return;
        }
        
        const partial = line.slice(1).toLowerCase();
        const matches = this.availableCommands.filter(cmd => cmd.startsWith(partial));
        
        if (matches.length === 0) {
            this.hideCompletions();
            return;
        }
        
        this.completionMatches = matches;
        this.selectedCompletion = Math.min(this.selectedCompletion, matches.length - 1);
        this.displayCompletions();
    }
    
    private displayCompletions(): void {
        if (this.completionMatches.length === 0) return;
        
        // Clear previous completions and move cursor up
        process.stdout.write('\\x1b[s'); // Save cursor position
        
        console.log(chalk.cyan('\\n📋 Available commands:'));
        
        this.completionMatches.forEach((cmd, index) => {
            const isSelected = index === this.selectedCompletion;
            const prefix = isSelected ? chalk.green('▶ ') : '  ';
            const cmdName = isSelected ? chalk.green(`/${cmd}`) : chalk.gray(`/${cmd}`);
            const desc = isSelected ? chalk.white(this.commandDescriptions[cmd]) : chalk.gray(this.commandDescriptions[cmd]);
            
            console.log(`${prefix}${cmdName} - ${desc}`);
        });
        
        console.log(chalk.gray('\\nUse ↑↓ to navigate, Enter to select, Esc to cancel\\n'));
        
        // Restore cursor and move back to input line
        process.stdout.write('\\x1b[u'); // Restore cursor position
    }
    
    private navigateCompletions(direction: number): void {
        if (this.completionMatches.length === 0) return;
        
        this.selectedCompletion += direction;
        
        if (this.selectedCompletion < 0) {
            this.selectedCompletion = this.completionMatches.length - 1;
        } else if (this.selectedCompletion >= this.completionMatches.length) {
            this.selectedCompletion = 0;
        }
        
        // Clear and redisplay completions
        this.clearCompletionsDisplay();
        this.displayCompletions();
    }
    
    private selectCompletion(): void {
        if (this.completionMatches.length === 0 || !this.rl) return;
        
        const selectedCmd = this.completionMatches[this.selectedCompletion];
        
        // Clear the current line and set the selected command
        (this.rl as any).line = `/${selectedCmd}`;
        (this.rl as any).cursor = (this.rl as any).line.length;
        
        this.hideCompletions();
        
        // Refresh the display
        (this.rl as any)._refreshLine();
    }
    
    private hideCompletions(): void {
        if (!this.showingCompletions) return;
        
        this.showingCompletions = false;
        this.completionMatches = [];
        this.selectedCompletion = 0;
        
        this.clearCompletionsDisplay();
    }
    
    private clearCompletionsDisplay(): void {
        // Move cursor up and clear the completion display
        const linesToClear = this.completionMatches.length + 3; // commands + header + navigation help + spacing
        
        for (let i = 0; i < linesToClear; i++) {
            process.stdout.write('\\x1b[1A'); // Move up one line
            process.stdout.write('\\x1b[2K'); // Clear the line
        }
    }

    async start(): Promise<void> {
        if (this.isRunning) return;
        
        this.isRunning = true;
        
        console.log(chalk.cyan('\\n🤖 AutoClaude Terminal Mode'));
        console.log(chalk.gray('Type your message and press Enter to send'));
        console.log(chalk.gray('Type / to see available commands with auto-completion'));
        console.log(chalk.gray('Use ↑↓ arrows to navigate, Enter to select, Tab for completion'));
        console.log(chalk.gray('Press Ctrl+C to exit\\n'));

        // Auto-start processing if enabled
        if (this.config.get('session', 'autoStart')) {
            await this.startProcessing();
        }

        this.logger.info('Starting interactive prompt...');
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
            
            case 'test':
                console.log(chalk.green('✅ Terminal mode is working!'));
                console.log(`├─ Readline: ${this.rl ? 'Active' : 'Inactive'}`);
                console.log(`├─ Session: ${this.session ? 'Connected' : 'Disconnected'}`);
                console.log(`└─ Running: ${this.isRunning ? 'Yes' : 'No'}`);
                break;
            
            case 'log':
                await this.toggleLogging();
                break;
            
            case 'enable-agents':
                await this.enableParallelAgents();
                break;
            
            case 'disable-agents':
                await this.disableParallelAgents();
                break;
            
            case 'generate-agents':
                await this.generateContextAgents(args.join(' '));
                break;
            
            case 'list-agents':
                await this.listAllAgents();
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
    
    private async toggleLogging(): Promise<void> {
        if (this.isLogging) {
            await this.stopLogging();
        } else {
            await this.startLogging();
        }
    }
    
    private async startLogging(): Promise<void> {
        if (!this.session) {
            console.log(chalk.red('❌ Claude session not available for logging'));
            return;
        }
        
        if (this.isLogging) {
            console.log(chalk.yellow('⚠️  Logging is already active'));
            return;
        }
        
        this.isLogging = true;
        console.log(chalk.cyan('📡 Starting real-time Claude output logging...'));
        console.log(chalk.gray('Press Enter to stop logging and return to prompt\n'));
        
        // Create output listener
        this.logOutputListener = (output: string) => {
            // Clean and format the output
            const cleanOutput = this.cleanLogOutput(output);
            if (cleanOutput.trim()) {
                console.log(chalk.blue('Claude> ') + chalk.white(cleanOutput));
            }
        };
        
        // Attach listener to session
        this.session.on('output', this.logOutputListener);
        
        // Setup special Enter key handling for logging mode
        this.setupLogModeKeyHandling();
    }
    
    private async stopLogging(): Promise<void> {
        if (!this.isLogging) return;
        
        this.isLogging = false;
        
        // Remove output listener
        if (this.session && this.logOutputListener) {
            this.session.removeListener('output', this.logOutputListener);
            this.logOutputListener = null;
        }
        
        console.log(chalk.cyan('\n📡 Stopped real-time logging'));
        console.log(''); // Add spacing
    }
    
    private cleanLogOutput(output: string): string {
        // Remove ANSI escape codes
        let cleaned = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        
        // Remove excessive whitespace but preserve meaningful formatting
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 consecutive newlines
        cleaned = cleaned.replace(/^\s+|\s+$/g, ''); // Trim start/end
        
        return cleaned;
    }
    
    private setupLogModeKeyHandling(): void {
        if (!this.rl) return;
        
        // Override the line handler temporarily for log mode
        const originalLineHandler = this.rl.listeners('line')[0] as (input: string) => void;
        
        const logModeLineHandler = (input: string) => {
            // Any Enter key press stops logging
            if (this.isLogging) {
                this.stopLogging().then(() => {
                    // Restore normal input handling
                    this.rl?.removeListener('line', logModeLineHandler);
                    this.rl?.on('line', originalLineHandler);
                    
                    // If there was actual input, process it
                    if (input.trim()) {
                        this.handleInput(input.trim());
                    } else {
                        this.rl?.prompt();
                    }
                });
            }
        };
        
        // Replace line handler temporarily
        this.rl.removeListener('line', originalLineHandler as (...args: any[]) => void);
        this.rl.on('line', logModeLineHandler);
    }
    
    private async enableParallelAgents(): Promise<void> {
        if (this.config.get('parallelAgents', 'enabled')) {
            console.log(chalk.yellow('⚠️  Parallel agents are already enabled'));
            return;
        }
        
        this.config.set('parallelAgents', 'enabled', true);
        console.log(chalk.green('✅ Parallel agents enabled'));
        
        // Initialize agent manager if not already done
        try {
            if (!(this.agentManager as any).isRunning) {
                await this.agentManager.initialize();
                console.log(chalk.cyan('🤖 Agent manager initialized'));
            }
            
            // Start built-in agents if enabled
            if (this.config.get('parallelAgents').builtInAgents.enabled) {
                await this.startBuiltInAgents();
            }
            
        } catch (error) {
            console.log(chalk.red(`❌ Error initializing agents: ${error}`));
        }
    }
    
    private async disableParallelAgents(): Promise<void> {
        if (!this.config.get('parallelAgents', 'enabled')) {
            console.log(chalk.yellow('⚠️  Parallel agents are already disabled'));
            return;
        }
        
        this.config.set('parallelAgents', 'enabled', false);
        console.log(chalk.red('🔴 Parallel agents disabled'));
        
        // Stop all agents
        try {
            await (this.agentManager as any).stopAllAgents();
            this.generatedAgents = [];
            console.log(chalk.gray('All agents stopped'));
        } catch (error) {
            console.log(chalk.red(`❌ Error stopping agents: ${error}`));
        }
    }
    
    private async startBuiltInAgents(): Promise<void> {
        const enabledTypes = this.config.get('parallelAgents').builtInAgents.types;
        console.log(chalk.cyan(`🚀 Starting ${enabledTypes.length} built-in agents...`));
        
        for (const agentType of enabledTypes) {
            if (this.builtInAgentTypes[agentType]) {
                const agent = this.builtInAgentTypes[agentType];
                console.log(chalk.blue(`  ▶ ${agentType}: ${agent.description}`));
                
                // Add to generated agents list for tracking
                this.generatedAgents.push({
                    id: `builtin-${agentType}`,
                    type: agentType,
                    context: agent.specialization,
                    active: true
                });
            }
        }
        
        console.log(chalk.green('✅ Built-in agents started'));
    }
    
    private async generateContextAgents(context: string): Promise<void> {
        if (!this.config.get('parallelAgents', 'enabled')) {
            console.log(chalk.red('❌ Parallel agents are disabled. Use /enable-agents first'));
            return;
        }
        
        if (!this.config.get('parallelAgents').contextGeneration.enabled) {
            console.log(chalk.yellow('⚠️  Context-based agent generation is disabled'));
            return;
        }
        
        if (!context.trim()) {
            console.log(chalk.yellow('💡 Usage: /generate-agents <task description>'));
            console.log(chalk.gray('Example: /generate-agents build a React component with TypeScript'));
            return;
        }
        
        console.log(chalk.cyan('🔍 Analyzing context for agent generation...'));
        
        try {
            const generatedTypes = await this.analyzeContextAndGenerateAgents(context);
            
            if (generatedTypes.length === 0) {
                console.log(chalk.yellow('⚠️  No additional agents needed for this context'));
                return;
            }
            
            console.log(chalk.green(`✨ Generated ${generatedTypes.length} context-specific agents:`));
            
            generatedTypes.forEach((agent, index) => {
                console.log(chalk.blue(`  ${index + 1}. ${agent.type}: ${agent.description}`));
                this.generatedAgents.push({
                    id: `generated-${Date.now()}-${index}`,
                    type: agent.type,
                    context: agent.context,
                    active: true
                });
            });
            
        } catch (error) {
            console.log(chalk.red(`❌ Error generating agents: ${error}`));
        }
    }
    
    private async analyzeContextAndGenerateAgents(context: string): Promise<Array<{ type: string; description: string; context: string }>> {
        // Analyze context to determine what types of agents would be helpful
        const contextLower = context.toLowerCase();
        const generatedAgents: Array<{ type: string; description: string; context: string }> = [];
        
        // Language-specific agents
        if (contextLower.includes('rust') || contextLower.includes('.rs') || contextLower.includes('cargo')) {
            generatedAgents.push({
                type: 'rust-systems-developer',
                description: 'Rust systems programming and memory safety',
                context: 'Rust ownership, async/await, cargo ecosystem, memory-safe systems'
            });
        }
        
        if (contextLower.includes('.net') || contextLower.includes('dotnet') || contextLower.includes('c#') || contextLower.includes('csharp') || contextLower.includes('.cs')) {
            generatedAgents.push({
                type: 'dotnet-solutions-architect',
                description: '.NET Core/5+ and C# enterprise development',
                context: 'ASP.NET Core, Entity Framework, Blazor, microservices, Azure integration'
            });
        }
        
        if (contextLower.includes('java') || contextLower.includes('.java') || contextLower.includes('spring') || contextLower.includes('maven') || contextLower.includes('gradle')) {
            generatedAgents.push({
                type: 'java-enterprise-developer',
                description: 'Java enterprise applications and Spring ecosystem',
                context: 'Spring Boot, microservices, JPA, REST APIs, reactive programming'
            });
        }
        
        if (contextLower.includes('golang') || contextLower.includes('go ') || contextLower.includes('.go') || contextLower.includes('goroutine')) {
            generatedAgents.push({
                type: 'golang-cloud-developer',
                description: 'Go concurrent programming and cloud-native development',
                context: 'Goroutines, channels, context patterns, gRPC, Kubernetes operators'
            });
        }
        
        if ((contextLower.includes(' c ') || contextLower.includes('.c ') || contextLower.includes('embedded')) && !contextLower.includes('c++') && !contextLower.includes('c#')) {
            generatedAgents.push({
                type: 'c-embedded-developer',
                description: 'C systems and embedded programming',
                context: 'Memory management, pointers, system calls, embedded systems, real-time'
            });
        }
        
        if (contextLower.includes('c++') || contextLower.includes('cpp') || contextLower.includes('.cpp') || contextLower.includes('.hpp')) {
            generatedAgents.push({
                type: 'cpp-high-performance',
                description: 'Modern C++ and high-performance computing',
                context: 'C++17/20/23, template metaprogramming, STL, move semantics, SIMD'
            });
        }
        
        // Framework and technology-specific agents
        if (contextLower.includes('react') || contextLower.includes('component')) {
            generatedAgents.push({
                type: 'react-specialist',
                description: 'React component development and best practices',
                context: 'React development, hooks, state management, performance'
            });
        }
        
        if (contextLower.includes('typescript') || contextLower.includes('ts') || contextLower.includes('.ts')) {
            generatedAgents.push({
                type: 'typescript-expert',
                description: 'TypeScript type system and advanced patterns',
                context: 'TypeScript types, generics, advanced patterns, type safety'
            });
        }
        
        if (contextLower.includes('api') || contextLower.includes('backend') || contextLower.includes('server')) {
            generatedAgents.push({
                type: 'api-architect',
                description: 'API design and backend architecture',
                context: 'REST APIs, GraphQL, microservices, backend patterns'
            });
        }
        
        if (contextLower.includes('database') || contextLower.includes('sql') || contextLower.includes('db') || contextLower.includes('postgres') || contextLower.includes('mysql')) {
            generatedAgents.push({
                type: 'database-optimizer',
                description: 'Database design and query optimization',
                context: 'Database schema, SQL optimization, indexing, performance'
            });
        }
        
        if (contextLower.includes('deploy') || contextLower.includes('docker') || contextLower.includes('kubernetes') || contextLower.includes('k8s') || contextLower.includes('cloud')) {
            generatedAgents.push({
                type: 'devops-engineer',
                description: 'Deployment and infrastructure automation',
                context: 'Docker, Kubernetes, CI/CD, cloud deployment, infrastructure as code'
            });
        }
        
        if (contextLower.includes('performance') || contextLower.includes('optimization') || contextLower.includes('profiling')) {
            generatedAgents.push({
                type: 'performance-optimizer',
                description: 'Application performance analysis and optimization',
                context: 'Performance profiling, optimization strategies, bottleneck analysis'
            });
        }
        
        // Testing and quality
        if (contextLower.includes('test') || contextLower.includes('unit') || contextLower.includes('integration') || contextLower.includes('e2e')) {
            generatedAgents.push({
                type: 'testing-automation-engineer',
                description: 'Comprehensive testing strategies and automation',
                context: 'Unit testing, integration testing, E2E testing, test automation, TDD'
            });
        }
        
        // Mobile development
        if (contextLower.includes('android') || contextLower.includes('kotlin')) {
            generatedAgents.push({
                type: 'android-developer',
                description: 'Android app development with Kotlin/Java',
                context: 'Android SDK, Jetpack Compose, Kotlin coroutines, Material Design'
            });
        }
        
        if (contextLower.includes('ios') || contextLower.includes('swift') || contextLower.includes('swiftui')) {
            generatedAgents.push({
                type: 'ios-developer',
                description: 'iOS app development with Swift',
                context: 'Swift, SwiftUI, UIKit, Core Data, iOS frameworks'
            });
        }
        
        // Machine learning and data
        if (contextLower.includes('machine learning') || contextLower.includes('ml') || contextLower.includes('ai') || contextLower.includes('neural')) {
            generatedAgents.push({
                type: 'ml-engineer',
                description: 'Machine learning and AI implementation',
                context: 'TensorFlow, PyTorch, scikit-learn, model training, deployment'
            });
        }
        
        // Limit the number of generated agents
        const maxAgents = this.config.get('parallelAgents').contextGeneration.maxGeneratedAgents;
        return generatedAgents.slice(0, maxAgents);
    }
    
    private async listAllAgents(): Promise<void> {
        console.log(chalk.cyan('\\n🤖 Agent Status Report'));
        
        // Show system status
        const agentsEnabled = this.config.get('parallelAgents', 'enabled');
        console.log(`├─ System Status: ${agentsEnabled ? chalk.green('Enabled') : chalk.red('Disabled')}`);
        console.log(`├─ Max Agents: ${chalk.yellow(this.config.get('parallelAgents', 'maxAgents'))}`);
        console.log(`└─ Active Agents: ${chalk.yellow(this.generatedAgents.filter(a => a.active).length)}\\n`);
        
        if (!agentsEnabled) {
            console.log(chalk.gray('Use /enable-agents to start the parallel agents system\\n'));
            return;
        }
        
        // Show built-in agents
        const builtInEnabled = this.config.get('parallelAgents').builtInAgents.enabled;
        console.log(chalk.cyan('📋 Built-in Agents:'));
        
        if (builtInEnabled) {
            const enabledTypes = this.config.get('parallelAgents').builtInAgents.types;
            enabledTypes.forEach((type: string) => {
                const agent = this.builtInAgentTypes[type];
                if (agent) {
                    const isActive = this.generatedAgents.some(a => a.type === type && a.active);
                    const status = isActive ? chalk.green('●') : chalk.gray('○');
                    console.log(`  ${status} ${chalk.blue(type)}: ${chalk.gray(agent.description)}`);
                }
            });
        } else {
            console.log(chalk.gray('  Built-in agents are disabled'));
        }
        
        // Show generated agents
        const contextAgents = this.generatedAgents.filter(a => !a.id.startsWith('builtin-'));
        if (contextAgents.length > 0) {
            console.log(chalk.cyan('\\n✨ Context-Generated Agents:'));
            contextAgents.forEach(agent => {
                const status = agent.active ? chalk.green('●') : chalk.gray('○');
                console.log(`  ${status} ${chalk.blue(agent.type)}: ${chalk.gray(agent.context)}`);
            });
        }
        
        // Show configuration
        console.log(chalk.cyan('\\n⚙️  Configuration:'));
        console.log(`├─ Auto-generation: ${this.config.get('parallelAgents').contextGeneration.enabled ? chalk.green('On') : chalk.red('Off')}`);
        console.log(`├─ Min complexity: ${chalk.yellow(this.config.get('parallelAgents').contextGeneration.minComplexity)}`);
        console.log(`└─ Max generated: ${chalk.yellow(this.config.get('parallelAgents').contextGeneration.maxGeneratedAgents)}\\n`);
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
        console.log(chalk.gray('├─ /test      - Test terminal functionality'));
        console.log(chalk.gray('├─ /log       - Show real-time Claude output (press Enter to stop)'));
        console.log(chalk.gray('├─ /enable-agents    - Enable parallel agents system'));
        console.log(chalk.gray('├─ /disable-agents   - Disable parallel agents system'));
        console.log(chalk.gray('├─ /generate-agents  - Generate context-specific agents'));
        console.log(chalk.gray('├─ /list-agents      - List all active and available agents'));
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
        if (!this.config.get('parallelAgents', 'enabled')) {
            return false;
        }
        
        // Enhanced heuristics to determine if task needs subagents
        const complexTaskIndicators = [
            'implement', 'create', 'build', 'develop', 'design',
            'refactor', 'optimize', 'test', 'deploy', 'analyze',
            'multiple', 'complex', 'system', 'architecture',
            'full-stack', 'database', 'api', 'frontend', 'backend',
            // Language-specific indicators
            'rust', 'cargo', 'ownership', 'lifetime', 'trait',
            '.net', 'dotnet', 'c#', 'csharp', 'asp.net', 'blazor',
            'java', 'spring', 'maven', 'gradle', 'jvm', 'hibernate',
            'golang', 'go', 'goroutine', 'channel', 'grpc',
            'embedded', 'pointer', 'memory', 'kernel', 'driver',
            'c++', 'cpp', 'template', 'stl', 'boost', 'qt',
            // Framework and tech indicators
            'microservice', 'kubernetes', 'docker', 'cloud-native',
            'machine learning', 'ml', 'ai', 'neural', 'tensorflow',
            'android', 'ios', 'mobile', 'swift', 'kotlin'
        ];

        const lowerText = text.toLowerCase();
        const complexity = complexTaskIndicators.filter(indicator => 
            lowerText.includes(indicator)
        ).length;
        
        const minComplexity = this.config.get('parallelAgents').contextGeneration.minComplexity;
        const isComplex = complexity >= minComplexity || text.length > 200;
        
        // Auto-generate agents if enabled and task is complex
        if (isComplex && this.config.get('parallelAgents').autoGenerate) {
            await this.generateContextAgents(text);
        }
        
        return isComplex;
    }

    private async processWithClaude(text: string): Promise<void> {
        console.log(chalk.blue('💭 Thinking...'));
        
        try {
            if (!this.session) {
                console.log(chalk.red('❌ Claude session not available'));
                console.log(chalk.yellow('💡 Try restarting AutoClaude or check Claude Code CLI installation'));
                return;
            }

            // Send message to Claude
            const response = await this.session.sendMessage(text);
            
            // Display response with nice formatting
            console.log(chalk.cyan('\\n🤖 Claude:'));
            console.log(chalk.white(response));
            console.log('');
        } catch (error) {
            console.log(chalk.red(`❌ Error communicating with Claude: ${error}`));
            console.log(chalk.yellow('💡 Make sure Claude Code CLI is properly authenticated'));
        }
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

        // Stop logging if active
        if (this.isLogging) {
            await this.stopLogging();
        }

        if (this.rl) {
            this.rl.close();
        }

        if (this.session) {
            try {
                await this.session.stop();
            } catch (error) {
                this.logger.warn(`Error stopping session: ${error}`);
            }
        }

        console.log(chalk.gray('\\n👋 AutoClaude terminal mode stopped'));
        process.exit(0);
    }
}