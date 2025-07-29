import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';

export class TestAgent extends SubAgent {
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'test-check',
            name: 'Test Agent',
            description: 'Manages test suites, ensures coverage, and maintains test quality',
            category: 'quality',
            enabled: true,
            icon: '✅',
            capabilities: [
                {
                    id: 'analyze-test-failures',
                    name: 'Analyze Test Failures',
                    description: 'Understand why tests are failing and provide fixes',
                    action: 'analyze'
                },
                {
                    id: 'fix-tests',
                    name: 'Fix Failing Tests',
                    description: 'Repair broken tests and update outdated assertions',
                    action: 'fix'
                },
                {
                    id: 'generate-tests',
                    name: 'Generate Missing Tests',
                    description: 'Create comprehensive test coverage for untested code',
                    action: 'generate'
                },
                {
                    id: 'improve-test-quality',
                    name: 'Improve Test Quality',
                    description: 'Enhance test reliability, speed, and maintainability',
                    action: 'refactor'
                }
            ],
            checkScript: '.autoclaude/scripts/test-check.sh',
            systemPrompt: `You are a Testing specialist sub-agent. Your role is to:
1. Fix failing tests by updating assertions or fixing bugs
2. Generate comprehensive test cases for uncovered code
3. Improve test performance and reduce flakiness
4. Ensure proper test isolation and cleanup
5. Create meaningful test descriptions and documentation
6. Implement proper mocking and stubbing strategies
7. Ensure edge cases and error scenarios are tested
8. Maintain high code coverage without sacrificing quality

Focus on creating fast, reliable, and maintainable tests that catch real bugs.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        if (!context.scriptResult) {
            return 'No test results to analyze.';
        }

        if (context.scriptResult.passed) {
            analysis.push('✅ All tests passing!');
            analysis.push('');
            analysis.push('Suggestions for test improvement:');
            analysis.push('- Increase code coverage if below 80%');
            analysis.push('- Add integration tests for critical paths');
            analysis.push('- Implement property-based testing for complex logic');
            analysis.push('- Add performance benchmarks');
            analysis.push('- Create end-to-end tests for user workflows');
            return analysis.join('\n');
        }

        // Analyze test failure patterns
        const failedTests = context.scriptResult.errors.filter(e => 
            e.includes('FAIL') || e.includes('failed') || e.includes('Failed')
        ).length;
        const timeouts = context.scriptResult.errors.filter(e => 
            e.includes('timeout') || e.includes('Timeout')
        ).length;
        const assertionErrors = context.scriptResult.errors.filter(e => 
            e.includes('assert') || e.includes('expect') || e.includes('Expected')
        ).length;

        analysis.push(`Test suite failed with ${context.scriptResult.errors.length} issues:`);
        analysis.push('');
        
        if (failedTests > 0) {
            analysis.push(`❌ ${failedTests} tests failed`);
        }
        if (timeouts > 0) {
            analysis.push(`⏱️ ${timeouts} tests timed out`);
        }
        if (assertionErrors > 0) {
            analysis.push(`🔍 ${assertionErrors} assertion failures`);
        }

        analysis.push('');
        analysis.push('Fix strategy:');
        analysis.push('1. Address timeout issues first (may indicate infinite loops)');
        analysis.push('2. Fix assertion errors by updating tests or fixing bugs');
        analysis.push('3. Ensure test data and mocks are properly set up');
        analysis.push('4. Check for race conditions in async tests');
        analysis.push('5. Verify test isolation and cleanup');

        return analysis.join('\n');
    }
}