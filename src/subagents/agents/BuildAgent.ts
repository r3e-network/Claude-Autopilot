import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';

export class BuildAgent extends SubAgent {
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'build-check',
            name: 'Build Agent',
            description: 'Ensures the project builds successfully and manages build configurations',
            category: 'quality',
            enabled: true,
            icon: '🔨',
            capabilities: [
                {
                    id: 'analyze-build-errors',
                    name: 'Analyze Build Errors',
                    description: 'Deep dive into compilation and build failures',
                    action: 'analyze'
                },
                {
                    id: 'fix-build-issues',
                    name: 'Fix Build Issues',
                    description: 'Resolve compilation errors, missing dependencies, and configuration issues',
                    action: 'fix'
                },
                {
                    id: 'optimize-build',
                    name: 'Optimize Build Process',
                    description: 'Improve build speed and reduce bundle size',
                    action: 'optimize'
                },
                {
                    id: 'suggest-build-improvements',
                    name: 'Suggest Build Improvements',
                    description: 'Recommend better build tools and configurations',
                    action: 'suggest'
                }
            ],
            checkScript: '.autoclaude/scripts/build-check.sh',
            systemPrompt: `You are a Build System specialist sub-agent. Your role is to:
1. Fix compilation errors and type issues
2. Resolve missing dependencies and imports
3. Fix configuration problems in build files
4. Optimize build performance and output size
5. Ensure cross-platform compatibility
6. Set up proper build pipelines
7. Configure environment-specific builds
8. Implement build caching strategies

Focus on making builds fast, reliable, and reproducible across all environments.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        if (!context.scriptResult) {
            return 'No build results to analyze.';
        }

        if (context.scriptResult.passed) {
            analysis.push('✅ Build successful!');
            analysis.push('');
            analysis.push('Consider these optimizations:');
            analysis.push('- Enable build caching for faster rebuilds');
            analysis.push('- Implement incremental compilation');
            analysis.push('- Optimize bundle sizes with tree shaking');
            analysis.push('- Set up parallel build tasks');
            return analysis.join('\n');
        }

        // Analyze build error patterns
        const typeErrors = context.scriptResult.errors.filter(e => 
            e.includes('type') || e.includes('Type') || e.includes('TS') || e.includes('error TS')
        ).length;
        const importErrors = context.scriptResult.errors.filter(e => 
            e.includes('import') || e.includes('module') || e.includes('Cannot find')
        ).length;
        const syntaxErrors = context.scriptResult.errors.filter(e => 
            e.includes('syntax') || e.includes('Syntax') || e.includes('Expected')
        ).length;

        analysis.push(`Build failed with ${context.scriptResult.errors.length} errors:`);
        analysis.push('');
        
        if (typeErrors > 0) {
            analysis.push(`🔤 ${typeErrors} type errors detected`);
        }
        if (importErrors > 0) {
            analysis.push(`📦 ${importErrors} import/module resolution errors`);
        }
        if (syntaxErrors > 0) {
            analysis.push(`⚠️ ${syntaxErrors} syntax errors found`);
        }

        analysis.push('');
        analysis.push('Resolution strategy:');
        analysis.push('1. Fix syntax errors first (they block everything else)');
        analysis.push('2. Resolve import and module issues');
        analysis.push('3. Address type errors systematically');
        analysis.push('4. Ensure all dependencies are installed');
        analysis.push('5. Verify build configuration is correct');

        return analysis.join('\n');
    }
}