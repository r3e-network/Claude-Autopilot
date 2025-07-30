import * as vscode from 'vscode';
import * as path from 'path';
import {
    claudePanel, isRunning, setClaudePanel, setIsRunning,
    setExtensionContext, setDebugMode, isDevelopmentMode, developmentOnly,
    getValidatedConfig, showConfigValidationStatus, resetConfigToDefaults, watchConfigChanges
} from './core';
import { updateWebviewContent, updateSessionState, getWebviewContent, sendHistoryVisibilitySettings } from './ui';
import { startClaudeSession, resetClaudeSession, handleClaudeKeypress, startProcessingQueue, stopProcessingQueue, flushClaudeOutput, clearClaudeOutput } from './claude';
import {
    removeMessageFromQueue, duplicateMessageInQueue, editMessageInQueue, reorderQueue, sortQueue, clearMessageQueue,
    addMessageToQueueFromWebview, loadWorkspaceHistory, filterHistory, 
    loadPendingQueue, clearPendingQueue, saveWorkspaceHistory, endCurrentHistoryRun,
    startAutomaticMaintenance, stopAutomaticMaintenance, performQueueMaintenance, getMemoryUsageSummary
} from './queue';
import { recoverWaitingMessages, stopSleepPrevention, stopHealthCheck, startScheduledSession, stopScheduledSession } from './services';
import { sendSecuritySettings, toggleXssbypassSetting } from './services/security';
import { debugLog } from './utils';
import { ScriptRunner } from './scripts';
import { AutomationManager } from './automation/automationManager';
import { QuickStartManager } from './ui/quickStart';
import { WorkflowOrchestrator } from './automation/workflowOrchestrator';
import { TaskCompletionEngine } from './automation/taskCompletion';
import { ErrorRecoverySystem } from './automation/errorRecovery';
import { ParallelAgentOrchestrator } from './agents/ParallelAgentOrchestrator';
import { AgentMonitor } from './monitoring/AgentMonitor';
import { WorkDistributor } from './agents/WorkDistributor';
import { CoordinationProtocol } from './coordination/CoordinationProtocol';

// Development-only imports
let simulateUsageLimit: (() => void) | undefined;
let clearAllTimers: (() => void) | undefined;
let debugQueueState: (() => void) | undefined;

// Extension context for global access
let extensionContext: vscode.ExtensionContext;

// Dynamically import development features only in dev mode
if (isDevelopmentMode()) {
    import('./services/usage').then(module => {
        simulateUsageLimit = module.simulateUsageLimit;
        clearAllTimers = module.clearAllTimers;
        debugQueueState = module.debugQueueState;
    }).catch(error => {
        console.error('Failed to load development features:', error);
        vscode.window.showWarningMessage('Development features failed to load');
    });
}

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    setExtensionContext(context);
    setDebugMode(false);

    // Validate configuration on startup
    const config = getValidatedConfig();
    debugLog('Extension activated with validated configuration');

    // Global instances for new features
    let parallelOrchestrator: ParallelAgentOrchestrator | null = null;
    let agentMonitor: AgentMonitor | null = null;
    let workDistributor: WorkDistributor | null = null;
    let coordinationProtocol: CoordinationProtocol | null = null;

    // Initialize automation if workspace is available
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        // Initialize automatic parallel agents if enabled
        const parallelConfig = vscode.workspace.getConfiguration('autoclaude.parallelAgents');
        if (parallelConfig.get<boolean>('enabled', false) && parallelConfig.get<boolean>('autoStart', false)) {
            setTimeout(async () => {
                try {
                    const { AutoWorkDetector } = await import('./agents/AutoWorkDetector');
                    const autoDetector = new AutoWorkDetector(workspaceFolder.uri.fsPath);
                    await autoDetector.initialize();
                    
                    const detection = await autoDetector.detectWork();
                    if (detection.hasWork) {
                        debugLog(`Auto-detected ${detection.workCount} work items on startup`);
                        
                        // Auto-start agents
                        const agentCount = Math.min(
                            detection.suggestedAgents,
                            parallelConfig.get<number>('defaultAgents', 5)
                        );
                        
                        vscode.window.showInformationMessage(
                            `AutoClaude detected ${detection.workCount} items to fix. Starting ${agentCount} agents...`
                        );
                        
                        // Start agents automatically
                        parallelOrchestrator = new ParallelAgentOrchestrator(workspaceFolder.uri.fsPath);
                        await parallelOrchestrator.initialize();
                        await parallelOrchestrator.startAgents(agentCount);
                        
                        // Start monitoring
                        agentMonitor = new AgentMonitor(parallelOrchestrator, workspaceFolder.uri.fsPath);
                        await agentMonitor.initialize();
                        
                        // Start auto-detection
                        if (parallelConfig.get<boolean>('autoDetectWork', true)) {
                            await autoDetector.startAutoDetection(parallelOrchestrator);
                        }
                        
                        // Store globally
                        (global as any).autoWorkDetector = autoDetector;
                    }
                } catch (error) {
                    debugLog(`Failed to auto-start parallel agents: ${error}`);
                }
            }, 5000); // Delay to ensure extension is fully loaded
        }
        // Initialize context system for project indexing and task persistence
        import('./context').then(module => {
            module.initializeContextSystem(workspaceFolder.uri.fsPath).then(contextProvider => {
                // Store globally for access by other modules
                (global as any).contextProvider = contextProvider;
                debugLog('Context system initialized with project indexing and task persistence');
                
                // Generate initial context
                contextProvider.generateFullContext().catch(error => {
                    debugLog(`Failed to generate initial context: ${error}`);
                });
            });
        }).catch(error => {
            debugLog(`Failed to initialize context system: ${error}`);
        });

        import('./queue/automationWrapper').then(module => {
            module.initializeAutomation(workspaceFolder.uri.fsPath);
            debugLog('Automation features initialized');
        }).catch(error => {
            debugLog(`Failed to initialize automation: ${error}`);
        });

        // Initialize error recovery system
        import('./automation/contextManager').then(module => {
            const contextManager = new module.ContextManager(workspaceFolder.uri.fsPath);
            const errorRecovery = new ErrorRecoverySystem(contextManager, workspaceFolder.uri.fsPath);
            
            // Store globally for access by other modules
            (global as any).errorRecovery = errorRecovery;
            debugLog('Error recovery system initialized');
        }).catch(error => {
            debugLog(`Failed to initialize error recovery: ${error}`);
        });
    }

    // Watch for configuration changes
    const configWatcher = watchConfigChanges((newConfig) => {
        debugLog('Configuration updated, reloading settings...');
        
        // Update UI settings
        sendSecuritySettings();
        sendHistoryVisibilitySettings();
        
        // Restart scheduler if scheduledStartTime changed
        stopScheduledSession();
        if (newConfig.session.scheduledStartTime && !newConfig.session.autoStart) {
            startScheduledSession(() => {
                // Start Claude session directly (not just open panel)
                startClaudeSession(newConfig.session.skipPermissions).catch(error => {
                    vscode.window.showErrorMessage(`Scheduled Claude session failed to start: ${error.message}`);
                });
            });
        }
    });

    // Register commands
    const startCommand = vscode.commands.registerCommand('autoclaude.start', () => {
        startClaudeAutopilot(context);
    });

    const stopCommand = vscode.commands.registerCommand('autoclaude.stop', () => {
        stopClaudeAutopilot();
    });

    const addMessageCommand = vscode.commands.registerCommand('autoclaude.addMessage', () => {
        addMessageToQueue();
    });

    const runScriptChecksCommand = vscode.commands.registerCommand('autoclaude.runScriptChecks', async () => {
        await runScriptChecks();
    });

    const runScriptLoopCommand = vscode.commands.registerCommand('autoclaude.runScriptLoop', async () => {
        await runScriptCheckLoop();
    });

    const quickStartCommand = vscode.commands.registerCommand('autoclaude.quickStart', async () => {
        await showQuickStart();
    });

    const runSubAgentsCommand = vscode.commands.registerCommand('autoclaude.runSubAgents', async () => {
        await runSubAgents();
    });

    const autoCompleteCommand = vscode.commands.registerCommand('autoclaude.autoComplete', async () => {
        await autoCompleteCurrentTask();
    });

    const workflowWizardCommand = vscode.commands.registerCommand('autoclaude.workflowWizard', async () => {
        await showWorkflowWizard();
    });

    // Context system commands
    const updateContextCommand = vscode.commands.registerCommand('autoclaude.updateContext', async () => {
        const contextModule = await import('./context');
        await contextModule.updateProjectContext();
    });

    const showContextCommand = vscode.commands.registerCommand('autoclaude.showContext', async () => {
        const contextModule = await import('./context');
        await contextModule.showProjectContext();
    });

    const showTasksCommand = vscode.commands.registerCommand('autoclaude.showTasks', async () => {
        const contextProvider = (global as any).contextProvider;
        if (contextProvider) {
            const taskManager = contextProvider.taskManager;
            const summary = taskManager.getTaskSummary();
            
            // Create temporary document with task summary
            const doc = await vscode.workspace.openTextDocument({
                content: summary,
                language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);
        } else {
            vscode.window.showErrorMessage('Context system not initialized');
        }
    });

    // Command for executing high-level automation commands
    const executeAutomationCommand = vscode.commands.registerCommand('autoclaude.executeCommand', async () => {
        const command = await vscode.window.showInputBox({
            prompt: 'Enter a high-level command (e.g., "make project production ready", "fix all tests", "create website")',
            placeHolder: 'make project production ready',
            ignoreFocusOut: true
        });

        if (!command) {
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }

        // Get the automation manager
        const automationWrapper = await import('./queue/automationWrapper');
        const automation = automationWrapper.getAutomationManager();
        
        if (!automation || !(automation as any).commandOrchestrator) {
            vscode.window.showErrorMessage('Automation system not initialized. Please wait a moment and try again.');
            return;
        }

        // Show progress
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Executing: ${command}`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 0, message: 'Analyzing command...' });
                
                const result = await (automation as any).commandOrchestrator.executeCommand(command);
                
                if (result.success) {
                    vscode.window.showInformationMessage(`✅ Command completed successfully!`);
                    
                    // Show execution summary
                    const summary = `# Command Execution Summary\n\n` +
                        `**Command:** ${command}\n` +
                        `**Status:** ${result.success ? 'Success' : 'Failed'}\n` +
                        `**Steps Executed:** ${result.executedSteps.length}\n\n` +
                        `## Executed Steps:\n` +
                        result.executedSteps.map((step: any, i: number) => 
                            `${i + 1}. ${step.description} - ${step.status}`
                        ).join('\n') +
                        `\n\n## Output:\n${result.output || 'No output'}`;
                    
                    const doc = await vscode.workspace.openTextDocument({
                        content: summary,
                        language: 'markdown'
                    });
                    await vscode.window.showTextDocument(doc);
                } else {
                    vscode.window.showErrorMessage(`❌ Command failed: ${result.error || 'Unknown error'}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    });

    // Parallel Agent Commands
    const startParallelAgentsCommand = vscode.commands.registerCommand('autoclaude.startParallelAgents', async () => {
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a workspace folder to use parallel agents');
            return;
        }

        const agentCount = await vscode.window.showInputBox({
            prompt: 'How many parallel agents to start?',
            placeHolder: '5',
            value: '5',
            validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num < 1) return 'Please enter a number greater than 0';
                if (num > 50) return 'Maximum 50 agents allowed';
                return null;
            }
        });

        if (!agentCount) return;

        try {
            // Get config from settings
            const config = vscode.workspace.getConfiguration('autoclaude.parallelAgents');
            const orchestratorConfig = {
                maxAgents: config.get<number>('maxAgents', 50),
                defaultAgents: parseInt(agentCount),
                staggerDelay: config.get<number>('staggerDelay', 10),
                contextThreshold: config.get<number>('contextThreshold', 20),
                autoRestart: config.get<boolean>('autoRestart', true),
                checkInterval: config.get<number>('checkInterval', 10)
            };

            parallelOrchestrator = new ParallelAgentOrchestrator(workspaceFolder.uri.fsPath, orchestratorConfig);
            await parallelOrchestrator.initialize();
            await parallelOrchestrator.startAgents(parseInt(agentCount));

            // Initialize monitor
            agentMonitor = new AgentMonitor(parallelOrchestrator, workspaceFolder.uri.fsPath);
            await agentMonitor.initialize();
            
            // Store in context for cleanup
            context.workspaceState.update('parallelOrchestrator', parallelOrchestrator);
            context.workspaceState.update('agentMonitor', agentMonitor);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start parallel agents: ${error instanceof Error ? error.message : String(error)}`);
        }
    });

    const stopParallelAgentsCommand = vscode.commands.registerCommand('autoclaude.stopParallelAgents', async () => {
        if (parallelOrchestrator) {
            await parallelOrchestrator.stopAgents();
            parallelOrchestrator = null;
        }
        if (agentMonitor) {
            agentMonitor.dispose();
            agentMonitor = null;
        }
    });

    const showAgentMonitorCommand = vscode.commands.registerCommand('autoclaude.showAgentMonitor', async () => {
        if (!agentMonitor) {
            vscode.window.showErrorMessage('No parallel agents running');
            return;
        }
        await agentMonitor.showDashboard();
    });

    const attachToAgentsCommand = vscode.commands.registerCommand('autoclaude.attachToAgents', async () => {
        if (!parallelOrchestrator) {
            vscode.window.showErrorMessage('No parallel agents running');
            return;
        }
        await parallelOrchestrator.attachToSession();
    });

    const clearAllAgentContextCommand = vscode.commands.registerCommand('autoclaude.clearAllAgentContext', async () => {
        if (!parallelOrchestrator) {
            vscode.window.showErrorMessage('No parallel agents running');
            return;
        }
        await parallelOrchestrator.sendCommandToAllAgents('/clear');
        vscode.window.showInformationMessage('Sent /clear command to all agents');
    });

    const toggleAutoOrchestrationCommand = vscode.commands.registerCommand('autoclaude.toggleAutoOrchestration', async () => {
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('Please open a workspace folder to use auto-orchestration');
            return;
        }

        const config = vscode.workspace.getConfiguration('autoclaude.parallelAgents');
        const isEnabled = config.get<boolean>('enabled', false);
        
        if (!isEnabled) {
            // Enable auto-orchestration
            await config.update('enabled', true, vscode.ConfigurationTarget.Workspace);
            await config.update('autoStart', true, vscode.ConfigurationTarget.Workspace);
            await config.update('autoDetectWork', true, vscode.ConfigurationTarget.Workspace);
            await config.update('autoScale', true, vscode.ConfigurationTarget.Workspace);
            await config.update('autoShutdown', true, vscode.ConfigurationTarget.Workspace);
            
            vscode.window.showInformationMessage(
                '🚀 Auto-orchestration enabled! Agents will start automatically when work is detected.'
            );
            
            // Start immediately
            const { AutoOrchestrationCoordinator } = await import('./agents/AutoOrchestrationCoordinator');
            const autoConfig = {
                enabled: true,
                autoStart: true,
                autoDetectWork: true,
                autoScale: true,
                autoShutdown: true,
                maxAgents: config.get<number>('maxAgents', 50),
                workDetectionInterval: config.get<number>('workDetectionInterval', 60),
                coordinationEnabled: config.get<boolean>('coordinationEnabled', false)
            };
            
            const coordinator = new AutoOrchestrationCoordinator(workspaceFolder.uri.fsPath, autoConfig);
            await coordinator.initialize();
            await coordinator.start();
            
            // Store globally
            (global as any).autoOrchestrationCoordinator = coordinator;
        } else {
            // Disable auto-orchestration
            await config.update('enabled', false, vscode.ConfigurationTarget.Workspace);
            await config.update('autoStart', false, vscode.ConfigurationTarget.Workspace);
            
            // Stop if running
            const coordinator = (global as any).autoOrchestrationCoordinator;
            if (coordinator) {
                await coordinator.stop();
                (global as any).autoOrchestrationCoordinator = null;
            }
            
            vscode.window.showInformationMessage('Auto-orchestration disabled');
        }
    });

    // Import/Export commands
    const exportQueueCommand = vscode.commands.registerCommand('autoclaude.exportQueue', async () => {
        const { exportQueueCommand } = await import('./commands/exportImport');
        await exportQueueCommand();
    });

    const importQueueCommand = vscode.commands.registerCommand('autoclaude.importQueue', async () => {
        const { importQueueCommand } = await import('./commands/exportImport');
        await importQueueCommand();
    });

    const exportSettingsCommand = vscode.commands.registerCommand('autoclaude.exportSettings', async () => {
        const { exportSettingsCommand } = await import('./commands/exportImport');
        await exportSettingsCommand();
    });

    // Template commands
    const useTemplateCommand = vscode.commands.registerCommand('autoclaude.useTemplate', async () => {
        const { MessageTemplateManager, showTemplateQuickPick } = await import('./templates/messageTemplates');
        const templateManager = new MessageTemplateManager(context);
        const content = await showTemplateQuickPick(templateManager);
        if (content) {
            await addMessageToQueueFromWebview(content);
        }
    });

    const manageTemplatesCommand = vscode.commands.registerCommand('autoclaude.manageTemplates', async () => {
        vscode.window.showInformationMessage('Template manager coming soon!');
    });

    // Statistics command
    const showStatisticsCommand = vscode.commands.registerCommand('autoclaude.showStatistics', async () => {
        const { StatisticsManager } = await import('./ui/statistics');
        const statsManager = new StatisticsManager();
        await statsManager.showStatisticsWebview(context);
    });

    context.subscriptions.push(
        startCommand, stopCommand, addMessageCommand, runScriptChecksCommand, runScriptLoopCommand,
        quickStartCommand, runSubAgentsCommand, autoCompleteCommand, workflowWizardCommand,
        updateContextCommand, showContextCommand, showTasksCommand, executeAutomationCommand,
        startParallelAgentsCommand, stopParallelAgentsCommand, showAgentMonitorCommand,
        attachToAgentsCommand, clearAllAgentContextCommand, toggleAutoOrchestrationCommand,
        exportQueueCommand, importQueueCommand, exportSettingsCommand,
        useTemplateCommand, manageTemplatesCommand, showStatisticsCommand,
        configWatcher
    );
    
    // Auto-start or schedule Claude session based on configuration
    if (config.session.autoStart) {
        setTimeout(() => {
            startClaudeAutopilot(context);
        }, 1000); // Small delay to ensure extension is fully loaded
    } else if (config.session.scheduledStartTime) {
        // Start scheduler for timed session start
        setTimeout(() => {
            startScheduledSession(() => {
                // Start Claude session directly (not just open panel)
                startClaudeSession(config.session.skipPermissions).catch(error => {
                    vscode.window.showErrorMessage(`Scheduled Claude session failed to start: ${error.message}`);
                });
            });
        }, 1000); // Small delay to ensure extension is fully loaded
    }
}

function startClaudeAutopilot(context: vscode.ExtensionContext): void {
    if (isRunning && claudePanel) {
        claudePanel.reveal(vscode.ViewColumn.Two);
        vscode.window.showInformationMessage('AutoClaude is already running - showing existing panel');
        return;
    }
    
    if (isRunning && !claudePanel) {
        setIsRunning(false);
    }

    const panel = vscode.window.createWebviewPanel(
        'autoclaude',
        'AutoClaude',
        vscode.ViewColumn.Two,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.joinPath(context.extensionUri, 'out'),
                vscode.Uri.joinPath(context.extensionUri, 'src'),
                context.extensionUri
            ]
        }
    );

    setClaudePanel(panel);
    panel.webview.html = getWebviewContent(context);

    loadPendingQueue();
    recoverWaitingMessages();
    
    // Start automatic queue maintenance
    startAutomaticMaintenance();
    
    setTimeout(() => {
        updateWebviewContent();
        updateSessionState();
        sendSecuritySettings();
        sendHistoryVisibilitySettings();
        sendScrollLockState();
        loadWorkspaceHistory();
        debugLog('Webview state synchronized after reopening');
        
        // Auto-start processing if configured
        const config = getValidatedConfig();
        if (config.session.autoStart) {
            setTimeout(() => {
                startProcessingQueue(config.session.skipPermissions).catch(error => {
                    vscode.window.showErrorMessage(`Failed to auto-start processing: ${error.message}`);
                });
            }, 500); // Small delay to ensure webview is fully loaded
        }
    }, 100);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        (message: any) => {
            switch (message.command) {
                case 'addMessage':
                    addMessageToQueueFromWebview(message.text, message.attachedScripts);
                    break;
                case 'getAvailableScripts':
                    sendAvailableScriptsToWebview();
                    break;
                case 'getWorkspaceFiles':
                    getWorkspaceFiles(message.query || '', message.page || 0);
                    break;
                case 'startProcessing':
                    startProcessingQueue(message.skipPermissions).catch(error => {
                        vscode.window.showErrorMessage(`Failed to start processing: ${error.message}`);
                        debugLog(`Error starting processing: ${error}`);
                    });
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
                    startClaudeSession(message.skipPermissions).catch(error => {
                        vscode.window.showErrorMessage(`Failed to start Claude session: ${error.message}`);
                        debugLog(`Error starting Claude session: ${error}`);
                    });
                    break;
                case 'claudeKeypress':
                    handleClaudeKeypress(message.key);
                    break;
                case 'removeMessage':
                    removeMessageFromQueue(message.messageId);
                    break;
                case 'duplicateMessage':
                    duplicateMessageInQueue(message.messageId);
                    break;
                case 'editMessage':
                    editMessageInQueue(message.messageId, message.newText);
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
                case 'toggleXssbypass':
                    toggleXssbypassSetting(message.enabled);
                    break;
                case 'getSecuritySettings':
                    sendSecuritySettings();
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'autoclaude');
                    break;
                case 'saveScrollLockState':
                    // Save scroll lock state to workspace state
                    extensionContext.workspaceState.update('autoScrollEnabled', message.enabled);
                    break;
                case 'getDevelopmentModeSetting':
                    sendDevelopmentModeSetting();
                    break;
                case 'getSubAgentData':
                    sendSubAgentData();
                    break;
                case 'simulateUsageLimit':
                    developmentOnly(() => {
                        if (simulateUsageLimit) {
                            simulateUsageLimit();
                        } else {
                            vscode.window.showWarningMessage('Development feature not available');
                        }
                    });
                    break;
                case 'clearAllTimers':
                    developmentOnly(() => {
                        if (clearAllTimers) {
                            clearAllTimers();
                        } else {
                            vscode.window.showWarningMessage('Development feature not available');
                        }
                    });
                    break;
                case 'debugQueueState':
                    developmentOnly(() => {
                        if (debugQueueState) {
                            debugQueueState();
                        } else {
                            vscode.window.showWarningMessage('Development feature not available');
                        }
                    });
                    break;
                case 'toggleDebugLogging':
                    toggleDebugLogging();
                    break;
                case 'performQueueMaintenance':
                    developmentOnly(() => {
                        performQueueMaintenance();
                        vscode.window.showInformationMessage('Queue maintenance completed');
                    });
                    break;
                case 'getMemoryUsage':
                    developmentOnly(() => {
                        const summary = getMemoryUsageSummary();
                        vscode.window.showInformationMessage(summary);
                    });
                    break;
                case 'validateConfig':
                    developmentOnly(() => {
                        showConfigValidationStatus();
                    });
                    break;
                case 'resetConfig':
                    developmentOnly(() => {
                        vscode.window.showWarningMessage(
                            'This will reset all AutoClaude settings to defaults. Continue?',
                            'Reset',
                            'Cancel'
                        ).then(selection => {
                            if (selection === 'Reset') {
                                resetConfigToDefaults();
                            }
                        });
                    });
                    break;
                case 'runScriptChecks':
                    runScriptChecks();
                    break;
                case 'runSingleScript':
                    runSingleScript(message.scriptId);
                    break;
                case 'runScriptLoop':
                    runScriptLoopWithConfig(message.config);
                    break;
                case 'updateScriptOrder':
                    updateScriptOrder(message.order);
                    break;
                case 'runMessageInLoop':
                    runMessageInLoopWithConfig(message.messageId, message.config);
                    break;
            }
        },
        undefined,
        []
    );

    // Handle panel disposal
    panel.onDidDispose(() => {
        debugLog('Webview panel disposed - cleaning up but keeping Claude session running');
        
        setClaudePanel(null);
        flushClaudeOutput();
        clearClaudeOutput();
        setIsRunning(false);
        
        vscode.window.showInformationMessage('AutoClaude panel closed. Claude session continues in background. Use "Start AutoClaude" to reopen.');
    }, null, []);

    setIsRunning(true);
    vscode.window.showInformationMessage('AutoClaude started');
}

async function getWorkspaceFiles(query: string, page: number = 0): Promise<void> {
    try {
        if (!claudePanel) {
            return;
        }

        const excludePattern = '{node_modules,coverage,.git,dist,build,out,.vscode,.idea,.history,tmp,temp}/**';
        
        let files;
        if (query.trim()) {
            // Search for both files containing query AND files inside folders containing query
            const [fileMatches, folderMatches] = await Promise.all([
                vscode.workspace.findFiles(`**/*${query}*`, excludePattern, 500),
                vscode.workspace.findFiles(`**/*${query}*/**`, excludePattern, 500)
            ]);
            files = [...fileMatches, ...folderMatches];
        } else {
            files = await vscode.workspace.findFiles('**/*', excludePattern, 1000);
        }
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceRoot) {
            claudePanel.webview.postMessage({
                command: 'workspaceFilesResult',
                files: [],
                query: query
            });
            return;
        }

        let results = files
            .map(file => ({
                path: vscode.workspace.asRelativePath(file, false),
                name: vscode.workspace.asRelativePath(file, false).split('/').pop() || ''
            }))
            .filter((file, index, self) => index === self.findIndex(f => f.path === file.path))
            .sort((a, b) => {
                if (!query.trim()) return a.path.localeCompare(b.path);
                
                const lowerQuery = query.toLowerCase();
                const aNameMatch = a.name.toLowerCase().startsWith(lowerQuery);
                const bNameMatch = b.name.toLowerCase().startsWith(lowerQuery);
                
                if (aNameMatch && !bNameMatch) return -1;
                if (!aNameMatch && bNameMatch) return 1;
                
                return a.path.localeCompare(b.path);
            });

        const pageSize = 50;
        const totalResults = results.length;
        const totalPages = Math.ceil(totalResults / pageSize);
        const paginatedFiles = results.slice(page * pageSize, (page + 1) * pageSize);

        claudePanel.webview.postMessage({
            command: 'workspaceFilesResult',
            files: paginatedFiles,
            query: query,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalResults: totalResults,
                pageSize: pageSize,
                hasNextPage: page < totalPages - 1,
                hasPrevPage: page > 0
            }
        });

    } catch (error) {
        debugLog(`Error getting workspace files: ${error}`);
        if (claudePanel) {
            claudePanel.webview.postMessage({
                command: 'workspaceFilesResult',
                files: [],
                query: query,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

function stopClaudeAutopilot(): void {
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

    vscode.window.showInformationMessage('AutoClaude stopped');
}

function addMessageToQueue(): void {
    vscode.window.showInputBox({
        prompt: 'Enter message to add to AutoClaude queue',
        placeHolder: 'Type your message here...'
    }).then(message => {
        if (message) {
            try {
                addMessageToQueueFromWebview(message);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to add message to queue: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }, error => {
        vscode.window.showErrorMessage(`Input dialog error: ${error instanceof Error ? error.message : String(error)}`);
    });
}

function sendDevelopmentModeSetting(): void {
    if (claudePanel) {
        const config = vscode.workspace.getConfiguration('autoclaude');
        const isDevelopmentMode = config.get<boolean>('developmentMode', false);
        
        claudePanel.webview.postMessage({
            command: 'setDevelopmentModeSetting',
            enabled: isDevelopmentMode
        });
    }
}

function sendScrollLockState(): void {
    if (claudePanel) {
        // Get saved scroll lock state from workspace state, default to true (auto-scroll enabled)
        const autoScrollEnabled = extensionContext.workspaceState.get('autoScrollEnabled', true);
        
        claudePanel.webview.postMessage({
            command: 'setScrollLockState',
            enabled: autoScrollEnabled
        });
    }
}

async function sendSubAgentData(): Promise<void> {
    if (claudePanel) {
        const config = vscode.workspace.getConfiguration('autoclaude');
        const subAgentsEnabled = config.get<boolean>('subAgents.enabled', false);
        const showCapabilities = config.get<boolean>('subAgents.showCapabilities', true);
        
        if (subAgentsEnabled) {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                const { SubAgentRunner } = await import('./subagents');
                const runner = new SubAgentRunner(workspaceFolder.uri.fsPath);
                await runner.initialize();
                
                const registry = runner.getRegistry();
                const agents = registry.getAllAgents().map(agent => ({
                    id: agent.id,
                    name: agent.id,
                    capabilities: showCapabilities ? agent.getCapabilities() : []
                }));
                
                claudePanel.webview.postMessage({
                    command: 'updateSubAgents',
                    subAgents: {
                        enabled: true,
                        agents
                    }
                });
            }
        } else {
            claudePanel.webview.postMessage({
                command: 'updateSubAgents',
                subAgents: {
                    enabled: false,
                    agents: []
                }
            });
        }
    }
}

function toggleDebugLogging(): void {
    const config = vscode.workspace.getConfiguration('autoclaude');
    const isDevelopmentMode = config.get<boolean>('developmentMode', false);
    
    if (!isDevelopmentMode) {
        vscode.window.showWarningMessage('Development mode must be enabled to use debug features');
        return;
    }
    
    // Toggle debug logging state (this would need to be implemented in core state)
    vscode.window.showInformationMessage('DEBUG: Debug logging toggled');
}

async function sendAvailableScriptsToWebview(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder || !claudePanel) {
        return;
    }

    try {
        const scriptRunner = new ScriptRunner(workspaceFolder.uri.fsPath);
        await scriptRunner.initialize();
        await scriptRunner.loadUserScripts();
        
        const config = scriptRunner.getConfig();
        const availableScripts = config.scripts.map(script => ({
            id: script.id,
            name: script.name,
            description: script.description,
            enabled: script.enabled
        }));

        claudePanel.webview.postMessage({
            command: 'setAvailableScripts',
            scripts: availableScripts
        });
    } catch (error) {
        debugLog(`Error getting available scripts: ${error}`);
    }
}

async function runSingleScript(scriptId: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const scriptRunner = new ScriptRunner(workspaceFolder.uri.fsPath);
    await scriptRunner.initialize();
    await scriptRunner.loadUserScripts();

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Running ${scriptId}...`,
        cancellable: false
    }, async (progress) => {
        const result = await scriptRunner.runSingleCheck(scriptId);
        
        if (!result) {
            vscode.window.showErrorMessage(`Script ${scriptId} not found`);
            return;
        }
        
        const script = scriptRunner.getConfig().scripts.find(s => s.id === scriptId);
        const scriptName = script?.name || scriptId;
        
        // Send results to Claude for analysis regardless of pass/fail
        let message: string;
        if (result.passed) {
            vscode.window.showInformationMessage(`✅ ${scriptName} passed!`);
            message = `Script "${scriptName}" passed all checks.\n\nPlease analyze the code to see if there are any improvements or optimizations that could be made, even though the script passes.`;
        } else {
            const errors = result.errors.join('\n');
            vscode.window.showWarningMessage(`❌ ${scriptName} failed:\n${errors}`);
            
            // Generate detailed fix instructions
            const fixInstructions = result.fixInstructions || '';
            message = `Script "${scriptName}" failed with the following errors:\n\n${errors}\n\n${fixInstructions ? `Suggested fixes:\n${fixInstructions}\n\n` : ''}Please fix these issues to make the code pass the script checks.`;
        }
        
        // Add option to send to Claude
        const sendToClaude = await vscode.window.showInformationMessage(
            `Send ${scriptName} results to Claude for analysis?`,
            'Yes',
            'No'
        );
        
        if (sendToClaude === 'Yes') {
            try {
                addMessageToQueueFromWebview(message);
                vscode.window.showInformationMessage('Script results sent to Claude for analysis');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to send to Claude: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    });
}

async function runScriptChecks(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const scriptRunner = new ScriptRunner(workspaceFolder.uri.fsPath);
    await scriptRunner.initialize();
    await scriptRunner.loadUserScripts();

    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running script checks...',
        cancellable: false
    }, async (progress) => {
        // Run checks with stopOnFailure = true for manual runs
        const { allPassed, results } = await scriptRunner.runChecks(true);
        
        if (allPassed) {
            vscode.window.showInformationMessage('All script checks passed!');
        } else {
            const failedScripts = Array.from(results.entries())
                .filter(([_, result]) => !result.passed)
                .map(([scriptId, _]) => scriptId);
            
            vscode.window.showWarningMessage(`Script checks failed: ${failedScripts.join(', ')}`);
        }
    });
}


async function runScriptCheckLoop(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    if (!isRunning || !claudePanel) {
        vscode.window.showErrorMessage('AutoClaude must be running to use script check loop');
        return;
    }

    const scriptRunner = new ScriptRunner(workspaceFolder.uri.fsPath);
    await scriptRunner.initialize();
    await scriptRunner.loadUserScripts();

    const config = scriptRunner.getConfig();
    const enabledScripts = config.scripts.filter(s => s.enabled);
    
    if (enabledScripts.length === 0) {
        vscode.window.showWarningMessage('No scripts are enabled. Please configure scripts first.');
        return;
    }

    vscode.window.showInformationMessage(`Starting script check loop with ${config.maxIterations} max iterations...`);
    
    try {
        await scriptRunner.runCheckLoop();
    } catch (error) {
        vscode.window.showErrorMessage(`Script check loop failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function runScriptLoopWithConfig(scriptConfig: any): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    if (!isRunning || !claudePanel) {
        vscode.window.showErrorMessage('AutoClaude must be running to use script check loop');
        return;
    }

    const scriptRunner = new ScriptRunner(workspaceFolder.uri.fsPath);
    await scriptRunner.initialize();
    await scriptRunner.loadUserScripts();

    // Update configuration based on UI selections
    if (scriptConfig) {
        const config = scriptRunner.getConfig();
        
        // Update script enabled states and order
        if (scriptConfig.scripts) {
            // Reorder scripts based on UI order
            const orderedScripts: any[] = [];
            for (const scriptUpdate of scriptConfig.scripts) {
                const script = config.scripts.find(s => s.id === scriptUpdate.id);
                if (script) {
                    script.enabled = scriptUpdate.enabled;
                    orderedScripts.push(script);
                }
            }
            
            // Add any remaining scripts that weren't in the UI (e.g., user scripts)
            for (const script of config.scripts) {
                if (!orderedScripts.find(s => s.id === script.id)) {
                    orderedScripts.push(script);
                }
            }
            
            config.scripts = orderedScripts;
        }
        
        // Update max iterations
        if (scriptConfig.maxIterations) {
            config.maxIterations = scriptConfig.maxIterations;
        }
        
        await scriptRunner.updateConfig(config);
    }

    const config = scriptRunner.getConfig();
    const enabledScripts = config.scripts.filter(s => s.enabled);
    
    if (enabledScripts.length === 0) {
        vscode.window.showWarningMessage('No scripts are enabled. Please select at least one script.');
        return;
    }

    vscode.window.showInformationMessage(`Starting script check loop with ${config.maxIterations} max iterations...`);
    
    try {
        await scriptRunner.runCheckLoop();
    } catch (error) {
        vscode.window.showErrorMessage(`Script check loop failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function updateScriptOrder(order: string[]): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return;
    }

    const scriptRunner = new ScriptRunner(workspaceFolder.uri.fsPath);
    await scriptRunner.initialize();
    
    const config = scriptRunner.getConfig();
    
    // Reorder scripts based on the new order
    const orderedScripts: any[] = [];
    for (const scriptId of order) {
        const script = config.scripts.find(s => s.id === scriptId);
        if (script) {
            orderedScripts.push(script);
        }
    }
    
    // Add any remaining scripts that weren't in the order array
    for (const script of config.scripts) {
        if (!orderedScripts.find(s => s.id === script.id)) {
            orderedScripts.push(script);
        }
    }
    
    config.scripts = orderedScripts;
    await scriptRunner.updateConfig(config);
}

async function showQuickStart(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const quickStartManager = new QuickStartManager(workspaceFolder.uri.fsPath);
    await quickStartManager.initialize();
    await quickStartManager.showQuickStart();
}

async function runSubAgents(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const { SubAgentRunner } = await import('./subagents');
    const runner = new SubAgentRunner(workspaceFolder.uri.fsPath);
    await runner.initialize();

    const enabledAgents = runner.getConfig().enabledAgents;
    const choices = enabledAgents.map(agentId => ({
        label: `🤖 ${agentId}`,
        description: `Run ${agentId} analysis`,
        agentId
    }));

    choices.push({
        label: '🚀 Run All Agents',
        description: 'Execute all enabled sub-agents',
        agentId: 'all'
    });

    const selected = await vscode.window.showQuickPick(choices, {
        placeHolder: 'Select sub-agents to run'
    });

    if (selected) {
        if (selected.agentId === 'all') {
            await runner.runAgentLoop();
        } else {
            const result = await runner.runSingleAgent(selected.agentId);
            if (result && !result.passed) {
                await runner.runAgentAnalysis(selected.agentId, result);
            }
        }
    }
}

async function autoCompleteCurrentTask(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const taskEngine = new TaskCompletionEngine(workspaceFolder.uri.fsPath);
    await taskEngine.initialize();

    const context = await taskEngine.analyzeCurrentContext();
    await taskEngine.autoCompleteTask(context);
}

async function showWorkflowWizard(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const orchestrator = new WorkflowOrchestrator(workspaceFolder.uri.fsPath);
    await orchestrator.initialize();

    const templates = orchestrator.getWorkflowTemplates();
    const choices = templates.map(template => ({
        label: template.name,
        description: template.description,
        detail: `⏱️ ${template.estimatedTime} | 🎯 ${template.difficulty} | 📂 ${template.category}`,
        template
    }));

    const selected = await vscode.window.showQuickPick(choices, {
        placeHolder: 'Select a workflow to execute',
        matchOnDescription: true,
        matchOnDetail: true
    });

    if (selected) {
        await orchestrator.executeWorkflow(selected.template.id);
    }
}

async function runMessageInLoopWithConfig(messageId: string, scriptConfig: any): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    if (!isRunning || !claudePanel) {
        vscode.window.showErrorMessage('AutoClaude must be running to use message loop');
        return;
    }

    // Find the message in the queue
    const { messageQueue } = await import('./core/state');
    const message = messageQueue.find(m => m.id === messageId);
    
    if (!message) {
        vscode.window.showErrorMessage('Message not found in queue');
        return;
    }

    if (message.status !== 'pending') {
        vscode.window.showErrorMessage('Only pending messages can be run in loop');
        return;
    }

    const scriptRunner = new ScriptRunner(workspaceFolder.uri.fsPath);
    await scriptRunner.initialize();
    await scriptRunner.loadUserScripts();

    // Update configuration based on UI selections
    if (scriptConfig) {
        const config = scriptRunner.getConfig();
        
        // Update script enabled states and order
        if (scriptConfig.scripts) {
            // Reorder scripts based on UI order
            const orderedScripts: any[] = [];
            for (const scriptUpdate of scriptConfig.scripts) {
                const script = config.scripts.find(s => s.id === scriptUpdate.id);
                if (script) {
                    script.enabled = scriptUpdate.enabled;
                    orderedScripts.push(script);
                }
            }
            
            // Add any remaining scripts that weren't in the UI (e.g., user scripts)
            for (const script of config.scripts) {
                if (!orderedScripts.find(s => s.id === script.id)) {
                    orderedScripts.push(script);
                }
            }
            
            config.scripts = orderedScripts;
        }
        
        // Update max iterations
        if (scriptConfig.maxIterations) {
            config.maxIterations = scriptConfig.maxIterations;
        }
        
        await scriptRunner.updateConfig(config);
    }

    vscode.window.showInformationMessage(`Starting message loop with ${scriptConfig.maxIterations} max iterations...`);
    
    try {
        await scriptRunner.runMessageLoop(message);
    } catch (error) {
        vscode.window.showErrorMessage(`Message loop failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function deactivate(): Promise<void> {
    // Stop all timers and background processes first
    stopHealthCheck();
    stopAutomaticMaintenance();
    stopScheduledSession();
    
    // Clean up parallel agents
    const context = (global as any).extensionContext;
    if (context) {
        const parallelOrchestrator = context.workspaceState.get('parallelOrchestrator') as ParallelAgentOrchestrator | undefined;
        const agentMonitor = context.workspaceState.get('agentMonitor') as AgentMonitor | undefined;
        
        if (parallelOrchestrator) {
            try {
                await parallelOrchestrator.stopAgents();
            } catch (error) {
                debugLog(`Error stopping parallel agents: ${error}`);
            }
        }
        
        if (agentMonitor) {
            agentMonitor.dispose();
        }
    }
    
    // Clear development timers if available
    if (clearAllTimers) {
        try {
            clearAllTimers();
        } catch (error) {
            console.error('Error clearing timers during deactivation:', error);
        }
    }
    
    // Save state and clean up
    try {
        saveWorkspaceHistory();
        endCurrentHistoryRun();
    } catch (error) {
        console.error('Error saving state during deactivation:', error);
    }
    
    // Clean up output and stop loops
    try {
        flushClaudeOutput();
        clearClaudeOutput();
        stopClaudeAutopilot();
    } catch (error) {
        console.error('Error during final cleanup:', error);
    }
}