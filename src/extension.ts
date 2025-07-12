import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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



let claudePanel: vscode.WebviewPanel | null = null;
let isRunning = false;
let messageQueue: MessageItem[] = [];
let claudeProcess: ChildProcess | null = null;
let resumeTimer: NodeJS.Timeout | null = null;

// Session state management
let sessionReady = false;
let currentMessage: MessageItem | null = null;
let processingQueue = false;
let debugMode = false; // Enable debug logging (set to true for development)

// Configuration constants
const TIMEOUT_MS = 60 * 60 * 60 * 1000; // 1 hour
const SILENCE_THRESHOLD_MS = 3000; // 3 seconds of silence means Claude is ready

export function activate(context: vscode.ExtensionContext) {
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
    if (isRunning) {
        vscode.window.showInformationMessage('ClaudeLoop is already running');
        return;
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
                case 'startClaudeSession':
                    startClaudeSession(message.skipPermissions);
                    break;
                case 'claudeKeypress':
                    handleClaudeKeypress(message.key);
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

    // Clear resume timer
    if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
    }

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
    updateWebviewContent();
    vscode.window.showInformationMessage(`Message added to queue: ${message.substring(0, 50)}...`);
}

function startProcessingQueue(skipPermissions: boolean = true): void {
    if (messageQueue.length === 0) {
        vscode.window.showWarningMessage('No messages in queue to process');
        return;
    }

    // Auto-start Claude session if not already running
    if (!claudeProcess) {
        vscode.window.showInformationMessage('Starting Claude session...');
        startClaudeSession(skipPermissions);
        
        // Wait for session to be ready then start processing
        const checkReadyInterval = setInterval(() => {
            if (sessionReady) {
                clearInterval(checkReadyInterval);
                processingQueue = true;
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
        
        return;
    }

    processingQueue = true;
    processNextMessage();
}

function stopProcessingQueue(): void {
    processingQueue = false;
    currentMessage = null;
    
    // Stop Claude session when stopping processing
    if (claudeProcess) {
        claudeProcess.kill();
        claudeProcess = null;
        sessionReady = false;
        vscode.window.showInformationMessage('Claude session stopped');
    }
    
    updateWebviewContent();
}

function clearMessageQueue(): void {
    messageQueue = [];
    updateWebviewContent();
    vscode.window.showInformationMessage('Message queue cleared');
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
        let silenceTimer: NodeJS.Timeout | null = null;
        let waitingForPermission = false;
        let promptCursorDetected = false;
        const SILENCE_THRESHOLD_MS = 3000; // 3 seconds of silence means Claude finished processing

        // Regex to detect Claude's prompt cursor ANSI sequence
        const promptCursorRegex = /\\u001b\[2m\\u001b\[38;5;244m│\\u001b\[39m\\u001b\[22m\s>/;

        const timeout = setTimeout(() => {
            if (debugMode) {
                console.error(`\n\nERROR: Timed out after ${TIMEOUT_MS / 1000}s waiting for Claude to finish processing.`);
            }
            if (dataListener && claudeProcess?.stdout) {
                claudeProcess.stdout.removeListener('data', dataListener);
            }
            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }
            reject(new Error('Timeout waiting for Claude to finish processing'));
        }, TIMEOUT_MS);

        const checkForSilence = () => {
            const timeSinceLastOutput = Date.now() - lastOutputTime;
            debugLog(`⏱️  Checking silence: ${timeSinceLastOutput}ms since last output (waiting for permission: ${waitingForPermission}, prompt cursor: ${promptCursorDetected})`);
            
            if (waitingForPermission) {
                // When waiting for permission, don't resolve on silence - wait for user interaction
                debugLog(`🔐 Still waiting for permission prompt response from user`);
                silenceTimer = setTimeout(checkForSilence, 1000); // Check less frequently
                return;
            }
            
            if (timeSinceLastOutput >= SILENCE_THRESHOLD_MS && promptCursorDetected) {
                debugLog(`✅ Claude finished processing! No output for ${timeSinceLastOutput}ms + prompt cursor detected`);
                clearTimeout(timeout);
                if (dataListener && claudeProcess?.stdout) {
                    claudeProcess.stdout.removeListener('data', dataListener);
                }
                if (silenceTimer) {
                    clearTimeout(silenceTimer);
                }
                resolve();
            } else if (timeSinceLastOutput >= SILENCE_THRESHOLD_MS) {
                debugLog(`⏱️  Silence detected but no prompt cursor yet - continuing to wait`);
                silenceTimer = setTimeout(checkForSilence, 500);
            } else {
                // Not enough silence yet, check again in 500ms
                silenceTimer = setTimeout(checkForSilence, 500);
            }
        };

        dataListener = (data: Buffer) => {
            const output = data.toString();
            const jsonOutput = JSON.stringify(output);
            debugLog(`📤 Claude output (${data.length} bytes): ${jsonOutput}`);
            
            // Check for Claude's prompt cursor in the JSON-stringified output
            if (promptCursorRegex.test(jsonOutput)) {
                debugLog(`🎯 PROMPT CURSOR DETECTED: Claude is ready for input`);
                promptCursorDetected = true;
            }
            
            // Check for permission prompts during message processing
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
            
            if (hasPermissionPrompt && !waitingForPermission) {
                debugLog(`🔐 PERMISSION PROMPT DETECTED during message processing: User interaction required`);
                waitingForPermission = true;
                promptCursorDetected = false; // Reset cursor detection for permission flow
                vscode.window.showInformationMessage('Claude is asking for permission. Use the Claude output area to navigate and select your choice.');
            }
            
            // If we were waiting for permission and now see "? for shortcuts", permission was handled
            if (waitingForPermission && output.includes('? for shortcuts')) {
                debugLog(`✅ Permission prompt resolved - back to normal processing`);
                waitingForPermission = false;
                promptCursorDetected = false; // Reset cursor detection after permission
                // Continue with normal silence detection
            }
            
            // Update last output time
            lastOutputTime = Date.now();
            
            // Clear any existing silence timer since we got new output
            if (silenceTimer) {
                clearTimeout(silenceTimer);
            }
            
            // Start checking for silence after a small delay
            silenceTimer = setTimeout(checkForSilence, 500);
        };

        claudeProcess.stdout.on('data', dataListener);
        
        // Start the initial silence check
        silenceTimer = setTimeout(checkForSilence, 500);
    });
}

async function processNextMessage(): Promise<void> {
    debugLog('--- PROCESSING NEXT MESSAGE ---');
    
    if (!processingQueue || messageQueue.length === 0) {
        debugLog('No processing needed - queue empty or processing stopped');
        processingQueue = false;
        updateWebviewContent();
        if (messageQueue.length === 0) {
            vscode.window.showInformationMessage('All messages processed');
            debugLog('✓ All messages processed');
        }
        return;
    }

    const message = messageQueue.find(m => m.status === 'pending');
    if (!message) {
        debugLog('No pending messages found');
        processingQueue = false;
        updateWebviewContent();
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

async function sendMessageToClaudeProcess(message: MessageItem): Promise<void> {
    if (!claudeProcess || !claudeProcess.stdin) {
        throw new Error('Claude process not available');
    }

    debugLog(`📝 Sending message to Claude process: "${message.text}"`);
    
    // Send the message text
    claudeProcess.stdin.write(message.text);
    
    // Small delay before sending carriage return
    await new Promise(resolve => setTimeout(resolve, 300));
    
    debugLog(`📝 Sending carriage return to submit message...`);
    // ★★★ THIS IS THE CRITICAL FIX ★★★
    // We are now sending a Carriage Return to simulate pressing the Enter key.
    claudeProcess.stdin.write('\r');
    
    debugLog(`✓ Message sent to Claude process successfully`);
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
        
        // Check for usage limit
        if (output.includes('Claude usage limit reached')) {
            debugLog('⚠️ USAGE LIMIT DETECTED');
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
            if (debugMode) {
                console.log('Claude session is ready (permission prompt)');
            }
            vscode.window.showInformationMessage('Claude is asking for permission. Use the Claude output area to navigate and select your choice.');
        } else if (output.includes('? for shortcuts') && !sessionReady) {
            debugLog('✅ Claude ready prompt detected during startup');
            sessionReady = true;
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
        claudeProcess = null;
        
        const closeMessage = formatTerminalOutput(`Claude process closed with code: ${code}`, 'info');
        sendToWebviewTerminal(closeMessage);
        
        if (currentMessage && currentMessage.status === 'processing') {
            debugLog(`❌ Current message #${currentMessage.id} marked as error due to process closure`);
            currentMessage.status = 'error';
            currentMessage.error = `Claude process closed unexpectedly (code: ${code})`;
            updateWebviewContent();
            currentMessage = null;
        }
        
        vscode.window.showInformationMessage('Claude session ended');
        debugLog('=== CLAUDE SESSION ENDED ===');
    });

    // Handle process error
    claudeProcess.on('error', (error: Error) => {
        if (debugMode) {
            console.error('Claude process error:', error);
        }
        debugLog(`💥 PROCESS ERROR: ${error.message}`);
        
        sessionReady = false;
        claudeProcess = null;
        
        const errorMessage = formatTerminalOutput(`Claude process error: ${error.message}`, 'error');
        sendToWebviewTerminal(errorMessage);
        
        if (currentMessage && currentMessage.status === 'processing') {
            debugLog(`❌ Current message #${currentMessage.id} marked as error due to process error`);
            currentMessage.status = 'error';
            currentMessage.error = `Claude process error: ${error.message}`;
            updateWebviewContent();
            currentMessage = null;
        }
        
        vscode.window.showErrorMessage(`Claude process error: ${error.message}`);
        debugLog('=== CLAUDE SESSION ENDED WITH ERROR ===');
    });
}

function calculateWaitTime(resetTime: string): number {
    // Default to 60 minutes if can't parse
    if (resetTime === 'unknown time') {
        return 60;
    }
    
    try {
        // Parse the reset time (e.g., "2:30 PM" or "14:30")
        const now = new Date();
        const [timePart, ampm] = resetTime.split(' ');
        const [hours, minutes] = timePart.split(':').map(Number);
        
        const resetDate = new Date(now);
        let resetHours = hours;
        
        // Handle AM/PM format
        if (ampm) {
            if (ampm.toUpperCase() === 'PM' && hours !== 12) {
                resetHours = hours + 12;
            } else if (ampm.toUpperCase() === 'AM' && hours === 12) {
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
    // Extract reset time from Claude's usage limit message
    const resetTimeMatch = output.match(/resets at (\d{1,2}:\d{2}(?:\s*[APM]{2})?)/i);
    const resetTime = resetTimeMatch ? resetTimeMatch[1] : 'unknown time';
    
    // Stop current processing
    processingQueue = false;
    message.status = 'waiting';
    message.error = `Usage limit reached - will resume at ${resetTime}`;
    updateWebviewContent();
    
    // Calculate wait time until reset (default to 1 hour if can't parse)
    const waitMinutes = calculateWaitTime(resetTime);
    const waitSeconds = waitMinutes * 60;
    
    vscode.window.showWarningMessage(`Claude usage limit reached. Will automatically resume processing at ${resetTime} (${waitMinutes} minutes)`);
    
    // Start countdown timer
    startCountdownTimer(message, waitSeconds);
}



function startCountdownTimer(message: MessageItem, waitSeconds: number): void {
    let remainingSeconds = waitSeconds;
    
    const countdownInterval = setInterval(() => {
        remainingSeconds--;
        message.waitSeconds = remainingSeconds;
        updateWebviewContent();

        if (remainingSeconds <= 0) {
            clearInterval(countdownInterval);
            
            // Resume processing automatically
            message.status = 'pending';
            message.error = undefined;
            message.waitSeconds = undefined;
            updateWebviewContent();
            
            vscode.window.showInformationMessage('Usage limit has reset. Resuming processing...');
            
            // Resume processing if we were processing before
            if (!processingQueue) {
                processingQueue = true;
                setTimeout(() => {
                    processNextMessage();
                }, 2000); // 2 second delay before resuming
            }
        }
    }, 1000);

    resumeTimer = setTimeout(() => {
        clearInterval(countdownInterval);
    }, waitSeconds * 1000);
}



function updateWebviewContent(): void {
    if (claudePanel) {
        claudePanel.webview.postMessage({
            command: 'updateQueue',
            queue: messageQueue
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
    const timestamp = new Date().toLocaleTimeString();
    
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
    const htmlPath = path.join(context.extensionPath, 'src', 'webview.html');
    
    try {
        return fs.readFileSync(htmlPath, 'utf8');
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

export function deactivate(): void {
    stopClaudeLoop();
} 