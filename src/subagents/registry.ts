import { SubAgentConfig, SubAgentExecutor } from './types';
import { ProductionReadinessAgent } from './agents/ProductionReadinessAgent';
import { BuildAgent } from './agents/BuildAgent';
import { TestAgent } from './agents/TestAgent';
import { FormatAgent } from './agents/FormatAgent';
import { GitHubActionsAgent } from './agents/GitHubActionsAgent';
import { ContextAwarenessAgent } from './agents/ContextAwarenessAgent';
import { TaskPlanningAgent } from './agents/TaskPlanningAgent';
import { DependencyResolutionAgent } from './agents/DependencyResolutionAgent';
import { CodeUnderstandingAgent } from './agents/CodeUnderstandingAgent';
import { IntegrationTestingAgent } from './agents/IntegrationTestingAgent';
import { PerformanceOptimizationAgent } from './agents/PerformanceOptimizationAgent';
import { SecurityAuditAgent } from './agents/SecurityAuditAgent';
import { debugLog } from '../utils/logging';

export class SubAgentRegistry {
    private agents: Map<string, SubAgentExecutor> = new Map();
    private configs: Map<string, SubAgentConfig> = new Map();
    private workspacePath: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.registerBuiltInAgents();
    }

    private registerBuiltInAgents(): void {
        // Register all built-in agents
        const builtInAgents = [
            // Basic quality agents
            new ProductionReadinessAgent(this.workspacePath),
            new BuildAgent(this.workspacePath),
            new TestAgent(this.workspacePath),
            new FormatAgent(this.workspacePath),
            new GitHubActionsAgent(this.workspacePath),
            
            // Advanced automation agents
            new ContextAwarenessAgent(this.workspacePath),
            new TaskPlanningAgent(this.workspacePath),
            new DependencyResolutionAgent(this.workspacePath),
            new CodeUnderstandingAgent(this.workspacePath),
            new IntegrationTestingAgent(this.workspacePath),
            new PerformanceOptimizationAgent(this.workspacePath),
            new SecurityAuditAgent(this.workspacePath)
        ];

        builtInAgents.forEach(agent => {
            this.registerAgent(agent);
        });

        debugLog(`Registered ${builtInAgents.length} built-in sub-agents`);
    }

    registerAgent(agent: SubAgentExecutor): void {
        this.agents.set(agent.id, agent);
        debugLog(`Registered sub-agent: ${agent.id}`);
    }

    getAgent(id: string): SubAgentExecutor | undefined {
        return this.agents.get(id);
    }

    getAllAgents(): SubAgentExecutor[] {
        return Array.from(this.agents.values());
    }

    getEnabledAgents(): SubAgentExecutor[] {
        // In the future, we'll check config for enabled status
        return this.getAllAgents();
    }

    getAgentsByCategory(category: string): SubAgentExecutor[] {
        return this.getAllAgents().filter(agent => {
            // We'll need to expose category from agents
            return true; // Placeholder
        });
    }

    // Custom agent support for future
    async loadCustomAgents(): Promise<void> {
        // TODO: Load custom agents from .autoclaude/agents folder
        debugLog('Custom agent loading not yet implemented');
    }
}