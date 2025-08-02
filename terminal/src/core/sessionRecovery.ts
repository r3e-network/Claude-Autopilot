import { ClaudeSession } from './session';
import { HealthMonitor } from './healthMonitor';
import { Logger } from '../utils/logger';
import { Config } from './config';
import { EventEmitter } from 'eventemitter3';

import { toLogMetadata, toError } from '../utils/typeGuards';
export interface RecoveryOptions {
    maxRetries: number;
    retryDelay: number;
    preserveContext: boolean;
    autoRecover: boolean;
}

export interface RecoveryState {
    retryCount: number;
    lastError?: string;
    isRecovering: boolean;
    lastRecoveryTime?: number;
    pendingMessage?: { text: string; timestamp: number };
    wasProcessingWhenFailed?: boolean;
}

export class SessionRecoveryManager extends EventEmitter {
    private session: ClaudeSession | null = null;
    private healthMonitor: HealthMonitor | null = null;
    private logger: Logger;
    private config: Config;
    private options: RecoveryOptions;
    private recoveryState: RecoveryState;
    private contextBuffer: string[] = [];
    private maxContextSize: number = 10;

    constructor(config: Config, logger: Logger, options?: Partial<RecoveryOptions>) {
        super();
        this.config = config;
        this.logger = logger;
        this.options = {
            maxRetries: 3,
            retryDelay: 5000,
            preserveContext: true,
            autoRecover: true,
            ...options
        };
        this.recoveryState = {
            retryCount: 0,
            isRecovering: false
        };
    }

    async initializeSession(skipPermissions: boolean = true): Promise<ClaudeSession> {
        try {
            // Create new session
            this.session = new ClaudeSession(this.config, this.logger);
            
            // Set up session event handlers
            this.setupSessionHandlers();
            
            // Start the session
            await this.session.start(skipPermissions);
            
            // Create and start health monitor
            this.healthMonitor = new HealthMonitor(this.session, this.logger);
            this.setupHealthMonitorHandlers();
            this.healthMonitor.start();
            
            // Reset recovery state on successful start
            this.recoveryState.retryCount = 0;
            this.recoveryState.isRecovering = false;
            
            this.logger.info('Session initialized successfully with health monitoring');
            this.emit('sessionReady', this.session);
            
            return this.session;
        } catch (error) {
            this.logger.error('Failed to initialize session:', toLogMetadata({ error: toError(error) }));
            throw error;
        }
    }

    private setupSessionHandlers(): void {
        if (!this.session) return;

        this.session.on('output', (data: string) => {
            // Keep context buffer for recovery
            if (this.options.preserveContext && data.trim()) {
                this.contextBuffer.push(data);
                if (this.contextBuffer.length > this.maxContextSize) {
                    this.contextBuffer.shift();
                }
            }
        });

        this.session.on('exit', ({ exitCode, signal }) => {
            this.logger.warn(`Session exited unexpectedly (code: ${exitCode}, signal: ${signal})`);
            
            // Check if session was processing when it failed
            const sessionInfo = this.session?.getSessionInfo();
            this.recoveryState.wasProcessingWhenFailed = sessionInfo?.isProcessing || false;
            
            if (this.options.autoRecover && !this.recoveryState.isRecovering) {
                this.handleSessionCrash();
            }
        });
    }

    private setupHealthMonitorHandlers(): void {
        if (!this.healthMonitor) return;

        this.healthMonitor.on('sessionStuck', (details) => {
            this.logger.error('Session detected as stuck:', details);
            this.emit('sessionStuck', details);
            
            if (this.options.autoRecover) {
                this.initiateRecovery('Session stuck - no activity detected');
            }
        });

        this.healthMonitor.on('sessionUnhealthy', (details) => {
            this.logger.error('Session unhealthy:', details);
            this.emit('sessionUnhealthy', details);
            
            if (this.options.autoRecover) {
                this.initiateRecovery('Session unhealthy - multiple health check failures');
            }
        });

        this.healthMonitor.on('healthCheckError', (error) => {
            this.logger.error('Health check error:', error);
        });
    }

    private async handleSessionCrash(): Promise<void> {
        if (this.recoveryState.isRecovering) return;
        
        this.logger.warn('Handling session crash...', {
            wasProcessing: this.recoveryState.wasProcessingWhenFailed,
            hasPendingMessage: !!this.recoveryState.pendingMessage
        });
        
        // If session was processing, save the context for retry
        if (this.recoveryState.wasProcessingWhenFailed && this.recoveryState.pendingMessage) {
            this.logger.info('Session crashed while processing message, will retry after recovery');
        }
        
        await this.initiateRecovery('Session crashed unexpectedly');
    }

    async initiateRecovery(reason: string): Promise<void> {
        if (this.recoveryState.isRecovering) {
            this.logger.warn('Recovery already in progress');
            return;
        }

        this.recoveryState.isRecovering = true;
        this.recoveryState.lastError = reason;
        
        this.logger.info(`Initiating session recovery: ${reason}`);
        this.emit('recoveryStarted', { reason, attempt: this.recoveryState.retryCount + 1 });

        try {
            // Stop health monitor
            if (this.healthMonitor) {
                this.healthMonitor.stop();
                this.healthMonitor = null;
            }

            // Try to gracefully stop current session
            if (this.session && this.session.isActive()) {
                try {
                    await this.session.stop();
                } catch (error) {
                    this.logger.warn('Error stopping session during recovery:', toLogMetadata({ error: toError(error) }));
                }
            }

            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, this.options.retryDelay));

            // Check retry limit
            if (this.recoveryState.retryCount >= this.options.maxRetries) {
                throw new Error(`Max recovery attempts (${this.options.maxRetries}) exceeded`);
            }

            this.recoveryState.retryCount++;

            // Attempt to create new session
            await this.initializeSession(true);

            // Restore context if enabled
            if (this.options.preserveContext && this.contextBuffer.length > 0) {
                this.logger.info('Attempting to restore session context...');
                this.emit('contextRestoring', this.contextBuffer);
                // The actual context restoration would be handled by the terminal UI
            }
            
            // If there was a pending message when session failed, notify about retry
            if (this.recoveryState.pendingMessage && 
                (Date.now() - this.recoveryState.pendingMessage.timestamp) < 300000) { // Within 5 minutes
                this.logger.info('Pending message found, will retry after recovery');
                this.emit('pendingMessageRetry', this.recoveryState.pendingMessage);
            }

            this.recoveryState.lastRecoveryTime = Date.now();
            this.emit('recoverySucceeded', {
                attempt: this.recoveryState.retryCount,
                contextRestored: this.options.preserveContext
            });

        } catch (error) {
            this.logger.error('Recovery failed:', toLogMetadata({ error: toError(error) }));
            this.emit('recoveryFailed', {
                error,
                attempt: this.recoveryState.retryCount,
                willRetry: this.recoveryState.retryCount < this.options.maxRetries
            });

            if (this.recoveryState.retryCount < this.options.maxRetries) {
                // Schedule another recovery attempt
                setTimeout(() => {
                    this.initiateRecovery(reason);
                }, this.options.retryDelay * 2); // Double delay for subsequent attempts
            } else {
                // Give up
                this.recoveryState.isRecovering = false;
                this.emit('recoveryAbandoned', {
                    reason: 'Max retries exceeded',
                    lastError: error
                });
            }
        } finally {
            this.recoveryState.isRecovering = false;
        }
    }

    async sendMessage(message: string, onProgress?: (elapsed: number) => void): Promise<string> {
        // Debug logging
        this.logger.debug(`Sending message, session exists: ${!!this.session}, session active: ${this.session?.isActive()}`);
        
        if (!this.session || !this.session.isActive()) {
            // If we have auto-recover on and not already recovering, try recovery first
            if (this.options.autoRecover && !this.recoveryState.isRecovering) {
                this.logger.info('Session not active, attempting recovery before sending message');
                this.recoveryState.pendingMessage = { text: message, timestamp: Date.now() };
                await this.initiateRecovery('Session not active');
                
                // After recovery, try again if session is now active
                if (this.session && this.session.isActive()) {
                    this.recoveryState.pendingMessage = undefined;
                    return this.sendMessage(message, onProgress);
                }
            }
            throw new Error('Session not active');
        }

        // Save message in case we need to retry after crash
        this.recoveryState.pendingMessage = { text: message, timestamp: Date.now() };

        if (this.healthMonitor) {
            this.healthMonitor.recordMessageSent();
        }

        try {
            const response = await this.session.sendMessage(message, onProgress);
            
            if (this.healthMonitor) {
                this.healthMonitor.recordMessageSuccess();
            }
            
            // Clear pending message on success
            this.recoveryState.pendingMessage = undefined;
            
            return response;
        } catch (error) {
            if (this.healthMonitor) {
                this.healthMonitor.recordMessageFailed(error instanceof Error ? error.message : String(error));
            }
            
            // Check if we should attempt recovery
            if (this.options.autoRecover && error instanceof Error && 
                (error.message.includes('timeout') || error.message.includes('Session not active') || 
                 error.message.includes('Session not running'))) {
                this.logger.warn('Message failed, attempting recovery...');
                await this.initiateRecovery(`Message failed: ${error.message}`);
                
                // Retry the message after recovery
                if (this.session && this.session.isActive()) {
                    this.recoveryState.pendingMessage = undefined;
                    return this.session.sendMessage(message, onProgress);
                }
            }
            
            // Clear pending message on permanent failure
            this.recoveryState.pendingMessage = undefined;
            throw error;
        }
    }

    getHealthStatus() {
        return this.healthMonitor?.getStatus() || null;
    }

    getRecoveryState(): RecoveryState {
        return { ...this.recoveryState };
    }

    async stop(): Promise<void> {
        if (this.healthMonitor) {
            this.healthMonitor.stop();
        }
        
        if (this.session) {
            await this.session.stop();
        }
        
        this.contextBuffer = [];
        this.recoveryState.retryCount = 0;
    }
}