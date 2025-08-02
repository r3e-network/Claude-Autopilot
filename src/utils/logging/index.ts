import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { claudePanel, debugMode, setDebugMode as coreSetDebugMode } from '../../core/state';

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4
}

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: Record<string, any>;
    source?: string;
}

class Logger {
    private static instance: Logger;
    private logBuffer: LogEntry[] = [];
    private readonly MAX_BUFFER_SIZE = 1000;
    private logLevel: LogLevel = LogLevel.INFO;
    private logToFile: boolean = false;
    private logFilePath?: string;

    private constructor() {
        this.initializeLogFile();
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private initializeLogFile(): void {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const logDir = path.join(workspaceFolder.uri.fsPath, '.autoclaude', 'logs');
                if (!fs.existsSync(logDir)) {
                    fs.mkdirSync(logDir, { recursive: true });
                }
                this.logFilePath = path.join(logDir, `claude-autopilot-${new Date().toISOString().split('T')[0]}.log`);
                this.logToFile = true;
            }
        } catch (error) {
            console.error('Failed to initialize log file:', error);
            this.logToFile = false;
        }
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        return level <= this.logLevel;
    }

    private formatLogEntry(entry: LogEntry): string {
        const levelNames = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
        const levelName = levelNames[entry.level] || 'UNKNOWN';
        const contextStr = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : '';
        const sourceStr = entry.source ? ` | Source: ${entry.source}` : '';
        return `[${entry.timestamp}] [${levelName}]${sourceStr}: ${entry.message}${contextStr}`;
    }

    private addToBuffer(entry: LogEntry): void {
        this.logBuffer.push(entry);
        if (this.logBuffer.length > this.MAX_BUFFER_SIZE) {
            this.logBuffer = this.logBuffer.slice(-this.MAX_BUFFER_SIZE);
        }
    }

    private writeToFile(entry: LogEntry): void {
        if (this.logToFile && this.logFilePath) {
            try {
                const logLine = this.formatLogEntry(entry) + '\n';
                fs.appendFileSync(this.logFilePath, logLine);
            } catch (error) {
                console.error('Failed to write to log file:', error);
                this.logToFile = false;
            }
        }
    }

    log(level: LogLevel, message: string, context?: Record<string, any>, source?: string): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            context,
            source
        };

        this.addToBuffer(entry);
        this.writeToFile(entry);

        // Console output
        const formattedMessage = this.formatLogEntry(entry);
        console.log(formattedMessage);

        // Webview output for debug mode
        if (debugMode) {
            const webviewMessage = formatTerminalOutput(message, this.getLogTypeForWebview(level));
            sendToWebviewTerminal(webviewMessage + '\n');
        }
    }

    private getLogTypeForWebview(level: LogLevel): 'claude' | 'debug' | 'error' | 'info' | 'success' {
        switch (level) {
            case LogLevel.ERROR: return 'error';
            case LogLevel.WARN: return 'info';
            case LogLevel.INFO: return 'info';
            case LogLevel.DEBUG: return 'debug';
            case LogLevel.TRACE: return 'debug';
            default: return 'debug';
        }
    }

    error(message: string, context?: Record<string, any>, source?: string): void {
        this.log(LogLevel.ERROR, message, context, source);
    }

    warn(message: string, context?: Record<string, any>, source?: string): void {
        this.log(LogLevel.WARN, message, context, source);
    }

    info(message: string, context?: Record<string, any>, source?: string): void {
        this.log(LogLevel.INFO, message, context, source);
    }

    debug(message: string, context?: Record<string, any>, source?: string): void {
        this.log(LogLevel.DEBUG, message, context, source);
    }

    trace(message: string, context?: Record<string, any>, source?: string): void {
        this.log(LogLevel.TRACE, message, context, source);
    }

    getLogBuffer(): LogEntry[] {
        return [...this.logBuffer];
    }

    clearLogBuffer(): void {
        this.logBuffer = [];
    }

    exportLogs(): string {
        return this.logBuffer.map(entry => this.formatLogEntry(entry)).join('\n');
    }
}

const logger = Logger.getInstance();

export function debugLog(message: string, context?: Record<string, any>): void {
    logger.debug(message, context, 'debugLog');
}

export function errorLog(message: string, context?: Record<string, any>): void {
    logger.error(message, context, 'errorLog');
}

export function infoLog(message: string, context?: Record<string, any>): void {
    logger.info(message, context, 'infoLog');
}

export function warnLog(message: string, context?: Record<string, any>): void {
    logger.warn(message, context, 'warnLog');
}

export function setLogLevel(level: LogLevel): void {
    logger.setLogLevel(level);
}

export function getLogBuffer(): LogEntry[] {
    return logger.getLogBuffer();
}

export function exportLogs(): string {
    return logger.exportLogs();
}

export { LogEntry };

export function formatTerminalOutput(text: string, type: 'claude' | 'debug' | 'error' | 'info' | 'success'): string {
    const now = new Date();
    const timestamp = `${now.toLocaleTimeString()}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    
    switch (type) {
        case 'claude':
            return `\n\u001b[36m🤖 [CLAUDE ${timestamp}]\u001b[0m\n\u001b[37m${text}\u001b[0m\n\u001b[36m>>> [END CLAUDE OUTPUT]\u001b[0m\n`;
        case 'debug':
            return `\u001b[35m[DEBUG ${timestamp}]\u001b[0m \u001b[90m${text}\u001b[0m`;
        case 'error':
            return `\u001b[31m❌ [ERROR ${timestamp}]\u001b[0m \u001b[91m${text}\u001b[0m`;
        case 'info':
            return `\u001b[34mℹ️  [INFO ${timestamp}]\u001b[0m \u001b[94m${text}\u001b[0m`;
        case 'success':
            return `\u001b[32m✅ [SUCCESS ${timestamp}]\u001b[0m \u001b[92m${text}\u001b[0m`;
        default:
            return `[${timestamp}] ${text}`;
    }
}

export function sendToWebviewTerminal(output: string): void {
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'terminalOutput',
                output: output
            });
        } catch (error) {
            debugLog(`❌ Failed to send to webview terminal: ${error}`);
        }
    }
}

export function getWorkspacePath(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath || 'global';
}

export function getHistoryStorageKey(): string {
    return `claudeautopilot_history_${getWorkspacePath().replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export function getPendingQueueStorageKey(): string {
    return `claudeautopilot_pending_${getWorkspacePath().replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export function setDebugMode(enabled: boolean): void {
    coreSetDebugMode(enabled);
}

export function getDebugMode(): boolean {
    return debugMode;
}