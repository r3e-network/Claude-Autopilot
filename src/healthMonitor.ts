import { EventEmitter } from 'events';
import { debugLog } from './utils/logging';

interface Logger {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string, error?: any) => void;
}

interface ClaudeSession {
    on: (event: string, handler: Function) => void;
    sendRawInput: (input: string) => void;
    isActive: () => boolean;
}

export interface HealthStatus {
    isHealthy: boolean;
    lastResponseTime: number;
    consecutiveTimeouts: number;
    sessionUptime: number;
    totalMessages: number;
    failedMessages: number;
    lastError?: string;
}

export interface HealthCheckOptions {
    checkInterval: number;       // How often to check health (ms)
    responseTimeout: number;     // Max time to wait for response (ms)
    maxConsecutiveTimeouts: number; // Max timeouts before declaring unhealthy
    stuckDetectionTime: number;  // Time without activity to consider stuck (ms)
}

export class HealthMonitor extends EventEmitter {
    private logger: Logger;
    private session: ClaudeSession;
    private options: HealthCheckOptions;
    private checkInterval: NodeJS.Timeout | null = null;
    private lastActivityTime: number = Date.now();
    private lastResponseTime: number = Date.now();
    private consecutiveTimeouts: number = 0;
    private sessionStartTime: number = Date.now();
    private totalMessages: number = 0;
    private failedMessages: number = 0;
    private isMonitoring: boolean = false;
    private pendingHealthCheck: boolean = false;

    constructor(session: ClaudeSession, logger?: Logger, options?: Partial<HealthCheckOptions>) {
        super();
        this.session = session;
        this.logger = logger || {
            info: (msg: string) => debugLog(`[HealthMonitor] ${msg}`),
            warn: (msg: string) => debugLog(`[HealthMonitor WARN] ${msg}`),
            error: (msg: string, error?: any) => debugLog(`[HealthMonitor ERROR] ${msg}`, error)
        };
        this.options = {
            checkInterval: 30000,        // Check every 30 seconds
            responseTimeout: 10000,      // 10 second response timeout
            maxConsecutiveTimeouts: 3,   // 3 strikes and you're out
            stuckDetectionTime: 120000,  // 2 minutes without activity = stuck
            ...options
        };

        this.setupSessionListeners();
    }

    private setupSessionListeners(): void {
        // Monitor session output
        this.session.on('output', (data: string) => {
            this.lastActivityTime = Date.now();
            if (data.trim().length > 0) {
                this.lastResponseTime = Date.now();
            }
        });

        // Monitor session exit
        this.session.on('exit', () => {
            this.stop();
            this.emit('sessionExited');
        });
    }

    start(): void {
        if (this.isMonitoring) return;

        this.isMonitoring = true;
        this.sessionStartTime = Date.now();
        this.lastActivityTime = Date.now();
        this.lastResponseTime = Date.now();
        
        this.logger.info('Health monitor started');
        
        // Start periodic health checks
        this.checkInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.options.checkInterval);

        // Perform initial check after 5 seconds
        setTimeout(() => this.performHealthCheck(), 5000);
    }

    stop(): void {
        if (!this.isMonitoring) return;

        this.isMonitoring = false;
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }

        this.logger.info('Health monitor stopped');
    }

    private async performHealthCheck(): Promise<void> {
        if (!this.isMonitoring || this.pendingHealthCheck) return;

        this.pendingHealthCheck = true;

        try {
            const timeSinceLastActivity = Date.now() - this.lastActivityTime;
            const timeSinceLastResponse = Date.now() - this.lastResponseTime;

            // Check if session appears stuck
            if (timeSinceLastActivity > this.options.stuckDetectionTime) {
                this.logger.warn(`Session appears stuck (no activity for ${timeSinceLastActivity}ms)`);
                this.emit('sessionStuck', {
                    timeSinceLastActivity,
                    timeSinceLastResponse
                });
                return;
            }

            // Send a lightweight health check command
            const healthCheckSuccess = await this.sendHealthCheck();

            if (healthCheckSuccess) {
                this.consecutiveTimeouts = 0;
                this.emit('healthCheckPassed');
            } else {
                this.consecutiveTimeouts++;
                this.logger.warn(`Health check failed (${this.consecutiveTimeouts}/${this.options.maxConsecutiveTimeouts})`);
                
                if (this.consecutiveTimeouts >= this.options.maxConsecutiveTimeouts) {
                    this.emit('sessionUnhealthy', {
                        reason: 'Too many consecutive timeouts',
                        consecutiveTimeouts: this.consecutiveTimeouts
                    });
                }
            }
        } catch (error) {
            this.logger.error('Health check error:', error);
            this.emit('healthCheckError', error);
        } finally {
            this.pendingHealthCheck = false;
        }
    }

    private async sendHealthCheck(): Promise<boolean> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.session.removeListener('output', outputHandler);
                resolve(false);
            }, this.options.responseTimeout);

            const outputHandler = (data: string) => {
                // Any output is a sign of life
                if (data.trim().length > 0) {
                    clearTimeout(timeout);
                    this.session.removeListener('output', outputHandler);
                    resolve(true);
                }
            };

            this.session.on('output', outputHandler);

            // Send a minimal command that should trigger a response
            // Using empty line or space to check if Claude is responsive
            this.session.sendRawInput('\n');
        });
    }

    getStatus(): HealthStatus {
        return {
            isHealthy: this.consecutiveTimeouts < this.options.maxConsecutiveTimeouts,
            lastResponseTime: this.lastResponseTime,
            consecutiveTimeouts: this.consecutiveTimeouts,
            sessionUptime: Date.now() - this.sessionStartTime,
            totalMessages: this.totalMessages,
            failedMessages: this.failedMessages
        };
    }

    recordMessageSent(): void {
        this.totalMessages++;
        this.lastActivityTime = Date.now();
    }

    recordMessageFailed(error?: string): void {
        this.failedMessages++;
        if (error) {
            this.logger.error(`Message failed: ${error}`);
        }
    }

    recordMessageSuccess(): void {
        this.lastResponseTime = Date.now();
        this.consecutiveTimeouts = 0;
    }

    isHealthy(): boolean {
        const status = this.getStatus();
        return status.isHealthy && this.isMonitoring;
    }
}