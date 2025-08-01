import { EventEmitter } from 'eventemitter3';
import { Logger } from './logger';

interface PerformanceMetrics {
    cpuUsage: NodeJS.CpuUsage;
    memoryUsage: NodeJS.MemoryUsage;
    eventLoopDelay: number;
    activeHandles: number;
    activeRequests: number;
    timestamp: number;
}

interface PerformanceThresholds {
    maxMemoryUsageMB: number;
    maxHeapUsagePercent: number;
    maxEventLoopDelayMs: number;
    maxCpuUsagePercent: number;
}

export class PerformanceMonitor extends EventEmitter {
    private metrics: PerformanceMetrics[] = [];
    private monitoringInterval: NodeJS.Timeout | null = null;
    private readonly maxMetricsHistory = 100;
    private lastCpuUsage: NodeJS.CpuUsage;
    private startTime: number;

    private thresholds: PerformanceThresholds = {
        maxMemoryUsageMB: 500,
        maxHeapUsagePercent: 90,
        maxEventLoopDelayMs: 100,
        maxCpuUsagePercent: 80
    };

    constructor(private logger: Logger) {
        super();
        this.lastCpuUsage = process.cpuUsage();
        this.startTime = Date.now();
    }

    /**
     * Start performance monitoring
     */
    start(intervalMs: number = 10000): void {
        if (this.monitoringInterval) {
            return;
        }

        this.logger.info('Starting performance monitoring', { intervalMs });

        this.monitoringInterval = setInterval(() => {
            this.collectMetrics();
        }, intervalMs);

        // Collect initial metrics
        this.collectMetrics();
    }

    /**
     * Stop performance monitoring
     */
    stop(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            this.logger.info('Stopped performance monitoring');
        }
    }

    /**
     * Collect current performance metrics
     */
    private collectMetrics(): void {
        const currentCpuUsage = process.cpuUsage();
        const memoryUsage = process.memoryUsage();
        const eventLoopDelay = this.measureEventLoopDelay();
        
        const metrics: PerformanceMetrics = {
            cpuUsage: currentCpuUsage,
            memoryUsage,
            eventLoopDelay,
            activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
            activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
            timestamp: Date.now()
        };

        // Add to history
        this.metrics.push(metrics);
        if (this.metrics.length > this.maxMetricsHistory) {
            this.metrics.shift();
        }

        // Check thresholds
        this.checkThresholds(metrics);

        // Emit metrics event
        this.emit('metrics', this.getFormattedMetrics(metrics));

        this.lastCpuUsage = currentCpuUsage;
    }

    /**
     * Measure event loop delay
     */
    private measureEventLoopDelay(): number {
        const start = process.hrtime.bigint();
        setImmediate(() => {
            const delay = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms
            return delay;
        });
        return 0; // Placeholder, actual measurement is async
    }

    /**
     * Check if any thresholds are exceeded
     */
    private checkThresholds(metrics: PerformanceMetrics): void {
        const memoryUsageMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
        const heapUsagePercent = (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100;
        const cpuPercent = this.calculateCpuUsagePercent(metrics.cpuUsage);

        // Memory threshold
        if (memoryUsageMB > this.thresholds.maxMemoryUsageMB) {
            this.emit('threshold-exceeded', {
                type: 'memory',
                value: memoryUsageMB,
                threshold: this.thresholds.maxMemoryUsageMB,
                message: `Memory usage ${memoryUsageMB.toFixed(2)}MB exceeds threshold`
            });
        }

        // Heap usage threshold
        if (heapUsagePercent > this.thresholds.maxHeapUsagePercent) {
            this.emit('threshold-exceeded', {
                type: 'heap',
                value: heapUsagePercent,
                threshold: this.thresholds.maxHeapUsagePercent,
                message: `Heap usage ${heapUsagePercent.toFixed(2)}% exceeds threshold`
            });

            // Force garbage collection if available
            if (global.gc) {
                this.logger.info('Forcing garbage collection due to high heap usage');
                global.gc();
            }
        }

        // CPU threshold
        if (cpuPercent > this.thresholds.maxCpuUsagePercent) {
            this.emit('threshold-exceeded', {
                type: 'cpu',
                value: cpuPercent,
                threshold: this.thresholds.maxCpuUsagePercent,
                message: `CPU usage ${cpuPercent.toFixed(2)}% exceeds threshold`
            });
        }

        // Event loop delay threshold
        if (metrics.eventLoopDelay > this.thresholds.maxEventLoopDelayMs) {
            this.emit('threshold-exceeded', {
                type: 'eventLoop',
                value: metrics.eventLoopDelay,
                threshold: this.thresholds.maxEventLoopDelayMs,
                message: `Event loop delay ${metrics.eventLoopDelay.toFixed(2)}ms exceeds threshold`
            });
        }
    }

    /**
     * Calculate CPU usage percentage
     */
    private calculateCpuUsagePercent(currentUsage: NodeJS.CpuUsage): number {
        const userDiff = currentUsage.user - this.lastCpuUsage.user;
        const systemDiff = currentUsage.system - this.lastCpuUsage.system;
        const totalDiff = userDiff + systemDiff;
        
        const elapsedTime = Date.now() - this.startTime;
        const cpuPercent = (totalDiff / 1000 / elapsedTime) * 100;
        
        return Math.min(cpuPercent, 100); // Cap at 100%
    }

    /**
     * Get formatted metrics for display
     */
    private getFormattedMetrics(metrics: PerformanceMetrics): any {
        const memoryUsageMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
        const totalMemoryMB = metrics.memoryUsage.heapTotal / 1024 / 1024;
        const externalMB = metrics.memoryUsage.external / 1024 / 1024;
        const rssMB = metrics.memoryUsage.rss / 1024 / 1024;

        return {
            memory: {
                heapUsed: `${memoryUsageMB.toFixed(2)} MB`,
                heapTotal: `${totalMemoryMB.toFixed(2)} MB`,
                heapPercent: `${((metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal) * 100).toFixed(2)}%`,
                external: `${externalMB.toFixed(2)} MB`,
                rss: `${rssMB.toFixed(2)} MB`
            },
            cpu: {
                user: `${(metrics.cpuUsage.user / 1000).toFixed(2)} ms`,
                system: `${(metrics.cpuUsage.system / 1000).toFixed(2)} ms`,
                percent: `${this.calculateCpuUsagePercent(metrics.cpuUsage).toFixed(2)}%`
            },
            process: {
                uptime: `${Math.floor(process.uptime())} seconds`,
                activeHandles: metrics.activeHandles,
                activeRequests: metrics.activeRequests
            },
            eventLoopDelay: `${metrics.eventLoopDelay.toFixed(2)} ms`
        };
    }

    /**
     * Get current metrics
     */
    getCurrentMetrics(): any {
        if (this.metrics.length === 0) {
            return null;
        }
        return this.getFormattedMetrics(this.metrics[this.metrics.length - 1]);
    }

    /**
     * Get average metrics over a time period
     */
    getAverageMetrics(periodMs: number = 60000): any {
        const now = Date.now();
        const relevantMetrics = this.metrics.filter(m => now - m.timestamp <= periodMs);
        
        if (relevantMetrics.length === 0) {
            return null;
        }

        const avgMemory = relevantMetrics.reduce((sum, m) => sum + m.memoryUsage.heapUsed, 0) / relevantMetrics.length;
        const avgCpu = relevantMetrics.reduce((sum, m) => sum + this.calculateCpuUsagePercent(m.cpuUsage), 0) / relevantMetrics.length;
        const avgEventLoop = relevantMetrics.reduce((sum, m) => sum + m.eventLoopDelay, 0) / relevantMetrics.length;

        return {
            period: `${periodMs / 1000} seconds`,
            averageMemoryMB: (avgMemory / 1024 / 1024).toFixed(2),
            averageCpuPercent: avgCpu.toFixed(2),
            averageEventLoopDelayMs: avgEventLoop.toFixed(2),
            sampleCount: relevantMetrics.length
        };
    }

    /**
     * Get memory leak indicators
     */
    detectMemoryLeak(): { suspected: boolean; reason?: string } {
        if (this.metrics.length < 10) {
            return { suspected: false };
        }

        // Check if memory has been consistently increasing
        const recentMetrics = this.metrics.slice(-10);
        let increasingCount = 0;

        for (let i = 1; i < recentMetrics.length; i++) {
            if (recentMetrics[i].memoryUsage.heapUsed > recentMetrics[i - 1].memoryUsage.heapUsed) {
                increasingCount++;
            }
        }

        if (increasingCount >= 8) {
            const startMemory = recentMetrics[0].memoryUsage.heapUsed / 1024 / 1024;
            const endMemory = recentMetrics[recentMetrics.length - 1].memoryUsage.heapUsed / 1024 / 1024;
            const increase = endMemory - startMemory;
            const percentIncrease = (increase / startMemory) * 100;

            return {
                suspected: true,
                reason: `Memory increased by ${increase.toFixed(2)}MB (${percentIncrease.toFixed(2)}%) over last ${recentMetrics.length} samples`
            };
        }

        return { suspected: false };
    }

    /**
     * Set custom thresholds
     */
    setThresholds(thresholds: Partial<PerformanceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...thresholds };
        this.logger.info('Updated performance thresholds', this.thresholds);
    }

    /**
     * Generate performance report
     */
    generateReport(): string {
        const current = this.getCurrentMetrics();
        const average = this.getAverageMetrics();
        const memoryLeak = this.detectMemoryLeak();

        let report = '=== Performance Report ===\n\n';
        
        if (current) {
            report += 'Current Metrics:\n';
            report += JSON.stringify(current, null, 2) + '\n\n';
        }

        if (average) {
            report += 'Average Metrics:\n';
            report += JSON.stringify(average, null, 2) + '\n\n';
        }

        report += 'Memory Leak Detection:\n';
        report += JSON.stringify(memoryLeak, null, 2) + '\n\n';

        report += 'Thresholds:\n';
        report += JSON.stringify(this.thresholds, null, 2) + '\n';

        return report;
    }
}