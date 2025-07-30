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
    private screen: any = null;
    private grid: any;
    private widgets: {
        claudeOutput?: any;
        messageInput?: any;
        queue?: any;
        status?: any;
        controls?: any;
        terminal?: any;
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
            title: 'AutoClaude Terminal',
            fullUnicode: true,
            dockBorders: true,
            autoPadding: true
        });

        // Skip grid layout for now to avoid blessed issues
        this.grid = null;

        // Create widgets
        this.createWidgets();
        this.setupEventHandlers();

        // Initial render
        this.screen.render();
    }

    private createWidgets(): void {
        if (!this.screen) return;

        // Claude Output (main area)
        this.widgets.claudeOutput = blessed.log({
            label: '🤖 Claude Output',
            parent: this.screen,
            top: 0,
            left: 0,
            width: '70%',
            height: '60%',
            border: { type: 'line' },
            style: {
                fg: 'cyan',
                border: { fg: 'cyan' }
            },
            scrollable: true,
            alwaysScroll: true,
            mouse: true,
            keys: true,
            vi: true
        });

        // Message Queue (right side)
        this.widgets.queue = blessed.list({
            label: '📋 Message Queue',
            parent: this.screen,
            top: 0,
            left: '70%',
            width: '30%',
            height: '60%',
            border: { type: 'line' },
            style: {
                fg: 'green',
                border: { fg: 'green' }
            },
            mouse: true,
            keys: true,
            vi: true,
            items: ['Ready - Waiting for messages...']
        });

        // Terminal Output (middle)
        this.widgets.terminal = blessed.log({
            label: '📟 Terminal Output',
            parent: this.screen,
            top: '60%',
            left: 0,
            width: '100%',
            height: '25%',
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

        // Message Input (bottom left)
        this.widgets.messageInput = blessed.textarea({
            label: '✏️  Message Input (Ctrl+Enter to send)',
            parent: this.screen,
            top: '85%',
            left: 0,
            width: '70%',
            height: '10%',
            border: { type: 'line' },
            style: {
                fg: 'yellow',
                border: { fg: 'yellow' }
            },
            mouse: true,
            keys: true,
            inputOnFocus: true
        });

        // Control Buttons (bottom right)
        this.widgets.controls = blessed.box({
            label: '🎮 Controls',
            parent: this.screen,
            top: '85%',
            left: '70%',
            width: '30%',
            height: '10%',
            border: { type: 'line' },
            style: {
                fg: 'magenta',
                border: { fg: 'magenta' }
            },
            content: this.getControlsContent()
        });

        // Status Bar (very bottom)
        this.widgets.status = blessed.box({
            parent: this.screen,
            top: '95%',
            left: 0,
            width: '100%',
            height: '5%',
            style: {
                fg: 'white',
                bg: 'blue'
            },
            content: this.getStatusContent()
        });

        // Initialize content for log widgets to prevent rendering errors
        if (this.widgets.claudeOutput) {
            this.widgets.claudeOutput.log('AutoClaude Terminal initialized');
        }
        if (this.widgets.terminal) {
            this.widgets.terminal.log('Terminal output ready');
        }
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

        // Global fallback for Ctrl+Enter - send message from input
        this.screen.key(['C-m'], () => {
            if (this.widgets.messageInput) {
                const text = this.widgets.messageInput.getValue().trim();
                if (this.widgets.terminal) {
                    this.widgets.terminal.log('Global Ctrl+M pressed, text: ' + text);
                }
                if (text) {
                    this.emit('addMessage', text);
                    this.widgets.messageInput.clearValue();
                    this.widgets.messageInput.focus();
                    this.screen!.render();
                }
            }
        });

        // Message input handlers
        if (this.widgets.messageInput) {
            // Send message with Ctrl+Enter
            this.widgets.messageInput.key(['C-m'], () => {
                const text = this.widgets.messageInput!.getValue().trim();
                if (this.widgets.terminal) {
                    this.widgets.terminal.log('Ctrl+M pressed, text: ' + text);
                }
                if (text) {
                    this.emit('addMessage', text);
                    this.widgets.messageInput!.clearValue();
                    this.widgets.messageInput!.focus();
                    this.screen!.render();
                }
            });

            // Alternative: regular Enter also sends message
            this.widgets.messageInput.key(['enter'], () => {
                const text = this.widgets.messageInput!.getValue().trim();
                if (this.widgets.terminal) {
                    this.widgets.terminal.log('Enter pressed, text: ' + text);
                }
                if (text) {
                    this.emit('addMessage', text);
                    this.widgets.messageInput!.clearValue();
                    this.widgets.messageInput!.focus();
                    this.screen!.render();
                }
            });

            // Clear input with Escape
            this.widgets.messageInput.key(['escape'], () => {
                this.widgets.messageInput!.clearValue();
                this.screen!.render();
            });

            // Set focus to message input on startup
            this.widgets.messageInput.focus();
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
            title: 'AutoClaude Agent Monitor'
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