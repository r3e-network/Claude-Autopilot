import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { EventEmitter } from 'eventemitter3';
import { Config } from '../core/config';
import { Logger } from '../utils/logger';
import { Message } from '../queue/messageQueue';
import { ParallelAgentManager } from '../agents/parallelAgentManager';
import chalk from 'chalk';

export class UIManager extends EventEmitter {
    private config: Config;
    private logger: Logger;
    private screen: blessed.Widgets.Screen | null = null;
    private grid: any;
    private widgets: {
        claudeOutput?: blessed.Widgets.Log;
        messageInput?: blessed.Widgets.Textarea;
        queue?: blessed.Widgets.ListTable;
        status?: blessed.Widgets.Box;
        controls?: blessed.Widgets.Box;
        terminal?: blessed.Widgets.Log;
    } = {};
    private autoScroll: boolean = true;

    constructor(config: Config, logger: Logger) {
        super();
        this.config = config;
        this.logger = logger;
        this.autoScroll = config.get('ui', 'autoScroll');
    }

    async initialize(): Promise<void> {
        // Create screen
        this.screen = blessed.screen({
            smartCSR: true,
            title: 'Claude Autopilot Terminal',
            fullUnicode: true,
            dockBorders: true,
            autoPadding: true
        });

        // Create grid layout
        this.grid = new contrib.grid({
            rows: 12,
            cols: 12,
            screen: this.screen
        });

        // Create widgets
        this.createWidgets();
        this.setupEventHandlers();

        // Initial render
        this.screen.render();
    }

    private createWidgets(): void {
        // Claude Output (top left - 8x8)
        this.widgets.claudeOutput = this.grid.set(0, 0, 6, 8, blessed.log, {
            label: '🤖 Claude Output',
            border: { type: 'line' },
            style: {
                fg: 'cyan',
                border: { fg: 'cyan' }
            },
            scrollable: true,
            alwaysScroll: true,
            mouse: true,
            keys: true,
            vi: true,
            scrollbar: {
                style: {
                    bg: 'cyan'
                }
            }
        });

        // Message Queue (top right - 8x4)
        this.widgets.queue = this.grid.set(0, 8, 6, 4, blessed.listtable, {
            label: '📋 Message Queue',
            border: { type: 'line' },
            style: {
                fg: 'green',
                border: { fg: 'green' },
                header: { fg: 'bright-green' }
            },
            align: 'left',
            mouse: true,
            keys: true,
            vi: true,
            headers: ['#', 'Status', 'Message']
        });

        // Terminal Output (middle - 3x12)
        this.widgets.terminal = this.grid.set(6, 0, 3, 12, blessed.log, {
            label: '📟 Terminal Output',
            border: { type: 'line' },
            style: {
                fg: 'white',
                border: { fg: 'white' }
            },
            scrollable: true,
            mouse: true,
            keys: true,
            vi: true
        });

        // Message Input (bottom left - 2x8)
        this.widgets.messageInput = this.grid.set(9, 0, 2, 8, blessed.textarea, {
            label: '✏️  Message Input (Ctrl+Enter to send)',
            border: { type: 'line' },
            style: {
                fg: 'yellow',
                border: { fg: 'yellow' }
            },
            mouse: true,
            keys: true,
            inputOnFocus: true
        });

        // Control Buttons (bottom right - 2x4)
        this.widgets.controls = this.grid.set(9, 8, 2, 4, blessed.box, {
            label: '🎮 Controls',
            border: { type: 'line' },
            style: {
                fg: 'magenta',
                border: { fg: 'magenta' }
            },
            content: this.getControlsContent()
        });

        // Status Bar (very bottom - 1x12)
        this.widgets.status = this.grid.set(11, 0, 1, 12, blessed.box, {
            style: {
                fg: 'white',
                bg: 'blue'
            },
            content: this.getStatusContent()
        });
    }

    private setupEventHandlers(): void {
        if (!this.screen) return;

        // Global key bindings
        this.screen.key(['q', 'C-c'], () => {
            this.emit('quit');
        });

        this.screen.key(['C-s'], () => {
            this.emit('startProcessing');
        });

        this.screen.key(['C-x'], () => {
            this.emit('stopProcessing');
        });

        this.screen.key(['C-l'], () => {
            this.clearClaudeOutput();
        });

        this.screen.key(['C-a'], () => {
            this.toggleAutoScroll();
        });

        this.screen.key(['escape'], () => {
            this.emit('interrupt');
        });

        // Message input handlers
        if (this.widgets.messageInput) {
            this.widgets.messageInput.key(['C-enter'], () => {
                const text = this.widgets.messageInput!.getValue().trim();
                if (text) {
                    this.emit('addMessage', text);
                    this.widgets.messageInput!.clearValue();
                    this.widgets.messageInput!.focus();
                    this.screen!.render();
                }
            });

            this.widgets.messageInput.key(['escape'], () => {
                this.widgets.messageInput!.clearValue();
                this.screen!.render();
            });
        }

        // Queue navigation
        if (this.widgets.queue) {
            this.widgets.queue.key(['delete', 'd'], () => {
                const selected = this.widgets.queue!.selected;
                if (selected > 0) {
                    this.emit('removeMessage', selected - 1);
                }
            });

            this.widgets.queue.key(['c'], () => {
                this.emit('clearQueue');
            });
        }

        // Focus management
        this.screen.key(['tab'], () => {
            this.focusNext();
        });

        this.screen.key(['S-tab'], () => {
            this.focusPrevious();
        });
    }

    appendClaudeOutput(text: string): void {
        if (this.widgets.claudeOutput) {
            this.widgets.claudeOutput.log(text);
            
            if (this.autoScroll) {
                this.widgets.claudeOutput.setScrollPerc(100);
            }
            
            this.screen?.render();
        }
    }

    appendTerminalOutput(text: string): void {
        if (this.widgets.terminal) {
            this.widgets.terminal.log(text);
            this.screen?.render();
        }
    }

    updateQueue(messages: Message[]): void {
        if (!this.widgets.queue) return;

        const data = messages.map((msg, index) => {
            const status = this.getStatusIcon(msg.status);
            const text = msg.text.substring(0, 30) + (msg.text.length > 30 ? '...' : '');
            return [String(index + 1), status, text];
        });

        this.widgets.queue.setData({
            headers: ['#', 'Status', 'Message'],
            data: data
        });

        this.screen?.render();
    }

    updateStatus(status: string): void {
        if (this.widgets.status) {
            this.widgets.status.setContent(this.getStatusContent(status));
            this.screen?.render();
        }
    }

    showError(message: string): void {
        const errorBox = blessed.message({
            parent: this.screen!,
            border: 'line',
            height: 'shrink',
            width: 'half',
            top: 'center',
            left: 'center',
            label: '❌ Error',
            style: {
                fg: 'red',
                border: { fg: 'red' }
            }
        });

        errorBox.error(message, () => {
            this.screen?.render();
        });
    }

    showInfo(message: string): void {
        const infoBox = blessed.message({
            parent: this.screen!,
            border: 'line',
            height: 'shrink',
            width: 'half',
            top: 'center',
            left: 'center',
            label: 'ℹ️  Info',
            style: {
                fg: 'blue',
                border: { fg: 'blue' }
            }
        });

        infoBox.display(message, 3, () => {
            this.screen?.render();
        });
    }

    async showAgentDashboard(agentManager: ParallelAgentManager): Promise<void> {
        // Create a new screen for agent monitoring
        const dashScreen = blessed.screen({
            smartCSR: true,
            title: 'Claude Agent Monitor'
        });

        const dashGrid = new contrib.grid({
            rows: 12,
            cols: 12,
            screen: dashScreen
        });

        // Agent status table
        const agentTable = dashGrid.set(0, 0, 6, 6, contrib.table, {
            label: 'Agent Status',
            columnSpacing: 3,
            columnWidth: [10, 15, 10, 10]
        });

        // Performance chart
        const perfChart = dashGrid.set(0, 6, 6, 6, contrib.line, {
            label: 'Performance Metrics',
            showLegend: true
        });

        // Activity log
        const activityLog = dashGrid.set(6, 0, 6, 12, blessed.log, {
            label: 'Activity Log',
            scrollable: true
        });

        // Update function
        const updateDashboard = () => {
            const agents = agentManager.getAgentStatuses();
            
            // Update agent table
            const tableData = {
                headers: ['Agent ID', 'Status', 'Messages', 'CPU %'],
                data: agents.map(agent => [
                    agent.id,
                    agent.status,
                    String(agent.messagesProcessed),
                    String(agent.cpuUsage || 0)
                ])
            };
            agentTable.setData(tableData);

            // Update performance chart
            const perfData = {
                x: agents.map((_, i) => String(i)),
                y: agents.map(a => a.messagesProcessed)
            };
            perfChart.setData([{
                title: 'Messages Processed',
                x: perfData.x,
                y: perfData.y,
                style: { line: 'cyan' }
            }]);

            dashScreen.render();
        };

        // Initial update
        updateDashboard();

        // Set up refresh interval
        const refreshInterval = setInterval(updateDashboard, 1000);

        // Exit handler
        dashScreen.key(['q', 'escape'], () => {
            clearInterval(refreshInterval);
            dashScreen.destroy();
            this.screen?.render();
        });

        dashScreen.render();
    }

    async run(): Promise<void> {
        return new Promise((resolve) => {
            this.once('quit', resolve);
        });
    }

    destroy(): void {
        this.screen?.destroy();
    }

    private clearClaudeOutput(): void {
        if (this.widgets.claudeOutput) {
            this.widgets.claudeOutput.setContent('');
            this.screen?.render();
        }
    }

    private toggleAutoScroll(): void {
        this.autoScroll = !this.autoScroll;
        this.config.set('ui', 'autoScroll', this.autoScroll);
        this.showInfo(`Auto-scroll ${this.autoScroll ? 'enabled' : 'disabled'}`);
    }

    private focusNext(): void {
        const focusableWidgets = [
            this.widgets.messageInput,
            this.widgets.queue,
            this.widgets.claudeOutput
        ].filter(w => w);

        const currentIndex = focusableWidgets.findIndex(w => w === this.screen?.focused);
        const nextIndex = (currentIndex + 1) % focusableWidgets.length;
        
        focusableWidgets[nextIndex]?.focus();
        this.screen?.render();
    }

    private focusPrevious(): void {
        const focusableWidgets = [
            this.widgets.messageInput,
            this.widgets.queue,
            this.widgets.claudeOutput
        ].filter(w => w);

        const currentIndex = focusableWidgets.findIndex(w => w === this.screen?.focused);
        const prevIndex = currentIndex <= 0 ? focusableWidgets.length - 1 : currentIndex - 1;
        
        focusableWidgets[prevIndex]?.focus();
        this.screen?.render();
    }

    private getStatusIcon(status: string): string {
        const icons: { [key: string]: string } = {
            pending: '⏳',
            processing: '🔄',
            completed: '✅',
            error: '❌',
            cancelled: '🚫'
        };
        return icons[status] || '❓';
    }

    private getControlsContent(): string {
        return [
            'Ctrl+S - Start',
            'Ctrl+X - Stop',
            'Ctrl+L - Clear',
            'Ctrl+A - Auto-scroll',
            'Tab - Next widget',
            'Q - Quit'
        ].join('\\n');
    }

    private getStatusContent(customStatus?: string): string {
        const timestamp = new Date().toLocaleTimeString();
        const status = customStatus || 'Ready';
        const autoScrollStatus = this.autoScroll ? 'ON' : 'OFF';
        
        return ` ${timestamp} | Status: ${status} | Auto-scroll: ${autoScrollStatus} | Press Q to quit `;
    }
}