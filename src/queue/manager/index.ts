import * as vscode from 'vscode';
import { MessageItem } from '../../core/types';
import { messageQueue, queueSortConfig, claudePanel, setQueueSortConfig } from '../../core/state';
import { debugLog } from '../../utils/logging';
import { updateWebviewContent } from '../../ui/webview';

export function removeMessageFromQueue(messageId: number): void {
    const index = messageQueue.findIndex(msg => msg.id === messageId);
    if (index >= 0) {
        messageQueue.splice(index, 1);
        updateWebviewContent();
        vscode.window.showInformationMessage('Message removed from queue');
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
    vscode.window.showInformationMessage('Message queue cleared');
}

export function addMessageToQueueFromWebview(message: string): void {
    const messageItem: MessageItem = {
        id: Date.now(),
        text: message,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };

    messageQueue.push(messageItem);
    updateWebviewContent();
    
    const hasWaitingMessages = messageQueue.some(msg => msg.status === 'waiting');
    if (hasWaitingMessages) {
        vscode.window.showInformationMessage(`Message added to queue (waiting for usage limit to reset): ${message.substring(0, 50)}...`);
    } else {
        vscode.window.showInformationMessage(`Message added to queue: ${message.substring(0, 50)}...`);
    }
}