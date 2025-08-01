import winston from 'winston';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import os from 'os';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogMetadata {
    component?: string;
    action?: string;
    userId?: string;
    sessionId?: string;
    duration?: number;
    error?: any;
    [key: string]: any;
}

export class Logger {
    private winston: winston.Logger;
    private level: LogLevel = 'info';
    private sessionId: string;
    private metrics: Map<string, { count: number; totalDuration: number }> = new Map();
    private startTimes: Map<string, number> = new Map();

    constructor(logFile?: string) {
        this.sessionId = this.generateSessionId();
        const dateStr = new Date().toISOString().split('T')[0];
        const logsDir = logFile ? path.dirname(logFile) : path.join(os.homedir(), '.autoclaude', 'logs');

        // Ensure logs directory exists
        try {
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true, mode: 0o755 });
            }
        } catch (error) {
            console.error('Failed to create logs directory:', error);
        }

        const transports: winston.transport[] = [
            // Console transport with clean formatting
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.timestamp({ format: 'HH:mm:ss' }),
                    winston.format.printf(({ timestamp, level, message, ...meta }) => {
                        const coloredLevel = this.colorizeLevel(level);
                        let output = `${chalk.gray(timestamp)} ${coloredLevel} ${message}`;
                        
                        // Add important metadata
                        if (meta.error) {
                            output += `\n  ${chalk.red('Error:')} ${meta.error}`;
                        }
                        if (meta.duration !== undefined) {
                            output += chalk.gray(` (${meta.duration}ms)`);
                        }
                        if (meta.component) {
                            output = `${chalk.gray(timestamp)} ${coloredLevel} [${chalk.cyan(meta.component)}] ${message}`;
                        }
                        
                        return output;
                    })
                )
            })
        ];

        // Production file transports
        if (process.env.NODE_ENV === 'production' || logFile) {
            transports.push(
                // Error log
                new winston.transports.File({
                    filename: path.join(logsDir, `error-${dateStr}.log`),
                    level: 'error',
                    maxsize: 10 * 1024 * 1024, // 10MB
                    maxFiles: 30,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                }),
                // Combined log
                new winston.transports.File({
                    filename: logFile || path.join(logsDir, `combined-${dateStr}.log`),
                    maxsize: 50 * 1024 * 1024, // 50MB
                    maxFiles: 7,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                }),
                // Performance metrics log
                new winston.transports.File({
                    filename: path.join(logsDir, `metrics-${dateStr}.log`),
                    level: 'info',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json(),
                        winston.format((info) => {
                            return (info.duration !== undefined || info.metric !== undefined) ? info : false;
                        })()
                    )
                })
            );
        }

        this.winston = winston.createLogger({
            level: this.level,
            defaultMeta: {
                sessionId: this.sessionId,
                pid: process.pid,
                hostname: os.hostname(),
                nodeVersion: process.version
            },
            transports,
            exceptionHandlers: [
                new winston.transports.File({ 
                    filename: path.join(logsDir, `exceptions-${dateStr}.log`)
                })
            ],
            rejectionHandlers: [
                new winston.transports.File({ 
                    filename: path.join(logsDir, `rejections-${dateStr}.log`)
                })
            ]
        });

        // Log startup
        this.info('Logger initialized', {
            component: 'logger',
            logsDir,
            sessionId: this.sessionId,
            environment: process.env.NODE_ENV || 'development'
        });
    }

    setLevel(level: LogLevel): void {
        this.level = level;
        this.winston.level = level;
    }

    getLevel(): LogLevel {
        return this.level;
    }

    error(message: string, metadata?: LogMetadata): void {
        this.winston.error(message, this.sanitizeMetadata(metadata));
    }

    warn(message: string, metadata?: LogMetadata): void {
        this.winston.warn(message, this.sanitizeMetadata(metadata));
    }

    info(message: string, metadata?: LogMetadata): void {
        this.winston.info(message, this.sanitizeMetadata(metadata));
    }

    debug(message: string, metadata?: LogMetadata): void {
        this.winston.debug(message, this.sanitizeMetadata(metadata));
    }

    // Performance monitoring
    startTimer(label: string): void {
        this.startTimes.set(label, Date.now());
    }

    endTimer(label: string, metadata?: LogMetadata): void {
        const startTime = this.startTimes.get(label);
        if (startTime) {
            const duration = Date.now() - startTime;
            this.startTimes.delete(label);
            
            // Update metrics
            const metric = this.metrics.get(label) || { count: 0, totalDuration: 0 };
            metric.count++;
            metric.totalDuration += duration;
            this.metrics.set(label, metric);
            
            this.info(`${label} completed`, {
                ...metadata,
                duration,
                metric: label,
                avgDuration: Math.round(metric.totalDuration / metric.count)
            });
        }
    }

    // Log metrics summary
    logMetrics(): void {
        const metricsData: any[] = [];
        
        this.metrics.forEach((metric, label) => {
            metricsData.push({
                label,
                count: metric.count,
                totalDuration: metric.totalDuration,
                avgDuration: Math.round(metric.totalDuration / metric.count)
            });
        });
        
        if (metricsData.length > 0) {
            this.info('Performance metrics summary', {
                component: 'metrics',
                metrics: metricsData
            });
        }
    }

    // Structured error logging
    logError(error: Error, context?: string, metadata?: LogMetadata): void {
        this.error(context || 'An error occurred', {
            ...metadata,
            error: {
                ...error,
                name: error.name,
                message: error.message,
                stack: error.stack
            }
        });
    }

    // Security audit logging
    logSecurityEvent(event: string, metadata?: LogMetadata): void {
        this.warn(`Security event: ${event}`, {
            ...metadata,
            securityEvent: true,
            timestamp: new Date().toISOString()
        });
    }

    private sanitizeMetadata(metadata?: LogMetadata): LogMetadata {
        if (!metadata) return {};
        
        // Remove sensitive data
        const sanitized = { ...metadata };
        const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
        
        Object.keys(sanitized).forEach(key => {
            if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
                sanitized[key] = '[REDACTED]';
            }
        });
        
        return sanitized;
    }

    private generateSessionId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private colorizeLevel(level: string): string {
        const colors: { [key: string]: (text: string) => string } = {
            error: chalk.red,
            warn: chalk.yellow,
            info: chalk.blue,
            debug: chalk.gray
        };

        const colorFn = colors[level] || chalk.white;
        return colorFn(level.toUpperCase().padEnd(5));
    }

    // Cleanup method
    async close(): Promise<void> {
        this.logMetrics();
        this.info('Logger closing', { component: 'logger' });
        
        return new Promise((resolve) => {
            this.winston.on('finish', resolve);
            this.winston.end();
        });
    }
}