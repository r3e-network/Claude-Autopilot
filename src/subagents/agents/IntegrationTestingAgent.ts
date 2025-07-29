import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class IntegrationTestingAgent extends SubAgent {
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'integration-testing',
            name: 'Integration Testing Agent',
            description: 'Creates and manages comprehensive integration tests automatically',
            category: 'quality',
            enabled: true,
            icon: '🧪',
            capabilities: [
                {
                    id: 'generate-integration-tests',
                    name: 'Generate Integration Tests',
                    description: 'Create comprehensive integration tests for new features',
                    action: 'generate'
                },
                {
                    id: 'analyze-test-coverage',
                    name: 'Analyze Test Coverage',
                    description: 'Identify gaps in test coverage and suggest improvements',
                    action: 'analyze'
                },
                {
                    id: 'create-e2e-tests',
                    name: 'Create End-to-End Tests',
                    description: 'Generate user workflow tests',
                    action: 'generate'
                },
                {
                    id: 'mock-external-services',
                    name: 'Mock External Services',
                    description: 'Create mocks for APIs and external dependencies',
                    action: 'generate'
                },
                {
                    id: 'performance-testing',
                    name: 'Performance Testing',
                    description: 'Create performance benchmarks and load tests',
                    action: 'generate'
                }
            ],
            checkScript: '.autoclaude/scripts/integration-testing-check.sh',
            systemPrompt: `You are an Integration Testing specialist sub-agent. Your role is to:
1. Generate comprehensive integration tests for new features
2. Create end-to-end tests that cover user workflows
3. Analyze test coverage and identify gaps
4. Create mocks and stubs for external dependencies
5. Generate performance and load tests
6. Ensure tests cover error scenarios and edge cases
7. Create test data and fixtures
8. Set up test environments and configurations
9. Generate API contract tests
10. Create visual regression tests where applicable

You ensure that all code changes are thoroughly tested before deployment.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        analysis.push('🧪 Integration Testing Analysis:');
        analysis.push('');
        
        // Analyze current test setup
        const testSetup = await this.analyzeTestSetup();
        analysis.push(`Test Framework: ${testSetup.framework || 'None detected'}`);
        analysis.push(`Total Test Files: ${testSetup.testFiles}`);
        analysis.push(`Test Coverage: ${testSetup.coverage}%`);
        analysis.push('');
        
        // Identify missing test scenarios
        const missingTests = await this.identifyMissingTests();
        if (missingTests.length > 0) {
            analysis.push('❌ Missing Test Scenarios:');
            missingTests.forEach(test => {
                analysis.push(`- ${test.type}: ${test.description}`);
            });
            analysis.push('');
        }
        
        // Suggest test improvements
        const improvements = await this.suggestTestImprovements();
        if (improvements.length > 0) {
            analysis.push('💡 Test Improvement Suggestions:');
            improvements.forEach(imp => {
                analysis.push(`- ${imp.category}: ${imp.suggestion}`);
            });
            analysis.push('');
        }
        
        analysis.push('🎯 Testing Recommendations:');
        analysis.push('1. Add integration tests for all API endpoints');
        analysis.push('2. Create end-to-end tests for critical user workflows');
        analysis.push('3. Mock external services for reliable testing');
        analysis.push('4. Add performance benchmarks for key operations');
        analysis.push('5. Ensure error scenarios are thoroughly tested');
        
        return analysis.join('\n');
    }
    
    private async analyzeTestSetup(): Promise<any> {
        const setup = {
            framework: null as string | null,
            testFiles: 0,
            coverage: 0
        };
        
        try {
            // Check for test frameworks
            if (fs.existsSync(path.join(this.workspacePath, 'package.json'))) {
                const packageJson = JSON.parse(fs.readFileSync(path.join(this.workspacePath, 'package.json'), 'utf8'));
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                
                if (deps.jest) setup.framework = 'Jest';
                else if (deps.mocha) setup.framework = 'Mocha';
                else if (deps.vitest) setup.framework = 'Vitest';
                else if (deps.cypress) setup.framework = 'Cypress';
                else if (deps.playwright) setup.framework = 'Playwright';
            }
            
            // Count test files
            const { stdout } = await execAsync('find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules | wc -l', {
                cwd: this.workspacePath
            });
            setup.testFiles = parseInt(stdout.trim()) || 0;
            
            // Try to get coverage information
            try {
                const { stdout: coverageOutput } = await execAsync('npm run test:coverage --silent 2>/dev/null || echo "0"', {
                    cwd: this.workspacePath
                });
                const coverageMatch = coverageOutput.match(/(\d+(?:\.\d+)?)%/);
                if (coverageMatch) {
                    setup.coverage = parseFloat(coverageMatch[1]);
                }
            } catch {
                // Coverage not available
            }
            
        } catch (error) {
            // Use defaults on error
        }
        
        return setup;
    }
    
    private async identifyMissingTests(): Promise<Array<{ type: string; description: string }>> {
        const missing: Array<{ type: string; description: string }> = [];
        
        try {
            // Check for API endpoints without tests
            const apiEndpoints = await this.findApiEndpoints();
            const testFiles = await this.findTestFiles();
            
            for (const endpoint of apiEndpoints) {
                const hasTest = testFiles.some(testFile => 
                    testFile.includes(endpoint.toLowerCase()) || 
                    testFile.includes(endpoint.replace(/[A-Z]/g, '-$&').toLowerCase())
                );
                
                if (!hasTest) {
                    missing.push({
                        type: 'API Test',
                        description: `No integration test found for ${endpoint} endpoint`
                    });
                }
            }
            
            // Check for database operations without tests
            const dbOperations = await this.findDatabaseOperations();
            for (const operation of dbOperations) {
                const hasTest = testFiles.some(testFile => 
                    testFile.includes(operation.toLowerCase())
                );
                
                if (!hasTest) {
                    missing.push({
                        type: 'Database Test',
                        description: `No test found for ${operation} database operation`
                    });
                }
            }
            
            // Check for error handling tests
            const errorScenarios = await this.findErrorScenarios();
            if (errorScenarios.length > 0 && !testFiles.some(f => f.includes('error') || f.includes('exception'))) {
                missing.push({
                    type: 'Error Handling',
                    description: 'No tests found for error scenarios and exception handling'
                });
            }
            
        } catch (error) {
            // Return empty array on error
        }
        
        return missing;
    }
    
    private async findApiEndpoints(): Promise<string[]> {
        const endpoints: string[] = [];
        
        try {
            // Look for Express routes, FastAPI endpoints, etc.
            const { stdout } = await execAsync('grep -r "app\\." . --include="*.ts" --include="*.js" --include="*.py" | grep -E "(get|post|put|delete|patch)\\(" | head -20', {
                cwd: this.workspacePath
            });
            
            const lines = stdout.trim().split('\n').filter(l => l);
            for (const line of lines) {
                const match = line.match(/\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/);
                if (match) {
                    endpoints.push(match[2]);
                }
            }
        } catch {
            // Ignore errors
        }
        
        return [...new Set(endpoints)];
    }
    
    private async findTestFiles(): Promise<string[]> {
        try {
            const { stdout } = await execAsync('find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules', {
                cwd: this.workspacePath
            });
            return stdout.trim().split('\n').filter(f => f);
        } catch {
            return [];
        }
    }
    
    private async findDatabaseOperations(): Promise<string[]> {
        const operations: string[] = [];
        
        try {
            // Look for common database operations
            const { stdout } = await execAsync('grep -r "\\(save\\|find\\|update\\|delete\\|create\\|insert\\)" . --include="*.ts" --include="*.js" | grep -v test | head -10', {
                cwd: this.workspacePath
            });
            
            const lines = stdout.trim().split('\n').filter(l => l);
            for (const line of lines) {
                const match = line.match(/\.(save|find|update|delete|create|insert)/);
                if (match) {
                    operations.push(match[1]);
                }
            }
        } catch {
            // Ignore errors
        }
        
        return [...new Set(operations)];
    }
    
    private async findErrorScenarios(): Promise<string[]> {
        try {
            const { stdout } = await execAsync('grep -r "throw\\|catch\\|error" . --include="*.ts" --include="*.js" | grep -v test | wc -l', {
                cwd: this.workspacePath
            });
            
            const count = parseInt(stdout.trim()) || 0;
            return count > 0 ? ['error-handling'] : [];
        } catch {
            return [];
        }
    }
    
    private async suggestTestImprovements(): Promise<Array<{ category: string; suggestion: string }>> {
        const improvements: Array<{ category: string; suggestion: string }> = [];
        
        // Analyze test quality
        const testFiles = await this.findTestFiles();
        
        if (testFiles.length > 0) {
            try {
                // Check for test organization
                const hasTestFolder = fs.existsSync(path.join(this.workspacePath, 'test')) || 
                                    fs.existsSync(path.join(this.workspacePath, '__tests__'));
                
                if (!hasTestFolder) {
                    improvements.push({
                        category: 'Organization',
                        suggestion: 'Create a dedicated test folder structure'
                    });
                }
                
                // Check for test utilities
                const hasTestUtils = testFiles.some(f => f.includes('util') || f.includes('helper'));
                if (!hasTestUtils) {
                    improvements.push({
                        category: 'Utilities',
                        suggestion: 'Create test utilities and helpers for common operations'
                    });
                }
                
                // Check for fixture data
                const hasFixtures = fs.existsSync(path.join(this.workspacePath, 'fixtures')) ||
                                  testFiles.some(f => f.includes('fixture'));
                
                if (!hasFixtures) {
                    improvements.push({
                        category: 'Test Data',
                        suggestion: 'Create fixture data for consistent testing'
                    });
                }
                
            } catch {
                // Ignore errors
            }
        } else {
            improvements.push({
                category: 'Setup',
                suggestion: 'Set up a testing framework and create initial test files'
            });
        }
        
        return improvements;
    }
}