import { BaseProductionAgent } from './BaseProductionAgent';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { debugLog } from '../utils/logging';

const execAsync = promisify(exec);

/**
 * Test Fixer Agent - Fixes failing unit tests
 */
export class TestFixerAgent extends BaseProductionAgent {
    name = 'Test Fixer';
    description = 'Analyzes and fixes failing unit tests';
    capabilities = [
        'Identify test failures',
        'Fix common test issues',
        'Update test assertions',
        'Mock dependencies properly'
    ];

    async analyzeTestResults(error: string, output: string): Promise<{
        issues: string[];
        suggestedFixes: string[];
        affectedFiles: string[];
    }> {
        const issues: string[] = [];
        const suggestedFixes: string[] = [];
        const affectedFiles: Set<string> = new Set();

        // Parse test output for failures
        const failurePattern = /FAIL\s+([\w\/\.\-]+)/g;
        let match;
        while ((match = failurePattern.exec(output)) !== null) {
            affectedFiles.add(match[1]);
            issues.push(`Test failure in ${match[1]}`);
        }

        // Analyze error types
        if (error.includes('Cannot find module')) {
            issues.push('Missing module dependencies');
            suggestedFixes.push('Install missing dependencies or fix import paths');
        }
        if (error.includes('TypeError')) {
            issues.push('Type errors in tests');
            suggestedFixes.push('Fix type mismatches and add proper type annotations');
        }
        if (error.includes('Expected')) {
            issues.push('Assertion failures');
            suggestedFixes.push('Update test assertions to match current implementation');
        }

        return {
            issues,
            suggestedFixes,
            affectedFiles: Array.from(affectedFiles)
        };
    }

    async executeSimple(): Promise<{ success: boolean; message: string }> {
        try {
            // Run tests to get current state
            const { stdout, stderr } = await execAsync('npm test', { cwd: this.workspaceRoot });
            
            const analysis = await this.analyzeTestResults(stderr, stdout);
            
            if (analysis.issues.length === 0) {
                return { success: true, message: 'All tests are passing!' };
            }

            // Generate fix plan
            const fixPlan = this.generateFixPlan(analysis);
            
            // Save fix plan for Claude
            const planPath = path.join(this.workspaceRoot, '.autopilot', 'test-fix-plan.md');
            fs.writeFileSync(planPath, fixPlan);

            return {
                success: true,
                message: `Found ${analysis.issues.length} test issues. Fix plan saved to ${planPath}`
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Test analysis failed: ${error.message}`
            };
        }
    }

    private generateFixPlan(analysis: any): string {
        return `# Test Fix Plan

## Issues Found
${analysis.issues.map((issue: string) => `- ${issue}`).join('\n')}

## Suggested Fixes
${analysis.suggestedFixes.map((fix: string) => `1. ${fix}`).join('\n')}

## Affected Files
${analysis.affectedFiles.map((file: string) => `- ${file}`).join('\n')}

## Next Steps
1. Review each failing test file
2. Update test assertions to match current behavior
3. Fix any missing imports or dependencies
4. Ensure all mocks are properly configured
5. Run tests again to verify fixes
`;
    }
}

/**
 * Test Creator Agent - Adds missing unit tests
 */
export class TestCreatorAgent extends BaseProductionAgent {
    name = 'Test Creator';
    description = 'Creates unit tests for untested code';
    capabilities = [
        'Analyze code coverage',
        'Generate test cases',
        'Create test fixtures',
        'Add integration tests'
    ];

    private async analyzeTestCoverage(): Promise<{
        coverage: number;
        uncoveredFiles: string[];
        testableFiles: string[];
    }> {
        try {
            // Try to get coverage report
            const { stdout } = await execAsync('npm run test:coverage', { cwd: this.workspaceRoot });
            
            // Parse coverage (simplified - real implementation would parse coverage report)
            const coverageMatch = stdout.match(/All files\s+\|\s+([\d.]+)/);
            const coverage = coverageMatch ? parseFloat(coverageMatch[1]) : 0;

            // Find files without tests
            const srcFiles = await this.findSourceFiles();
            const testFiles = await this.findTestFiles();
            const uncoveredFiles = srcFiles.filter(src => 
                !testFiles.some(test => test.includes(path.basename(src, path.extname(src))))
            );

            return {
                coverage,
                uncoveredFiles,
                testableFiles: srcFiles
            };
        } catch (error) {
            // If coverage command doesn't exist, analyze manually
            const srcFiles = await this.findSourceFiles();
            return {
                coverage: 0,
                uncoveredFiles: srcFiles,
                testableFiles: srcFiles
            };
        }
    }

    async executeSimple(): Promise<{ success: boolean; message: string }> {
        const analysis = await this.analyzeTestCoverage();
        
        // Generate test creation plan
        const plan = `# Test Creation Plan

## Current Coverage: ${analysis.coverage}%

## Files Needing Tests (${analysis.uncoveredFiles.length})
${analysis.uncoveredFiles.slice(0, 10).map(file => `- ${file}`).join('\n')}

## Test Creation Strategy
1. Start with critical business logic files
2. Add unit tests for all public methods
3. Include edge cases and error scenarios
4. Add integration tests for API endpoints
5. Aim for minimum 80% coverage

## Test Template
\`\`\`typescript
describe('ComponentName', () => {
    beforeEach(() => {
        // Setup
    });

    describe('methodName', () => {
        it('should handle normal case', () => {
            // Test implementation
        });

        it('should handle error case', () => {
            // Test error handling
        });
    });
});
\`\`\`
`;

        const planPath = path.join(this.workspaceRoot, '.autopilot', 'test-creation-plan.md');
        fs.writeFileSync(planPath, plan);

        return {
            success: true,
            message: `Test creation plan generated. ${analysis.uncoveredFiles.length} files need tests.`
        };
    }

    private async findSourceFiles(): Promise<string[]> {
        // Simplified - real implementation would use glob
        return [];
    }

    private async findTestFiles(): Promise<string[]> {
        // Simplified - real implementation would use glob
        return [];
    }
}

/**
 * Documentation Generator Agent
 */
export class DocGeneratorAgent extends BaseProductionAgent {
    name = 'Documentation Generator';
    description = 'Creates comprehensive documentation';
    capabilities = [
        'Generate README files',
        'Create API documentation',
        'Add code comments',
        'Generate architecture diagrams'
    ];

    async executeSimple(): Promise<{ success: boolean; message: string }> {
        const projectInfo = await this.analyzeProject();
        
        // Generate documentation templates
        await this.generateReadme(projectInfo);
        await this.generateApiDocs(projectInfo);
        await this.generateArchitectureDocs(projectInfo);

        return {
            success: true,
            message: 'Documentation templates generated in .autopilot/docs/'
        };
    }

    private async analyzeProject(): Promise<any> {
        // Analyze package.json, file structure, etc.
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        let packageInfo: any = {};
        
        if (fs.existsSync(packageJsonPath)) {
            packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        }

        return {
            name: packageInfo.name || 'Project',
            description: packageInfo.description || 'Project description',
            version: packageInfo.version || '1.0.0',
            scripts: packageInfo.scripts || {},
            dependencies: packageInfo.dependencies || {}
        };
    }

    private async generateReadme(projectInfo: any): Promise<void> {
        const readme = `# ${projectInfo.name}

${projectInfo.description}

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Available Scripts

${Object.entries(projectInfo.scripts).map(([key, value]) => 
    `- \`npm run ${key}\`: ${value}`
).join('\n')}

## Project Structure

\`\`\`
.
├── src/           # Source code
├── tests/         # Test files
├── docs/          # Documentation
└── package.json   # Project configuration
\`\`\`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
`;

        const docsDir = path.join(this.workspaceRoot, '.autopilot', 'docs');
        if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
        }

        fs.writeFileSync(path.join(docsDir, 'README.md'), readme);
    }

    private async generateApiDocs(projectInfo: any): Promise<void> {
        const apiDoc = `# API Documentation

## Overview

This document describes the API endpoints and methods available in ${projectInfo.name}.

## Authentication

Describe authentication methods here.

## Endpoints

### GET /api/example
Description of endpoint

**Parameters:**
- \`param1\` (string): Description

**Response:**
\`\`\`json
{
  "status": "success",
  "data": {}
}
\`\`\`

## Error Handling

All errors follow this format:
\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
\`\`\`
`;

        const docsDir = path.join(this.workspaceRoot, '.autopilot', 'docs');
        fs.writeFileSync(path.join(docsDir, 'API.md'), apiDoc);
    }

    private async generateArchitectureDocs(projectInfo: any): Promise<void> {
        const archDoc = `# Architecture Documentation

## System Overview

${projectInfo.name} is built using a modular architecture...

## Components

### Frontend
- Framework: [Detect from dependencies]
- State Management: [Detect from dependencies]

### Backend
- Framework: [Detect from dependencies]
- Database: [Detect from configuration]

### Infrastructure
- Deployment: [Docker/Kubernetes/etc]
- CI/CD: [GitHub Actions/Jenkins/etc]

## Data Flow

1. User interacts with frontend
2. Frontend sends request to API
3. API processes request
4. Database operations performed
5. Response sent back to frontend

## Security Considerations

- Authentication: JWT/OAuth
- Authorization: Role-based access
- Data encryption: TLS/SSL
- Input validation: All inputs sanitized

## Scalability

- Horizontal scaling supported
- Caching layer implemented
- Database indexing optimized
`;

        const docsDir = path.join(this.workspaceRoot, '.autopilot', 'docs');
        fs.writeFileSync(path.join(docsDir, 'ARCHITECTURE.md'), archDoc);
    }
}

/**
 * Docker Creator Agent
 */
export class DockerCreatorAgent extends BaseProductionAgent {
    name = 'Docker Creator';
    description = 'Creates Docker configuration for the project';
    capabilities = [
        'Generate Dockerfile',
        'Create docker-compose.yml',
        'Add .dockerignore',
        'Setup multi-stage builds'
    ];

    async executeSimple(): Promise<{ success: boolean; message: string }> {
        const projectInfo = await this.analyzeProjectType();
        
        await this.createDockerfile(projectInfo);
        await this.createDockerCompose(projectInfo);
        await this.createDockerIgnore();

        return {
            success: true,
            message: 'Docker configuration created successfully'
        };
    }

    private async analyzeProjectType(): Promise<{ type: string; runtime: string }> {
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            return { type: 'node', runtime: 'node:18-alpine' };
        }
        
        // Check for other project types
        if (fs.existsSync(path.join(this.workspaceRoot, 'requirements.txt'))) {
            return { type: 'python', runtime: 'python:3.9-slim' };
        }
        
        if (fs.existsSync(path.join(this.workspaceRoot, 'go.mod'))) {
            return { type: 'go', runtime: 'golang:1.19-alpine' };
        }

        return { type: 'generic', runtime: 'alpine:latest' };
    }

    private async createDockerfile(projectInfo: any): Promise<void> {
        let dockerfile = '';

        if (projectInfo.type === 'node') {
            dockerfile = `# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"]
`;
        } else if (projectInfo.type === 'python') {
            dockerfile = `FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd -m -u 1001 appuser
USER appuser

# Expose port
EXPOSE 8000

# Run application
CMD ["python", "app.py"]
`;
        }

        const dockerfilePath = path.join(this.workspaceRoot, 'Dockerfile');
        fs.writeFileSync(dockerfilePath, dockerfile);
    }

    private async createDockerCompose(projectInfo: any): Promise<void> {
        const dockerCompose = `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
    restart: unless-stopped

  # Add database service if needed
  # db:
  #   image: postgres:14-alpine
  #   environment:
  #     POSTGRES_DB: myapp
  #     POSTGRES_USER: user
  #     POSTGRES_PASSWORD: password
  #   volumes:
  #     - db_data:/var/lib/postgresql/data

volumes:
  db_data:
`;

        const composePath = path.join(this.workspaceRoot, 'docker-compose.yml');
        fs.writeFileSync(composePath, dockerCompose);
    }

    private async createDockerIgnore(): Promise<void> {
        const dockerignore = `node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.*
.vscode
.idea
.DS_Store
*.log
coverage
.nyc_output
dist
build
*.test.js
*.spec.js
`;

        const ignorePath = path.join(this.workspaceRoot, '.dockerignore');
        fs.writeFileSync(ignorePath, dockerignore);
    }
}

/**
 * Code Cleaner Agent
 */
export class CodeCleanerAgent extends BaseProductionAgent {
    name = 'Code Cleaner';
    description = 'Cleans and organizes codebase';
    capabilities = [
        'Remove dead code',
        'Organize imports',
        'Fix linting issues',
        'Update dependencies'
    ];

    async executeSimple(): Promise<{ success: boolean; message: string }> {
        const issues = await this.analyzeCodeQuality();
        
        // Generate cleanup plan
        const plan = this.generateCleanupPlan(issues);
        
        const planPath = path.join(this.workspaceRoot, '.autopilot', 'cleanup-plan.md');
        fs.writeFileSync(planPath, plan);

        // Try to auto-fix some issues
        await this.autoFixIssues();

        return {
            success: true,
            message: `Code cleanup plan generated. Found ${issues.totalIssues} issues to address.`
        };
    }

    private async analyzeCodeQuality(): Promise<any> {
        const issues = {
            deadCode: [] as string[],
            lintErrors: [] as string[],
            outdatedDeps: [] as string[],
            duplicateCode: [] as string[],
            largeFiles: [] as any[],
            totalIssues: 0
        };

        // Run linter if available
        try {
            await execAsync('npm run lint', { cwd: this.workspaceRoot });
        } catch (error: any) {
            // Parse lint errors
            const lintErrors = error.stdout?.match(/\d+ errors?/);
            if (lintErrors) {
                issues.lintErrors.push(lintErrors[0]);
            }
        }

        // Check for outdated dependencies
        try {
            const { stdout } = await execAsync('npm outdated', { cwd: this.workspaceRoot });
            if (stdout) {
                issues.outdatedDeps = stdout.split('\n').filter(line => line.trim());
            }
        } catch (error) {
            // npm outdated returns non-zero exit code when deps are outdated
        }

        issues.totalIssues = 
            issues.deadCode.length + 
            issues.lintErrors.length + 
            issues.outdatedDeps.length;

        return issues;
    }

    private generateCleanupPlan(issues: any): string {
        return `# Code Cleanup Plan

## Summary
Total issues found: ${issues.totalIssues}

## Issues by Category

### Linting Errors
${issues.lintErrors.length > 0 ? issues.lintErrors.join('\n') : 'No linting errors found'}

### Outdated Dependencies
${issues.outdatedDeps.length > 0 ? issues.outdatedDeps.join('\n') : 'All dependencies up to date'}

### Dead Code
${issues.deadCode.length > 0 ? issues.deadCode.join('\n') : 'No dead code detected'}

## Cleanup Steps

1. **Fix Linting Errors**
   - Run \`npm run lint:fix\` to auto-fix
   - Manually fix remaining errors

2. **Update Dependencies**
   - Review breaking changes in changelogs
   - Update package.json versions
   - Run \`npm update\` carefully

3. **Remove Dead Code**
   - Identify unused exports
   - Remove commented code blocks
   - Delete unused files

4. **Organize Imports**
   - Group imports by type
   - Remove unused imports
   - Sort alphabetically

5. **Code Formatting**
   - Run prettier or formatter
   - Ensure consistent style
`;
    }

    private async autoFixIssues(): Promise<void> {
        try {
            // Try to run auto-fix commands
            await execAsync('npm run lint:fix', { cwd: this.workspaceRoot });
            debugLog('Auto-fixed linting issues');
        } catch (error) {
            debugLog('Could not auto-fix all linting issues');
        }
    }
}

// Export all agents
export const productionAgents = {
    'test-fixer': TestFixerAgent,
    'test-creator': TestCreatorAgent,
    'doc-generator': DocGeneratorAgent,
    'docker-creator': DockerCreatorAgent,
    'code-cleaner': CodeCleanerAgent
};