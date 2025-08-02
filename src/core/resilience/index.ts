import * as vscode from 'vscode';
import { debugLog, errorLog, warnLog } from '../../utils/logging';
import { ErrorManager, CommonErrors, ErrorSeverity } from '../errors';

export interface ResilienceConfig {
    retryAttempts: number;
    retryDelay: number;
    backoffMultiplier: number;
    maxRetryDelay: number;
    enableFallbacks: boolean;
    enableGracefulDegradation: boolean;
}

export const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
    retryAttempts: 3,
    retryDelay: 1000,
    backoffMultiplier: 2,
    maxRetryDelay: 30000,
    enableFallbacks: true,
    enableGracefulDegradation: true
};

export enum ServiceStatus {
    HEALTHY = 'healthy',
    DEGRADED = 'degraded',
    FAILING = 'failing',
    OFFLINE = 'offline'
}

export interface ServiceHealth {
    status: ServiceStatus;
    lastCheck: Date;
    failureCount: number;
    lastError?: string;
    degradationReason?: string;
}

export class ResilienceManager {
    private static instance: ResilienceManager;
    private config: ResilienceConfig;
    private serviceHealth: Map<string, ServiceHealth>;
    private circuitBreakers: Map<string, CircuitBreaker>;

    private constructor() {
        this.config = DEFAULT_RESILIENCE_CONFIG;
        this.serviceHealth = new Map();
        this.circuitBreakers = new Map();
    }

    static getInstance(): ResilienceManager {
        if (!ResilienceManager.instance) {
            ResilienceManager.instance = new ResilienceManager();
        }
        return ResilienceManager.instance;
    }

    updateConfig(config: Partial<ResilienceConfig>): void {
        this.config = { ...this.config, ...config };
    }

    // Retry with exponential backoff
    async retryWithBackoff<T>(
        operation: () => Promise<T>,
        serviceName: string,
        options?: Partial<ResilienceConfig>
    ): Promise<T> {
        const config = { ...this.config, ...options };
        let lastError: Error;
        let delay = config.retryDelay;

        for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
            try {
                const result = await operation();
                this.recordSuccess(serviceName);
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                this.recordFailure(serviceName, lastError);

                if (attempt === config.retryAttempts) {
                    break;
                }

                debugLog(`Retry attempt ${attempt}/${config.retryAttempts} for ${serviceName} failed: ${lastError.message}`);
                
                // Wait before retry with exponential backoff
                await this.sleep(Math.min(delay, config.maxRetryDelay));
                delay *= config.backoffMultiplier;
            }
        }

        // All retries exhausted
        ErrorManager.logError(lastError!, { serviceName, attempts: config.retryAttempts });
        throw lastError!;
    }

    // Circuit breaker pattern
    async executeWithCircuitBreaker<T>(
        operation: () => Promise<T>,
        serviceName: string,
        options?: {
            failureThreshold?: number;
            resetTimeout?: number;
            fallback?: () => Promise<T>;
        }
    ): Promise<T> {
        const circuitBreaker = this.getOrCreateCircuitBreaker(serviceName, options);
        
        if (circuitBreaker.state === CircuitBreakerState.OPEN) {
            if (Date.now() - circuitBreaker.lastFailureTime > circuitBreaker.resetTimeout) {
                circuitBreaker.state = CircuitBreakerState.HALF_OPEN;
                debugLog(`Circuit breaker for ${serviceName} moved to HALF_OPEN`);
            } else if (options?.fallback) {
                warnLog(`Circuit breaker OPEN for ${serviceName}, using fallback`);
                return await options.fallback();
            } else {
                throw new Error(`Service ${serviceName} is temporarily unavailable (circuit breaker open)`);
            }
        }

        try {
            const result = await operation();
            circuitBreaker.recordSuccess();
            this.recordSuccess(serviceName);
            return result;
        } catch (error) {
            circuitBreaker.recordFailure();
            this.recordFailure(serviceName, error instanceof Error ? error : new Error(String(error)));
            
            if (circuitBreaker.state === CircuitBreakerState.OPEN && options?.fallback) {
                warnLog(`Circuit breaker opened for ${serviceName}, using fallback`);
                return await options.fallback();
            }
            
            throw error;
        }
    }

    // Graceful degradation
    async executeWithDegradation<T, F>(
        primaryOperation: () => Promise<T>,
        fallbackOperation: () => Promise<F>,
        serviceName: string,
        degradationMessage?: string
    ): Promise<T | F> {
        if (!this.config.enableGracefulDegradation) {
            return await primaryOperation();
        }

        try {
            return await primaryOperation();
        } catch (error) {
            errorLog(`Primary operation failed for ${serviceName}, falling back to degraded mode`, {
                error: error instanceof Error ? error.message : String(error)
            });

            this.markServiceDegraded(serviceName, degradationMessage || 'Primary operation failed, using fallback');

            try {
                return await fallbackOperation();
            } catch (fallbackError) {
                this.markServiceOffline(serviceName);
                errorLog(`Fallback operation also failed for ${serviceName}`, {
                    fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                });
                throw error; // Throw original error
            }
        }
    }

    // Health monitoring
    recordSuccess(serviceName: string): void {
        const health = this.getOrCreateServiceHealth(serviceName);
        health.status = ServiceStatus.HEALTHY;
        health.failureCount = 0;
        health.lastCheck = new Date();
        health.lastError = undefined;
        health.degradationReason = undefined;
    }

    recordFailure(serviceName: string, error: Error): void {
        const health = this.getOrCreateServiceHealth(serviceName);
        health.failureCount++;
        health.lastCheck = new Date();
        health.lastError = error.message;

        // Update status based on failure count
        if (health.failureCount >= 5) {
            health.status = ServiceStatus.OFFLINE;
        } else if (health.failureCount >= 2) {
            health.status = ServiceStatus.FAILING;
        }
    }

    markServiceDegraded(serviceName: string, reason: string): void {
        const health = this.getOrCreateServiceHealth(serviceName);
        health.status = ServiceStatus.DEGRADED;
        health.degradationReason = reason;
        health.lastCheck = new Date();
    }

    markServiceOffline(serviceName: string): void {
        const health = this.getOrCreateServiceHealth(serviceName);
        health.status = ServiceStatus.OFFLINE;
        health.lastCheck = new Date();
    }

    getServiceHealth(serviceName: string): ServiceHealth | undefined {
        return this.serviceHealth.get(serviceName);
    }

    getAllServiceHealth(): Map<string, ServiceHealth> {
        return new Map(this.serviceHealth);
    }

    // Timeout wrapper
    async withTimeout<T>(
        operation: () => Promise<T>,
        timeoutMs: number,
        serviceName: string,
        fallback?: () => Promise<T>
    ): Promise<T> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        try {
            return await Promise.race([operation(), timeoutPromise]);
        } catch (error) {
            this.recordFailure(serviceName, error instanceof Error ? error : new Error(String(error)));
            
            if (fallback && error instanceof Error && error.message.includes('timed out')) {
                warnLog(`Operation timed out for ${serviceName}, using fallback`);
                return await fallback();
            }
            
            throw error;
        }
    }

    // Bulkhead pattern - resource isolation
    async executeWithBulkhead<T>(
        operation: () => Promise<T>,
        bulkheadName: string,
        maxConcurrent: number = 5
    ): Promise<T> {
        // Simple implementation - could be enhanced with proper semaphore
        const startTime = Date.now();
        
        try {
            const result = await operation();
            const duration = Date.now() - startTime;
            debugLog(`Bulkhead ${bulkheadName} operation completed in ${duration}ms`);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            errorLog(`Bulkhead ${bulkheadName} operation failed after ${duration}ms`, {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private getOrCreateServiceHealth(serviceName: string): ServiceHealth {
        if (!this.serviceHealth.has(serviceName)) {
            this.serviceHealth.set(serviceName, {
                status: ServiceStatus.HEALTHY,
                lastCheck: new Date(),
                failureCount: 0
            });
        }
        return this.serviceHealth.get(serviceName)!;
    }

    private getOrCreateCircuitBreaker(serviceName: string, options?: any): CircuitBreaker {
        if (!this.circuitBreakers.has(serviceName)) {
            this.circuitBreakers.set(serviceName, new CircuitBreaker(
                options?.failureThreshold || 5,
                options?.resetTimeout || 60000
            ));
        }
        return this.circuitBreakers.get(serviceName)!;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Health check dashboard
    showHealthDashboard(): void {
        const healthData = Array.from(this.serviceHealth.entries()).map(([name, health]) => {
            const statusIcon = {
                [ServiceStatus.HEALTHY]: '✅',
                [ServiceStatus.DEGRADED]: '⚠️',
                [ServiceStatus.FAILING]: '❌',
                [ServiceStatus.OFFLINE]: '🔴'
            }[health.status];

            return `${statusIcon} ${name}: ${health.status.toUpperCase()}${health.degradationReason ? ` (${health.degradationReason})` : ''}`;
        });

        const content = [
            'Claude Autopilot Service Health Dashboard',
            '='.repeat(40),
            '',
            ...healthData,
            '',
            `Last updated: ${new Date().toLocaleString()}`,
            '',
            'Legend:',
            '✅ Healthy - Service operating normally',
            '⚠️ Degraded - Service working with limitations',
            '❌ Failing - Service experiencing issues',
            '🔴 Offline - Service unavailable'
        ].join('\n');

        vscode.workspace.openTextDocument({
            content,
            language: 'plaintext'
        }).then(doc => {
            vscode.window.showTextDocument(doc);
        });
    }
}

enum CircuitBreakerState {
    CLOSED = 'closed',
    OPEN = 'open',
    HALF_OPEN = 'half_open'
}

class CircuitBreaker {
    state: CircuitBreakerState = CircuitBreakerState.CLOSED;
    failureCount: number = 0;
    lastFailureTime: number = 0;

    constructor(
        private failureThreshold: number,
        public resetTimeout: number
    ) {}

    recordSuccess(): void {
        this.failureCount = 0;
        this.state = CircuitBreakerState.CLOSED;
    }

    recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        
        if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitBreakerState.OPEN;
        }
    }
}

// Global resilience manager instance
export const resilience = ResilienceManager.getInstance();

// Convenience functions
export async function retryOperation<T>(
    operation: () => Promise<T>,
    serviceName: string,
    options?: Partial<ResilienceConfig>
): Promise<T> {
    return resilience.retryWithBackoff(operation, serviceName, options);
}

export async function executeWithFallback<T, F>(
    primary: () => Promise<T>,
    fallback: () => Promise<F>,
    serviceName: string,
    degradationMessage?: string
): Promise<T | F> {
    return resilience.executeWithDegradation(primary, fallback, serviceName, degradationMessage);
}

export async function withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    serviceName: string,
    fallback?: () => Promise<T>
): Promise<T> {
    return resilience.withTimeout(operation, timeoutMs, serviceName, fallback);
}