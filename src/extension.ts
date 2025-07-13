import * as vscode from 'vscode';
import {
    claudePanel, isRunning, setClaudePanel, setIsRunning,
    setExtensionContext, setDebugMode
} from './core';
import { updateWebviewContent, updateSessionState, getWebviewContent } from './ui';
import { startClaudeSession, resetClaudeSession, handleClaudeKeypress, startProcessingQueue, stopProcessingQueue, flushClaudeOutput, clearClaudeOutput } from './claude';
import {
    removeMessageFromQueue, reorderQueue, sortQueue, clearMessageQueue,
    addMessageToQueueFromWebview, loadWorkspaceHistory, filterHistory, 
    loadPendingQueue, clearPendingQueue, saveWorkspaceHistory, endCurrentHistoryRun
} from './queue';
import { recoverWaitingMessages, toggleSleepPreventionSetting, sendSleepPreventionSetting, stopSleepPrevention } from './services';
import { debugLog } from './utils';

export function activate(context: vscode.ExtensionContext) {
    setExtensionContext(context);
    setDebugMode(false);

    // Register commands
    const startCommand = vscode.commands.registerCommand('claude-loop.start', () => {
        startClaudeLoop(context);
    });

    const stopCommand = vscode.commands.registerCommand('claude-loop.stop', () => {
        stopClaudeLoop();
    });

    const addMessageCommand = vscode.commands.registerCommand('claude-loop.addMessage', () => {
        addMessageToQueue();
    });

    context.subscriptions.push(startCommand, stopCommand, addMessageCommand);
}

function startClaudeLoop(context: vscode.ExtensionContext): void {
    if (isRunning && claudePanel) {
        claudePanel.reveal(vscode.ViewColumn.Two);
        vscode.window.showInformationMessage('ClaudeLoop is already running - showing existing panel');
        return;
    }
    
    if (isRunning && !claudePanel) {
        setIsRunning(false);
    }

    const panel = vscode.window.createWebviewPanel(
        'claudeLoop',
        'ClaudeLoop',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    setClaudePanel(panel);
    panel.webview.html = getWebviewContent(context);

    loadPendingQueue();
    recoverWaitingMessages();
    
    setTimeout(() => {
        updateWebviewContent();
        updateSessionState();
        sendSleepPreventionSetting();
        loadWorkspaceHistory();
        debugLog('🔄 Webview state synchronized after reopening');
    }, 100);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        (message: any) => {
            switch (message.command) {
                case 'addMessage':
                    addMessageToQueueFromWebview(message.text);
                    break;
                case 'startProcessing':
                    startProcessingQueue(message.skipPermissions);
                    break;
                case 'stopProcessing':
                    stopProcessingQueue();
                    break;
                case 'clearQueue':
                    clearMessageQueue();
                    break;
                case 'resetSession':
                    resetClaudeSession();
                    break;
                case 'startClaudeSession':
                    startClaudeSession(message.skipPermissions);
                    break;
                case 'claudeKeypress':
                    handleClaudeKeypress(message.key);
                    break;
                case 'removeMessage':
                    removeMessageFromQueue(message.messageId);
                    break;
                case 'reorderQueue':
                    reorderQueue(message.fromIndex, message.toIndex);
                    break;
                case 'sortQueue':
                    sortQueue(message.field, message.direction);
                    break;
                case 'loadHistory':
                    loadWorkspaceHistory();
                    break;
                case 'filterHistory':
                    filterHistory(message.filter);
                    break;
                case 'toggleSleepPrevention':
                    toggleSleepPreventionSetting(message.enabled);
                    break;
                case 'getSleepPreventionSetting':
                    sendSleepPreventionSetting();
                    break;
            }
        },
        undefined,
        []
    );

    // Handle panel disposal
    panel.onDidDispose(() => {
        debugLog('🪟 Webview panel disposed - cleaning up but keeping Claude session running');
        
        setClaudePanel(null);
        flushClaudeOutput();
        clearClaudeOutput();
        setIsRunning(false);
        
        vscode.window.showInformationMessage('ClaudeLoop panel closed. Claude session continues in background. Use "Start ClaudeLoop" to reopen.');
    }, null, []);

    setIsRunning(true);
    vscode.window.showInformationMessage('ClaudeLoop started');
}

function stopClaudeLoop(): void {
    if (!isRunning) {
        return;
    }

    stopSleepPrevention();
    flushClaudeOutput();
    clearClaudeOutput();
    setIsRunning(false);
    
    if (claudePanel) {
        claudePanel.dispose();
        setClaudePanel(null);
    }

    vscode.window.showInformationMessage('ClaudeLoop stopped');
}

function addMessageToQueue(): void {
    vscode.window.showInputBox({
        prompt: 'Enter message to add to ClaudeLoop queue',
        placeHolder: 'Type your message here...'
    }).then(message => {
        if (message) {
            addMessageToQueueFromWebview(message);
        }
    });
}

export function deactivate(): void {
    saveWorkspaceHistory();
    endCurrentHistoryRun();
    flushClaudeOutput();
    clearClaudeOutput();
    stopClaudeLoop();
}