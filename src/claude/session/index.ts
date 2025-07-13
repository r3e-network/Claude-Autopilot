import * as vscode from 'vscode';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
    claudeProcess, sessionReady, currentMessage, processingQueue,
    setClaudeProcess, setSessionReady, setCurrentMessage, setProcessingQueue
} from '../../core/state';
import { debugLog, formatTerminalOutput, sendToWebviewTerminal } from '../../utils/logging';
import { updateWebviewContent, updateSessionState } from '../../ui/webview';
import { sendClaudeOutput } from '../../claude/output';
import { handleUsageLimit, isCurrentUsageLimit } from '../../services/usage';
import { startHealthCheck, stopHealthCheck } from '../../services/health';
import { startSleepPrevention, stopSleepPrevention } from '../../services/sleep';
import { runDependencyCheck, showDependencyStatus } from '../../services/dependency-check';

export function startClaudeSession(skipPermissions: boolean = true): void {
    debugLog('=== STARTING CLAUDE SESSION ===');
    
    if (claudeProcess) {
        vscode.window.showInformationMessage('Claude session is already running');
        debugLog('Claude session already running - aborting');
        return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const cwd = workspaceFolder?.uri.fsPath || process.cwd();
    
    debugLog(`Working directory: ${cwd}`);
    debugLog('Spawning Claude process...');
    
    const wrapperPath = path.join(__dirname, 'claude_pty_wrapper.py');
    const args = [wrapperPath];
    if (skipPermissions) {
        args.push('--skip-permissions');
    }
    
    const spawnedProcess = spawn('python3', args, {
        cwd: cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
            ...process.env,
            TERM: 'xterm-256color',
            COLUMNS: '120',
            LINES: '30'
        }
    });

    if (!spawnedProcess) {
        vscode.window.showErrorMessage('Failed to start Claude process');
        debugLog('✗ Failed to start Claude process');
        return;
    }

    setClaudeProcess(spawnedProcess);
    debugLog(`✓ Claude process started successfully`);
    debugLog(`Process PID: ${spawnedProcess.pid}`);
    
    spawnedProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        
        sendClaudeOutput(output);
        
        if (output.includes('Claude usage limit reached') || output.includes('usage limit reached')) {
            debugLog('⚠️ POTENTIAL USAGE LIMIT DETECTED');
            debugLog(`📋 Usage limit output: ${output}`);
            if (currentMessage && isCurrentUsageLimit(output)) {
                debugLog('✅ Confirmed: This is a current usage limit');
                handleUsageLimit(output, currentMessage);
            } else {
                debugLog('⚠️ Skipped: Usage limit is old or not within 6-hour window');
            }
            return;
        }
        
        const claudeAuthErrors = [
            'Claude CLI authentication failed',
            'Please authenticate with Claude'
        ];
        const isAuthError = claudeAuthErrors.some(authError => output.includes(authError));
        
        if (isAuthError) {
            debugLog('🔐 AUTHENTICATION ERROR detected');
            setSessionReady(false);
            if (currentMessage) {
                currentMessage.status = 'error';
                currentMessage.error = 'Claude CLI authentication failed';
                updateWebviewContent();
            }
            vscode.window.showErrorMessage('Claude CLI authentication failed');
            return;
        }
        
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
            setSessionReady(true);
            startHealthCheck();
            startSleepPrevention();
            updateSessionState();
            vscode.window.showInformationMessage('Claude is asking for permission. Use the Claude output area to navigate and select your choice.');
        } else if (output.includes('? for shortcuts') && !sessionReady) {
            debugLog('✅ Claude ready prompt detected during startup');
            setSessionReady(true);
            startHealthCheck();
            startSleepPrevention();
            updateSessionState();
            vscode.window.showInformationMessage('Claude session started and ready! You can now process the message queue.');
        }
    });

    spawnedProcess.stderr?.on('data', (data: Buffer) => {
        const error = data.toString();
        debugLog(`📥 STDERR: ${error}`);
        
        const formattedError = formatTerminalOutput(error, 'error');
        sendToWebviewTerminal(formattedError);
    });

    spawnedProcess.on('close', (code: number | null) => {
        debugLog(`🔚 PROCESS CLOSED with code: ${code}`);
        setSessionReady(false);
        stopHealthCheck();
        stopSleepPrevention();
        
        // Output flushing handled elsewhere
        
        const wasProcessing = processingQueue;
        setProcessingQueue(false);
        
        const closeMessage = formatTerminalOutput(`Claude process closed with code: ${code}`, 'info');
        sendToWebviewTerminal(closeMessage);
        
        if (currentMessage && currentMessage.status === 'processing') {
            debugLog(`❌ Current message #${currentMessage.id} marked as error due to process closure`);
            currentMessage.status = 'error';
            currentMessage.error = `Claude process closed unexpectedly (code: ${code})`;
            setCurrentMessage(null);
        }
        
        setClaudeProcess(null);
        
        updateWebviewContent();
        updateSessionState();
        
        if (wasProcessing) {
            vscode.window.showWarningMessage('Claude process closed unexpectedly while processing. You can restart the session.');
        } else {
            vscode.window.showInformationMessage('Claude session ended');
        }
        debugLog('=== CLAUDE SESSION ENDED ===');
    });

    spawnedProcess.on('error', (error: Error) => {
        debugLog(`💥 PROCESS ERROR: ${error.message}`);
        
        setSessionReady(false);
        stopHealthCheck();
        stopSleepPrevention();
        
        // Output flushing handled elsewhere
        
        const wasProcessing = processingQueue;
        setProcessingQueue(false);
        
        const errorMessage = formatTerminalOutput(`Claude process error: ${error.message}`, 'error');
        sendToWebviewTerminal(errorMessage);
        
        if (currentMessage && currentMessage.status === 'processing') {
            debugLog(`❌ Current message #${currentMessage.id} marked as error due to process error`);
            currentMessage.status = 'error';
            currentMessage.error = `Claude process error: ${error.message}`;
            setCurrentMessage(null);
        }
        
        setClaudeProcess(null);
        
        updateWebviewContent();
        updateSessionState();
        
        if (wasProcessing) {
            vscode.window.showErrorMessage(`Claude process error while processing: ${error.message}`);
        } else {
            vscode.window.showErrorMessage(`Claude process error: ${error.message}`);
        }
        debugLog('=== CLAUDE SESSION ENDED WITH ERROR ===');
    });
}

export function resetClaudeSession(): void {
    if (claudeProcess) {
        claudeProcess.kill();
        setClaudeProcess(null);
        setSessionReady(false);
    }
    
    stopSleepPrevention();
    setCurrentMessage(null);
    setProcessingQueue(false);
    
    updateWebviewContent();
    updateSessionState();
    vscode.window.showInformationMessage('Claude session reset. You can now start a new session.');
}

export function handleClaudeKeypress(key: string): void {
    if (!claudeProcess || !claudeProcess.stdin) {
        debugLog(`❌ Cannot send keypress: Claude process not available`);
        return;
    }

    debugLog(`⌨️  Sending keypress: ${key}`);
    
    switch (key) {
        case 'up':
            claudeProcess.stdin.write('\x1b[A');
            break;
        case 'down':
            claudeProcess.stdin.write('\x1b[B');
            break;
        case 'left':
            claudeProcess.stdin.write('\x1b[D');
            break;
        case 'right':
            claudeProcess.stdin.write('\x1b[C');
            break;
        case 'enter':
            claudeProcess.stdin.write('\r');
            break;
        case 'escape':
            claudeProcess.stdin.write('\x1b');
            break;
        default:
            debugLog(`❌ Unknown key: ${key}`);
    }
}