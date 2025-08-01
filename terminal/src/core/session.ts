import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'eventemitter3';
import { Config } from './config';
import { Logger } from '../utils/logger';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { toLogMetadata, toError } from '../utils/typeGuards';
import { promisify } from 'util';

export interface SessionOptions {
    skipPermissions?: boolean;
}

export class ClaudeSession extends EventEmitter {
    private config: Config;
    private logger: Logger;
    private pty: IPty | null = null;
    private isRunning: boolean = false;
    private outputBuffer: string = '';
    private currentScreen: string = '';
    private outputTimer: NodeJS.Timeout | null = null;
    private cleanupTimer: NodeJS.Timeout | null = null;
    private keepAliveTimer: NodeJS.Timeout | null = null;
    private lastActivityTime: number = Date.now();
    private isProcessingMessage: boolean = false;
    private activeMessageCount: number = 0;
    private lastMessageStartTime: number = 0;
    private messageTimeouts: Set<NodeJS.Timeout> = new Set();
    private readonly THROTTLE_MS = 500;
    private readonly MAX_BUFFER_SIZE = 50000; // 50KB max buffer size
    private readonly MAX_SCREEN_SIZE = 25000; // 25KB max screen buffer
    private readonly CLEANUP_INTERVAL = 60000; // Clean up every minute
    private readonly KEEPALIVE_INTERVAL = 30000; // Send keepalive every 30 seconds
    private readonly SESSION_TIMEOUT = 600000; // 10 minutes of inactivity

    constructor(config: Config, logger: Logger) {
        super();
        this.config = config;
        this.logger = logger;
    }

    private async killZombieClaudeProcesses(): Promise<void> {
        const execAsync = promisify(exec);
        const platform = os.platform();

        try {
            if (platform === 'win32') {
                // Windows: Kill all claude.exe processes
                await execAsync('taskkill /F /IM claude.exe 2>nul', { shell: 'cmd.exe' });
                this.logger.info('Killed zombie Claude processes on Windows');
            } else {
                // Unix-like systems: Kill all claude processes
                // First try graceful kill
                try {
                    await execAsync('pkill -TERM claude');
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                } catch (e) {
                    // Ignore if no processes found
                }
                
                // Then force kill any remaining
                try {
                    await execAsync('pkill -KILL claude');
                    this.logger.info('Killed zombie Claude processes on Unix');
                } catch (e) {
                    // Ignore if no processes found
                    this.logger.debug('No zombie Claude processes found');
                }
            }
        } catch (error) {
            this.logger.warn(`Failed to kill zombie Claude processes: ${error}`);
        }
    }

    async start(skipPermissions: boolean = true): Promise<void> {
        if (this.isRunning) {
            throw new Error('Session already running');
        }

        try {
            // Kill any zombie Claude processes before starting
            await this.killZombieClaudeProcesses();
            
            // Find Python executable
            const pythonCmd = await this.findPython();
            
            // Get the wrapper script path
            const wrapperPath = path.join(__dirname, '..', 'claude_pty_wrapper.py');
            
            // Check if wrapper exists
            const fs = require('fs');
            if (!fs.existsSync(wrapperPath)) {
                throw new Error(`PTY wrapper not found at ${wrapperPath}`);
            }
            
            const args = [wrapperPath];
            if (skipPermissions) {
                args.push('--skip-permissions');
            }
            
            // Get terminal dimensions
            const cols = process.stdout.columns || 80;
            const rows = process.stdout.rows || 24;

            this.logger.info(`Starting Claude via Python wrapper: ${pythonCmd} ${args.join(' ')}`);

            // Spawn Python wrapper instead of Claude directly
            this.pty = spawn(pythonCmd, args, {
                name: 'xterm-256color',
                cols,
                rows,
                cwd: process.cwd(),
                env: { 
                    ...process.env as { [key: string]: string },
                    PYTHONUNBUFFERED: '1'
                },
            });

            this.isRunning = true;
            this.setupEventHandlers();
            this.startPeriodicCleanup();
            this.startKeepAlive();
            
            this.logger.info('Claude session started');
            this.emit('started');

            // Wait for initial prompt
            try {
                await this.waitForReady();
            } catch (readyError) {
                this.logger.warn(`Claude ready check failed: ${readyError}, continuing anyway`);
            }
            
        } catch (error) {
            this.isRunning = false;
            this.logger.error(`Failed to start Claude session: ${error}`);
            throw new Error(`Failed to start Claude session: ${error}`);
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) return;

        try {
            if (this.pty) {
                this.pty.kill();
                this.pty = null;
            }
            
            this.isRunning = false;
            this.outputBuffer = '';
            this.currentScreen = '';
            
            if (this.outputTimer) {
                clearTimeout(this.outputTimer);
                this.outputTimer = null;
            }
            
            if (this.cleanupTimer) {
                clearInterval(this.cleanupTimer);
                this.cleanupTimer = null;
            }
            
            if (this.keepAliveTimer) {
                clearInterval(this.keepAliveTimer);
                this.keepAliveTimer = null;
            }
            
            // Clear any pending message timeouts
            this.messageTimeouts.forEach(timer => clearTimeout(timer));
            this.messageTimeouts.clear();
            
            this.logger.info('Claude session stopped');
            this.emit('stopped');
            
        } catch (error) {
            this.logger.error('Error stopping session:', toLogMetadata({ error: toError(error) }));
        }
    }

    async sendMessage(message: string, onProgress?: (elapsed: number) => void): Promise<string> {
        if (!this.isRunning || !this.pty) {
            throw new Error('Session not running');
        }

        // Track that we're processing a message
        this.isProcessingMessage = true;
        this.activeMessageCount++;
        this.lastMessageStartTime = Date.now();
        this.updateLastActivity();

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const timeout = 300000; // 5 minutes timeout
            let responseBuffer = '';
            let isCollecting = false;
            let lastOutputTime = Date.now();
            let inactivityChecker: NodeJS.Timeout;
            let progressTimer: NodeJS.Timeout;

            const cleanup = () => {
                this.removeListener('output', outputHandler);
                clearTimeout(timeoutTimer);
                if (inactivityChecker) clearInterval(inactivityChecker);
                if (progressTimer) clearInterval(progressTimer);
                // Mark message processing as complete
                this.activeMessageCount = Math.max(0, this.activeMessageCount - 1);
                if (this.activeMessageCount === 0) {
                    this.isProcessingMessage = false;
                    this.lastMessageStartTime = 0;
                }
                // Remove timeout from set
                this.messageTimeouts.delete(timeoutTimer);
            };
            
            // Start progress reporting if callback provided
            if (onProgress) {
                progressTimer = setInterval(() => {
                    const elapsed = Date.now() - startTime;
                    onProgress(elapsed);
                }, 1000);
            }

            const outputHandler = (output: string) => {
                lastOutputTime = Date.now();
                this.updateLastActivity();
                
                // Log raw output for debugging
                this.logger.debug(`Raw Claude output: ${JSON.stringify(output)}`);
                
                // Start collecting immediately if we haven't started yet
                if (!isCollecting) {
                    // Check if this looks like a Claude response or if enough time has passed
                    const timeSinceStart = Date.now() - startTime;
                    const looksLikeResponse = output.trim().length > 0 && 
                                            !output.includes('Human:') && 
                                            !output.includes('>') &&
                                            timeSinceStart > 100; // Give 100ms for echo
                    
                    if (looksLikeResponse || output.includes(message)) {
                        isCollecting = true;
                        // If the output contains the message, skip it
                        if (output.includes(message)) {
                            const messageIndex = output.indexOf(message);
                            const afterMessage = output.substring(messageIndex + message.length);
                            if (afterMessage.trim()) {
                                responseBuffer += afterMessage;
                            }
                            return;
                        }
                    }
                }

                if (isCollecting || responseBuffer.length === 0) {
                    // Always collect output if we haven't collected anything yet
                    responseBuffer += output;
                    
                    // Check if Claude is done responding
                    if (this.isResponseComplete(responseBuffer)) {
                        cleanup();
                        resolve(this.cleanResponse(responseBuffer));
                    }
                }
            };
            
            // Also add an inactivity checker
            inactivityChecker = setInterval(() => {
                const timeSinceLastOutput = Date.now() - lastOutputTime;
                if (isCollecting && timeSinceLastOutput > 5000 && responseBuffer.length > 0) {
                    // No output for 5 seconds after starting collection, assume done
                    clearInterval(inactivityChecker);
                    cleanup();
                    resolve(this.cleanResponse(responseBuffer));
                }
            }, 1000);

            const timeoutTimer = setTimeout(() => {
                cleanup();
                reject(new Error('Message timeout'));
            }, timeout);
            
            // Track timeout for cleanup
            this.messageTimeouts.add(timeoutTimer);

            this.on('output', outputHandler);
            
            // Send the message
            this.pty!.write(message + '\\n');
        });
    }

    sendInterrupt(): void {
        if (this.pty) {
            this.pty.write('\\x03'); // Ctrl+C
            this.logger.debug('Sent interrupt signal');
        }
    }

    sendEscape(): void {
        if (this.pty) {
            this.pty.write('\\x1b'); // ESC
            this.logger.debug('Sent escape key');
        }
    }

    sendRawInput(input: string): void {
        if (this.pty) {
            this.pty.write(input);
            this.logger.debug(`Sent raw input: ${JSON.stringify(input)}`);
        }
    }

    resize(cols: number, rows: number): void {
        if (this.pty) {
            this.pty.resize(cols, rows);
            this.logger.debug(`Resized terminal to ${cols}x${rows}`);
        }
    }

    private setupEventHandlers(): void {
        if (!this.pty) return;

        this.pty.onData((data: string) => {
            this.outputBuffer += data;
            this.processOutput();
        });

        this.pty.onExit(({ exitCode, signal }) => {
            this.logger.info(`Claude process exited with code ${exitCode}, signal ${signal}`);
            this.isRunning = false;
            this.emit('exit', { exitCode, signal });
            this.stop();
        });
    }

    private processOutput(): void {
        // Enforce buffer size limits to prevent memory leaks
        if (this.outputBuffer.length > this.MAX_BUFFER_SIZE) {
            // Keep only the last portion of the buffer
            this.outputBuffer = this.outputBuffer.slice(-this.MAX_BUFFER_SIZE / 2);
            this.logger.debug('Output buffer trimmed to prevent memory leak');
        }

        // Update current screen state
        if (this.hasScreenClear(this.outputBuffer)) {
            const lastClearIndex = this.getLastScreenClearIndex(this.outputBuffer);
            this.currentScreen = this.outputBuffer.substring(lastClearIndex);
            // Clear the old buffer immediately to free memory
            this.outputBuffer = this.currentScreen;
        } else {
            this.currentScreen = this.outputBuffer;
        }

        // Enforce screen size limits
        if (this.currentScreen.length > this.MAX_SCREEN_SIZE) {
            this.currentScreen = this.currentScreen.slice(-this.MAX_SCREEN_SIZE);
            this.outputBuffer = this.currentScreen;
            this.logger.debug('Screen buffer trimmed to prevent memory leak');
        }

        // Throttle output events
        if (this.outputTimer) {
            clearTimeout(this.outputTimer);
        }

        this.outputTimer = setTimeout(() => {
            this.flushOutput();
            // Clear output buffer after flushing to free memory
            this.outputBuffer = '';
        }, this.THROTTLE_MS);
    }

    private flushOutput(): void {
        if (this.currentScreen.length === 0) return;

        this.emit('output', this.currentScreen);
        this.logger.debug(`Flushed output: ${this.currentScreen.length} chars`);
    }

    private hasScreenClear(text: string): boolean {
        const clearPatterns = ['\\x1b[2J', '\\x1b[3J', '\\x1b[H'];
        return clearPatterns.some(pattern => text.includes(pattern));
    }

    private getLastScreenClearIndex(text: string): number {
        const clearPatterns = ['\\x1b[2J', '\\x1b[3J', '\\x1b[H'];
        let lastIndex = -1;
        
        clearPatterns.forEach(pattern => {
            const index = text.lastIndexOf(pattern);
            if (index > lastIndex) {
                lastIndex = index;
            }
        });
        
        return lastIndex;
    }

    private async waitForReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.logger.warn('Claude session ready timeout, continuing anyway...');
                resolve(); // Continue anyway after timeout
            }, 5000); // 5 second timeout

            const checkReady = () => {
                // More flexible ready detection patterns for Claude Code CLI
                if (this.currentScreen.includes('Welcome to Claude') || 
                    this.currentScreen.includes('Ready') ||
                    this.currentScreen.includes('>') ||
                    this.currentScreen.includes('Claude Code') ||
                    this.currentScreen.length > 10) { // Any substantial output indicates ready
                    clearTimeout(timeout);
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }

    private isResponseComplete(response: string): boolean {
        // First check if response seems empty or just whitespace
        if (response.trim().length < 5) {
            return false; // Don't consider empty responses as complete
        }
        
        // Check for common Claude response endings
        const endings = [
            '\n>',
            '\nClaude>',
            '\n$ ',  // Shell prompt
            '\nclaude> ',  // Claude Code CLI prompt
            'Human: ',  // Claude Code CLI human prompt
            'Human:', // Without space
            '\nHuman:', // With newline
            'Is there anything else',
            'Let me know if',
            'Feel free to ask',
            'What would you like',
            'How can I help',
            'today?',
            'tasks.',
            '✓',  // Claude Code often ends with checkmarks
            '✅',  // Success indicator
            '❌',  // Error indicator
            'All tests passed',
            'successfully',
            'completed',
            // Claude Code specific patterns
            '\n\n', // Double newline often indicates end
            '║\n╰', // Box drawing characters
            '│\n╰', // More box drawing
            '╯\n' // End of box
        ];
        
        // Check if response ends with any of these patterns
        const trimmedResponse = response.trim();
        if (endings.some(ending => trimmedResponse.endsWith(ending))) {
            return true;
        }
        
        // Check for Claude Code specific formatting
        if (response.includes('╰') && response.includes('╯')) {
            // Likely a complete box/panel output
            const lastBox = response.lastIndexOf('╯');
            const afterBox = response.substring(lastBox + 1).trim();
            if (afterBox.length < 50) { // Not much content after the box
                return true;
            }
        }
        
        // Also check for no new output for a period (indicates completion)
        const lastNewline = response.lastIndexOf('\n');
        const lastContent = response.substring(lastNewline + 1);
        
        // If we see a question mark or period at the end of a line, likely done
        if (lastContent.endsWith('?') || lastContent.endsWith('.') || lastContent.endsWith('!')) {
            return true;
        }
        
        return endings.some(ending => response.includes(ending));
    }

    private cleanResponse(response: string): string {
        // Remove ANSI escape codes
        const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
        let cleaned = response.replace(ansiRegex, '');
        
        // Remove various prompt markers
        cleaned = cleaned.replace(/\n?>/g, '');
        cleaned = cleaned.replace(/\nClaude>/g, '');
        cleaned = cleaned.replace(/\nclaude>/g, '');
        cleaned = cleaned.replace(/Human:\s*/g, '');
        cleaned = cleaned.replace(/Assistant:\s*/g, '');
        
        // Remove Claude Code CLI specific UI elements and formatting
        // Remove box drawing patterns with content inside
        cleaned = cleaned.replace(/╭[─┬]+╮[\s\S]*?╰[─┴]+╯/g, (match) => {
            // Extract content from inside the box
            const lines = match.split('\n');
            const content = lines
                .filter(line => line.includes('│'))
                .map(line => line.replace(/[│║]/g, '').trim())
                .filter(line => line.length > 0)
                .join('\n');
            return content;
        });
        
        // Remove remaining box characters
        cleaned = cleaned.replace(/[╭╮╰╯─│║╟╢╤╧╪═╞╡╥╨╫╬┌┐└┘├┤┬┴┼]/g, '');
        
        // Remove Claude Code specific markers
        cleaned = cleaned.replace(/\[Tool Use:.*?\]/g, ''); // Tool use indicators
        cleaned = cleaned.replace(/\[File:.*?\]/g, ''); // File markers
        cleaned = cleaned.replace(/\[Code:.*?\]/g, ''); // Code block markers
        
        // Clean up code fences that might be left over
        cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
            // Keep code blocks but clean them up
            return match.replace(/```(\w+)?\n?/, '').replace(/\n?```$/, '');
        });
        
        // Remove excessive whitespace
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 newlines
        cleaned = cleaned.replace(/^\s+|\s+$/g, ''); // Trim
        cleaned = cleaned.replace(/\n\s+\n/g, '\n\n'); // Remove lines with only whitespace
        
        // Remove any remaining control characters
        cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
        
        // Handle empty or minimal responses
        if (cleaned.trim().length < 5) {
            return "No response received from Claude. The session may need to be restarted.";
        }
        
        return cleaned.trim();
    }

    isActive(): boolean {
        return this.isRunning;
    }

    getCurrentScreen(): string {
        return this.currentScreen;
    }

    private async findPython(): Promise<string> {
        const execAsync = promisify(exec);
        const candidates = ['python3', 'python', 'python3.8', 'python3.9', 'python3.10', 'python3.11'];
        
        for (const cmd of candidates) {
            try {
                const { stdout } = await execAsync(`${cmd} --version`);
                if (stdout.includes('Python 3.')) {
                    this.logger.debug(`Found Python: ${cmd} - ${stdout.trim()}`);
                    return cmd;
                }
            } catch (e) {
                // Try next candidate
            }
        }
        
        throw new Error('Python 3 not found. Please install Python 3.8 or higher.');
    }

    private startPeriodicCleanup(): void {
        this.cleanupTimer = setInterval(() => {
            this.performMemoryCleanup();
        }, this.CLEANUP_INTERVAL);
    }

    private performMemoryCleanup(): void {
        const initialBufferSize = this.outputBuffer.length;
        const initialScreenSize = this.currentScreen.length;

        // Force garbage collection of old buffers
        if (this.outputBuffer.length > this.MAX_BUFFER_SIZE / 2) {
            this.outputBuffer = this.outputBuffer.slice(-this.MAX_BUFFER_SIZE / 4);
        }

        if (this.currentScreen.length > this.MAX_SCREEN_SIZE / 2) {
            this.currentScreen = this.currentScreen.slice(-this.MAX_SCREEN_SIZE / 4);
            this.outputBuffer = this.currentScreen;
        }

        // Log cleanup if significant reduction occurred
        const bufferReduction = initialBufferSize - this.outputBuffer.length;
        const screenReduction = initialScreenSize - this.currentScreen.length;
        
        if (bufferReduction > 1000 || screenReduction > 1000) {
            this.logger.debug('Memory cleanup performed', {
                bufferReduced: bufferReduction,
                screenReduced: screenReduction,
                newBufferSize: this.outputBuffer.length,
                newScreenSize: this.currentScreen.length
            });
        }

        // Suggest garbage collection
        if (global.gc) {
            global.gc();
        }
    }

    private startKeepAlive(): void {
        this.keepAliveTimer = setInterval(() => {
            if (!this.isRunning || !this.pty) return;

            const timeSinceLastActivity = Date.now() - this.lastActivityTime;
            
            // Check for session timeout
            const hasActiveMessages = this.activeMessageCount > 0 || this.isProcessingMessage;
            const messageInProgress = this.lastMessageStartTime > 0 && 
                (Date.now() - this.lastMessageStartTime) < 300000; // 5 minute grace period for messages
            
            if (timeSinceLastActivity > this.SESSION_TIMEOUT && !hasActiveMessages && !messageInProgress) {
                this.logger.warn('Session timeout due to inactivity', {
                    timeSinceLastActivity,
                    activeMessageCount: this.activeMessageCount,
                    isProcessingMessage: this.isProcessingMessage,
                    messageInProgress
                });
                this.stop();
                return;
            }

            // Send keepalive if no recent activity and not processing
            if (timeSinceLastActivity > this.KEEPALIVE_INTERVAL && !this.isProcessingMessage) {
                try {
                    // Send a harmless command that won't affect Claude's state
                    this.pty.write('\x00'); // Null character - ignored by most terminals
                    this.logger.debug('Sent keepalive signal');
                } catch (error) {
                    this.logger.error('Failed to send keepalive:', toLogMetadata({ error: toError(error) }));
                }
            }
        }, this.KEEPALIVE_INTERVAL);
    }

    private updateLastActivity(): void {
        this.lastActivityTime = Date.now();
    }

    isActivelyProcessing(): boolean {
        const hasActiveMessages = this.activeMessageCount > 0 || this.isProcessingMessage;
        const recentMessageStart = this.lastMessageStartTime > 0 && 
            (Date.now() - this.lastMessageStartTime) < 300000; // 5 minutes
        return hasActiveMessages || recentMessageStart;
    }

    getSessionInfo(): { isActive: boolean; isProcessing: boolean; lastActivity: number; activeMessages: number } {
        return {
            isActive: this.isRunning,
            isProcessing: this.isProcessingMessage,
            lastActivity: this.lastActivityTime,
            activeMessages: this.activeMessageCount
        };
    }
}