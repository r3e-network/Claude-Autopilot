import * as vscode from 'vscode';
import { AutomationManager } from '../automation/automationManager';
import { addMessageToQueueFromWebview } from './manager';
import { debugLog } from '../utils/logging';

let automationManager: AutomationManager | null = null;

/**
 * Initialize automation wrapper
 */
export function initializeAutomation(workspacePath: string) {
    automationManager = new AutomationManager(workspacePath);
    automationManager.initialize();
    debugLog('Automation wrapper initialized');
}

/**
 * Add message with automation enhancements
 */
export async function addMessageWithAutomation(message: string, currentFile?: string): Promise<void> {
    if (!automationManager) {
        // Fallback to regular message if automation not initialized
        addMessageToQueueFromWebview(message);
        return;
    }
    
    try {
        // Process message with automation features
        const enhancedMessage = await automationManager.processMessage(message, currentFile);
        
        // Add enhanced message to queue
        addMessageToQueueFromWebview(enhancedMessage);
        
        debugLog('Message enhanced with automation features');
    } catch (error) {
        debugLog(`Automation enhancement failed: ${error}, using original message`);
        // Fallback to original message
        addMessageToQueueFromWebview(message);
    }
}

/**
 * Handle error with automation recovery
 */
export async function handleErrorWithAutomation(error: string, context?: any): Promise<boolean> {
    if (!automationManager) {
        return false;
    }
    
    return await automationManager.handleError(error, context);
}

/**
 * Run validation with automation
 */
export async function runAutomationValidation(): Promise<void> {
    if (!automationManager) {
        vscode.window.showWarningMessage('Automation not initialized');
        return;
    }
    
    await automationManager.runValidation();
}

/**
 * Get automation status
 */
export function getAutomationStatus() {
    if (!automationManager) {
        return { enabled: false, initialized: false };
    }
    
    return {
        enabled: true,
        initialized: true,
        statistics: automationManager.getStatistics()
    };
}