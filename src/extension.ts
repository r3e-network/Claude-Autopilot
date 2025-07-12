import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface MessageItem {
    id: number;
    text: string;
    timestamp: string;
    status: 'pending' | 'processing' | 'completed' | 'error' | 'waiting';
    output?: string;
    error?: string;
    completedAt?: string;
    waitUntil?: number;
    waitSeconds?: number;
}

interface HistoryRun {
    id: string;
    startTime: string;
    endTime?: string;
    workspacePath: string;
    messages: MessageItem[];
    totalMessages: number;
    completedMessages: number;
    errorMessages: number;
    waitingMessages: number;
}

interface QueueSortConfig {
    field: 'timestamp' | 'status' | 'text';
    direction: 'asc' | 'desc';
}



let claudePanel: vscode.WebviewPanel | null = null;
let isRunning = false;
let messageQueue: MessageItem[] = [];
let claudeProcess: ChildProcess | null = null;
let resumeTimer: NodeJS.Timeout | null = null;
let countdownInterval: NodeJS.Timeout | null = null;
let sleepPreventionProcess: ChildProcess | null = null;
let sleepPreventionActive = false;
let healthCheckTimer: NodeJS.Timeout | null = null;

// Session state management
let sessionReady = false;
let currentMessage: MessageItem | null = null;
let processingQueue = false;
let debugMode = true; // Enable debug logging (set to true for development)

// History and workspace management
let currentRun: HistoryRun | null = null;
let extensionContext: vscode.ExtensionContext;
let queueSortConfig: QueueSortConfig = { field: 'timestamp', direction: 'asc' };

// Output management for Claude stdout - show current screen content at controlled rate
let claudeOutputBuffer: string = '';
let claudeCurrentScreen: string = '';
let claudeOutputTimer: NodeJS.Timeout | null = null;
let claudeAutoClearTimer: NodeJS.Timeout | null = null;
let lastClaudeOutputTime: number = 0;
const CLAUDE_OUTPUT_THROTTLE_MS = 1000; // 1000ms = 1 time per second max (prevent UI freezing)
const CLAUDE_OUTPUT_AUTO_CLEAR_MS = 30000; // 30 seconds - auto clear output buffer
const CLAUDE_OUTPUT_MAX_BUFFER_SIZE = 100000; // 100KB max buffer size
const ANSI_CLEAR_SCREEN_PATTERNS = [
    '\x1b[2J',           // Clear entire screen
    '\x1b[H\x1b[2J',     // Move cursor to home + clear screen
    '\x1b[2J\x1b[H',     // Clear screen + move cursor to home
    '\x1b[1;1H\x1b[2J',  // Move cursor to 1,1 + clear screen
    '\x1b[2J\x1b[1;1H'   // Clear screen + move cursor to 1,1
];

// Configuration constants
const TIMEOUT_MS = 60 * 60 * 60 * 1000; // 1 hour
const HEALTH_CHECK_INTERVAL_MS = 30000; // Check Claude process health every 30 seconds

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    
    if (debugMode) {
        console.log('ClaudeLoop extension is now active!');
    }

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
        // If already running with a valid panel, just reveal it
        claudePanel.reveal(vscode.ViewColumn.Two);
        vscode.window.showInformationMessage('ClaudeLoop is already running - showing existing panel');
        return;
    }
    
    // If isRunning is true but claudePanel is null, reset the state
    if (isRunning && !claudePanel) {
        isRunning = false;
    }

    // Create webview panel
    claudePanel = vscode.window.createWebviewPanel(
        'claudeLoop',
        'ClaudeLoop',
        vscode.ViewColumn.Two, // Put webview in second column
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    claudePanel.webview.html = getWebviewContent(context);

    // Load any pending messages from previous session
    loadPendingQueue();
    
    // Check for and recover any waiting messages with timers
    recoverWaitingMessages();

    // Handle messages from webview
    claudePanel.webview.onDidReceiveMessage(
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
    claudePanel.onDidDispose(() => {
        stopClaudeLoop();
        claudePanel = null;
        // Clear any running timers when panel is disposed
        if (resumeTimer) {
            clearTimeout(resumeTimer);
            resumeTimer = null;
        }
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        if (claudeOutputTimer) {
            clearTimeout(claudeOutputTimer);
            claudeOutputTimer = null;
        }
        if (claudeAutoClearTimer) {
            clearTimeout(claudeAutoClearTimer);
            claudeAutoClearTimer = null;
        }
        // Stop sleep prevention when panel is disposed
        stopSleepPrevention();
    }, null, []);

    isRunning = true;
    vscode.window.showInformationMessage('ClaudeLoop started');
}

function stopClaudeLoop(): void {
    if (!isRunning) {
        return;
    }

    // Stop Claude process
    if (claudeProcess) {
        claudeProcess.kill();
        claudeProcess = null;
        sessionReady = false;
    }

    // Clear timers
    if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
    }
    
    // Clear Claude output timer and flush any remaining output
    if (claudeOutputTimer) {
        clearTimeout(claudeOutputTimer);
        claudeOutputTimer = null;
    }
    flushClaudeOutput();
    
    // Clear buffers
    claudeOutputBuffer = '';
    claudeCurrentScreen = '';
    
    stopHealthCheck();

    // Reset state
    currentMessage = null;
    processingQueue = false;

    isRunning = false;
    
    if (claudePanel) {
        claudePanel.dispose();
        claudePanel = null;
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

function addMessageToQueueFromWebview(message: string): void {
    const messageItem: MessageItem = {
        id: Date.now(),
        text: message,
        timestamp: new Date().toISOString(),
        status: 'pending'
    };

    messageQueue.push(messageItem);
    
    // Start new history run if this is the first message
    if (!currentRun) {
        startNewHistoryRun();
    }
    
    updateWebviewContent();
    saveWorkspaceHistory();
    
    // Auto-start processing if session is ready and not currently processing AND no waiting messages
    const hasWaitingMessages = messageQueue.some(msg => msg.status === 'waiting');
    if (sessionReady && !processingQueue && !hasWaitingMessages) {
        vscode.window.showInformationMessage(`Message added and auto-processing started: ${message.substring(0, 50)}...`);
        processingQueue = true;
        updateSessionState();
        processNextMessage();
    } else {
        if (hasWaitingMessages) {
            vscode.window.showInformationMessage(`Message added to queue (waiting for usage limit to reset): ${message.substring(0, 50)}...`);
        } else {
            vscode.window.showInformationMessage(`Message added to queue: ${message.substring(0, 50)}...`);
        }
    }
}

function startProcessingQueue(skipPermissions: boolean = true): void {
    // If no Claude session, start one
    if (!claudeProcess) {
        vscode.window.showInformationMessage('Starting Claude session...');
        startClaudeSession(skipPermissions);
        
        // If we have messages, wait for session to be ready then start processing
        if (messageQueue.length > 0) {
            const checkReadyInterval = setInterval(() => {
                if (sessionReady) {
                    clearInterval(checkReadyInterval);
                    processingQueue = true;
                    updateSessionState();
                    processNextMessage();
                }
            }, 1000);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkReadyInterval);
                if (!sessionReady) {
                    vscode.window.showErrorMessage('Claude session failed to start. Please check your Claude CLI installation.');
                }
            }, 30000);
        }
        
        return;
    }

    // Session exists - start processing if we have messages
    if (messageQueue.length === 0) {
        vscode.window.showInformationMessage('Claude session is ready. Add messages to start processing.');
        return;
    }

    processingQueue = true;
    updateSessionState();
    processNextMessage();
}

function stopProcessingQueue(): void {
    processingQueue = false;
    currentMessage = null;
    
    // Send ESC to Claude to cancel any current operation
    if (claudeProcess && claudeProcess.stdin) {
        debugLog('⌨️ Sending ESC to Claude to cancel current operation');
        claudeProcess.stdin.write('\x1b'); // ESC key
    }
    
    // End current history run
    endCurrentHistoryRun();
    
    // Don't stop Claude session - just stop processing
    // Session should remain active for future processing
    updateWebviewContent();
    updateSessionState();
    vscode.window.showInformationMessage('Processing stopped. Claude session remains active.');
}

function clearMessageQueue(): void {
    messageQueue = [];
    clearPendingQueue();
    updateWebviewContent();
    vscode.window.showInformationMessage('Message queue cleared');
}

function resetClaudeSession(): void {
    // Stop Claude process if running
    if (claudeProcess) {
        claudeProcess.kill();
        claudeProcess = null;
        sessionReady = false;
    }

    // Clear resume timer
    if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
    }

    // Reset state
    currentMessage = null;
    processingQueue = false;
    
    // Reset any waiting messages back to pending
    messageQueue.forEach(msg => {
        if (msg.status === 'waiting' || msg.status === 'processing') {
            msg.status = 'pending';
            msg.error = undefined;
            msg.waitSeconds = undefined;
        }
    });

    updateWebviewContent();
    updateSessionState();
    vscode.window.showInformationMessage('Claude session reset. You can now start a new session.');
}

// History Management Functions
function getWorkspacePath(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    return workspaceFolder?.uri.fsPath || 'global';
}

function getHistoryStorageKey(): string {
    return `claudeloop_history_${getWorkspacePath().replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function getPendingQueueStorageKey(): string {
    return `claudeloop_pending_${getWorkspacePath().replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function saveWorkspaceHistory(): void {
    if (!extensionContext || !currentRun) return;
    
    const storageKey = getHistoryStorageKey();
    const existingHistory = extensionContext.globalState.get<HistoryRun[]>(storageKey, []);
    
    // Update current run with latest data
    currentRun.messages = [...messageQueue];
    currentRun.totalMessages = messageQueue.length;
    currentRun.completedMessages = messageQueue.filter(m => m.status === 'completed').length;
    currentRun.errorMessages = messageQueue.filter(m => m.status === 'error').length;
    currentRun.waitingMessages = messageQueue.filter(m => m.status === 'waiting').length;
    
    // Find existing run or add new one
    const existingIndex = existingHistory.findIndex(run => run.id === currentRun!.id);
    if (existingIndex >= 0) {
        existingHistory[existingIndex] = currentRun;
    } else {
        existingHistory.push(currentRun);
    }
    
    // Keep only last 50 runs per workspace
    const recentHistory = existingHistory.slice(-50);
    extensionContext.globalState.update(storageKey, recentHistory);
    
    // Also save current pending messages
    savePendingQueue();
}

function loadWorkspaceHistory(): void {
    if (!extensionContext) return;
    
    const storageKey = getHistoryStorageKey();
    const history = extensionContext.globalState.get<HistoryRun[]>(storageKey, []);
    
    if (claudePanel) {
        claudePanel.webview.postMessage({
            command: 'historyLoaded',
            history: history.reverse() // Most recent first
        });
    }
}

function filterHistory(filter: string): void {
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
        claudePanel.webview.postMessage({
            command: 'historyFiltered',
            history: filteredHistory.reverse(),
            filter: filter
        });
    }
}

function startNewHistoryRun(): void {
    currentRun = {
        id: `run_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        startTime: new Date().toISOString(),
        workspacePath: getWorkspacePath(),
        messages: [],
        totalMessages: 0,
        completedMessages: 0,
        errorMessages: 0,
        waitingMessages: 0
    };
}

function endCurrentHistoryRun(): void {
    if (currentRun) {
        currentRun.endTime = new Date().toISOString();
        saveWorkspaceHistory();
    }
}

// Queue Management Functions
function removeMessageFromQueue(messageId: number): void {
    const index = messageQueue.findIndex(msg => msg.id === messageId);
    if (index >= 0) {
        messageQueue.splice(index, 1);
        updateWebviewContent();
        saveWorkspaceHistory();
        savePendingQueue();
        vscode.window.showInformationMessage('Message removed from queue');
    }
}

function reorderQueue(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= messageQueue.length || toIndex < 0 || toIndex >= messageQueue.length) {
        return;
    }
    
    const [movedItem] = messageQueue.splice(fromIndex, 1);
    messageQueue.splice(toIndex, 0, movedItem);
    
    updateWebviewContent();
    saveWorkspaceHistory();
    savePendingQueue();
}

function sortQueue(field: 'timestamp' | 'status' | 'text', direction: 'asc' | 'desc'): void {
    queueSortConfig = { field, direction };
    
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
    saveWorkspaceHistory();
    savePendingQueue();
    
    if (claudePanel) {
        claudePanel.webview.postMessage({
            command: 'queueSorted',
            sortConfig: queueSortConfig
        });
    }
}

// Pending Queue Persistence Functions
function savePendingQueue(): void {
    if (!extensionContext) return;
    
    // Only save pending and waiting messages
    const pendingMessages = messageQueue.filter(msg => 
        msg.status === 'pending' || msg.status === 'waiting'
    );
    
    const storageKey = getPendingQueueStorageKey();
    extensionContext.globalState.update(storageKey, pendingMessages);
}

function loadPendingQueue(): void {
    if (!extensionContext) return;
    
    const storageKey = getPendingQueueStorageKey();
    const pendingMessages = extensionContext.globalState.get<MessageItem[]>(storageKey, []);
    
    if (pendingMessages.length > 0) {
        messageQueue = [...pendingMessages];
        updateWebviewContent();
        vscode.window.showInformationMessage(`Restored ${pendingMessages.length} pending messages from previous session`);
        
        // Start new history run with restored messages
        if (!currentRun) {
            startNewHistoryRun();
            saveWorkspaceHistory();
        }
    }
}

function clearPendingQueue(): void {
    if (!extensionContext) return;
    
    const storageKey = getPendingQueueStorageKey();
    extensionContext.globalState.update(storageKey, []);
}



// Helper function for waiting until Claude finishes processing a message
function waitForPrompt(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!claudeProcess || !claudeProcess.stdout) {
            reject(new Error('Claude process not available'));
            return;
        }

        let dataListener: ((data: Buffer) => void) | null = null;
        let lastOutputTime = Date.now();
        let screenAnalysisTimer: NodeJS.Timeout | null = null;
        let waitingForPermission = false;
        let currentScreenBuffer = '';
        const SCREEN_ANALYSIS_INTERVAL_MS = 500; // Analyze screen every 500ms
        const DEBOUNCE_THRESHOLD_MS = 1000; // Wait 1 second of stability before resolving

        // Patterns to detect Claude readiness
        const readyPatterns = [
            /\? for shortcuts/,                           // Main ready indicator
            /\\u001b\[2m\\u001b\[38;5;244m│\\u001b\[39m\\u001b\[22m\s>/,  // Cursor pattern
            />\s*$/,                                      // Simple prompt at end
        ];

        const permissionPrompts = [
            'Do you want to make this edit to',
            'Do you want to create',
            'Do you want to delete',
            'Do you want to read',
            'Would you like to',
            'Proceed with',
            'Continue?'
        ];

        const timeout = setTimeout(() => {
            debugLog(`❌ Timeout after ${TIMEOUT_MS / 1000}s waiting for Claude to be ready`);
            cleanup();
            reject(new Error('Timeout waiting for Claude to finish processing'));
        }, TIMEOUT_MS);

        const cleanup = () => {
            if (dataListener && claudeProcess?.stdout) {
                claudeProcess.stdout.removeListener('data', dataListener);
            }
            if (screenAnalysisTimer) {
                clearTimeout(screenAnalysisTimer);
            }
            clearTimeout(timeout);
        };

        const analyzeCurrentScreen = () => {
            const timeSinceLastOutput = Date.now() - lastOutputTime;
            debugLog(`🔍 Analyzing screen (${currentScreenBuffer.length} chars, ${timeSinceLastOutput}ms since last output)`);
            
            if (waitingForPermission) {
                // Check if permission was resolved
                if (currentScreenBuffer.includes('? for shortcuts')) {
                    debugLog(`✅ Permission resolved - back to normal processing`);
                    waitingForPermission = false;
                } else {
                    debugLog(`🔐 Still waiting for permission response`);
                    screenAnalysisTimer = setTimeout(analyzeCurrentScreen, SCREEN_ANALYSIS_INTERVAL_MS);
                    return;
                }
            }
            
            // Check for permission prompts
            const hasPermissionPrompt = permissionPrompts.some(prompt => 
                currentScreenBuffer.includes(prompt)
            );
            
            if (hasPermissionPrompt && !waitingForPermission) {
                debugLog(`🔐 Permission prompt detected in screen analysis`);
                waitingForPermission = true;
                vscode.window.showInformationMessage('Claude is asking for permission. Use the Claude output area to navigate and select your choice.');
                screenAnalysisTimer = setTimeout(analyzeCurrentScreen, SCREEN_ANALYSIS_INTERVAL_MS);
                return;
            }
            
            // Check for readiness patterns
            const isReady = readyPatterns.some(pattern => {
                const jsonScreen = JSON.stringify(currentScreenBuffer);
                return pattern.test(jsonScreen) || pattern.test(currentScreenBuffer);
            });
            
            if (isReady && timeSinceLastOutput >= DEBOUNCE_THRESHOLD_MS) {
                debugLog(`✅ Claude is ready! Pattern detected and ${timeSinceLastOutput}ms of stability`);
                cleanup();
                resolve();
            } else if (isReady) {
                debugLog(`⏳ Ready pattern detected but waiting for stability (${timeSinceLastOutput}ms < ${DEBOUNCE_THRESHOLD_MS}ms)`);
                screenAnalysisTimer = setTimeout(analyzeCurrentScreen, SCREEN_ANALYSIS_INTERVAL_MS);
            } else {
                debugLog(`⏱️  No ready pattern detected, continuing analysis`);
                screenAnalysisTimer = setTimeout(analyzeCurrentScreen, SCREEN_ANALYSIS_INTERVAL_MS);
            }
        };

        dataListener = (data: Buffer) => {
            const output = data.toString();
            debugLog(`📤 Claude output (${data.length} bytes)`);
            
            // Check for clear screen sequences and handle them properly
            let foundClearScreen = false;
            for (const pattern of ANSI_CLEAR_SCREEN_PATTERNS) {
                if (output.includes(pattern)) {
                    foundClearScreen = true;
                    break;
                }
            }
            
            if (foundClearScreen) {
                // Clear screen detected - reset buffer and start fresh
                currentScreenBuffer = output;
                debugLog(`🖥️  Clear screen detected - reset screen buffer`);
            } else {
                // Append to current screen buffer
                currentScreenBuffer += output;
                
                // Keep only recent screen content (last 50KB to avoid memory issues)
                if (currentScreenBuffer.length > 50000) {
                    currentScreenBuffer = currentScreenBuffer.slice(-40000);
                    debugLog(`📋 Screen buffer trimmed to prevent memory issues`);
                }
            }
            
            // Update last output time
            lastOutputTime = Date.now();
        };

        claudeProcess.stdout.on('data', dataListener);
        
        // Start the screen analysis
        screenAnalysisTimer = setTimeout(analyzeCurrentScreen, SCREEN_ANALYSIS_INTERVAL_MS);
    });
}

async function processNextMessage(): Promise<void> {
    debugLog('--- PROCESSING NEXT MESSAGE ---');
    
    if (!processingQueue || messageQueue.length === 0) {
        debugLog('No processing needed - queue empty or processing stopped');
        processingQueue = false;
        updateWebviewContent();
        updateSessionState();
        if (messageQueue.length === 0) {
            vscode.window.showInformationMessage('All messages processed. Claude session remains active.');
            debugLog('✓ All messages processed');
        }
        return;
    }

    const message = messageQueue.find(m => m.status === 'pending');
    if (!message) {
        debugLog('No pending messages found');
        processingQueue = false;
        updateWebviewContent();
        updateSessionState();
        vscode.window.showInformationMessage('No pending messages to process');
        return;
    }

    if (!claudeProcess) {
        debugLog('❌ Claude process not available');
        vscode.window.showWarningMessage('Claude session not started. Please start Claude session first.');
        processingQueue = false;
        return;
    }

    if (!sessionReady) {
        debugLog('❌ Claude session not ready');
        vscode.window.showWarningMessage('Claude session not ready. Please wait for Claude to be ready first.');
        processingQueue = false;
        return;
    }

    debugLog(`📋 Processing message #${message.id}: ${message.text.substring(0, 50)}...`);
    message.status = 'processing';
    currentMessage = message;
    updateWebviewContent();

    try {
        // Claude is already ready (sessionReady = true), so send message immediately
        debugLog('⏰ Claude is ready, sending message...');
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
        
        await sendMessageToClaudeProcess(message);
        
        // Wait for Claude to finish processing and show prompt again
        debugLog('⏰ Waiting for Claude to process message and show prompt...');
        await waitForPrompt();
        
        debugLog(`✓ Message #${message.id} completed`);
        message.status = 'completed';
        message.completedAt = new Date().toISOString();
        updateWebviewContent();
        
        // Process next message after a delay
        setTimeout(() => {
            debugLog('Processing next message after delay...');
            processNextMessage();
        }, 1000);
        
    } catch (error) {
        debugLog(`❌ Error processing message #${message.id}: ${error}`);
        message.status = 'error';
        message.error = `Processing failed: ${error}`;
        updateWebviewContent();
        
        // Continue with next message
        setTimeout(() => {
            processNextMessage();
        }, 1000);
    }
}

async function sendMessageToClaudeProcess(message: MessageItem, retryCount: number = 0): Promise<void> {
    const maxRetries = 3;
    
    if (!claudeProcess || !claudeProcess.stdin) {
        if (retryCount < maxRetries) {
            debugLog(`❌ Claude process not available, attempting to restart (retry ${retryCount + 1}/${maxRetries})`);
            
            // Try to restart Claude session
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            startClaudeSession(true);
            
            // Wait for session to be ready
            await new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    if (sessionReady && claudeProcess) {
                        clearInterval(checkInterval);
                        resolve(void 0);
                    }
                }, 1000);
                
                // Timeout after 30 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error('Claude session restart timeout'));
                }, 30000);
            });
            
            // Retry sending the message
            return sendMessageToClaudeProcess(message, retryCount + 1);
        } else {
            throw new Error(`Claude process not available after ${maxRetries} retries`);
        }
    }

    try {
        debugLog(`📝 Sending message to Claude process: "${message.text}"`);
        
        // Check if stdin is writable
        if (claudeProcess.stdin.destroyed || !claudeProcess.stdin.writable) {
            throw new Error('Claude process stdin is not writable');
        }
        
        // Send the message text
        claudeProcess.stdin.write(message.text);
        
        // Small delay before sending carriage return
        await new Promise(resolve => setTimeout(resolve, 300));
        
        debugLog(`📝 Sending carriage return to submit message...`);
        
        // Check again before sending carriage return
        if (claudeProcess.stdin.destroyed || !claudeProcess.stdin.writable) {
            throw new Error('Claude process stdin became unavailable');
        }
        
        // Send carriage return to submit the message
        claudeProcess.stdin.write('\r');
        
        debugLog(`✓ Message sent to Claude process successfully`);
        
    } catch (error) {
        debugLog(`❌ Error sending message to Claude: ${error}`);
        
        if (retryCount < maxRetries) {
            debugLog(`🔄 Retrying message send (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
            return sendMessageToClaudeProcess(message, retryCount + 1);
        } else {
            throw new Error(`Failed to send message after ${maxRetries} retries: ${error}`);
        }
    }
}

function startClaudeSession(skipPermissions: boolean = true): void {
    if (debugMode) {
        console.log('Starting Claude session...');
    }
    debugLog('=== STARTING CLAUDE SESSION ===');
    
    // Check if Claude process is already running
    if (claudeProcess) {
        vscode.window.showInformationMessage('Claude session is already running');
        debugLog('Claude session already running - aborting');
        return;
    }

    // Get the current workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const cwd = workspaceFolder?.uri.fsPath || process.cwd();
    
    debugLog(`Working directory: ${cwd}`);
    debugLog('Spawning Claude process...');
    
    // Start Claude using Python PTY wrapper for proper TTY allocation
    // This creates a real pseudo-terminal that Claude CLI recognizes as interactive
    const wrapperPath = path.join(__dirname, 'claude_pty_wrapper.py');
    const args = [wrapperPath];
    if (skipPermissions) {
        args.push('--skip-permissions');
    }
    claudeProcess = spawn('python3', args, {
        cwd: cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
            ...process.env,
            TERM: 'xterm-256color',
            COLUMNS: '120',
            LINES: '30'
        }
    });

    if (!claudeProcess) {
        vscode.window.showErrorMessage('Failed to start Claude process');
        debugLog('✗ Failed to start Claude process');
        return;
    }

    if (debugMode) {
        console.log('Claude process started with PID:', claudeProcess.pid);
    }
    debugLog(`✓ Claude process started successfully`);
    debugLog(`Process PID: ${claudeProcess.pid}`);
    
    // Handle stdout (Claude's responses)
    claudeProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        if (debugMode) {
            console.log('Claude stdout:', output);
        }
        
        // Send Claude output to webview
        sendClaudeOutput(output);
        
        // Check for usage limit - be more specific about the pattern
        if (output.includes('Claude usage limit reached') || output.includes('usage limit reached')) {
            debugLog('⚠️ USAGE LIMIT DETECTED');
            debugLog(`📋 Usage limit output: ${output}`);
            if (currentMessage) {
                handleUsageLimit(output, currentMessage);
            }
            return;
        }
        
        // Check for authentication errors
        const authErrors = ['authentication', 'login', 'unauthorized'];
        const isAuthError = authErrors.some(authError => output.includes(authError));
        
        if (isAuthError) {
            debugLog('🔐 AUTHENTICATION ERROR detected');
            sessionReady = false;
            if (currentMessage) {
                currentMessage.status = 'error';
                currentMessage.error = 'Claude CLI authentication failed';
                updateWebviewContent();
            }
            vscode.window.showErrorMessage('Claude CLI authentication failed');
            return;
        }
        
        // Session ready detection - look for permission prompts or ready indicator
        const permissionPrompts = [
            'Do you want to make this edit to',
            'Do you want to create',
            'Do you want to delete',
            'Do you want to read',
            'Would you like to',
            'Proceed with',
            'Continue?'
        ];
        
        const hasPermissionPrompt = permissionPrompts.some(prompt => output.includes(prompt));
        
        if (hasPermissionPrompt && !sessionReady) {
            debugLog('🔐 Permission prompt detected during startup - session ready for user interaction');
            sessionReady = true;
            startHealthCheck(); // Start monitoring Claude process health
            updateSessionState();
            if (debugMode) {
                console.log('Claude session is ready (permission prompt)');
            }
            vscode.window.showInformationMessage('Claude is asking for permission. Use the Claude output area to navigate and select your choice.');
        } else if (output.includes('? for shortcuts') && !sessionReady) {
            debugLog('✅ Claude ready prompt detected during startup');
            sessionReady = true;
            startHealthCheck(); // Start monitoring Claude process health
            updateSessionState();
            if (debugMode) {
                console.log('Claude session is ready');
            }
            vscode.window.showInformationMessage('Claude session started and ready! You can now process the message queue.');
        }
    });

    // Handle stderr (errors and status messages)
    claudeProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        if (debugMode) {
            console.log('Claude stderr:', error);
        }
        
        debugLog(`📥 STDERR: ${error}`);
        
        // Send error to webview
        const formattedError = formatTerminalOutput(error, 'error');
        sendToWebviewTerminal(formattedError);
    });

    // Handle process exit
    claudeProcess.on('close', (code: number | null) => {
        if (debugMode) {
            console.log('Claude process closed with code:', code);
        }
        debugLog(`🔚 PROCESS CLOSED with code: ${code}`);
        sessionReady = false;
        stopHealthCheck(); // Stop health monitoring
        
        // Flush any remaining Claude output
        if (claudeOutputTimer) {
            clearTimeout(claudeOutputTimer);
            claudeOutputTimer = null;
        }
        flushClaudeOutput();
        
        // Clear buffers
        claudeOutputBuffer = '';
        claudeCurrentScreen = '';
        
        const wasProcessing = processingQueue;
        processingQueue = false; // Stop processing queue immediately
        
        const closeMessage = formatTerminalOutput(`Claude process closed with code: ${code}`, 'info');
        sendToWebviewTerminal(closeMessage);
        
        // Handle current message if processing
        if (currentMessage && currentMessage.status === 'processing') {
            debugLog(`❌ Current message #${currentMessage.id} marked as error due to process closure`);
            currentMessage.status = 'error';
            currentMessage.error = `Claude process closed unexpectedly (code: ${code})`;
            currentMessage = null;
        }
        
        // Clear the process reference
        claudeProcess = null;
        
        // Update UI state
        updateWebviewContent();
        updateSessionState();
        
        // Notify user based on context
        if (wasProcessing) {
            vscode.window.showWarningMessage('Claude process closed unexpectedly while processing. You can restart the session.');
        } else {
            vscode.window.showInformationMessage('Claude session ended');
        }
        debugLog('=== CLAUDE SESSION ENDED ===');
    });

    // Handle process error
    claudeProcess.on('error', (error: Error) => {
        if (debugMode) {
            console.error('Claude process error:', error);
        }
        debugLog(`💥 PROCESS ERROR: ${error.message}`);
        
        sessionReady = false;
        stopHealthCheck(); // Stop health monitoring
        
        // Flush any remaining Claude output
        if (claudeOutputTimer) {
            clearTimeout(claudeOutputTimer);
            claudeOutputTimer = null;
        }
        flushClaudeOutput();
        
        // Clear buffers
        claudeOutputBuffer = '';
        claudeCurrentScreen = '';
        
        const wasProcessing = processingQueue;
        processingQueue = false; // Stop processing immediately
        
        const errorMessage = formatTerminalOutput(`Claude process error: ${error.message}`, 'error');
        sendToWebviewTerminal(errorMessage);
        
        // Handle current message if processing
        if (currentMessage && currentMessage.status === 'processing') {
            debugLog(`❌ Current message #${currentMessage.id} marked as error due to process error`);
            currentMessage.status = 'error';
            currentMessage.error = `Claude process error: ${error.message}`;
            currentMessage = null;
        }
        
        // Clear the process reference
        claudeProcess = null;
        
        // Update UI state
        updateWebviewContent();
        updateSessionState();
        
        // Show appropriate error message
        if (wasProcessing) {
            vscode.window.showErrorMessage(`Claude process error while processing: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Claude process error: ${error.message}`);
        }
        debugLog('=== CLAUDE SESSION ENDED WITH ERROR ===');
    });
}

function calculateWaitTime(resetTime: string): number {
    // Default to 60 minutes if can't parse
    if (resetTime === 'unknown time') {
        return 60;
    }
    
    try {
        // Parse the reset time (e.g., "2:30 PM", "14:30", "9pm (Asia/Jerusalem)")
        const now = new Date();
        
        // Clean up the time string - remove timezone info and normalize
        const cleanTime = resetTime.replace(/\s*\([^)]+\)/, '').trim();
        const [timePart, ampm] = cleanTime.split(' ');
        
        // Handle cases like "9pm" vs "9:00 PM"
        let hours: number, minutes: number;
        if (timePart.includes(':')) {
            [hours, minutes] = timePart.split(':').map(Number);
        } else {
            // Handle "9pm" format
            hours = parseInt(timePart.replace(/[^\d]/g, ''));
            minutes = 0;
        }
        
        const resetDate = new Date(now);
        let resetHours = hours;
        
        // Handle AM/PM format (case insensitive)
        if (ampm || /[ap]m/i.test(timePart)) {
            const isPM = /pm/i.test(ampm || timePart);
            const isAM = /am/i.test(ampm || timePart);
            
            if (isPM && hours !== 12) {
                resetHours = hours + 12;
            } else if (isAM && hours === 12) {
                resetHours = 0;
            }
        }
        
        resetDate.setHours(resetHours, minutes, 0, 0);
        
        // If reset time is in the past, assume it's tomorrow
        if (resetDate <= now) {
            resetDate.setDate(resetDate.getDate() + 1);
        }
        
        const waitMs = resetDate.getTime() - now.getTime();
        return Math.max(1, Math.ceil(waitMs / (1000 * 60))); // At least 1 minute
    } catch (error) {
        if (debugMode) {
            console.error('Error parsing reset time:', error);
        }
        return 60; // Default to 60 minutes
    }
}

function handleUsageLimit(output: string, message: MessageItem): void {
    // Extract reset time from Claude's usage limit message - handle timezone format
    const resetTimeMatch = output.match(/reset at (\d{1,2}[:\d]*(?:\s*[APM]{2})?(?:\s*\([^)]+\))?)/i);
    const resetTime = resetTimeMatch ? resetTimeMatch[1] : 'unknown time';
    
    // Stop current processing
    processingQueue = false;
    
    // Mark current message as completed (Claude did work on it before hitting limit)
    message.status = 'completed';
    message.completedAt = new Date().toISOString();
    message.output = 'Completed but hit usage limit';
    
    // Check if we already have a continue message waiting - don't add duplicates
    const existingContinue = messageQueue.find(msg => msg.text === 'continue' && msg.status === 'waiting');
    if (existingContinue) {
        debugLog('⚠️ Continue message already exists - not adding duplicate');
        return;
    }
    
    // Find the index of the current completed message
    const currentMessageIndex = messageQueue.findIndex(msg => msg.id === message.id);
    
    // Create a "continue" message to resume the conversation
    const continueMessage: MessageItem = {
        id: Date.now() + 1, // Ensure unique ID
        text: 'continue',
        timestamp: new Date().toISOString(),
        status: 'waiting',
        error: `Usage limit reached - will resume at ${resetTime}`,
        waitUntil: Date.now() + (calculateWaitTime(resetTime) * 60 * 1000)
    };
    
    // Add continue message right after the completed message
    if (currentMessageIndex >= 0) {
        messageQueue.splice(currentMessageIndex + 1, 0, continueMessage);
    } else {
        // Fallback: add to end if we can't find current message
        messageQueue.push(continueMessage);
    }
    
    updateWebviewContent();
    
    // Calculate wait time until reset (default to 1 hour if can't parse)
    const waitMinutes = calculateWaitTime(resetTime);
    const waitSeconds = waitMinutes * 60;
    
    vscode.window.showWarningMessage(`Claude usage limit reached. Added "continue" message to queue. Will automatically resume processing at ${resetTime} (${waitMinutes} minutes)`);
    
    // Start countdown timer for the continue message
    startCountdownTimer(continueMessage, waitSeconds);
    
    // Start sleep prevention if enabled
    startSleepPrevention();
}



function startCountdownTimer(message: MessageItem, waitSeconds: number): void {
    // Clear any existing timers
    if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    
    let remainingSeconds = waitSeconds;
    
    // Update the waitUntil timestamp based on remaining seconds
    message.waitUntil = Date.now() + (remainingSeconds * 1000);
    
    countdownInterval = setInterval(() => {
        remainingSeconds--;
        message.waitSeconds = remainingSeconds;
        
        // Double-check against absolute time to handle system sleep/wake
        const timeLeft = Math.max(0, Math.floor((message.waitUntil! - Date.now()) / 1000));
        if (timeLeft !== remainingSeconds) {
            remainingSeconds = timeLeft;
            message.waitSeconds = remainingSeconds;
        }
        
        updateWebviewContent();

        if (remainingSeconds <= 0) {
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
            
            // Resume processing automatically
            resumeProcessingFromWait(message);
        }
    }, 1000);

    resumeTimer = setTimeout(() => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        resumeProcessingFromWait(message);
    }, remainingSeconds * 1000);
}

function resumeProcessingFromWait(message: MessageItem): void {
    message.status = 'pending';
    message.error = undefined;
    message.waitSeconds = undefined;
    message.waitUntil = undefined;
    updateWebviewContent();
    saveWorkspaceHistory(); // Save the updated queue state
    
    // Stop sleep prevention when resuming
    stopSleepPrevention();
    
    vscode.window.showInformationMessage('Usage limit has reset. Resuming processing with "continue" message...');
    
    // Resume processing if we were processing before
    if (!processingQueue) {
        processingQueue = true;
        updateSessionState();
        setTimeout(() => {
            processNextMessage();
        }, 2000); // 2 second delay before resuming
    }
}

function recoverWaitingMessages(): void {
    const now = Date.now();
    
    messageQueue.forEach(message => {
        if (message.status === 'waiting' && message.waitUntil) {
            const timeLeft = Math.max(0, Math.floor((message.waitUntil - now) / 1000));
            
            if (timeLeft <= 0) {
                // Time has already passed - resume immediately
                debugLog(`⏰ Timer expired for message ${message.id} - resuming immediately`);
                resumeProcessingFromWait(message);
            } else {
                // Still time left - restart the countdown
                debugLog(`⏰ Recovering timer for message ${message.id} - ${timeLeft} seconds remaining`);
                message.waitSeconds = timeLeft;
                startCountdownTimer(message, timeLeft);
                // Start sleep prevention if we're recovering a waiting timer
                startSleepPrevention();
            }
        }
    });
}

function startSleepPrevention(): void {
    const config = vscode.workspace.getConfiguration('claudeLoop');
    const preventSleep = config.get<boolean>('preventSleep', false);
    
    if (!preventSleep || sleepPreventionActive) {
        return;
    }
    
    try {
        const platform = os.platform();
        let command: string;
        let args: string[];
        
        switch (platform) {
            case 'darwin': // macOS
                command = 'caffeinate';
                args = ['-d']; // Prevent display sleep
                break;
            case 'win32': // Windows
                command = 'powershell';
                args = ['-Command', 'Add-Type -Assembly System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState("Hibernate", $false, $false)'];
                break;
            case 'linux': // Linux
                command = 'systemd-inhibit';
                args = ['--what=sleep', '--who=ClaudeLoop', '--why=Waiting for Claude usage limit reset', 'sleep', '999999'];
                break;
            default:
                debugLog('❌ Sleep prevention not supported on this platform');
                return;
        }
        
        sleepPreventionProcess = spawn(command, args);
        sleepPreventionActive = true;
        
        sleepPreventionProcess.on('error', (error) => {
            debugLog(`❌ Sleep prevention failed: ${error.message}`);
            sleepPreventionActive = false;
            sleepPreventionProcess = null;
        });
        
        sleepPreventionProcess.on('exit', () => {
            debugLog('🛌 Sleep prevention ended');
            sleepPreventionActive = false;
            sleepPreventionProcess = null;
        });
        
        debugLog('☕ Sleep prevention started');
        vscode.window.showInformationMessage('Sleep prevention enabled while waiting for Claude usage limit reset');
        
    } catch (error) {
        debugLog(`❌ Failed to start sleep prevention: ${error}`);
    }
}

function stopSleepPrevention(): void {
    if (!sleepPreventionActive || !sleepPreventionProcess) {
        return;
    }
    
    try {
        sleepPreventionProcess.kill();
        sleepPreventionProcess = null;
        sleepPreventionActive = false;
        debugLog('🛌 Sleep prevention stopped');
    } catch (error) {
        debugLog(`❌ Failed to stop sleep prevention: ${error}`);
    }
}

function toggleSleepPreventionSetting(enabled: boolean): void {
    const config = vscode.workspace.getConfiguration('claudeLoop');
    config.update('preventSleep', enabled, vscode.ConfigurationTarget.Global);
    debugLog(`💤 Sleep prevention setting updated: ${enabled}`);
    
    // If disabling and currently active, stop sleep prevention
    if (!enabled && sleepPreventionActive) {
        stopSleepPrevention();
    }
}

function sendSleepPreventionSetting(): void {
    const config = vscode.workspace.getConfiguration('claudeLoop');
    const preventSleep = config.get<boolean>('preventSleep', false);
    
    if (claudePanel) {
        claudePanel.webview.postMessage({
            command: 'setSleepPreventionSetting',
            enabled: preventSleep
        });
    }
}

function updateWebviewContent(): void {
    if (claudePanel) {
        claudePanel.webview.postMessage({
            command: 'updateQueue',
            queue: messageQueue
        });
    }
}

function updateSessionState(): void {
    if (claudePanel) {
        claudePanel.webview.postMessage({
            command: 'sessionStateChanged',
            isSessionRunning: sessionReady,
            isProcessing: processingQueue
        });
    }
}

function sendToWebviewTerminal(output: string): void {
    if (claudePanel) {
        claudePanel.webview.postMessage({
            command: 'terminalOutput',
            output: output
        });
    }
}

function formatTerminalOutput(text: string, type: 'claude' | 'debug' | 'error' | 'info' | 'success'): string {
    // Add milliseconds to the timestamp
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

function sendClaudeOutput(output: string): void {
    // Add output to buffer
    claudeOutputBuffer += output;
    
    // Check buffer size and truncate if too large
    if (claudeOutputBuffer.length > CLAUDE_OUTPUT_MAX_BUFFER_SIZE) {
        debugLog(`📦 Buffer too large (${claudeOutputBuffer.length} chars), truncating...`);
        claudeOutputBuffer = claudeOutputBuffer.substring(claudeOutputBuffer.length - (CLAUDE_OUTPUT_MAX_BUFFER_SIZE * 0.75));
    }
    
    // Check if buffer contains ANSI clear screen sequence
    let foundClearScreen = false;
    let lastClearScreenIndex = -1;
    
    for (const pattern of ANSI_CLEAR_SCREEN_PATTERNS) {
        const index = claudeOutputBuffer.lastIndexOf(pattern);
        if (index > lastClearScreenIndex) {
            lastClearScreenIndex = index;
            foundClearScreen = true;
        }
    }
    
    if (foundClearScreen) {
        debugLog(`🖥️  Clear screen detected - reset screen buffer`);
        // Update current screen to content from last clear screen to end
        const newScreen = claudeOutputBuffer.substring(lastClearScreenIndex);
        claudeCurrentScreen = newScreen;
        
        // Keep only the current screen content in buffer for future appends
        claudeOutputBuffer = claudeCurrentScreen;
    } else {
        // No clear screen yet, current screen is the entire buffer
        claudeCurrentScreen = claudeOutputBuffer;
    }
    
    // Always throttle updates - no immediate sending
    const now = Date.now();
    const timeSinceLastOutput = now - lastClaudeOutputTime;
    
    if (timeSinceLastOutput >= CLAUDE_OUTPUT_THROTTLE_MS) {
        // Send when enough time has passed
        flushClaudeOutput();
    } else {
        // Schedule a delayed flush for rapid updates
        if (!claudeOutputTimer) {
            const delay = CLAUDE_OUTPUT_THROTTLE_MS - timeSinceLastOutput;
            claudeOutputTimer = setTimeout(() => {
                flushClaudeOutput();
            }, delay);
        }
    }
    
    // Set up auto-clear timer if not already set
    if (!claudeAutoClearTimer) {
        claudeAutoClearTimer = setTimeout(() => {
            clearClaudeOutput();
        }, CLAUDE_OUTPUT_AUTO_CLEAR_MS);
    }
}

function flushClaudeOutput(): void {
    if (claudeCurrentScreen.length === 0) {
        return;
    }
    
    const output = claudeCurrentScreen;
    lastClaudeOutputTime = Date.now();
    
    // Clear the timer
    if (claudeOutputTimer) {
        clearTimeout(claudeOutputTimer);
        claudeOutputTimer = null;
    }
    
    debugLog(`📤 Sending Claude current screen (${output.length} chars)`);
    
    // Send to webview
    if (claudePanel) {
        claudePanel.webview.postMessage({
            command: 'claudeOutput',
            output: output
        });
    }
    
    // Send to terminal with colored formatting
    const formattedOutput = formatTerminalOutput(output, 'claude');
    sendToWebviewTerminal(formattedOutput);
}

function clearClaudeOutput(): void {
    debugLog(`🧹 Auto-clearing Claude output buffer (${claudeCurrentScreen.length} chars)`);
    
    // Clear buffers
    claudeOutputBuffer = '';
    claudeCurrentScreen = '';
    
    // Clear timers
    if (claudeOutputTimer) {
        clearTimeout(claudeOutputTimer);
        claudeOutputTimer = null;
    }
    if (claudeAutoClearTimer) {
        clearTimeout(claudeAutoClearTimer);
        claudeAutoClearTimer = null;
    }
    
    // Send clear command to webview
    if (claudePanel) {
        claudePanel.webview.postMessage({
            command: 'clearClaudeOutput'
        });
    }
    
    debugLog(`✨ Claude output cleared and ready for new content`);
}

function handleClaudeKeypress(key: string): void {
    if (!claudeProcess || !claudeProcess.stdin) {
        debugLog(`❌ Cannot send keypress: Claude process not available`);
        return;
    }

    debugLog(`⌨️  Sending keypress: ${key}`);
    
    switch (key) {
        case 'up':
            claudeProcess.stdin.write('\x1b[A'); // Up arrow
            break;
        case 'down':
            claudeProcess.stdin.write('\x1b[B'); // Down arrow
            break;
        case 'left':
            claudeProcess.stdin.write('\x1b[D'); // Left arrow
            break;
        case 'right':
            claudeProcess.stdin.write('\x1b[C'); // Right arrow
            break;
        case 'enter':
            claudeProcess.stdin.write('\r'); // Enter key
            break;
        case 'escape':
            claudeProcess.stdin.write('\x1b'); // Escape key
            break;
        default:
            debugLog(`❌ Unknown key: ${key}`);
    }
}

function debugLog(message: string): void {
    if (debugMode) {
        const formattedMessage = formatTerminalOutput(message, 'debug');
        console.log(formattedMessage);
        sendToWebviewTerminal(formattedMessage + '\n');
    }
}



function getWebviewContent(context: vscode.ExtensionContext): string {
    const htmlPath = path.join(context.extensionPath, 'src', 'webview', 'index.html');
    const cssPath = path.join(context.extensionPath, 'src', 'webview', 'styles.css');
    const jsPath = path.join(context.extensionPath, 'src', 'webview', 'script.js');
    
    try {
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        // Get URIs for CSS and JS files that are accessible by the webview
        const cssUri = claudePanel?.webview.asWebviewUri(vscode.Uri.file(cssPath));
        const jsUri = claudePanel?.webview.asWebviewUri(vscode.Uri.file(jsPath));
        
        // Replace relative paths with webview URIs
        html = html.replace('href="styles.css"', `href="${cssUri}"`);
        html = html.replace('src="script.js"', `src="${jsUri}"`);
        
        return html;
    } catch (error) {
        if (debugMode) {
            console.error('Error reading webview HTML file:', error);
        }
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>ClaudeLoop</title>
                <style>
                    body { 
                        font-family: Arial, sans-serif; 
                        padding: 20px; 
                        background-color: var(--vscode-editor-background);
                        color: var(--vscode-editor-foreground);
                    }
                    .error { 
                        color: var(--vscode-charts-red); 
                        font-weight: bold; 
                    }
                </style>
            </head>
            <body>
                <h1>ClaudeLoop</h1>
                <p class="error">Error loading webview content. Please check the HTML file.</p>
            </body>
            </html>
        `;
    }
}

// Health Check Functions
function isClaudeProcessHealthy(): boolean {
    if (!claudeProcess) {
        return false;
    }
    
    // Check if process exists and is running
    if (claudeProcess.killed || claudeProcess.exitCode !== null) {
        debugLog('❌ Claude process is killed or exited');
        return false;
    }
    
    // Check if stdin is writable
    if (!claudeProcess.stdin || claudeProcess.stdin.destroyed || !claudeProcess.stdin.writable) {
        debugLog('❌ Claude process stdin is not writable');
        return false;
    }
    
    return true;
}

function startHealthCheck(): void {
    // Clear any existing health check
    if (healthCheckTimer) {
        clearTimeout(healthCheckTimer);
    }
    
    healthCheckTimer = setInterval(() => {
        if (sessionReady && !isClaudeProcessHealthy()) {
            debugLog('🩺 Health check failed - Claude process is unhealthy');
            
            // Reset session state
            sessionReady = false;
            claudeProcess = null;
            
            // Stop processing if active
            if (processingQueue) {
                processingQueue = false;
                
                // Mark current message as error
                if (currentMessage && currentMessage.status === 'processing') {
                    currentMessage.status = 'error';
                    currentMessage.error = 'Claude process became unhealthy';
                    currentMessage = null;
                }
            }
            
            // Update UI
            updateWebviewContent();
            updateSessionState();
            
            // Clear health check since process is dead
            if (healthCheckTimer) {
                clearTimeout(healthCheckTimer);
                healthCheckTimer = null;
            }
            
            vscode.window.showWarningMessage('Claude process became unhealthy. Please restart the session.');
        }
    }, HEALTH_CHECK_INTERVAL_MS);
    
    debugLog('🩺 Started health monitoring for Claude process');
}

function stopHealthCheck(): void {
    if (healthCheckTimer) {
        clearTimeout(healthCheckTimer);
        healthCheckTimer = null;
        debugLog('🩺 Stopped health monitoring');
    }
}

export function deactivate(): void {
    // Save pending messages before closing
    savePendingQueue();
    
    // Clear Claude output timer and flush any remaining output
    if (claudeOutputTimer) {
        clearTimeout(claudeOutputTimer);
        claudeOutputTimer = null;
    }
    flushClaudeOutput();
    
    // Clear buffers
    claudeOutputBuffer = '';
    claudeCurrentScreen = '';
    
    stopClaudeLoop();
} 