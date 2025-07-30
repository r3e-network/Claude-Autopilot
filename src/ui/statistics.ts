import * as vscode from 'vscode';
import { messageQueue } from '../core/state';
import { MessageItem } from '../core/types';

export interface QueueStatistics {
    totalMessages: number;
    pendingMessages: number;
    processingMessages: number;
    completedMessages: number;
    errorMessages: number;
    averageProcessingTime: number;
    successRate: number;
    messagesPerHour: number;
    peakHour: string;
    topScripts: { script: string; count: number }[];
    errorTypes: { type: string; count: number }[];
    timeDistribution: { hour: number; count: number }[];
}

export class StatisticsManager {
    private startTime: number = Date.now();
    private processedCount: number = 0;
    private lastHourCounts: Map<number, number> = new Map();

    constructor() {
        // Track messages processed per hour
        setInterval(() => {
            const currentHour = new Date().getHours();
            const currentCount = messageQueue.filter(m => 
                m.status === 'completed' && 
                m.timestamp && 
                new Date(m.timestamp).getHours() === currentHour
            ).length;
            this.lastHourCounts.set(currentHour, currentCount);
        }, 60000); // Update every minute
    }

    getStatistics(): QueueStatistics {
        const now = Date.now();
        const messages = [...messageQueue];
        
        // Basic counts
        const totalMessages = messages.length;
        const pendingMessages = messages.filter(m => m.status === 'waiting' || m.status === 'pending').length;
        const processingMessages = messages.filter(m => m.status === 'processing').length;
        const completedMessages = messages.filter(m => m.status === 'completed').length;
        const errorMessages = messages.filter(m => m.status === 'error').length;

        // Calculate average processing time
        const completedWithTime = messages.filter(m => 
            m.status === 'completed' && m.timestamp && m.completedAt
        );
        const totalProcessingTime = completedWithTime.reduce((sum, m) => {
            const startTime = new Date(m.timestamp).getTime();
            const endTime = new Date(m.completedAt!).getTime();
            return sum + (endTime - startTime);
        }, 0);
        const averageProcessingTime = completedWithTime.length > 0 
            ? totalProcessingTime / completedWithTime.length 
            : 0;

        // Success rate
        const processedTotal = completedMessages + errorMessages;
        const successRate = processedTotal > 0 
            ? (completedMessages / processedTotal) * 100 
            : 0;

        // Messages per hour
        const runningTime = (now - this.startTime) / (1000 * 60 * 60); // in hours
        const messagesPerHour = runningTime > 0 
            ? completedMessages / runningTime 
            : 0;

        // Time distribution
        const timeDistribution = this.getTimeDistribution(messages);
        
        // Peak hour
        const peakHour = this.getPeakHour(timeDistribution);

        // Top scripts
        const topScripts = this.getTopScripts(messages);

        // Error types
        const errorTypes = this.getErrorTypes(messages);

        return {
            totalMessages,
            pendingMessages,
            processingMessages,
            completedMessages,
            errorMessages,
            averageProcessingTime,
            successRate,
            messagesPerHour,
            peakHour,
            topScripts,
            errorTypes,
            timeDistribution
        };
    }

    private getTimeDistribution(messages: MessageItem[]): { hour: number; count: number }[] {
        const distribution = new Map<number, number>();
        
        messages.forEach(message => {
            if (message.timestamp) {
                const hour = new Date(message.timestamp).getHours();
                distribution.set(hour, (distribution.get(hour) || 0) + 1);
            }
        });

        // Convert to array and fill missing hours
        const result: { hour: number; count: number }[] = [];
        for (let hour = 0; hour < 24; hour++) {
            result.push({ hour, count: distribution.get(hour) || 0 });
        }
        
        return result;
    }

    private getPeakHour(distribution: { hour: number; count: number }[]): string {
        const peak = distribution.reduce((max, current) => 
            current.count > max.count ? current : max
        );
        
        const hour = peak.hour;
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        
        return `${displayHour}:00 ${period}`;
    }

    private getTopScripts(messages: MessageItem[]): { script: string; count: number }[] {
        const scriptCounts = new Map<string, number>();
        
        messages.forEach(message => {
            if (message.attachedScripts) {
                message.attachedScripts.forEach((script: string) => {
                    scriptCounts.set(script, (scriptCounts.get(script) || 0) + 1);
                });
            }
        });

        return Array.from(scriptCounts.entries())
            .map(([script, count]) => ({ script, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    private getErrorTypes(messages: MessageItem[]): { type: string; count: number }[] {
        const errorTypes = new Map<string, number>();
        const errorMessages = messages.filter(m => m.status === 'error');
        
        errorMessages.forEach(message => {
            if (message.error) {
                const errorType = this.categorizeError(message.error);
                errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
            }
        });

        return Array.from(errorTypes.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count);
    }

    private categorizeError(error: string): string {
        if (error.includes('timeout')) return 'Timeout';
        if (error.includes('permission')) return 'Permission';
        if (error.includes('network')) return 'Network';
        if (error.includes('memory')) return 'Memory';
        if (error.includes('syntax')) return 'Syntax';
        return 'Other';
    }

    formatStatistics(stats: QueueStatistics): string {
        const formatTime = (ms: number): string => {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
            return `${seconds}s`;
        };

        return `
📊 **Queue Statistics**

**Overview:**
• Total Messages: ${stats.totalMessages}
• Pending: ${stats.pendingMessages}
• Processing: ${stats.processingMessages}
• Completed: ${stats.completedMessages} ✅
• Errors: ${stats.errorMessages} ❌

**Performance:**
• Success Rate: ${stats.successRate.toFixed(1)}%
• Avg Processing Time: ${formatTime(stats.averageProcessingTime)}
• Messages/Hour: ${stats.messagesPerHour.toFixed(1)}
• Peak Hour: ${stats.peakHour}

**Top Scripts:**
${stats.topScripts.map((s, i) => `${i + 1}. ${s.script} (${s.count} uses)`).join('\n')}

**Error Distribution:**
${stats.errorTypes.map(e => `• ${e.type}: ${e.count}`).join('\n')}
`;
    }

    async showStatisticsWebview(context: vscode.ExtensionContext): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'queueStatistics',
            'Queue Statistics',
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        const stats = this.getStatistics();
        panel.webview.html = this.getStatisticsHtml(stats);

        // Update every 5 seconds
        const updateInterval = setInterval(() => {
            if (panel.visible) {
                const newStats = this.getStatistics();
                panel.webview.postMessage({
                    command: 'updateStats',
                    stats: newStats
                });
            }
        }, 5000);

        panel.onDidDispose(() => {
            clearInterval(updateInterval);
        });
    }

    private getStatisticsHtml(stats: QueueStatistics): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Queue Statistics</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            margin: 10px 0;
        }
        .stat-label {
            color: var(--vscode-descriptionForeground);
            font-size: 0.9em;
        }
        .chart-container {
            margin: 30px 0;
            padding: 20px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
        }
        h2 {
            margin-top: 30px;
            margin-bottom: 20px;
        }
        .success { color: var(--vscode-charts-green); }
        .error { color: var(--vscode-charts-red); }
        .pending { color: var(--vscode-charts-yellow); }
        .processing { color: var(--vscode-charts-blue); }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <div class="container">
        <h1>📊 Queue Statistics</h1>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Total Messages</div>
                <div class="stat-value">${stats.totalMessages}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Pending</div>
                <div class="stat-value pending">${stats.pendingMessages}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Processing</div>
                <div class="stat-value processing">${stats.processingMessages}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Completed</div>
                <div class="stat-value success">${stats.completedMessages}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Errors</div>
                <div class="stat-value error">${stats.errorMessages}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Success Rate</div>
                <div class="stat-value">${stats.successRate.toFixed(1)}%</div>
            </div>
        </div>
        
        <div class="chart-container">
            <h2>Messages by Hour</h2>
            <canvas id="timeChart"></canvas>
        </div>
        
        <div class="chart-container">
            <h2>Status Distribution</h2>
            <canvas id="statusChart"></canvas>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        const stats = ${JSON.stringify(stats)};
        
        // Time distribution chart
        const timeCtx = document.getElementById('timeChart').getContext('2d');
        new Chart(timeCtx, {
            type: 'bar',
            data: {
                labels: stats.timeDistribution.map(d => d.hour + ':00'),
                datasets: [{
                    label: 'Messages',
                    data: stats.timeDistribution.map(d => d.count),
                    backgroundColor: 'rgba(74, 158, 255, 0.5)',
                    borderColor: 'rgba(74, 158, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        // Status distribution chart
        const statusCtx = document.getElementById('statusChart').getContext('2d');
        new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Pending', 'Processing', 'Completed', 'Errors'],
                datasets: [{
                    data: [
                        stats.pendingMessages,
                        stats.processingMessages,
                        stats.completedMessages,
                        stats.errorMessages
                    ],
                    backgroundColor: [
                        'rgba(255, 206, 86, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(255, 99, 132, 0.5)'
                    ],
                    borderColor: [
                        'rgba(255, 206, 86, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true
            }
        });
        
        // Listen for updates
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateStats') {
                // Update stats and refresh charts
                location.reload();
            }
        });
    </script>
</body>
</html>`;
    }
}