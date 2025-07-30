import * as vscode from 'vscode';
import * as path from 'path';
import { SubAgentRegistry } from './registry';
import { SubAgentExecutor, SubAgentRequest, SubAgentContext } from './types';
import { ScriptResult } from '../scripts';
import { MessageItem } from '../core/types';
import { debugLog } from '../utils/logging';
import { addMessageToQueueFromWebview } from '../queue';
import { setSubAgentMessageHandler } from './SubAgent';

export interface SubAgentRunnerConfig {
    enabledAgents: string[];
    maxIterations: number;
    continueOnError: boolean;
    agentOrder: string[];
}

export class SubAgentRunner {
    private registry: SubAgentRegistry;
    private config: SubAgentRunnerConfig;
    private workspacePath: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.registry = new SubAgentRegistry(workspacePath);
        this.config = {
            enabledAgents: [
                // Basic quality agents
                'production-readiness', 
                'build-check', 
                'test-check', 
                'format-check', 
                'github-actions',
                // Advanced automation agents
                'context-awareness',
                'task-planning',
                'dependency-resolution',
                'code-understanding',
                'integration-testing',
                'performance-optimization',
                'security-audit'
            ],
            maxIterations: 5,
            continueOnError: false,
            agentOrder: []
        };
    }

    async initialize(): Promise<void> {
        // Set up message handler for SubAgents
        setSubAgentMessageHandler((message: string) => {
            addMessageToQueueFromWebview(message);
        });
        
        // Load custom agents
        await this.registry.loadCustomAgents();
        
        // Load configuration
        await this.loadConfig();
    }

    private async loadConfig(): Promise<void> {
        // Configuration is loaded from VS Code settings
        // Future enhancement: Consider .autoclaude/subagents.json for per-project settings
        debugLog('SubAgent configuration loaded');
    }

    async runSingleAgent(agentId: string): Promise<ScriptResult | null> {
        const agent = this.registry.getAgent(agentId);
        if (!agent) {
            debugLog(`Agent not found: ${agentId}`);
            return null;
        }

        debugLog(`🤖 Running sub-agent: ${agentId}`);
        return await agent.runCheck();
    }

    async runAgentAnalysis(agentId: string, scriptResult: ScriptResult): Promise<void> {
        const agent = this.registry.getAgent(agentId);
        if (!agent) {
            debugLog(`Agent not found: ${agentId}`);
            return;
        }

        const context: SubAgentContext = {
            workspacePath: this.workspacePath,
            scriptResult,
            iterationCount: 0,
            maxIterations: this.config.maxIterations
        };

        const request: SubAgentRequest = {
            action: 'analyze',
            context,
            prompt: 'Analyze the check results and provide detailed recommendations.',
            confidence: 'high'
        };

        await agent.execute(request);
    }

    async runAllAgents(stopOnFailure: boolean = false): Promise<{ allPassed: boolean; results: Map<string, ScriptResult> }> {
        const results = new Map<string, ScriptResult>();
        let allPassed = true;

        const enabledAgents = this.config.enabledAgents
            .map(id => this.registry.getAgent(id))
            .filter(agent => agent !== undefined) as SubAgentExecutor[];

        for (const agent of enabledAgents) {
            debugLog(`🤖 Running sub-agent check: ${agent.id}`);
            
            const result = await agent.runCheck();
            results.set(agent.id, result);

            if (!result.passed) {
                allPassed = false;
                
                if (stopOnFailure) {
                    debugLog(`⛔ Stopping on first failure: ${agent.id}`);
                    break;
                }
            }
        }

        return { allPassed, results };
    }

    async runAgentLoop(forceAnalysis: boolean = false): Promise<void> {
        let iteration = 0;
        
        debugLog(`\n=== Starting Sub-Agent Loop ===`);
        
        // Initial check
        let { allPassed, results } = await this.runAllAgents();
        
        if (allPassed) {
            if (!forceAnalysis) {
                const analyze = await vscode.window.showInformationMessage(
                    'All agent checks pass! Would you like the agents to analyze for improvements anyway?',
                    'Yes, Analyze',
                    'No, Exit'
                );
                
                if (analyze !== 'Yes, Analyze') {
                    return;
                }
            }
            
            // Have each agent analyze even though checks pass
            for (const [agentId, result] of results) {
                await this.runAgentAnalysis(agentId, result);
            }
            
            vscode.window.showInformationMessage('Sub-agents are analyzing for improvements');
            return;
        }

        while (iteration < this.config.maxIterations && !allPassed) {
            iteration++;
            debugLog(`\n=== Sub-Agent Loop Iteration ${iteration}/${this.config.maxIterations} ===`);
            
            // Have failing agents provide analysis and fixes
            for (const [agentId, result] of results) {
                if (!result.passed) {
                    const agent = this.registry.getAgent(agentId);
                    if (agent) {
                        const context: SubAgentContext = {
                            workspacePath: this.workspacePath,
                            scriptResult: result,
                            iterationCount: iteration,
                            maxIterations: this.config.maxIterations
                        };

                        const request: SubAgentRequest = {
                            action: 'fix',
                            context,
                            prompt: `Fix the issues found by your check. Iteration ${iteration} of ${this.config.maxIterations}.`,
                            confidence: 'high'
                        };

                        await agent.execute(request);
                    }
                }
            }
            
            // Show progress
            vscode.window.showInformationMessage(`Sub-agent iteration ${iteration}: Waiting for fixes...`);
            
            // Wait for processing
            await this.waitForProcessing();
            
            // Run checks again
            const newResults = await this.runAllAgents();
            allPassed = newResults.allPassed;
            results = newResults.results;
            
            if (allPassed) {
                vscode.window.showInformationMessage(`✅ All agent checks passed after ${iteration} iteration(s)!`);
                return;
            }
        }
        
        if (!allPassed) {
            vscode.window.showWarningMessage(`⚠️ Maximum iterations (${this.config.maxIterations}) reached. Some checks still failing.`);
        }
    }

    async runMessageWithAgents(message: MessageItem): Promise<void> {
        debugLog(`\n=== Running Message with Sub-Agents: ${message.text.substring(0, 50)}... ===`);
        
        // Process the message first
        vscode.window.showInformationMessage('Processing message with sub-agent support...');
        
        // Wait for message completion
        await this.waitForMessageCompletion(message.id);
        
        // Run agent checks and loop
        await this.runAgentLoop();
    }

    private async waitForProcessing(): Promise<void> {
        // Wait for processing completion with fixed delay
        // Future enhancement: Real-time queue monitoring
        const waitTime = 60000; // 60 seconds
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    private async waitForMessageCompletion(messageId: string): Promise<void> {
        const { messageQueue } = await import('../core/state');
        const timeout = 300000; // 5 minutes
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                const message = messageQueue.find(m => m.id === messageId);
                
                if (!message || message.status === 'completed') {
                    clearInterval(checkInterval);
                    resolve();
                } else if (message.status === 'error') {
                    clearInterval(checkInterval);
                    reject(new Error(`Message processing failed: ${message.error}`));
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout waiting for message completion'));
                }
            }, 1000);
        });
    }

    getRegistry(): SubAgentRegistry {
        return this.registry;
    }

    getConfig(): SubAgentRunnerConfig {
        return this.config;
    }

    async updateConfig(config: Partial<SubAgentRunnerConfig>): Promise<void> {
        this.config = { ...this.config, ...config };
        // Configuration is stored in memory and VS Code settings
        // Future enhancement: Persist custom configurations to .autoclaude/subagents.json
    }
}