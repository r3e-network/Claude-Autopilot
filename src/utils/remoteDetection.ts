import * as vscode from 'vscode';

/**
 * Detects if VS Code is running in a remote environment
 */
export function isRemoteEnvironment(): boolean {
    return vscode.env.remoteName !== undefined;
}

/**
 * Gets the type of remote environment
 * @returns 'ssh-remote', 'wsl', 'dev-container', 'codespaces', or undefined
 */
export function getRemoteType(): string | undefined {
    return vscode.env.remoteName;
}

/**
 * Checks if the extension can work in the current environment
 */
export async function checkRemoteCompatibility(): Promise<{
    compatible: boolean;
    reason?: string;
    suggestions?: string[];
}> {
    if (!isRemoteEnvironment()) {
        return { compatible: true };
    }

    const remoteType = getRemoteType();
    
    switch (remoteType) {
        case 'ssh-remote':
            return {
                compatible: false,
                reason: 'AutoClaude runs Claude CLI locally but your workspace is on a remote SSH host.',
                suggestions: [
                    'Install the terminal version on your remote host: npm install -g claude-autopilot',
                    'Use autoclaude terminal command on the remote host',
                    'Or work with local files instead of remote SSH'
                ]
            };
            
        case 'wsl':
            return {
                compatible: false,
                reason: 'AutoClaude needs Claude CLI installed in your WSL environment.',
                suggestions: [
                    'Open a WSL terminal and install Claude CLI there',
                    'Install the terminal tool: npm install -g claude-autopilot',
                    'Use autoclaude terminal command in WSL'
                ]
            };
            
        case 'dev-container':
            return {
                compatible: false,
                reason: 'AutoClaude needs Claude CLI installed in your dev container.',
                suggestions: [
                    'Add Claude CLI to your devcontainer.json',
                    'Install in container: npm install -g claude-autopilot',
                    'Use the terminal version inside the container'
                ]
            };
            
        case 'codespaces':
            return {
                compatible: false,
                reason: 'AutoClaude needs Claude CLI in your GitHub Codespace.',
                suggestions: [
                    'Install in terminal: npm install -g claude-autopilot',
                    'Add to your devcontainer.json for persistence',
                    'Use autoclaude terminal command'
                ]
            };
            
        default:
            return {
                compatible: false,
                reason: `AutoClaude may not work correctly in ${remoteType} environment.`,
                suggestions: [
                    'Try installing the terminal version',
                    'Check if Claude CLI is accessible'
                ]
            };
    }
}

/**
 * Shows a warning message for remote environments
 */
export async function showRemoteWarning(): Promise<void> {
    const compatibility = await checkRemoteCompatibility();
    
    if (!compatibility.compatible) {
        const message = compatibility.reason || 'AutoClaude may not work correctly in remote environment.';
        const suggestions = compatibility.suggestions || [];
        
        const choice = await vscode.window.showWarningMessage(
            message,
            'Show Instructions',
            'Continue Anyway',
            'Cancel'
        );
        
        if (choice === 'Show Instructions') {
            const instructionsContent = `
# AutoClaude Remote Environment Instructions

## Issue
${message}

## Solutions

${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Why This Happens

AutoClaude spawns the Claude CLI process locally on your machine, but when using VS Code Remote, your workspace files are on the remote host. This creates a disconnect where Claude can't access your files.

## Recommended Approach

For remote development, we recommend using the **terminal version** of AutoClaude directly on your remote host:

\`\`\`bash
# On your remote host
npm install -g claude-autopilot
autoclaude terminal
\`\`\`

This ensures Claude runs in the same environment as your files.
`;
            
            const doc = await vscode.workspace.openTextDocument({
                content: instructionsContent,
                language: 'markdown'
            });
            
            await vscode.window.showTextDocument(doc);
        } else if (choice === 'Cancel') {
            throw new Error('Operation cancelled due to remote environment');
        }
        // 'Continue Anyway' - let it proceed
    }
}