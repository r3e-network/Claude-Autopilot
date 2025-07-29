import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';

export class FormatAgent extends SubAgent {
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'format-check',
            name: 'Code Format Agent',
            description: 'Ensures consistent code formatting and style across the project',
            category: 'quality',
            enabled: true,
            icon: '💅',
            capabilities: [
                {
                    id: 'fix-formatting',
                    name: 'Fix Code Formatting',
                    description: 'Apply consistent formatting rules across all files',
                    action: 'fix'
                },
                {
                    id: 'analyze-style-issues',
                    name: 'Analyze Style Issues',
                    description: 'Identify patterns of inconsistent styling',
                    action: 'analyze'
                },
                {
                    id: 'suggest-style-improvements',
                    name: 'Suggest Style Improvements',
                    description: 'Recommend better coding patterns and conventions',
                    action: 'suggest'
                },
                {
                    id: 'refactor-for-readability',
                    name: 'Refactor for Readability',
                    description: 'Improve code readability beyond just formatting',
                    action: 'refactor'
                }
            ],
            checkScript: '.autoclaude/scripts/format-check.sh',
            systemPrompt: `You are a Code Formatting and Style specialist sub-agent. Your role is to:
1. Apply consistent formatting using project-specific tools (prettier, gofmt, rustfmt, etc.)
2. Ensure consistent naming conventions across the codebase
3. Fix indentation, spacing, and line length issues
4. Organize imports and dependencies properly
5. Apply language-specific style guidelines
6. Improve code readability and maintainability
7. Ensure consistent file organization
8. Apply team coding standards and conventions

Focus on making code beautiful, consistent, and easy to read.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        if (!context.scriptResult) {
            return 'No formatting results to analyze.';
        }

        if (context.scriptResult.passed) {
            analysis.push('✅ Code formatting is consistent!');
            analysis.push('');
            analysis.push('Additional style improvements to consider:');
            analysis.push('- Ensure variable names are descriptive and consistent');
            analysis.push('- Check for overly complex functions that need splitting');
            analysis.push('- Verify consistent error handling patterns');
            analysis.push('- Look for opportunities to improve code organization');
            return analysis.join('\n');
        }

        // Count files with formatting issues
        const filesWithIssues = new Set(
            context.scriptResult.errors
                .map(e => {
                    const match = e.match(/([^:]+):/);
                    return match ? match[1] : null;
                })
                .filter(Boolean)
        ).size;

        analysis.push(`Found formatting issues in ${filesWithIssues || 'multiple'} files:`);
        analysis.push('');
        
        // Group errors by type if possible
        const indentationIssues = context.scriptResult.errors.filter(e => 
            e.includes('indent') || e.includes('space') || e.includes('tab')
        ).length;
        const lineIssues = context.scriptResult.errors.filter(e => 
            e.includes('line') || e.includes('newline') || e.includes('length')
        ).length;
        const importIssues = context.scriptResult.errors.filter(e => 
            e.includes('import') || e.includes('require')
        ).length;

        if (indentationIssues > 0) {
            analysis.push(`📐 ${indentationIssues} indentation/spacing issues`);
        }
        if (lineIssues > 0) {
            analysis.push(`📏 ${lineIssues} line length/newline issues`);
        }
        if (importIssues > 0) {
            analysis.push(`📦 ${importIssues} import organization issues`);
        }

        analysis.push('');
        analysis.push('Fix approach:');
        analysis.push('1. Run the appropriate formatter for each file type');
        analysis.push('2. Ensure .editorconfig or prettier config is properly set');
        analysis.push('3. Fix any manual formatting that tools cannot handle');
        analysis.push('4. Organize imports and remove unused ones');
        analysis.push('5. Ensure consistent code structure patterns');

        return analysis.join('\n');
    }
}