import * as vscode from 'vscode';
import { HistoryRun, MessageItem } from '../../core/types';
import { extensionContext, currentRun, messageQueue, setCurrentRun } from '../../core/state';
import { claudePanel } from '../../core/state';
import { debugLog, getHistoryStorageKey, getPendingQueueStorageKey, getWorkspacePath } from '../../utils/logging';

export function saveWorkspaceHistory(): void {
    if (!extensionContext || !currentRun) return;
    
    const storageKey = getHistoryStorageKey();
    const existingHistory = extensionContext.globalState.get<HistoryRun[]>(storageKey, []);
    
    currentRun.messages = [...messageQueue];
    currentRun.totalMessages = messageQueue.length;
    currentRun.completedMessages = messageQueue.filter(m => m.status === 'completed').length;
    currentRun.errorMessages = messageQueue.filter(m => m.status === 'error').length;
    currentRun.waitingMessages = messageQueue.filter(m => m.status === 'waiting').length;
    
    const existingIndex = existingHistory.findIndex(run => run.id === currentRun!.id);
    if (existingIndex >= 0) {
        existingHistory[existingIndex] = currentRun;
    } else {
        existingHistory.push(currentRun);
    }
    
    const recentHistory = existingHistory.slice(-50);
    extensionContext.globalState.update(storageKey, recentHistory);
    
    savePendingQueue();
}

export function loadWorkspaceHistory(): void {
    if (!extensionContext) return;
    
    const storageKey = getHistoryStorageKey();
    const history = extensionContext.globalState.get<HistoryRun[]>(storageKey, []);
    
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'historyLoaded',
                history: history.reverse()
            });
        } catch (error) {
            debugLog(`❌ Failed to send history to webview: ${error}`);
        }
    }
}

export function filterHistory(filter: string): void {
    if (!extensionContext) return;
    
    const storageKey = getHistoryStorageKey();
    const allHistory = extensionContext.globalState.get<HistoryRun[]>(storageKey, []);
    
    let filteredHistory = allHistory;
    
    switch (filter) {
        case 'waiting':
            filteredHistory = allHistory.filter(run => run.waitingMessages > 0);
            break;
        case 'completed':
            filteredHistory = allHistory.filter(run => run.completedMessages === run.totalMessages && run.totalMessages > 0);
            break;
        case 'errors':
            filteredHistory = allHistory.filter(run => run.errorMessages > 0);
            break;
        case 'recent':
            filteredHistory = allHistory.slice(-10);
            break;
        default:
            filteredHistory = allHistory;
    }
    
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'historyFiltered',
                history: filteredHistory.reverse(),
                filter: filter
            });
        } catch (error) {
            debugLog(`❌ Failed to send filtered history to webview: ${error}`);
        }
    }
}

export function startNewHistoryRun(): void {
    const run: HistoryRun = {
        id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        startTime: new Date().toISOString(),
        workspacePath: getWorkspacePath(),
        messages: [],
        totalMessages: 0,
        completedMessages: 0,
        errorMessages: 0,
        waitingMessages: 0
    };
    setCurrentRun(run);
}

export function endCurrentHistoryRun(): void {
    if (currentRun) {
        currentRun.endTime = new Date().toISOString();
        saveWorkspaceHistory();
    }
}

export function savePendingQueue(): void {
    if (!extensionContext) return;
    
    const pendingMessages = messageQueue.filter(msg => 
        msg.status === 'pending' || msg.status === 'waiting'
    );
    
    const storageKey = getPendingQueueStorageKey();
    extensionContext.globalState.update(storageKey, pendingMessages);
}

export function loadPendingQueue(): void {
    if (!extensionContext) return;
    
    const storageKey = getPendingQueueStorageKey();
    const pendingMessages = extensionContext.globalState.get<MessageItem[]>(storageKey, []);
    
    if (pendingMessages.length > 0) {
        messageQueue.splice(0, messageQueue.length, ...pendingMessages);
        vscode.window.showInformationMessage(`Restored ${pendingMessages.length} pending messages from previous session`);
        
        if (!currentRun) {
            startNewHistoryRun();
            saveWorkspaceHistory();
        }
    }
}

export function clearPendingQueue(): void {
    if (!extensionContext) return;
    
    const storageKey = getPendingQueueStorageKey();
    extensionContext.globalState.update(storageKey, []);
}