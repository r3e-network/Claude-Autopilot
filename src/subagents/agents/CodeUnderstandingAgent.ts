import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);

export class CodeUnderstandingAgent extends SubAgent {
    private codebaseMap: Map<string, any> = new Map();
    
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'code-understanding',
            name: 'Code Understanding Agent',
            description: 'Deeply analyzes code patterns, structures, and semantics to guide development',
            category: 'analysis',
            enabled: true,
            icon: '🔍',
            capabilities: [
                {
                    id: 'analyze-patterns',
                    name: 'Analyze Code Patterns',
                    description: 'Identify design patterns, coding conventions, and architectural styles',
                    action: 'analyze'
                },
                {
                    id: 'extract-interfaces',
                    name: 'Extract Interfaces and APIs',
                    description: 'Document public interfaces, APIs, and contracts',
                    action: 'analyze'
                },
                {
                    id: 'find-similar-code',
                    name: 'Find Similar Code',
                    description: 'Locate similar implementations for consistency',
                    action: 'analyze'
                },
                {
                    id: 'suggest-refactoring',
                    name: 'Suggest Refactoring Opportunities',
                    description: 'Identify code that can be improved or consolidated',
                    action: 'suggest'
                },
                {
                    id: 'generate-documentation',
                    name: 'Generate Code Documentation',
                    description: 'Create comprehensive documentation for complex code',
                    action: 'generate'
                }
            ],
            checkScript: '.autoclaude/scripts/code-understanding-check.sh',
            systemPrompt: `You are a Code Understanding specialist sub-agent. Your role is to:
1. Deeply analyze code structure, patterns, and architecture
2. Understand the intent and purpose of existing code
3. Identify design patterns and architectural decisions
4. Extract public interfaces, APIs, and contracts
5. Map data flow and control flow through the application
6. Identify similar code patterns for consistency
7. Suggest refactoring opportunities and improvements
8. Generate comprehensive documentation
9. Understand the domain logic and business rules
10. Provide context for how new code should integrate

You help Claude write code that fits naturally with existing patterns and maintains consistency.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        analysis.push('🔍 Code Understanding Analysis:');
        analysis.push('');
        
        // Analyze codebase structure
        const structure = await this.analyzeCodebaseStructure();
        analysis.push(`Total Lines of Code: ${structure.totalLines}`);
        analysis.push(`Main Languages: ${structure.languages.join(', ')}`);
        analysis.push(`Complexity Score: ${structure.complexityScore}/10`);
        analysis.push('');
        
        // Identify patterns
        const patterns = await this.identifyCodePatterns();
        if (patterns.length > 0) {
            analysis.push('🎯 Identified Patterns:');
            patterns.forEach(pattern => {
                analysis.push(`- ${pattern.name}: ${pattern.description} (${pattern.frequency} occurrences)`);
            });
            analysis.push('');
        }
        
        // Find refactoring opportunities
        const refactoring = await this.findRefactoringOpportunities();
        if (refactoring.length > 0) {
            analysis.push('🔧 Refactoring Opportunities:');
            refactoring.forEach(opp => {
                analysis.push(`- ${opp.type}: ${opp.description} (Impact: ${opp.impact})`);
            });
            analysis.push('');
        }
        
        analysis.push('💡 Code Integration Recommendations:');
        analysis.push('1. Follow existing naming conventions and patterns');
        analysis.push('2. Use similar error handling approaches');
        analysis.push('3. Maintain consistent code organization');
        analysis.push('4. Follow the established architectural style');
        analysis.push('5. Add appropriate documentation and comments');
        
        return analysis.join('\n');
    }
    
    private async analyzeCodebaseStructure(): Promise<any> {
        const structure = {
            totalLines: 0,
            languages: [] as string[],
            complexityScore: 0
        };
        
        try {
            // Count lines of code by language
            const extensions = [
                { ext: 'ts', lang: 'TypeScript' },
                { ext: 'js', lang: 'JavaScript' },
                { ext: 'py', lang: 'Python' },
                { ext: 'go', lang: 'Go' },
                { ext: 'rs', lang: 'Rust' },
                { ext: 'java', lang: 'Java' },
                { ext: 'cpp', lang: 'C++' },
                { ext: 'c', lang: 'C' }
            ];
            
            for (const { ext, lang } of extensions) {
                try {
                    const { stdout } = await execAsync(`find . -name "*.${ext}" -not -path "./node_modules/*" -not -path "./.git/*" | xargs wc -l | tail -1`, {
                        cwd: this.workspacePath
                    });
                    
                    const lines = parseInt(stdout.trim().split(' ')[0]) || 0;
                    if (lines > 0) {
                        structure.totalLines += lines;
                        structure.languages.push(lang);
                    }
                } catch {
                    // Ignore if no files found
                }
            }
            
            // Calculate complexity score based on various factors
            structure.complexityScore = Math.min(Math.floor(structure.totalLines / 1000) + structure.languages.length, 10);
            
        } catch (error) {
            // Return default structure on error
        }
        
        return structure;
    }
    
    private async identifyCodePatterns(): Promise<Array<{ name: string; description: string; frequency: number }>> {
        const patterns: Array<{ name: string; description: string; frequency: number }> = [];
        
        try {
            // Find common design patterns
            const patternChecks = [
                {
                    name: 'Singleton Pattern',
                    pattern: /class\s+\w+\s*{[^}]*static\s+instance[^}]*getInstance/s,
                    description: 'Classes using singleton pattern'
                },
                {
                    name: 'Factory Pattern',
                    pattern: /create\w+|make\w+|\w+Factory/,
                    description: 'Factory methods and classes'
                },
                {
                    name: 'Observer Pattern',
                    pattern: /addEventListener|subscribe|emit|on\(/,
                    description: 'Event-driven architecture'
                },
                {
                    name: 'Async/Await Pattern',
                    pattern: /async\s+function|await\s+/,
                    description: 'Asynchronous programming patterns'
                },
                {
                    name: 'Error Handling Pattern',
                    pattern: /try\s*{|catch\s*\(|throw\s+/,
                    description: 'Consistent error handling'
                }
            ];
            
            // Search through source files
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" | grep -v node_modules | head -20', {
                cwd: this.workspacePath
            });
            
            const files = stdout.trim().split('\n').filter(f => f);
            
            for (const check of patternChecks) {
                let frequency = 0;
                
                for (const file of files) {
                    try {
                        const content = await readFileAsync(path.join(this.workspacePath, file), 'utf8');
                        const matches = content.match(check.pattern);
                        if (matches) {
                            frequency += matches.length;
                        }
                    } catch {
                        // Skip files that can't be read
                    }
                }
                
                if (frequency > 0) {
                    patterns.push({
                        name: check.name,
                        description: check.description,
                        frequency
                    });
                }
            }
            
        } catch (error) {
            // Return empty patterns on error
        }
        
        return patterns;
    }
    
    private async findRefactoringOpportunities(): Promise<Array<{ type: string; description: string; impact: string }>> {
        const opportunities: Array<{ type: string; description: string; impact: string }> = [];
        
        try {
            // Look for code smells and refactoring opportunities
            const checks = [
                {
                    type: 'Large Functions',
                    pattern: /function\s+\w+[^{]*{((?:[^{}]|{[^{}]*})*{[^{}]*}[^{}]*)*}/g,
                    threshold: 50,
                    description: 'Functions that are too long and should be split',
                    impact: 'Medium'
                },
                {
                    type: 'Duplicate Code',
                    pattern: /console\.log\(|throw new Error\(/g,
                    threshold: 10,
                    description: 'Repeated code patterns that could be extracted',
                    impact: 'High'
                },
                {
                    type: 'Magic Numbers',
                    pattern: /\b\d{2,}\b/g,
                    threshold: 5,
                    description: 'Numeric literals that should be named constants',
                    impact: 'Low'
                }
            ];
            
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" | grep -v node_modules | head -10', {
                cwd: this.workspacePath
            });
            
            const files = stdout.trim().split('\n').filter(f => f);
            
            for (const check of checks) {
                let totalMatches = 0;
                
                for (const file of files) {
                    try {
                        const content = await readFileAsync(path.join(this.workspacePath, file), 'utf8');
                        const matches = content.match(check.pattern);
                        if (matches) {
                            totalMatches += matches.length;
                        }
                    } catch {
                        // Skip files that can't be read
                    }
                }
                
                if (totalMatches > check.threshold) {
                    opportunities.push({
                        type: check.type,
                        description: check.description,
                        impact: check.impact
                    });
                }
            }
            
        } catch (error) {
            // Return empty opportunities on error
        }
        
        return opportunities;
    }
}