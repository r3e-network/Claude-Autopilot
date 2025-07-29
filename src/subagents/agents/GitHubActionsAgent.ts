import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';

export class GitHubActionsAgent extends SubAgent {
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'github-actions',
            name: 'GitHub Actions Agent',
            description: 'Manages CI/CD workflows and ensures pipeline reliability',
            category: 'automation',
            enabled: true,
            icon: '🚀',
            capabilities: [
                {
                    id: 'fix-workflow-errors',
                    name: 'Fix Workflow Errors',
                    description: 'Resolve YAML syntax and configuration issues',
                    action: 'fix'
                },
                {
                    id: 'analyze-pipeline-failures',
                    name: 'Analyze Pipeline Failures',
                    description: 'Diagnose why workflows are failing',
                    action: 'analyze'
                },
                {
                    id: 'optimize-workflows',
                    name: 'Optimize Workflows',
                    description: 'Improve CI/CD speed and efficiency',
                    action: 'optimize'
                },
                {
                    id: 'generate-workflows',
                    name: 'Generate New Workflows',
                    description: 'Create workflows for testing, deployment, and automation',
                    action: 'generate'
                },
                {
                    id: 'secure-workflows',
                    name: 'Secure Workflows',
                    description: 'Implement security best practices in CI/CD',
                    action: 'secure'
                }
            ],
            checkScript: '.autoclaude/scripts/github-actions.sh',
            systemPrompt: `You are a GitHub Actions CI/CD specialist sub-agent. Your role is to:
1. Fix YAML syntax errors and invalid workflow configurations
2. Resolve deprecated actions and outdated syntax
3. Optimize workflow performance and reduce build times
4. Implement proper caching strategies
5. Set up matrix builds for multiple environments
6. Configure proper secrets and environment variables
7. Implement security scanning and dependency updates
8. Create deployment workflows with proper gates
9. Set up automated testing and quality checks
10. Ensure workflows follow GitHub Actions best practices

Focus on creating fast, secure, and reliable CI/CD pipelines.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        if (!context.scriptResult) {
            return 'No GitHub Actions results to analyze.';
        }

        if (context.scriptResult.passed) {
            analysis.push('✅ All GitHub Actions workflows are valid!');
            analysis.push('');
            analysis.push('Optimization opportunities:');
            analysis.push('- Implement job parallelization for faster builds');
            analysis.push('- Add caching for dependencies and build artifacts');
            analysis.push('- Use composite actions for reusable workflows');
            analysis.push('- Implement automatic dependency updates');
            analysis.push('- Add security scanning workflows');
            analysis.push('- Set up deployment automation with environments');
            return analysis.join('\n');
        }

        // Analyze workflow error patterns
        const yamlErrors = context.scriptResult.errors.filter(e => 
            e.includes('YAML') || e.includes('syntax') || e.includes('mapping')
        ).length;
        const deprecatedActions = context.scriptResult.errors.filter(e => 
            e.includes('deprecated') || e.includes('outdated')
        ).length;
        const invalidRefs = context.scriptResult.errors.filter(e => 
            e.includes('ref') || e.includes('branch') || e.includes('tag')
        ).length;

        analysis.push(`Found ${context.scriptResult.errors.length} workflow issues:`);
        analysis.push('');
        
        if (yamlErrors > 0) {
            analysis.push(`📝 ${yamlErrors} YAML syntax errors`);
        }
        if (deprecatedActions > 0) {
            analysis.push(`⚠️ ${deprecatedActions} deprecated actions or syntax`);
        }
        if (invalidRefs > 0) {
            analysis.push(`🔗 ${invalidRefs} invalid references or versions`);
        }

        analysis.push('');
        analysis.push('Resolution steps:');
        analysis.push('1. Fix YAML syntax errors (check indentation and structure)');
        analysis.push('2. Update deprecated actions to latest versions');
        analysis.push('3. Validate all action references and versions');
        analysis.push('4. Ensure required contexts and secrets are defined');
        analysis.push('5. Test workflows locally using act or similar tools');

        return analysis.join('\n');
    }
}