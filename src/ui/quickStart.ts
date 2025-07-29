import * as vscode from 'vscode';
import { debugLog } from '../utils/logging';
import { WorkflowOrchestrator } from '../automation/workflowOrchestrator';

export interface QuickStartOption {
    id: string;
    title: string;
    description: string;
    icon: string;
    action: () => Promise<void>;
    category: 'getting-started' | 'common-tasks' | 'advanced';
}

export class QuickStartManager {
    private workspacePath: string;
    private orchestrator?: WorkflowOrchestrator;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
    }

    async initialize(): Promise<void> {
        this.orchestrator = new WorkflowOrchestrator(this.workspacePath);
        await this.orchestrator.initialize();
    }

    getQuickStartOptions(): QuickStartOption[] {
        return [
            // Getting Started Options
            {
                id: 'first-time-setup',
                title: '🎯 First Time Setup',
                description: 'Complete setup guide for new users',
                icon: '$(getting-started)',
                category: 'getting-started',
                action: async () => {
                    await this.showFirstTimeSetup();
                }
            },
            {
                id: 'quick-demo',
                title: '🎬 Quick Demo',
                description: 'See AutoClaude in action with a 2-minute demo',
                icon: '$(play-circle)',
                category: 'getting-started',
                action: async () => {
                    await this.runQuickDemo();
                }
            },
            {
                id: 'project-health-check',
                title: '🏥 Project Health Check',
                description: 'Quick analysis of your project\'s current state',
                icon: '$(pulse)',
                category: 'getting-started',
                action: async () => {
                    await this.runProjectHealthCheck();
                }
            },

            // Common Tasks
            {
                id: 'fix-common-issues',
                title: '🔧 Fix Common Issues',
                description: 'Automatically detect and fix typical code problems',
                icon: '$(tools)',
                category: 'common-tasks',
                action: async () => {
                    if (!this.orchestrator) await this.initialize();
                    await this.orchestrator!.executeWorkflow('auto-fix-workflow');
                }
            },
            {
                id: 'quality-check',
                title: '✅ Quality Check',
                description: 'Run comprehensive quality checks on your code',
                icon: '$(verified)',
                category: 'common-tasks',
                action: async () => {
                    if (!this.orchestrator) await this.initialize();
                    await this.orchestrator!.executeWorkflow('quick-quality-check');
                }
            },
            {
                id: 'code-review',
                title: '👁️ AI Code Review',
                description: 'Get detailed AI-powered code review and suggestions',
                icon: '$(search-view-icon)',
                category: 'common-tasks',
                action: async () => {
                    if (!this.orchestrator) await this.initialize();
                    await this.orchestrator!.executeWorkflow('comprehensive-analysis');
                }
            },
            {
                id: 'ask-claude',
                title: '💬 Ask Claude Anything',
                description: 'Get help with specific coding questions or problems',
                icon: '$(comment-discussion)',
                category: 'common-tasks',
                action: async () => {
                    await this.openClaudeChat();
                }
            },

            // Advanced Options
            {
                id: 'deployment-prep',
                title: '🚀 Prepare for Deployment',
                description: 'Comprehensive pre-deployment checks and optimization',
                icon: '$(rocket)',
                category: 'advanced',
                action: async () => {
                    if (!this.orchestrator) await this.initialize();
                    await this.orchestrator!.executeWorkflow('deployment-prep');
                }
            },
            {
                id: 'feature-planning',
                title: '🎯 Plan New Feature',
                description: 'Get guidance for implementing a new feature',
                icon: '$(lightbulb)',
                category: 'advanced',
                action: async () => {
                    if (!this.orchestrator) await this.initialize();
                    await this.orchestrator!.executeWorkflow('new-feature-setup');
                }
            },
            {
                id: 'custom-workflow',
                title: '🧙 Create Custom Workflow',
                description: 'Build a personalized automation workflow',
                icon: '$(settings-gear)',
                category: 'advanced',
                action: async () => {
                    await this.openWorkflowWizard();
                }
            }
        ];
    }

    async showQuickStart(): Promise<void> {
        const options = this.getQuickStartOptions();
        
        // Group options by category
        const categories = {
            'getting-started': options.filter(o => o.category === 'getting-started'),
            'common-tasks': options.filter(o => o.category === 'common-tasks'),
            'advanced': options.filter(o => o.category === 'advanced')
        };

        const panel = vscode.window.createWebviewPanel(
            'autoclaudeQuickStart',
            '⚡ AutoClaude Quick Start',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        panel.webview.html = this.generateQuickStartHTML(categories);

        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'executeOption':
                    const option = options.find(o => o.id === message.optionId);
                    if (option) {
                        try {
                            await option.action();
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to execute ${option.title}: ${error instanceof Error ? error.message : String(error)}`);
                        }
                    }
                    break;
                case 'close':
                    panel.dispose();
                    break;
            }
        });
    }

    private generateQuickStartHTML(categories: Record<string, QuickStartOption[]>): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AutoClaude Quick Start</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 10px;
            background: linear-gradient(135deg, var(--vscode-button-background), var(--vscode-button-hoverBackground));
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .category {
            margin-bottom: 40px;
        }
        .category h2 {
            color: var(--vscode-textLink-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 1.4em;
        }
        .options-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .option-card {
            background: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        .option-card:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-button-background);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .option-icon {
            font-size: 2em;
            margin-bottom: 10px;
            display: block;
        }
        .option-title {
            font-size: 1.2em;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
        }
        .option-description {
            color: var(--vscode-descriptionForeground);
            font-size: 0.95em;
            line-height: 1.4;
        }
        .getting-started .option-card {
            border-left: 4px solid #4CAF50;
        }
        .common-tasks .option-card {
            border-left: 4px solid #2196F3;
        }
        .advanced .option-card {
            border-left: 4px solid #FF9800;
        }
        .tips {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textLink-foreground);
            padding: 15px 20px;
            margin: 30px 0;
            border-radius: 0 8px 8px 0;
        }
        .tips h3 {
            margin-top: 0;
            color: var(--vscode-textLink-foreground);
        }
        .tips ul {
            margin-bottom: 0;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
            color: var(--vscode-descriptionForeground);
        }
        .close-button {
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
        }
        .close-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <button class="close-button" onclick="closeQuickStart()">✕ Close</button>
    
    <div class="header">
        <h1>⚡ AutoClaude Quick Start</h1>
        <p>Your AI-powered development assistant is ready to help!</p>
    </div>

    <div class="tips">
        <h3>💡 Pro Tips</h3>
        <ul>
            <li><strong>New to AutoClaude?</strong> Start with "First Time Setup" or "Quick Demo"</li>
            <li><strong>Need quick help?</strong> Try "Project Health Check" or "Ask Claude Anything"</li>
            <li><strong>Preparing for release?</strong> Use "Prepare for Deployment" workflow</li>
            <li><strong>Want automation?</strong> Explore our intelligent workflow system</li>
        </ul>
    </div>

    ${this.generateCategoryHTML('🚀 Getting Started', 'getting-started', categories['getting-started'])}
    ${this.generateCategoryHTML('⚡ Common Tasks', 'common-tasks', categories['common-tasks'])}
    ${this.generateCategoryHTML('🎯 Advanced Features', 'advanced', categories['advanced'])}

    <div class="footer">
        <p>Need help? Check our documentation or ask Claude directly!</p>
    </div>

    <script>
        function executeOption(optionId) {
            window.parent.postMessage({
                command: 'executeOption',
                optionId: optionId
            }, '*');
        }

        function closeQuickStart() {
            window.parent.postMessage({
                command: 'close'
            }, '*');
        }

        // Add click handlers to option cards
        document.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', () => {
                const optionId = card.dataset.optionId;
                executeOption(optionId);
            });
        });
    </script>
</body>
</html>`;
    }

    private generateCategoryHTML(title: string, className: string, options: QuickStartOption[]): string {
        const optionsHTML = options.map(option => `
            <div class="option-card" data-option-id="${option.id}">
                <div class="option-icon">${option.icon}</div>
                <div class="option-title">${option.title}</div>
                <div class="option-description">${option.description}</div>
            </div>
        `).join('');

        return `
            <div class="category ${className}">
                <h2>${title}</h2>
                <div class="options-grid">
                    ${optionsHTML}
                </div>
            </div>
        `;
    }

    private async showFirstTimeSetup(): Promise<void> {
        const steps = [
            'Welcome to AutoClaude! Let\'s get you set up.',
            'AutoClaude works best with Claude AI. Make sure you have Claude access.',
            'AutoClaude will analyze your code and help you improve it automatically.',
            'You can ask Claude questions, run quality checks, and automate common tasks.',
            'Let\'s run a quick health check on your current project.'
        ];

        for (let i = 0; i < steps.length; i++) {
            const choice = await vscode.window.showInformationMessage(
                `${steps[i]} (${i + 1}/${steps.length})`,
                i === steps.length - 1 ? 'Run Health Check' : 'Next',
                'Skip Setup'
            );

            if (choice === 'Skip Setup') {
                return;
            }

            if (choice === 'Run Health Check') {
                await this.runProjectHealthCheck();
                return;
            }
        }
    }

    private async runQuickDemo(): Promise<void> {
        await vscode.window.showInformationMessage(
            '🎬 AutoClaude Demo: I\'ll show you the key features in action!',
            'Start Demo'
        );

        // Start AutoClaude if not already running
        await vscode.commands.executeCommand('autoclaude.start');

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Run a quick quality check as demo
        await vscode.window.showInformationMessage(
            '🔍 Demo Step 1: Running quality checks on your project...',
            'Continue'
        );

        await vscode.commands.executeCommand('autoclaude.runScriptChecks');

        await new Promise(resolve => setTimeout(resolve, 2000));

        await vscode.window.showInformationMessage(
            '✨ Demo Complete! AutoClaude has analyzed your project. Check the AutoClaude panel for detailed results.',
            'Got it!'
        );
    }

    private async runProjectHealthCheck(): Promise<void> {
        if (!this.orchestrator) {
            await this.initialize();
        }

        const suggestedWorkflow = await this.orchestrator!.suggestWorkflow();
        
        if (suggestedWorkflow) {
            const choice = await vscode.window.showInformationMessage(
                `🏥 Health Check Complete! Based on your project, I recommend the "${suggestedWorkflow.name}" workflow.`,
                'Run Recommended Workflow',
                'View All Options',
                'Maybe Later'
            );

            switch (choice) {
                case 'Run Recommended Workflow':
                    await this.orchestrator!.executeWorkflow(suggestedWorkflow.id);
                    break;
                case 'View All Options':
                    await this.showQuickStart();
                    break;
            }
        } else {
            await vscode.window.showInformationMessage(
                '✅ Your project looks healthy! Consider running a comprehensive analysis to get detailed insights.',
                'Run Analysis',
                'Thanks!'
            );
        }
    }

    private async openClaudeChat(): Promise<void> {
        const message = await vscode.window.showInputBox({
            prompt: '💬 What would you like to ask Claude?',
            placeHolder: 'e.g., How can I improve this function? What are best practices for...?'
        });

        if (message) {
            // Start AutoClaude if not running
            await vscode.commands.executeCommand('autoclaude.start');
            // Add message to queue
            await vscode.commands.executeCommand('autoclaude.addMessage');
        }
    }

    private async openWorkflowWizard(): Promise<void> {
        await vscode.commands.executeCommand('autoclaude.workflowWizard');
    }
}