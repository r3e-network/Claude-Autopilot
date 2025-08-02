import * as vscode from 'vscode';
import { MessageItem } from '../../core/types';
import { messageQueue, queueSortConfig, claudePanel, setQueueSortConfig, processingQueue, sessionReady, setProcessingQueue } from '../../core/state';
import { debugLog } from '../../utils/logging';
import { updateWebviewContent } from '../../ui/webview';
import { processNextMessage } from '../../claude/communication';
import { enforceMessageSizeLimits, enforceQueueSizeLimit, performQueueMaintenance } from '../memory';
import { savePendingQueue } from '../processor/history';
import { generateMessageId } from '../../utils/id-generator';
import { ErrorManager, CommonErrors } from '../../core/errors';
import { InputValidator } from '../../core/validation';

export function removeMessageFromQueue(messageId: string): void {
    try {
        if (!messageId || typeof messageId !== 'string') {
            throw CommonErrors.INVALID_CONFIGURATION('messageId', messageId, 'non-empty string');
        }

        const index = messageQueue.findIndex(msg => msg.id === messageId);
        if (index >= 0) {
            const removedMessage = messageQueue[index];
            messageQueue.splice(index, 1);
            updateWebviewContent();
            savePendingQueue();
            
            debugLog(`✅ Message removed from queue: ${removedMessage.text.substring(0, 50)}...`);
            vscode.window.showInformationMessage(`Message removed: ${removedMessage.text.substring(0, 30)}...`);
        } else {
            throw new Error(`Message with ID ${messageId} not found in queue`);
        }
    } catch (error) {
        ErrorManager.logError(error instanceof Error ? error : new Error(String(error)), {
            context: 'removeMessageFromQueue',
            messageId
        });
    }
}

export function duplicateMessageInQueue(messageId: string): void {
    const message = messageQueue.find(msg => msg.id === messageId);
    if (message) {
        const duplicatedMessage: MessageItem = {
            id: generateMessageId(),
            text: message.text,
            timestamp: new Date().toISOString(),
            status: 'pending',
            attachedScripts: message.attachedScripts
        };
        
        const originalIndex = messageQueue.findIndex(msg => msg.id === messageId);
        messageQueue.splice(originalIndex + 1, 0, duplicatedMessage);
        
        updateWebviewContent();
        savePendingQueue(); // Save queue changes
        vscode.window.showInformationMessage(`Message duplicated: ${message.text.substring(0, 50)}...`);
    }
}

export function editMessageInQueue(messageId: string, newText: string): void {
    try {
        debugLog(`EditMessageInQueue called with messageId: ${messageId}, newText length: ${newText?.length || 0}`);
        
        // Validate inputs
        if (!messageId || typeof messageId !== 'string') {
            throw CommonErrors.INVALID_CONFIGURATION('messageId', messageId, 'non-empty string');
        }

        const validation = InputValidator.validateMessage(newText);
        if (!validation.isValid) {
            throw new Error(`Invalid message text: ${validation.errors.join(', ')}`);
        }

        const message = messageQueue.find(msg => msg.id === messageId);
        debugLog(`Found message: ${message ? 'yes' : 'not found'}`);
        
        if (message) {
            const oldText = message.text;
            message.text = validation.sanitizedValue || newText;
            message.timestamp = new Date().toISOString();
            
            debugLog(`✅ Message edited successfully`);
            updateWebviewContent();
            savePendingQueue();
            
            vscode.window.showInformationMessage(
                `Message edited: ${oldText.substring(0, 30)}... → ${message.text.substring(0, 30)}...`
            );

            // Show validation warnings if any
            if (validation.warnings.length > 0) {
                vscode.window.showWarningMessage(
                    `Message updated with warnings: ${validation.warnings.join(', ')}`
                );
            }
        } else {
            throw new Error(`Message with ID ${messageId} not found in queue`);
        }
    } catch (error) {
        ErrorManager.logError(error instanceof Error ? error : new Error(String(error)), {
            context: 'editMessageInQueue',
            messageId,
            newTextLength: newText?.length
        });
    }
}

export function reorderQueue(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= messageQueue.length || toIndex < 0 || toIndex >= messageQueue.length) {
        return;
    }
    
    const [movedItem] = messageQueue.splice(fromIndex, 1);
    messageQueue.splice(toIndex, 0, movedItem);
    
    updateWebviewContent();
}

export function sortQueue(field: 'timestamp' | 'status' | 'text', direction: 'asc' | 'desc'): void {
    setQueueSortConfig({ field, direction });
    
    messageQueue.sort((a, b) => {
        let comparison = 0;
        
        switch (field) {
            case 'timestamp':
                comparison = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                break;
            case 'status':
                const statusOrder = { 'pending': 0, 'processing': 1, 'waiting': 2, 'completed': 3, 'error': 4 };
                comparison = statusOrder[a.status] - statusOrder[b.status];
                break;
            case 'text':
                comparison = a.text.localeCompare(b.text);
                break;
        }
        
        return direction === 'desc' ? -comparison : comparison;
    });
    
    updateWebviewContent();
    
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'queueSorted',
                sortConfig: queueSortConfig
            });
        } catch (error) {
            debugLog(`❌ Failed to send queue sort config to webview: ${error}`);
        }
    }
}

export function clearMessageQueue(): void {
    messageQueue.length = 0;
    updateWebviewContent();
    savePendingQueue(); // Save queue changes (empty queue)
    
    // Ensure Claude output is cleared and ready for new messages
    import('../../claude/output').then(({ clearClaudeOutput, flushClaudeOutput }) => {
        flushClaudeOutput(); // Flush any pending output first
        clearClaudeOutput(); // Then clear the buffer
    }).catch(error => {
        debugLog(`Warning: Failed to clear Claude output: ${error}`);
    });
    
    vscode.window.showInformationMessage('Message queue cleared');
}

export function addMessageToQueueFromWebview(message: string, attachedScripts?: string[]): void {
    const messageItem: MessageItem = {
        id: generateMessageId(),
        text: message,
        timestamp: new Date().toISOString(),
        status: 'pending',
        attachedScripts: attachedScripts && attachedScripts.length > 0 ? attachedScripts : undefined
    };

    // Apply size limits to the new message
    const sizeLimitedMessage = enforceMessageSizeLimits(messageItem);
    
    messageQueue.push(sizeLimitedMessage);
    
    // Check and enforce queue size limits
    enforceQueueSizeLimit();
    
    updateWebviewContent();
    
    const hasWaitingMessages = messageQueue.some(msg => msg.status === 'waiting');
    if (hasWaitingMessages) {
        vscode.window.showInformationMessage(`Message added to queue (waiting for usage limit to reset): ${message.substring(0, 50)}...`);
    } else {
        vscode.window.showInformationMessage(`Message added to queue: ${message.substring(0, 50)}...`);
    }
    
    // Save pending queue after adding message
    savePendingQueue();
    
    // Auto-start processing if conditions are met
    tryAutoStartProcessing();
}

function tryAutoStartProcessing(): void {
    const hasProcessingMessages = messageQueue.some(msg => msg.status === 'processing');
    const hasPendingMessages = messageQueue.some(msg => msg.status === 'pending');
    const hasWaitingMessages = messageQueue.some(msg => msg.status === 'waiting');
    
    debugLog(`🔍 Auto-start check: sessionReady=${sessionReady}, processingQueue=${processingQueue}, hasProcessing=${hasProcessingMessages}, hasPending=${hasPendingMessages}, hasWaiting=${hasWaitingMessages}`);
    
    // Auto-start processing if:
    // 1. Session is ready AND
    // 2. Either processing is already enabled OR this is the first message added to ready session
    // 3. No messages are currently being processed
    // 4. There are pending messages to process
    // 5. No waiting messages (avoid interference with usage limit waits)
    
    const shouldAutoStart = (
        sessionReady && 
        !hasProcessingMessages && 
        hasPendingMessages && 
        !hasWaitingMessages &&
        (processingQueue || (!processingQueue && messageQueue.filter(m => m.status !== 'waiting').length === 1))
    );
    
    if (shouldAutoStart) {
        if (!processingQueue) {
            debugLog('🚀 Auto-enabling processing for first message in ready session');
            setProcessingQueue(true);
        }
        debugLog('🚀 Auto-starting queue processing - conditions met');
        setTimeout(() => {
            processNextMessage();
        }, 200);
    } else {
        debugLog('❌ Auto-start conditions not met - manual start required');
    }
}