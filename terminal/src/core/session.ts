import { spawn, IPty } from 'node-pty';
import { EventEmitter } from 'eventemitter3';
import { Config } from './config';
import { Logger } from '../utils/logger';
import os from 'os';
import path from 'path';

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
    private readonly THROTTLE_MS = 500;

    constructor(config: Config, logger: Logger) {
        super();
        this.config = config;
        this.logger = logger;
    }

    async start(skipPermissions: boolean = true): Promise<void> {
        if (this.isRunning) {
            throw new Error('Session already running');
        }

        try {
            const args = skipPermissions ? ['--dangerously-skip-permissions'] : [];
            
            // Get terminal dimensions
            const cols = process.stdout.columns || 80;
            const rows = process.stdout.rows || 24;

            // Spawn Claude PTY
            this.pty = spawn('claude', args, {
                name: 'xterm-256color',
                cols,
                rows,
                cwd: process.cwd(),
                env: process.env as { [key: string]: string },
            });

            this.isRunning = true;
            this.setupEventHandlers();
            
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
            
            this.logger.info('Claude session stopped');
            this.emit('stopped');
            
        } catch (error) {
            this.logger.error('Error stopping session:', error);
        }
    }

    async sendMessage(message: string, onProgress?: (elapsed: number) => void): Promise<string> {
        if (!this.isRunning || !this.pty) {
            throw new Error('Session not running');
        }

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
                
                // Start collecting after we see the message echoed
                if (!isCollecting && output.includes(message)) {
                    isCollecting = true;
                    return;
                }

                if (isCollecting) {
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

            this.on('output', outputHandler);
            
            // Send the message
            this.pty.write(message + '\\n');
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
        // Update current screen state
        if (this.hasScreenClear(this.outputBuffer)) {
            const lastClearIndex = this.getLastScreenClearIndex(this.outputBuffer);
            this.currentScreen = this.outputBuffer.substring(lastClearIndex);
            this.outputBuffer = this.currentScreen;
        } else {
            this.currentScreen = this.outputBuffer;
        }

        // Throttle output events
        if (this.outputTimer) {
            clearTimeout(this.outputTimer);
        }

        this.outputTimer = setTimeout(() => {
            this.flushOutput();
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
        // Check for common Claude response endings
        const endings = [
            '\\n>',
            '\\nClaude>',
            'Is there anything else',
            'Let me know if',
            'Feel free to ask',
            'What would you like',
            'How can I help',
            'today?',
            'tasks.'
        ];
        
        // Also check for no new output for a period (indicates completion)
        const lastNewline = response.lastIndexOf('\\n');
        const lastContent = response.substring(lastNewline + 1);
        
        // If we see a question mark or period at the end of a line, likely done
        if (lastContent.endsWith('?') || lastContent.endsWith('.')) {
            return true;
        }
        
        return endings.some(ending => response.includes(ending));
    }

    private cleanResponse(response: string): string {
        // Remove ANSI escape codes
        const ansiRegex = /\\x1b\\[[0-9;]*[a-zA-Z]/g;
        let cleaned = response.replace(ansiRegex, '');
        
        // Remove prompt markers
        cleaned = cleaned.replace(/\\n?>/g, '');
        cleaned = cleaned.replace(/Claude>/g, '');
        
        return cleaned.trim();
    }

    isActive(): boolean {
        return this.isRunning;
    }

    getCurrentScreen(): string {
        return this.currentScreen;
    }
}