import { ScriptResult } from '../scripts';

export interface SubAgentConfig {
    id: string;
    name: string;
    description: string;
    category: 'quality' | 'automation' | 'analysis' | 'optimization' | 'security' | 'custom';
    enabled: boolean;
    capabilities: SubAgentCapability[];
    checkScript?: string; // Path to shell script for checking
    systemPrompt: string; // Sub-agent's specialized system prompt
    icon?: string;
    order?: number;
}

export interface SubAgentCapability {
    id: string;
    name: string;
    description: string;
    action: SubAgentAction;
}

export type SubAgentAction = 
    | 'analyze' // Analyze code/results
    | 'fix' // Fix issues
    | 'suggest' // Suggest improvements
    | 'refactor' // Refactor code
    | 'generate' // Generate code/docs
    | 'validate' // Validate changes
    | 'optimize' // Optimize performance
    | 'secure' // Security improvements
    | 'test' // Generate/improve tests
    | 'document'; // Generate documentation

export interface SubAgentContext {
    workspacePath: string;
    scriptResult?: ScriptResult;
    previousAnalysis?: string;
    iterationCount: number;
    maxIterations: number;
    userMessage?: string;
    currentCode?: string;
}

export interface SubAgentRequest {
    action: SubAgentAction;
    context: SubAgentContext;
    prompt: string;
    confidence?: 'high' | 'medium' | 'low';
}

export interface SubAgentResponse {
    success: boolean;
    message: string;
    suggestedActions?: SubAgentAction[];
    confidence: 'high' | 'medium' | 'low';
    requiresUserApproval?: boolean;
    code?: string;
    analysis?: string;
}

export interface SubAgentExecutor {
    id: string;
    execute(request: SubAgentRequest): Promise<SubAgentResponse>;
    runCheck(): Promise<ScriptResult>;
    getCapabilities(): SubAgentCapability[];
}