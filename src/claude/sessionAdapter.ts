import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { debugLog } from '../utils/logging';

/**
 * Adapter to make the VS Code extension's Claude process compatible with
 * the terminal's ClaudeSession interface for the recovery manager
 */
export class ClaudeSessionAdapter extends EventEmitter {
    private process: ChildProcess | null = null;
    
    constructor() {
        super();
    }
    
    setProcess(process: ChildProcess): void {
        this.process = process;
        
        // Forward process events
        if (process.stdout) {
            process.stdout.on('data', (data: Buffer) => {
                this.emit('output', data.toString());
            });
        }
        
        if (process.stderr) {
            process.stderr.on('data', (data: Buffer) => {
                this.emit('output', data.toString());
            });
        }
        
        process.on('exit', (code, signal) => {
            this.emit('exit', { exitCode: code, signal });
        });
    }
    
    async sendMessage(message: string): Promise<string> {
        if (!this.process || !this.process.stdin) {
            throw new Error('Process not available');
        }
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Message timeout'));
            }, 300000); // 5 minutes
            
            let responseBuffer = '';
            let isCollecting = false;
            
            const outputHandler = (output: string) => {
                debugLog(`Claude output: ${output}`);
                
                // Start collecting after we see the message echoed
                if (!isCollecting && output.includes(message)) {
                    isCollecting = true;
                    return;
                }
                
                if (isCollecting) {
                    responseBuffer += output;
                    
                    // Check if response is complete
                    if (this.isResponseComplete(responseBuffer)) {
                        clearTimeout(timeout);
                        this.removeListener('output', outputHandler);
                        resolve(responseBuffer.trim());
                    }
                }
            };
            
            this.on('output', outputHandler);
            
            // Send the message
            this.process!.stdin!.write(message + '\n');
        });
    }
    
    sendRawInput(input: string): void {
        if (this.process && this.process.stdin) {
            this.process.stdin.write(input);
        }
    }
    
    isActive(): boolean {
        return this.process !== null && !this.process.killed;
    }
    
    async stop(): Promise<void> {
        if (this.process && !this.process.killed) {
            this.process.kill();
            this.process = null;
        }
    }
    
    private isResponseComplete(response: string): boolean {
        const endings = [
            '\n>',
            '\nClaude>',
            '\n$ ',
            '\nclaude> ',
            'Human: ',
            'Is there anything else',
            'Let me know if',
            'Feel free to ask',
            'What would you like',
            'How can I help'
        ];
        
        return endings.some(ending => response.includes(ending));
    }
}

// Global session adapter instance
export const sessionAdapter = new ClaudeSessionAdapter();