import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { messageQueue } from '../core/state';
import { getValidatedConfig } from '../core/config';
import { debugLog } from '../utils/logging';
import { addMessageToQueueFromWebview } from '../queue';

export interface ExportData {
    version: string;
    exportDate: string;
    queue: any[];
    settings?: any;
    statistics?: {
        totalMessages: number;
        completedMessages: number;
        failedMessages: number;
    };
}

export async function exportQueueCommand(): Promise<void> {
    try {
        // Get save location
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`autoclaude-export-${new Date().toISOString().split('T')[0]}.json`),
            filters: {
                'JSON files': ['json'],
                'All files': ['*']
            },
            saveLabel: 'Export Queue'
        });

        if (!saveUri) {
            return;
        }

        // Prepare export data
        const exportData: ExportData = {
            version: '3.1.0',
            exportDate: new Date().toISOString(),
            queue: messageQueue.filter(msg => msg.status === 'waiting' || msg.status === 'pending'),
            statistics: {
                totalMessages: messageQueue.length,
                completedMessages: messageQueue.filter(msg => msg.status === 'completed').length,
                failedMessages: messageQueue.filter(msg => msg.status === 'error').length
            }
        };

        // Include settings if user wants
        const includeSettings = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Include extension settings in export?'
        });

        if (includeSettings === 'Yes') {
            const config = vscode.workspace.getConfiguration('autoclaude');
            exportData.settings = {
                queue: config.get('queue'),
                session: config.get('session'),
                parallelAgents: config.get('parallelAgents'),
                scriptRunner: config.get('scriptRunner')
            };
        }

        // Write file
        await fs.writeFile(saveUri.fsPath, JSON.stringify(exportData, null, 2));

        vscode.window.showInformationMessage(
            `✅ Exported ${exportData.queue.length} messages to ${path.basename(saveUri.fsPath)}`
        );

        debugLog(`Exported queue to: ${saveUri.fsPath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to export queue: ${error}`);
        debugLog(`Export error: ${error}`);
    }
}

export async function importQueueCommand(): Promise<void> {
    try {
        // Get file to import
        const openUri = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'JSON files': ['json'],
                'All files': ['*']
            },
            openLabel: 'Import Queue'
        });

        if (!openUri || openUri.length === 0) {
            return;
        }

        // Read and parse file
        const content = await fs.readFile(openUri[0].fsPath, 'utf-8');
        const importData: ExportData = JSON.parse(content);

        // Validate data
        if (!importData.version || !importData.queue) {
            throw new Error('Invalid import file format');
        }

        // Show import options
        const importOptions = await vscode.window.showQuickPick([
            'Import messages only',
            'Import messages and settings',
            'Replace current queue',
            'Cancel'
        ], {
            placeHolder: `Import ${importData.queue.length} messages from ${importData.exportDate}?`
        });

        if (!importOptions || importOptions === 'Cancel') {
            return;
        }

        // Import messages
        let importedCount = 0;
        
        if (importOptions === 'Replace current queue') {
            // Clear existing queue first (except processing messages)
            const processingMessages = messageQueue.filter(msg => msg.status === 'processing');
            messageQueue.length = 0;
            messageQueue.push(...processingMessages);
        }

        // Add imported messages
        for (const message of importData.queue) {
            if (message.text) {
                await addMessageToQueueFromWebview(message.text, message.attachedScripts);
                importedCount++;
            }
        }

        // Import settings if requested
        if (importOptions === 'Import messages and settings' && importData.settings) {
            const config = vscode.workspace.getConfiguration('autoclaude');
            
            for (const [section, values] of Object.entries(importData.settings)) {
                if (typeof values === 'object' && values !== null) {
                    for (const [key, value] of Object.entries(values as Record<string, any>)) {
                        await config.update(`${section}.${key}`, value, vscode.ConfigurationTarget.Workspace);
                    }
                }
            }

            vscode.window.showInformationMessage(
                `✅ Imported ${importedCount} messages and settings from ${path.basename(openUri[0].fsPath)}`
            );
        } else {
            vscode.window.showInformationMessage(
                `✅ Imported ${importedCount} messages from ${path.basename(openUri[0].fsPath)}`
            );
        }

        debugLog(`Imported ${importedCount} messages from: ${openUri[0].fsPath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to import queue: ${error}`);
        debugLog(`Import error: ${error}`);
    }
}

export async function exportSettingsCommand(): Promise<void> {
    try {
        const saveUri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`autoclaude-settings-${new Date().toISOString().split('T')[0]}.json`),
            filters: {
                'JSON files': ['json']
            },
            saveLabel: 'Export Settings'
        });

        if (!saveUri) {
            return;
        }

        const config = vscode.workspace.getConfiguration('autoclaude');
        const settings = {
            version: '3.1.0',
            exportDate: new Date().toISOString(),
            settings: {
                developmentMode: config.get('developmentMode'),
                queue: config.get('queue'),
                session: config.get('session'),
                sleepPrevention: config.get('sleepPrevention'),
                history: config.get('history'),
                security: config.get('security'),
                scriptRunner: config.get('scriptRunner'),
                subAgents: config.get('subAgents'),
                parallelAgents: config.get('parallelAgents')
            }
        };

        await fs.writeFile(saveUri.fsPath, JSON.stringify(settings, null, 2));

        vscode.window.showInformationMessage(
            `✅ Settings exported to ${path.basename(saveUri.fsPath)}`
        );
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to export settings: ${error}`);
    }
}