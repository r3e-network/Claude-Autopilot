import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ParallelAgentOrchestrator, AgentConfig } from '../agents/ParallelAgentOrchestrator';
import { debugLog } from '../utils/logging';

const fsAsync = fs.promises;

export interface MonitoringStats {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    errorAgents: number;
    totalRestarts: number;
    totalWorkCycles: number;
    averageContextUsage: number;
    uptime: number;
    startTime: Date;
}

export class AgentMonitor {
    private orchestrator: ParallelAgentOrchestrator;
    private panel: vscode.WebviewPanel | null = null;
    private updateInterval: NodeJS.Timeout | null = null;
    private startTime: Date = new Date();
    private workspacePath: string;
    private reportPath: string;

    constructor(orchestrator: ParallelAgentOrchestrator, workspacePath: string) {
        this.orchestrator = orchestrator;
        this.workspacePath = workspacePath;
        this.reportPath = path.join(workspacePath, 'agent_farm_reports');
    }

    async initialize(): Promise<void> {
        // Create reports directory
        await fsAsync.mkdir(this.reportPath, { recursive: true });
    }

    async showDashboard(): Promise<void> {
        if (this.panel) {
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'claudeAgentMonitor',
            'Claude Agent Monitor',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = null;
            this.stopMonitoring();
        });

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(async (message) => {
            try {
                switch (message.type) {
                    case 'sendCommand':
                        await this.orchestrator.sendCommandToAllAgents(message.command);
                        vscode.window.showInformationMessage(`Sent command to all agents: ${message.command}`);
                        break;
                    case 'attachToSession':
                        await this.orchestrator.attachToSession();
                        break;
                    case 'generateReport':
                        const reportPath = await this.generateHtmlReport();
                        vscode.window.showInformationMessage(`Report generated: ${path.basename(reportPath)}`);
                        break;
                    case 'refresh':
                        await this.updateDashboard();
                        break;
                    default:
                        debugLog(`Unknown message type: ${message.type}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
                debugLog(`Error handling webview message: ${error}`);
            }
        });

        // Start monitoring
        this.startMonitoring();
        
        // Initial update
        await this.updateDashboard();
    }

    private startMonitoring(): void {
        this.updateInterval = setInterval(async () => {
            await this.updateDashboard();
        }, 5000); // Update every 5 seconds
    }

    private stopMonitoring(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    private async updateDashboard(): Promise<void> {
        if (!this.panel) return;

        const agents = this.orchestrator.getAgentStatuses();
        const stats = this.calculateStats(agents);
        
        this.panel.webview.html = this.getDashboardHtml(agents, stats);
    }

    private calculateStats(agents: AgentConfig[]): MonitoringStats {
        const activeAgents = agents.filter(a => a.status === 'working').length;
        const idleAgents = agents.filter(a => a.status === 'idle').length;
        const errorAgents = agents.filter(a => a.status === 'error' || a.status === 'disabled').length;
        const totalRestarts = agents.reduce((sum, a) => sum + a.restartCount, 0);
        const totalWorkCycles = agents.reduce((sum, a) => sum + a.workCycles, 0);
        const averageContextUsage = agents.length > 0 
            ? agents.reduce((sum, a) => sum + a.contextUsage, 0) / agents.length 
            : 0;
        const uptime = Date.now() - this.startTime.getTime();

        return {
            totalAgents: agents.length,
            activeAgents,
            idleAgents,
            errorAgents,
            totalRestarts,
            totalWorkCycles,
            averageContextUsage,
            uptime,
            startTime: this.startTime
        };
    }

    private getDashboardHtml(agents: AgentConfig[], stats: MonitoringStats): string {
        const uptimeFormatted = this.formatDuration(stats.uptime);
        
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Agent Monitor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid var(--vscode-panel-border);
        }
        
        h1 {
            margin: 0;
            font-size: 24px;
            color: var(--vscode-foreground);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
            text-align: center;
        }
        
        .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin: 5px 0;
        }
        
        .stat-label {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .agents-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        
        .agents-table th {
            background: var(--vscode-editor-background);
            color: var(--vscode-foreground);
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid var(--vscode-panel-border);
            font-weight: 600;
        }
        
        .agents-table td {
            padding: 10px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .agents-table tr:hover {
            background: var(--vscode-list-hoverBackground);
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-working { background: #28a745; color: white; }
        .status-idle { background: #17a2b8; color: white; }
        .status-ready { background: #6c757d; color: white; }
        .status-starting { background: #ffc107; color: #000; }
        .status-error { background: #dc3545; color: white; }
        .status-disabled { background: #343a40; color: white; }
        
        .context-bar {
            width: 100%;
            height: 20px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }
        
        .context-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        
        .context-low { background: #dc3545; }
        .context-medium { background: #ffc107; }
        .context-high { background: #28a745; }
        
        .context-text {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 11px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        }
        
        .heartbeat-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 5px;
        }
        
        .heartbeat-fresh { background: #28a745; }
        .heartbeat-stale { background: #ffc107; }
        .heartbeat-dead { background: #dc3545; }
        
        .actions {
            margin-top: 30px;
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
        }
        
        button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        .timestamp {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
        
        @media (max-width: 800px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 Claude Agent Farm Monitor</h1>
        <div class="timestamp">
            Started: ${stats.startTime.toLocaleTimeString()} | 
            Uptime: ${uptimeFormatted}
        </div>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">Total Agents</div>
            <div class="stat-value">${stats.totalAgents}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Active</div>
            <div class="stat-value" style="color: #28a745;">${stats.activeAgents}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Idle</div>
            <div class="stat-value" style="color: #17a2b8;">${stats.idleAgents}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Errors</div>
            <div class="stat-value" style="color: #dc3545;">${stats.errorAgents}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Work Cycles</div>
            <div class="stat-value">${stats.totalWorkCycles}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Restarts</div>
            <div class="stat-value">${stats.totalRestarts}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg Context</div>
            <div class="stat-value">${Math.round(stats.averageContextUsage)}%</div>
        </div>
    </div>
    
    <h2>Agent Status</h2>
    <table class="agents-table">
        <thead>
            <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Context</th>
                <th>Heartbeat</th>
                <th>Cycles</th>
                <th>Errors</th>
                <th>Restarts</th>
            </tr>
        </thead>
        <tbody>
            ${agents.map(agent => this.getAgentRow(agent)).join('')}
        </tbody>
    </table>
    
    <div class="actions">
        <button onclick="sendCommand('/clear')">Clear All Context</button>
        <button onclick="attachToSession()">View in Terminal</button>
        <button onclick="generateReport()">Generate Report</button>
        <button onclick="refresh()">Refresh</button>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function sendCommand(command) {
            vscode.postMessage({
                type: 'sendCommand',
                command: command
            });
        }
        
        function attachToSession() {
            vscode.postMessage({
                type: 'attachToSession'
            });
        }
        
        function generateReport() {
            vscode.postMessage({
                type: 'generateReport'
            });
        }
        
        function refresh() {
            vscode.postMessage({
                type: 'refresh'
            });
        }
    </script>
</body>
</html>`;
    }

    private getAgentRow(agent: AgentConfig): string {
        const heartbeatAge = Date.now() - agent.lastHeartbeat.getTime();
        const heartbeatClass = heartbeatAge < 30000 ? 'heartbeat-fresh' : 
                              heartbeatAge < 120000 ? 'heartbeat-stale' : 'heartbeat-dead';
        const heartbeatText = this.formatDuration(heartbeatAge);
        
        const contextClass = agent.contextUsage > 50 ? 'context-high' :
                           agent.contextUsage > 20 ? 'context-medium' : 'context-low';
        
        return `
            <tr>
                <td><strong>${agent.name}</strong></td>
                <td><span class="status-badge status-${agent.status}">${agent.status}</span></td>
                <td>
                    <div class="context-bar">
                        <div class="context-fill ${contextClass}" style="width: ${agent.contextUsage}%"></div>
                        <div class="context-text">${agent.contextUsage}%</div>
                    </div>
                </td>
                <td>
                    <span class="heartbeat-indicator ${heartbeatClass}"></span>
                    ${heartbeatText}
                </td>
                <td>${agent.workCycles}</td>
                <td>${agent.errors}</td>
                <td>${agent.restartCount}</td>
            </tr>
        `;
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    async generateHtmlReport(): Promise<string> {
        const agents = this.orchestrator.getAgentStatuses();
        const stats = this.calculateStats(agents);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportFile = path.join(this.reportPath, `agent_farm_report_${timestamp}.html`);
        
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Claude Agent Farm Report - ${new Date().toLocaleString()}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #e0e0e0;
            background-color: #1e1e1e;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        h1, h2 {
            color: #61dafb;
            border-bottom: 2px solid #444;
            padding-bottom: 10px;
        }
        
        .summary {
            background: #2d2d2d;
            border: 1px solid #444;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 15px;
        }
        
        .metric {
            text-align: center;
        }
        
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            color: #61dafb;
        }
        
        .metric-label {
            font-size: 14px;
            color: #999;
            text-transform: uppercase;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: #2d2d2d;
        }
        
        th {
            background: #1e1e1e;
            padding: 12px;
            text-align: left;
            color: #61dafb;
            font-weight: 600;
        }
        
        td {
            padding: 10px 12px;
            border-bottom: 1px solid #444;
        }
        
        tr:hover {
            background: #333;
        }
        
        .status-working { color: #4caf50; }
        .status-idle { color: #2196f3; }
        .status-error { color: #f44336; }
        .status-disabled { color: #666; }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #444;
            text-align: center;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>Claude Agent Farm Report</h1>
    
    <div class="summary">
        <h2>Run Summary</h2>
        <div class="summary-grid">
            <div class="metric">
                <div class="metric-value">${stats.totalAgents}</div>
                <div class="metric-label">Total Agents</div>
            </div>
            <div class="metric">
                <div class="metric-value">${stats.totalWorkCycles}</div>
                <div class="metric-label">Work Cycles</div>
            </div>
            <div class="metric">
                <div class="metric-value">${this.formatDuration(stats.uptime)}</div>
                <div class="metric-label">Run Duration</div>
            </div>
            <div class="metric">
                <div class="metric-value">${stats.totalRestarts}</div>
                <div class="metric-label">Total Restarts</div>
            </div>
        </div>
    </div>
    
    <h2>Agent Details</h2>
    <table>
        <thead>
            <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Work Cycles</th>
                <th>Context Usage</th>
                <th>Errors</th>
                <th>Restarts</th>
                <th>Last Activity</th>
            </tr>
        </thead>
        <tbody>
            ${agents.map(agent => `
                <tr>
                    <td>${agent.name}</td>
                    <td class="status-${agent.status}">${agent.status}</td>
                    <td>${agent.workCycles}</td>
                    <td>${agent.contextUsage}%</td>
                    <td>${agent.errors}</td>
                    <td>${agent.restartCount}</td>
                    <td>${new Date(agent.lastActivity).toLocaleTimeString()}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    
    <div class="footer">
        Generated on ${new Date().toLocaleString()} | Claude Agent Farm v1.0
    </div>
</body>
</html>`;
        
        await fsAsync.writeFile(reportFile, htmlContent);
        debugLog(`Generated report: ${reportFile}`);
        
        return reportFile;
    }

    dispose(): void {
        this.stopMonitoring();
        if (this.panel) {
            this.panel.dispose();
        }
    }
}