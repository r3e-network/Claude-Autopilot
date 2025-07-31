import * as vscode from 'vscode';

/**
 * Configuration adapter for the recovery manager
 */
export class RecoveryConfig {
    get(key: string, defaultValue?: any): any {
        const config = vscode.workspace.getConfiguration('autoclaude');
        
        // Map terminal config keys to VS Code settings
        switch (key) {
            case 'session':
                return {
                    skipPermissions: config.get('session.skipPermissions', true),
                    autoStart: config.get('session.autoStart', false)
                };
            case 'paths':
                return {
                    dataDir: '',
                    logsDir: ''
                };
            default:
                return defaultValue;
        }
    }
    
    set(key: string, value: any): void {
        // Not implemented for VS Code extension
    }
}

/**
 * Logger adapter for the recovery manager
 */
export class RecoveryLogger {
    info(message: string, ...args: any[]): void {
        console.log(`[Recovery] ${message}`, ...args);
    }
    
    warn(message: string, ...args: any[]): void {
        console.warn(`[Recovery] ${message}`, ...args);
    }
    
    error(message: string, ...args: any[]): void {
        console.error(`[Recovery] ${message}`, ...args);
    }
    
    debug(message: string, ...args: any[]): void {
        console.log(`[Recovery Debug] ${message}`, ...args);
    }
}