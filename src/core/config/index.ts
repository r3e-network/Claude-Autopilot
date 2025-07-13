import * as vscode from 'vscode';
import { debugLog } from '../../utils/logging';

export interface ClaudeLoopConfig {
    // Development settings
    developmentMode: boolean;
    
    // Queue management settings
    queue: {
        maxSize: number;
        maxMessageSize: number;
        maxOutputSize: number;
        maxErrorSize: number;
        cleanupThreshold: number;
        retentionHours: number;
        autoMaintenance: boolean;
    };
    
    // Session settings
    session: {
        autoStart: boolean;
        skipPermissions: boolean;
        healthCheckInterval: number;
        outputThrottleMs: number;
        autoClearOutputMs: number;
    };
    
    // Sleep prevention settings
    sleepPrevention: {
        enabled: boolean;
        method: 'caffeinate' | 'powershell' | 'systemd-inhibit' | 'auto';
    };
    
    // History settings
    history: {
        maxRuns: number;
        autoSave: boolean;
        persistPendingQueue: boolean;
    };
    
    // Debug and logging
    logging: {
        enabled: boolean;
        level: 'error' | 'warn' | 'info' | 'debug';
        outputToConsole: boolean;
    };
}

export const DEFAULT_CONFIG: ClaudeLoopConfig = {
    developmentMode: false,
    
    queue: {
        maxSize: 1000,
        maxMessageSize: 50000,
        maxOutputSize: 100000,
        maxErrorSize: 10000,
        cleanupThreshold: 500,
        retentionHours: 24,
        autoMaintenance: true
    },
    
    session: {
        autoStart: false,
        skipPermissions: true,
        healthCheckInterval: 30000,
        outputThrottleMs: 1000,
        autoClearOutputMs: 30000
    },
    
    sleepPrevention: {
        enabled: true,
        method: 'auto'
    },
    
    history: {
        maxRuns: 20,
        autoSave: true,
        persistPendingQueue: true
    },
    
    logging: {
        enabled: false,
        level: 'info',
        outputToConsole: false
    }
};

export interface ConfigValidationError {
    path: string;
    value: any;
    expected: string;
    message: string;
}

export function validateConfig(config: Partial<ClaudeLoopConfig>): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];
    
    // Helper function to add validation errors
    const addError = (path: string, value: any, expected: string, message: string) => {
        errors.push({ path, value, expected, message });
    };
    
    // Validate development mode
    if (config.developmentMode !== undefined && typeof config.developmentMode !== 'boolean') {
        addError('developmentMode', config.developmentMode, 'boolean', 'Development mode must be true or false');
    }
    
    
    // Validate queue settings
    if (config.queue) {
        const q = config.queue;
        
        if (q.maxSize !== undefined) {
            if (typeof q.maxSize !== 'number' || q.maxSize < 10 || q.maxSize > 10000) {
                addError('queue.maxSize', q.maxSize, 'number (10-10000)', 'Must be a number between 10 and 10000');
            }
        }
        
        if (q.maxMessageSize !== undefined) {
            if (typeof q.maxMessageSize !== 'number' || q.maxMessageSize < 1000 || q.maxMessageSize > 1000000) {
                addError('queue.maxMessageSize', q.maxMessageSize, 'number (1000-1000000)', 'Must be a number between 1KB and 1MB');
            }
        }
        
        if (q.retentionHours !== undefined) {
            if (typeof q.retentionHours !== 'number' || q.retentionHours < 1 || q.retentionHours > 168) {
                addError('queue.retentionHours', q.retentionHours, 'number (1-168)', 'Must be a number between 1 and 168 hours (1 week)');
            }
        }
    }
    
    // Validate session settings
    if (config.session) {
        const s = config.session;
        
        if (s.healthCheckInterval !== undefined) {
            if (typeof s.healthCheckInterval !== 'number' || s.healthCheckInterval < 5000 || s.healthCheckInterval > 300000) {
                addError('session.healthCheckInterval', s.healthCheckInterval, 'number (5000-300000)', 'Must be a number between 5s and 5min');
            }
        }
    }
    
    // Validate sleep prevention method
    if (config.sleepPrevention?.method !== undefined) {
        const validMethods = ['caffeinate', 'powershell', 'systemd-inhibit', 'auto'];
        if (!validMethods.includes(config.sleepPrevention.method)) {
            addError('sleepPrevention.method', config.sleepPrevention.method, validMethods.join(' | '), 'Must be one of the supported methods');
        }
    }
    
    // Validate logging level
    if (config.logging?.level !== undefined) {
        const validLevels = ['error', 'warn', 'info', 'debug'];
        if (!validLevels.includes(config.logging.level)) {
            addError('logging.level', config.logging.level, validLevels.join(' | '), 'Must be one of the supported log levels');
        }
    }
    
    return errors;
}

export function getValidatedConfig(): ClaudeLoopConfig {
    const workspaceConfig = vscode.workspace.getConfiguration('claudeLoop');
    
    // Get all configuration values with defaults
    const config: ClaudeLoopConfig = {
        developmentMode: workspaceConfig.get('developmentMode', DEFAULT_CONFIG.developmentMode),
        
        queue: {
            maxSize: workspaceConfig.get('queue.maxSize', DEFAULT_CONFIG.queue.maxSize),
            maxMessageSize: workspaceConfig.get('queue.maxMessageSize', DEFAULT_CONFIG.queue.maxMessageSize),
            maxOutputSize: workspaceConfig.get('queue.maxOutputSize', DEFAULT_CONFIG.queue.maxOutputSize),
            maxErrorSize: workspaceConfig.get('queue.maxErrorSize', DEFAULT_CONFIG.queue.maxErrorSize),
            cleanupThreshold: workspaceConfig.get('queue.cleanupThreshold', DEFAULT_CONFIG.queue.cleanupThreshold),
            retentionHours: workspaceConfig.get('queue.retentionHours', DEFAULT_CONFIG.queue.retentionHours),
            autoMaintenance: workspaceConfig.get('queue.autoMaintenance', DEFAULT_CONFIG.queue.autoMaintenance)
        },
        
        session: {
            autoStart: workspaceConfig.get('session.autoStart', DEFAULT_CONFIG.session.autoStart),
            skipPermissions: workspaceConfig.get('session.skipPermissions', DEFAULT_CONFIG.session.skipPermissions),
            healthCheckInterval: workspaceConfig.get('session.healthCheckInterval', DEFAULT_CONFIG.session.healthCheckInterval),
            outputThrottleMs: workspaceConfig.get('session.outputThrottleMs', DEFAULT_CONFIG.session.outputThrottleMs),
            autoClearOutputMs: workspaceConfig.get('session.autoClearOutputMs', DEFAULT_CONFIG.session.autoClearOutputMs)
        },
        
        sleepPrevention: {
            enabled: workspaceConfig.get('sleepPrevention.enabled', DEFAULT_CONFIG.sleepPrevention.enabled),
            method: workspaceConfig.get('sleepPrevention.method', DEFAULT_CONFIG.sleepPrevention.method)
        },
        
        history: {
            maxRuns: workspaceConfig.get('history.maxRuns', DEFAULT_CONFIG.history.maxRuns),
            autoSave: workspaceConfig.get('history.autoSave', DEFAULT_CONFIG.history.autoSave),
            persistPendingQueue: workspaceConfig.get('history.persistPendingQueue', DEFAULT_CONFIG.history.persistPendingQueue)
        },
        
        logging: {
            enabled: workspaceConfig.get('logging.enabled', DEFAULT_CONFIG.logging.enabled),
            level: workspaceConfig.get('logging.level', DEFAULT_CONFIG.logging.level),
            outputToConsole: workspaceConfig.get('logging.outputToConsole', DEFAULT_CONFIG.logging.outputToConsole)
        }
    };
    
    // Validate the configuration
    const errors = validateConfig(config);
    
    if (errors.length > 0) {
        debugLog('⚠️ Configuration validation errors found:');
        errors.forEach(error => {
            debugLog(`  - ${error.path}: ${error.message} (got: ${error.value}, expected: ${error.expected})`);
        });
        
        // Show warning to user about invalid configuration
        const errorMessages = errors.map(e => `${e.path}: ${e.message}`).join('\n');
        vscode.window.showWarningMessage(
            `ClaudeLoop configuration has invalid values:\n${errorMessages}\n\nUsing default values for invalid settings.`,
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'claudeLoop');
            }
        });
        
        // Use defaults for invalid values
        return getDefaultsForInvalidConfig(config, errors);
    }
    
    return config;
}

function getDefaultsForInvalidConfig(config: ClaudeLoopConfig, errors: ConfigValidationError[]): ClaudeLoopConfig {
    const fixedConfig = { ...config };
    
    // Reset invalid values to defaults
    errors.forEach(error => {
        const pathParts = error.path.split('.');
        let defaultValue = DEFAULT_CONFIG;
        let targetObject = fixedConfig;
        
        // Navigate to the correct nested object
        for (let i = 0; i < pathParts.length - 1; i++) {
            defaultValue = (defaultValue as any)[pathParts[i]];
            targetObject = (targetObject as any)[pathParts[i]];
        }
        
        // Set the default value
        const finalKey = pathParts[pathParts.length - 1];
        (targetObject as any)[finalKey] = (defaultValue as any)[finalKey];
    });
    
    return fixedConfig;
}

export function resetConfigToDefaults(): void {
    const config = vscode.workspace.getConfiguration('claudeLoop');
    
    // Reset all settings to undefined (which uses defaults)
    const resetPromises = [
        config.update('developmentMode', undefined),
        config.update('queue', undefined),
        config.update('session', undefined),
        config.update('sleepPrevention', undefined),
        config.update('history', undefined),
        config.update('logging', undefined)
    ];
    
    Promise.all(resetPromises).then(() => {
        vscode.window.showInformationMessage('ClaudeLoop configuration reset to defaults');
        debugLog('🔄 Configuration reset to defaults');
    }).catch(error => {
        vscode.window.showErrorMessage(`Failed to reset configuration: ${error}`);
        debugLog(`❌ Failed to reset configuration: ${error}`);
    });
}

export function showConfigValidationStatus(): void {
    const config = getValidatedConfig();
    const errors = validateConfig(config);
    
    if (errors.length === 0) {
        vscode.window.showInformationMessage('✅ ClaudeLoop configuration is valid');
    } else {
        const errorSummary = `${errors.length} configuration error(s) found:\n` +
                           errors.map(e => `• ${e.path}: ${e.message}`).join('\n');
        
        vscode.window.showWarningMessage(
            errorSummary,
            'Open Settings',
            'Reset to Defaults'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'claudeLoop');
            } else if (selection === 'Reset to Defaults') {
                resetConfigToDefaults();
            }
        });
    }
}

// Configuration change listener
export function watchConfigChanges(callback: (config: ClaudeLoopConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('claudeLoop')) {
            debugLog('🔧 ClaudeLoop configuration changed, revalidating...');
            const newConfig = getValidatedConfig();
            callback(newConfig);
        }
    });
}