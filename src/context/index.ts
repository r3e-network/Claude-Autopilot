export { ProjectIndexer, FileInfo, ProjectIndex, ProjectStructure, CodebaseStats } from './projectIndexer';
export { TaskPersistenceManager, PersistedTask, TaskContext, TaskSession, ClaudeMessage, CodeChange } from './taskPersistence';
export { ContextProvider, ContextOptions, EnhancedContext } from './contextProvider';

import * as vscode from 'vscode';
import { ContextProvider } from './contextProvider';
import { debugLog } from '../utils/logging';

let contextProvider: ContextProvider | null = null;

export async function initializeContextSystem(workspaceRoot: string): Promise<ContextProvider> {
    debugLog('Initializing context system...');
    
    contextProvider = ContextProvider.getInstance(workspaceRoot);
    await contextProvider.initialize();
    
    // Set up automatic context updates
    setupContextWatchers();
    
    debugLog('Context system initialized');
    return contextProvider;
}

function setupContextWatchers(): void {
    if (!contextProvider) return;
    
    // Watch for file changes
    const fileWatcher = vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (contextProvider) {
            await contextProvider.trackFileChange(document.uri.fsPath, 'modify');
        }
    });
    
    // Watch for active editor changes
    const editorWatcher = vscode.window.onDidChangeActiveTextEditor(async () => {
        if (contextProvider) {
            // Regenerate quick context when switching files
            contextProvider.getQuickContext();
        }
    });
    
    // Periodic context refresh (every 5 minutes)
    const refreshInterval = setInterval(async () => {
        if (contextProvider) {
            await contextProvider.generateFullContext({
                includeRecentChanges: true,
                includeUnfinishedTasks: true
            });
        }
    }, 5 * 60 * 1000);
    
    // Clean up on dispose
    const disposables = [fileWatcher, editorWatcher];
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        disposables.forEach(d => d.dispose());
        clearInterval(refreshInterval);
        if (contextProvider) {
            contextProvider.dispose();
            contextProvider = null;
        }
    });
}

export function getContextProvider(): ContextProvider | null {
    return contextProvider;
}

export async function updateProjectContext(): Promise<void> {
    if (!contextProvider) {
        debugLog('Context provider not initialized');
        return;
    }
    
    await contextProvider.generateFullContext();
    vscode.window.showInformationMessage('Project context updated successfully');
}

export async function showProjectContext(): Promise<void> {
    if (!contextProvider) {
        vscode.window.showErrorMessage('Context system not initialized');
        return;
    }
    
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;
    
    const contextFile = vscode.Uri.file(`${workspaceRoot}/.autopilot/CLAUDE_CONTEXT.md`);
    
    try {
        const doc = await vscode.workspace.openTextDocument(contextFile);
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage('Failed to open context file');
    }
}