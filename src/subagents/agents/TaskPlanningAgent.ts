import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';

export class TaskPlanningAgent extends SubAgent {
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'task-planning',
            name: 'Task Planning Agent',
            description: 'Breaks down complex tasks into manageable steps and creates execution plans',
            category: 'automation',
            enabled: true,
            icon: '📋',
            capabilities: [
                {
                    id: 'decompose-task',
                    name: 'Decompose Complex Tasks',
                    description: 'Break down large tasks into smaller, actionable steps',
                    action: 'analyze'
                },
                {
                    id: 'create-execution-plan',
                    name: 'Create Execution Plan',
                    description: 'Generate ordered steps with dependencies',
                    action: 'generate'
                },
                {
                    id: 'estimate-complexity',
                    name: 'Estimate Task Complexity',
                    description: 'Assess difficulty and time requirements',
                    action: 'analyze'
                },
                {
                    id: 'suggest-approach',
                    name: 'Suggest Implementation Approach',
                    description: 'Recommend best practices and patterns',
                    action: 'suggest'
                }
            ],
            systemPrompt: `You are a Task Planning specialist sub-agent. Your role is to:
1. Decompose complex user requests into clear, actionable steps
2. Create detailed execution plans with proper ordering
3. Identify dependencies between tasks
4. Estimate complexity and potential challenges
5. Suggest the best implementation approach
6. Break down vague requirements into concrete tasks
7. Ensure no steps are missed in the implementation
8. Create checkpoints for validation
9. Plan for error handling and edge cases
10. Generate comprehensive todo lists for Claude

You help Claude work systematically and ensure complete implementations by providing clear roadmaps.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        if (!context.userMessage) {
            return 'No task provided to plan.';
        }
        
        analysis.push('📋 Task Planning Analysis:');
        analysis.push('');
        
        // Analyze task complexity
        const complexity = this.assessComplexity(context.userMessage);
        analysis.push(`Task Complexity: ${complexity.level} (${complexity.score}/10)`);
        analysis.push(`Estimated Steps: ${complexity.estimatedSteps}`);
        analysis.push('');
        
        // Generate task breakdown
        analysis.push('🔧 Suggested Task Breakdown:');
        const tasks = this.generateTaskBreakdown(context.userMessage);
        tasks.forEach((task, index) => {
            analysis.push(`${index + 1}. ${task}`);
        });
        analysis.push('');
        
        // Add implementation notes
        analysis.push('📝 Implementation Notes:');
        analysis.push('- Start with the most critical functionality first');
        analysis.push('- Write tests for each component before implementation');
        analysis.push('- Validate each step before moving to the next');
        analysis.push('- Consider edge cases and error scenarios');
        analysis.push('- Document decisions and assumptions');
        
        return analysis.join('\n');
    }
    
    private assessComplexity(message: string): { level: string; score: number; estimatedSteps: number } {
        let score = 1;
        
        // Keywords that increase complexity
        const complexityIndicators = {
            high: ['refactor', 'migrate', 'redesign', 'optimize', 'integrate', 'architecture'],
            medium: ['implement', 'add', 'create', 'update', 'modify', 'enhance'],
            low: ['fix', 'change', 'adjust', 'rename', 'move', 'remove']
        };
        
        // Check for multiple requirements (and, also, plus, with)
        const multipleRequirements = (message.match(/\b(and|also|plus|with|including)\b/gi) || []).length;
        score += multipleRequirements * 2;
        
        // Check for complexity keywords
        for (const [level, keywords] of Object.entries(complexityIndicators)) {
            for (const keyword of keywords) {
                if (message.toLowerCase().includes(keyword)) {
                    score += level === 'high' ? 3 : level === 'medium' ? 2 : 1;
                }
            }
        }
        
        // Estimate steps based on score
        const estimatedSteps = Math.min(Math.max(Math.floor(score * 1.5), 3), 20);
        
        return {
            level: score > 7 ? 'High' : score > 4 ? 'Medium' : 'Low',
            score: Math.min(score, 10),
            estimatedSteps
        };
    }
    
    private generateTaskBreakdown(message: string): string[] {
        const tasks: string[] = [];
        
        // Common task patterns based on keywords
        const lowerMessage = message.toLowerCase();
        
        // Feature implementation
        if (lowerMessage.includes('implement') || lowerMessage.includes('add') || lowerMessage.includes('create')) {
            tasks.push('Analyze requirements and existing code structure');
            tasks.push('Design the solution architecture');
            tasks.push('Create necessary interfaces and types');
            tasks.push('Implement core functionality');
            tasks.push('Add error handling and validation');
            tasks.push('Write comprehensive tests');
            tasks.push('Update documentation');
        }
        
        // Bug fixing
        else if (lowerMessage.includes('fix') || lowerMessage.includes('bug') || lowerMessage.includes('issue')) {
            tasks.push('Reproduce the issue');
            tasks.push('Identify root cause');
            tasks.push('Implement the fix');
            tasks.push('Add tests to prevent regression');
            tasks.push('Verify fix doesn\'t break existing functionality');
        }
        
        // Refactoring
        else if (lowerMessage.includes('refactor') || lowerMessage.includes('improve') || lowerMessage.includes('optimize')) {
            tasks.push('Analyze current implementation');
            tasks.push('Identify improvement opportunities');
            tasks.push('Create refactoring plan');
            tasks.push('Implement changes incrementally');
            tasks.push('Ensure all tests pass');
            tasks.push('Measure performance improvements');
            tasks.push('Update documentation');
        }
        
        // Default breakdown
        else {
            tasks.push('Understand the requirement');
            tasks.push('Research similar implementations');
            tasks.push('Design the solution');
            tasks.push('Implement the changes');
            tasks.push('Test the implementation');
            tasks.push('Document the changes');
        }
        
        return tasks;
    }
}