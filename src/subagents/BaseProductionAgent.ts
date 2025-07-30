import { SubAgent } from './SubAgent';
import { SubAgentConfig, SubAgentRequest, SubAgentResponse, SubAgentAction, SubAgentContext } from './types';
import { debugLog } from '../utils/logging';

/**
 * Base class for production-ready sub-agents with simplified API
 */
export abstract class BaseProductionAgent extends SubAgent {
    // Simple properties for derived classes
    abstract name: string;
    abstract description: string;
    abstract capabilities: string[];
    
    constructor(workspaceRoot: string) {
        // Create config from abstract properties
        const config: SubAgentConfig = {
            id: 'base-agent',
            name: 'Base Agent',
            description: 'Base production agent',
            capabilities: [],
            enabled: true,
            category: 'automation',
            systemPrompt: 'You are a production-ready automation agent.'
        };
        
        super(config, workspaceRoot);
        
        // Update config after construction
        setTimeout(() => {
            this.config.id = this.name.toLowerCase().replace(/\s+/g, '-');
            this.config.name = this.name;
            this.config.description = this.description;
            this.config.capabilities = this.capabilities.map((cap, index) => ({
                id: `cap-${index}`,
                name: cap,
                description: cap,
                action: 'analyze' as SubAgentAction
            }));
        }, 0);
    }
    
    // Provide access to workspaceRoot for derived classes
    protected get workspaceRoot(): string {
        return this.workspacePath;
    }
    
    /**
     * Override analyzeResults to match SubAgent interface
     */
    async analyzeResults(context: SubAgentContext): Promise<string> {
        // Default implementation - can be overridden by subclasses
        return 'Analysis complete';
    }
    
    /**
     * Simplified execute method for production agents
     */
    abstract executeSimple(spec?: string): Promise<{ success: boolean; message: string }>;
    
    /**
     * Bridge to SubAgent execute method
     */
    async execute(request: SubAgentRequest): Promise<SubAgentResponse> {
        try {
            const result = await this.executeSimple(request.prompt);
            
            return {
                success: result.success,
                message: result.message,
                confidence: result.success ? 'high' : 'low'
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Agent execution failed: ${error.message}`,
                confidence: 'low'
            };
        }
    }
}