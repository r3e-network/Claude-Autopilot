import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { claudePanel, messageQueue, debugMode, sessionReady, processingQueue } from '../../core/state';
import { debugLog } from '../../utils/logging';
import { getValidatedConfig } from '../../core/config';

export function updateWebviewContent(): void {
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'updateQueue',
                queue: messageQueue
            });
        } catch (error) {
            debugLog(`❌ Failed to update webview content: ${error}`);
        }
    }
}

export function updateSessionState(): void {
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'sessionStateChanged',
                isSessionRunning: sessionReady,
                isProcessing: processingQueue
            });
        } catch (error) {
            debugLog(`❌ Failed to update session state: ${error}`);
        }
    }
}

export function getWebviewContent(context: vscode.ExtensionContext): string {
    const htmlPath = path.join(context.extensionPath, 'out', 'webview', 'index.html');
    const cssPath = path.join(context.extensionPath, 'out', 'webview', 'styles.css');
    const jsPath = path.join(context.extensionPath, 'out', 'webview', 'script.js');
    
    try {
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        const cssUri = claudePanel?.webview.asWebviewUri(vscode.Uri.file(cssPath));
        const jsUri = claudePanel?.webview.asWebviewUri(vscode.Uri.file(jsPath));
        
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
                <title>AutoClaude</title>
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
                <h1>AutoClaude</h1>
                <p class="error">Error loading webview content. Please check the HTML file.</p>
            </body>
            </html>
        `;
    }
}

export function sendHistoryVisibilitySettings(): void {
    const config = getValidatedConfig();
    
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'setHistoryVisibility',
                showInUI: config.history.showInUI
            });
        } catch (error) {
            debugLog(`❌ Failed to send history visibility settings to webview: ${error}`);
        }
    }
}

export function sendSubAgentData(subAgentData: any): void {
    if (claudePanel) {
        try {
            claudePanel.webview.postMessage({
                command: 'updateSubAgents',
                subAgents: subAgentData
            });
        } catch (error) {
            debugLog(`❌ Failed to send sub-agent data to webview: ${error}`);
        }
    }
}