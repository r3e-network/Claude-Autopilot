import * as vscode from 'vscode';
import { debugLog } from '../utils/logging';
import { ScriptRunner } from '../scripts';
import { SubAgentRunner } from '../subagents/SubAgentRunner';
import { addMessageToQueueFromWebview } from '../queue';
import { analyzeClaudeOutput } from '../claude/analyzer';

export interface WorkflowStep {
    id: string;
    name: string;
    description: string;
    type: 'script' | 'subagent' | 'claude' | 'user-input';
    config: any;
    dependencies?: string[];
    autoExecute?: boolean;
}

export interface WorkflowTemplate {
    id: string;
    name: string;
    description: string;
    category: 'development' | 'quality' | 'deployment' | 'maintenance';
    steps: WorkflowStep[];
    estimatedTime: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export class WorkflowOrchestrator {
    private workspacePath: string;
    private scriptRunner?: ScriptRunner;
    private subAgentRunner?: SubAgentRunner;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
    }

    async initialize(): Promise<void> {
        this.scriptRunner = new ScriptRunner(this.workspacePath);
        this.subAgentRunner = new SubAgentRunner(this.workspacePath);

        await Promise.all([
            this.scriptRunner.initialize(),
            this.subAgentRunner.initialize()
        ]);
    }

    getWorkflowTemplates(): WorkflowTemplate[] {
        return [
            {
                id: 'quick-quality-check',
                name: '⚡ Quick Quality Check',
                description: 'Run essential quality checks on your project',
                category: 'quality',
                estimatedTime: '2-3 minutes',
                difficulty: 'beginner',
                steps: [
                    {
                        id: 'production-readiness',
                        name: 'Check Production Readiness',
                        description: 'Scan for TODOs, debug statements, and incomplete code',
                        type: 'script',
                        config: { scriptId: 'production-readiness' },
                        autoExecute: true
                    },
                    {
                        id: 'build-verification',
                        name: 'Verify Build',
                        description: 'Ensure project compiles successfully',
                        type: 'script',
                        config: { scriptId: 'build-check' },
                        autoExecute: true
                    },
                    {
                        id: 'format-check',
                        name: 'Check Code Format',
                        description: 'Verify code formatting and linting',
                        type: 'script',
                        config: { scriptId: 'format-check' },
                        autoExecute: true
                    }
                ]
            },
            {
                id: 'comprehensive-analysis',
                name: '🔍 Comprehensive Code Analysis',
                description: 'Deep analysis with AI-powered insights',
                category: 'quality',
                estimatedTime: '5-10 minutes',
                difficulty: 'intermediate',
                steps: [
                    {
                        id: 'context-analysis',
                        name: 'Analyze Project Context',
                        description: 'Understand project structure and dependencies',
                        type: 'subagent',
                        config: { agentId: 'context-awareness' },
                        autoExecute: true
                    },
                    {
                        id: 'security-audit',
                        name: 'Security Audit',
                        description: 'Scan for security vulnerabilities',
                        type: 'subagent',
                        config: { agentId: 'security-audit' },
                        autoExecute: true
                    },
                    {
                        id: 'performance-analysis',
                        name: 'Performance Analysis',
                        description: 'Identify performance bottlenecks',
                        type: 'subagent',
                        config: { agentId: 'performance-optimization' },
                        autoExecute: true
                    },
                    {
                        id: 'claude-review',
                        name: 'AI Code Review',
                        description: 'Get detailed AI feedback on your code',
                        type: 'claude',
                        config: { 
                            prompt: 'Please review this codebase and provide detailed feedback on architecture, code quality, and potential improvements.' 
                        },
                        dependencies: ['context-analysis', 'security-audit', 'performance-analysis']
                    }
                ]
            },
            {
                id: 'auto-fix-workflow',
                name: '🔧 Auto-Fix Common Issues',
                description: 'Automatically detect and fix common code issues',
                category: 'maintenance',
                estimatedTime: '3-8 minutes',
                difficulty: 'intermediate',
                steps: [
                    {
                        id: 'issue-detection',
                        name: 'Detect Issues',
                        description: 'Scan for common issues and problems',
                        type: 'script',
                        config: { 
                            scriptIds: ['production-readiness', 'build-check', 'test-check'],
                            continueOnError: true
                        },
                        autoExecute: true
                    },
                    {
                        id: 'auto-fix-analysis',
                        name: 'Analyze Fixable Issues',
                        description: 'Determine which issues can be automatically fixed',
                        type: 'claude',
                        config: {
                            prompt: 'Based on the script results, identify issues that can be automatically fixed and provide specific fix instructions.'
                        },
                        dependencies: ['issue-detection']
                    },
                    {
                        id: 'apply-fixes',
                        name: 'Apply Automated Fixes',
                        description: 'Apply the suggested fixes automatically',
                        type: 'claude',
                        config: {
                            prompt: 'Please implement the previously identified fixes. Focus on safe, automated improvements that don\'t change business logic.'
                        },
                        dependencies: ['auto-fix-analysis']
                    },
                    {
                        id: 'verify-fixes',
                        name: 'Verify Applied Fixes',
                        description: 'Confirm fixes were applied successfully',
                        type: 'script',
                        config: { 
                            scriptIds: ['production-readiness', 'build-check', 'format-check']
                        },
                        dependencies: ['apply-fixes']
                    }
                ]
            },
            {
                id: 'deployment-prep',
                name: '🚀 Deployment Preparation',
                description: 'Comprehensive checks before deployment',
                category: 'deployment',
                estimatedTime: '10-15 minutes',
                difficulty: 'advanced',
                steps: [
                    {
                        id: 'all-quality-checks',
                        name: 'Run All Quality Checks',
                        description: 'Execute comprehensive quality verification',
                        type: 'script',
                        config: { 
                            scriptIds: ['production-readiness', 'build-check', 'test-check', 'format-check', 'github-actions'],
                            stopOnFailure: true
                        },
                        autoExecute: true
                    },
                    {
                        id: 'security-final-check',
                        name: 'Final Security Review',
                        description: 'Comprehensive security audit',
                        type: 'subagent',
                        config: { agentId: 'security-audit' },
                        dependencies: ['all-quality-checks'],
                        autoExecute: true
                    },
                    {
                        id: 'performance-validation',
                        name: 'Performance Validation',
                        description: 'Ensure performance standards are met',
                        type: 'subagent',
                        config: { agentId: 'performance-optimization' },
                        dependencies: ['all-quality-checks'],
                        autoExecute: true
                    },
                    {
                        id: 'deployment-checklist',
                        name: 'Generate Deployment Checklist',
                        description: 'Create a final deployment checklist',
                        type: 'claude',
                        config: {
                            prompt: 'Based on all the analysis results, generate a comprehensive deployment checklist with any remaining tasks or considerations.'
                        },
                        dependencies: ['security-final-check', 'performance-validation']
                    }
                ]
            },
            {
                id: 'new-feature-setup',
                name: '✨ New Feature Development Setup',
                description: 'Set up development environment for a new feature',
                category: 'development',
                estimatedTime: '5-10 minutes',
                difficulty: 'intermediate',
                steps: [
                    {
                        id: 'project-analysis',
                        name: 'Analyze Current Project',
                        description: 'Understand existing codebase structure',
                        type: 'subagent',
                        config: { agentId: 'context-awareness' },
                        autoExecute: true
                    },
                    {
                        id: 'task-planning',
                        name: 'Plan Feature Implementation',
                        description: 'Create detailed implementation plan',
                        type: 'subagent',
                        config: { agentId: 'task-planning' },
                        dependencies: ['project-analysis']
                    },
                    {
                        id: 'feature-guidance',
                        name: 'Get Implementation Guidance',
                        description: 'Receive step-by-step development guidance',
                        type: 'claude',
                        config: {
                            prompt: 'Based on the project analysis and task planning, provide detailed step-by-step guidance for implementing this new feature, including best practices and potential pitfalls to avoid.'
                        },
                        dependencies: ['task-planning']
                    }
                ]
            }
        ];
    }

    async executeWorkflow(templateId: string, userInputs?: Record<string, any>): Promise<void> {
        const template = this.getWorkflowTemplates().find(t => t.id === templateId);
        if (!template) {
            throw new Error(`Workflow template '${templateId}' not found`);
        }

        debugLog(`🧙 Starting workflow: ${template.name}`);
        
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Executing ${template.name}`,
            cancellable: true
        }, async (progress, token) => {
            const totalSteps = template.steps.length;
            const completedSteps = new Set<string>();
            const stepResults = new Map<string, any>();

            for (let i = 0; i < template.steps.length; i++) {
                const step = template.steps[i];
                
                if (token.isCancellationRequested) {
                    debugLog('Workflow cancelled by user');
                    return;
                }

                // Check dependencies
                if (step.dependencies) {
                    const unmetDependencies = step.dependencies.filter(dep => !completedSteps.has(dep));
                    if (unmetDependencies.length > 0) {
                        debugLog(`Skipping step '${step.id}' - unmet dependencies: ${unmetDependencies.join(', ')}`);
                        continue;
                    }
                }

                progress.report({
                    increment: (100 / totalSteps),
                    message: `${step.name} (${i + 1}/${totalSteps})`
                });

                try {
                    const result = await this.executeWorkflowStep(step, stepResults, userInputs);
                    stepResults.set(step.id, result);
                    completedSteps.add(step.id);
                    
                    debugLog(`✅ Completed step: ${step.name}`);
                } catch (error) {
                    debugLog(`❌ Failed step: ${step.name} - ${error}`);
                    
                    const shouldContinue = await vscode.window.showWarningMessage(
                        `Step "${step.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
                        'Continue Anyway',
                        'Stop Workflow'
                    );
                    
                    if (shouldContinue !== 'Continue Anyway') {
                        return;
                    }
                }
            }

            debugLog(`🎉 Workflow completed: ${template.name}`);
            vscode.window.showInformationMessage(`✅ Workflow "${template.name}" completed successfully!`);
        });
    }

    private async executeWorkflowStep(
        step: WorkflowStep, 
        previousResults: Map<string, any>,
        userInputs?: Record<string, any>
    ): Promise<any> {
        switch (step.type) {
            case 'script':
                return await this.executeScriptStep(step);
            
            case 'subagent':
                return await this.executeSubAgentStep(step);
            
            case 'claude':
                return await this.executeClaudeStep(step, previousResults);
            
            case 'user-input':
                return await this.executeUserInputStep(step, userInputs);
            
            default:
                throw new Error(`Unknown step type: ${(step as any).type}`);
        }
    }

    private async executeScriptStep(step: WorkflowStep): Promise<any> {
        if (!this.scriptRunner) {
            throw new Error('Script runner not initialized');
        }

        const { scriptId, scriptIds, stopOnFailure, continueOnError } = step.config;

        if (scriptIds) {
            // Multiple scripts
            const results = new Map();
            for (const id of scriptIds) {
                const result = await this.scriptRunner.runSingleCheck(id);
                results.set(id, result);
                
                if (stopOnFailure && result && !result.passed) {
                    throw new Error(`Script ${id} failed: ${result.errors?.join(', ')}`);
                }
            }
            return results;
        } else {
            // Single script
            const result = await this.scriptRunner.runSingleCheck(scriptId);
            if (result && !result.passed && !continueOnError) {
                throw new Error(`Script failed: ${result.errors?.join(', ')}`);
            }
            return result;
        }
    }

    private async executeSubAgentStep(step: WorkflowStep): Promise<any> {
        if (!this.subAgentRunner) {
            throw new Error('Sub-agent runner not initialized');
        }

        const { agentId } = step.config;
        const result = await this.subAgentRunner.runSingleAgent(agentId);
        
        if (result && !result.passed) {
            // Don't throw error for sub-agents, just return the result
            debugLog(`Sub-agent ${agentId} found issues: ${result.errors?.join(', ')}`);
        }
        
        return result;
    }

    private async executeClaudeStep(step: WorkflowStep, previousResults: Map<string, any>): Promise<any> {
        const { prompt } = step.config;
        
        // Build context from previous results
        let contextualPrompt = prompt;
        if (previousResults.size > 0) {
            contextualPrompt += '\n\nContext from previous steps:\n';
            for (const [stepId, result] of previousResults) {
                contextualPrompt += `\n${stepId}: ${JSON.stringify(result, null, 2)}\n`;
            }
        }

        // Add to Claude queue
        addMessageToQueueFromWebview(contextualPrompt);
        
        // Wait for Claude to process (simplified - in practice you'd want proper queue monitoring)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return { prompt: contextualPrompt, queued: true };
    }

    private async executeUserInputStep(step: WorkflowStep, userInputs?: Record<string, any>): Promise<any> {
        const inputKey = step.config.inputKey || step.id;
        
        if (userInputs && userInputs[inputKey]) {
            return { input: userInputs[inputKey] };
        }

        const input = await vscode.window.showInputBox({
            prompt: step.description,
            placeHolder: step.config.placeholder || 'Enter your input...'
        });

        if (!input) {
            throw new Error('User input required but not provided');
        }

        return { input };
    }

    async suggestWorkflow(): Promise<WorkflowTemplate | null> {
        if (!this.scriptRunner) {
            await this.initialize();
        }

        // Run quick analysis to suggest appropriate workflow
        const quickResults = await this.scriptRunner!.runChecks(true);
        
        if (!quickResults.allPassed) {
            const failedChecks = Array.from(quickResults.results.entries())
                .filter(([_, result]) => !result.passed)
                .map(([scriptId, _]) => scriptId);

            if (failedChecks.length > 2) {
                return this.getWorkflowTemplates().find(t => t.id === 'auto-fix-workflow') || null;
            } else {
                return this.getWorkflowTemplates().find(t => t.id === 'quick-quality-check') || null;
            }
        }

        // If everything passes, suggest comprehensive analysis
        return this.getWorkflowTemplates().find(t => t.id === 'comprehensive-analysis') || null;
    }
}