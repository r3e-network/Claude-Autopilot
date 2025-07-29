import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

// Create a temporary directory for testing
const testWorkspace = path.join(tmpdir(), 'autoclaude-subagent-test-' + Date.now());

// Mock dependencies
jest.mock('../../../src/utils/logging', () => ({
  debugLog: jest.fn()
}));

jest.mock('../../../src/queue', () => ({
  addMessageToQueueFromWebview: jest.fn()
}));

const mockVscode = {
  window: {
    showInformationMessage: jest.fn().mockResolvedValue('Yes, Analyze'),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    withProgress: jest.fn((options, callback) => callback({ report: jest.fn() }))
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn()
    })),
    workspaceFolders: [{
      uri: { fsPath: testWorkspace },
      name: 'test-workspace',
      index: 0
    }]
  }
};

global.vscode = mockVscode as any;

// Import after mocking
import { SubAgentRunner } from '../../../src/subagents/SubAgentRunner';
import { SubAgentRegistry } from '../../../src/subagents/registry';

describe('Sub-Agent System Integration', () => {
  let runner: SubAgentRunner;
  let registry: SubAgentRegistry;

  beforeEach(async () => {
    // Create test workspace
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true });
    }

    // Create a realistic project structure for testing
    await createTestProject();

    runner = new SubAgentRunner(testWorkspace);
    await runner.initialize();
    registry = runner.getRegistry();
  });

  afterEach(() => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  async function createTestProject() {
    // Create package.json
    fs.writeFileSync(path.join(testWorkspace, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      description: 'A test project for sub-agent integration testing',
      main: 'index.js',
      scripts: {
        build: 'tsc',
        test: 'jest',
        lint: 'eslint src/**/*.ts',
        start: 'node dist/index.js'
      },
      dependencies: {
        express: '^4.18.0',
        lodash: '^4.17.21'
      },
      devDependencies: {
        typescript: '^4.9.0',
        jest: '^29.0.0',
        eslint: '^8.0.0'
      }
    }, null, 2));

    // Create TypeScript config
    fs.writeFileSync(path.join(testWorkspace, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        outDir: 'dist',
        strict: true,
        esModuleInterop: true
      },
      include: ['src/**/*']
    }, null, 2));

    // Create source files
    const srcDir = path.join(testWorkspace, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    fs.writeFileSync(path.join(srcDir, 'index.ts'), `
import express from 'express';
import { getUserData } from './user';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/users/:id', async (req, res) => {
  const userId = req.params.id;
  const userData = await getUserData(userId);
  res.json(userData);
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});
`);

    fs.writeFileSync(path.join(srcDir, 'user.ts'), `
export interface User {
  id: string;
  name: string;
  email: string;
}

export async function getUserData(id: string): Promise<User | null> {
  // TODO: Implement actual database query
  return {
    id,
    name: 'Test User',
    email: 'test@example.com'
  };
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}
`);

    // Create test files
    const testDir = path.join(testWorkspace, 'tests');
    fs.mkdirSync(testDir, { recursive: true });

    fs.writeFileSync(path.join(testDir, 'user.test.ts'), `
import { validateEmail } from '../src/user';

describe('User utilities', () => {
  test('should validate correct email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  test('should reject invalid email', () => {
    expect(validateEmail('invalid-email')).toBe(false);
  });
});
`);

    // Create README
    fs.writeFileSync(path.join(testWorkspace, 'README.md'), `
# Test Project

This is a test project for sub-agent integration testing.

## Getting Started

1. Install dependencies: \`npm install\`
2. Build the project: \`npm run build\`
3. Run tests: \`npm test\`
4. Start the server: \`npm start\`
`);
  }

  describe('Sub-Agent Registry', () => {
    it('should load all built-in agents', () => {
      const agents = registry.getAllAgents();
      
      expect(agents.length).toBeGreaterThan(0);
      
      // Check for core agents
      const agentIds = agents.map(agent => agent.id);
      expect(agentIds).toContain('production-readiness');
      expect(agentIds).toContain('build-check');
      expect(agentIds).toContain('context-awareness');
      expect(agentIds).toContain('task-planning');
      expect(agentIds).toContain('dependency-resolution');
      expect(agentIds).toContain('security-audit');
    });

    it('should retrieve specific agents by ID', () => {
      const contextAgent = registry.getAgent('context-awareness');
      const securityAgent = registry.getAgent('security-audit');
      
      expect(contextAgent).toBeDefined();
      expect(contextAgent?.id).toBe('context-awareness');
      
      expect(securityAgent).toBeDefined();
      expect(securityAgent?.id).toBe('security-audit');
    });

    it('should return undefined for non-existent agents', () => {
      const nonExistentAgent = registry.getAgent('non-existent-agent');
      expect(nonExistentAgent).toBeUndefined();
    });
  });

  describe('Context Awareness Agent', () => {
    it('should analyze project structure', async () => {
      const result = await runner.runSingleAgent('context-awareness');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(true);
      expect(result?.errors).toEqual([]);
    });

    it('should detect missing project files', async () => {
      // Remove package.json to test detection
      fs.unlinkSync(path.join(testWorkspace, 'package.json'));
      
      const result = await runner.runSingleAgent('context-awareness');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.some(error => 
        error.includes('No project configuration file found')
      )).toBe(true);
    });
  });

  describe('Dependency Resolution Agent', () => {
    it('should check for dependency consistency', async () => {
      const result = await runner.runSingleAgent('dependency-resolution');
      
      expect(result).toBeDefined();
      // Result depends on whether node_modules exists and dependencies are installed
    });

    it('should detect missing lock files', async () => {
      // Ensure no lock files exist
      const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
      lockFiles.forEach(file => {
        const filePath = path.join(testWorkspace, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

      const result = await runner.runSingleAgent('dependency-resolution');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.some(error => 
        error.includes('No package-lock.json or yarn.lock found')
      )).toBe(true);
    });
  });

  describe('Code Understanding Agent', () => {
    it('should analyze code patterns and quality', async () => {
      const result = await runner.runSingleAgent('code-understanding');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(true);
    });

    it('should detect potential code quality issues', async () => {
      // Create a file with code quality issues
      fs.writeFileSync(path.join(testWorkspace, 'src', 'bad-code.ts'), `
export function veryLongFunctionWithTooManyParameters(
  param1: string,
  param2: string,
  param3: string,
  param4: string,
  param5: string,
  param6: string,
  param7: string,
  param8: string
) {
  console.log('Debug statement 1');
  console.log('Debug statement 2');
  console.log('Debug statement 3');
  throw new Error('Generic error');
  throw new Error('Another generic error');
  throw new Error('Yet another generic error');
  // This function is way too long and does too many things
  return param1 + param2 + param3 + param4 + param5 + param6 + param7 + param8;
}
`.repeat(50)); // Make it very long

      const result = await runner.runSingleAgent('code-understanding');
      
      expect(result).toBeDefined();
      // Should detect potential issues
    });
  });

  describe('Security Audit Agent', () => {
    it('should check for security best practices', async () => {
      const result = await runner.runSingleAgent('security-audit');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(true);
    });

    it('should detect security vulnerabilities', async () => {
      // Create a file with security issues
      fs.writeFileSync(path.join(testWorkspace, 'src', 'insecure.ts'), `
const API_KEY = "hardcoded-api-key-12345";
const PASSWORD = "admin123";

export function unsafeQuery(userInput: string) {
  const query = "SELECT * FROM users WHERE id = " + userInput;
  return query; // SQL injection vulnerability
}

export function unsafeHtml(userContent: string) {
  document.innerHTML = userContent; // XSS vulnerability
}

export function insecureConnection() {
  fetch('http://example.com/api'); // Insecure HTTP
}
`);

      const result = await runner.runSingleAgent('security-audit');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.some(error => 
        error.includes('Hardcoded secrets detected')
      )).toBe(true);
    });
  });

  describe('Performance Optimization Agent', () => {
    it('should analyze performance patterns', async () => {
      const result = await runner.runSingleAgent('performance-optimization');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(true);
    });

    it('should detect performance issues', async () => {
      // Create a file with performance issues
      fs.writeFileSync(path.join(testWorkspace, 'src', 'slow-code.ts'), `
import fs from 'fs';

export function inefficientCode() {
  // Nested loops - O(n²) complexity
  for (let i = 0; i < 1000; i++) {
    for (let j = 0; j < 1000; j++) {
      console.log(i * j);
    }
  }

  // Synchronous file operations
  const data = fs.readFileSync('large-file.txt', 'utf8');
  fs.writeFileSync('output.txt', data);
  
  return data;
}
`);

      const result = await runner.runSingleAgent('performance-optimization');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.some(error => 
        error.includes('Synchronous file operations found')
      )).toBe(true);
    });
  });

  describe('Integration Testing Agent', () => {
    it('should analyze test coverage and structure', async () => {
      const result = await runner.runSingleAgent('integration-testing');
      
      expect(result).toBeDefined();
      // Should pass since we have test files
      expect(result?.passed).toBe(true);
    });

    it('should detect missing tests', async () => {
      // Remove test files
      fs.rmSync(path.join(testWorkspace, 'tests'), { recursive: true, force: true });

      const result = await runner.runSingleAgent('integration-testing');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.some(error => 
        error.includes('No test files found')
      )).toBe(true);
    });
  });

  describe('Sub-Agent Loop Execution', () => {
    it('should run all agents in sequence', async () => {
      const result = await runner.runAllAgents();
      
      expect(result.results.size).toBeGreaterThan(0);
      
      // Check that core agents were executed
      expect(result.results.has('production-readiness')).toBe(true);
      expect(result.results.has('context-awareness')).toBe(true);
      expect(result.results.has('security-audit')).toBe(true);
    });

    it('should handle mixed success and failure results', async () => {
      // Add a file with issues to ensure some agents fail
      fs.writeFileSync(path.join(testWorkspace, 'src', 'issues.ts'), `
// TODO: This needs to be implemented
const hardcodedPassword = "secret123";
console.log("Debug output");
throw new Error("not implemented");
`);

      const result = await runner.runAllAgents();
      
      expect(result.results.size).toBeGreaterThan(0);
      
      // Should have mixed results
      const passedCount = Array.from(result.results.values()).filter(r => r.passed).length;
      const failedCount = Array.from(result.results.values()).filter(r => !r.passed).length;
      
      expect(passedCount).toBeGreaterThan(0);
      expect(failedCount).toBeGreaterThan(0);
      expect(result.allPassed).toBe(false);
    });

    it('should handle agent loop with iterations', async () => {
      // Create issues that would be detected
      fs.writeFileSync(path.join(testWorkspace, 'src', 'temp-issues.ts'), `
// TODO: Remove this temporary file
console.log('Temporary debug statement');
`);

      // Mock the progress messages
      const showInfoSpy = jest.spyOn(mockVscode.window, 'showInformationMessage')
        .mockResolvedValueOnce('Yes, Analyze');

      await runner.runAgentLoop();

      // Should have shown the analysis prompt since some checks will pass
      expect(showInfoSpy).toHaveBeenCalled();
    });
  });

  describe('Configuration and Customization', () => {
    it('should allow updating agent configuration', async () => {
      const originalConfig = runner.getConfig();
      
      const newConfig = {
        enabledAgents: ['context-awareness', 'security-audit'],
        maxIterations: 10,
        continueOnError: true
      };

      await runner.updateConfig(newConfig);
      
      const updatedConfig = runner.getConfig();
      expect(updatedConfig.enabledAgents).toEqual(['context-awareness', 'security-audit']);
      expect(updatedConfig.maxIterations).toBe(10);
      expect(updatedConfig.continueOnError).toBe(true);
    });

    it('should only run enabled agents', async () => {
      // Enable only specific agents
      await runner.updateConfig({
        enabledAgents: ['context-awareness', 'security-audit']
      });

      const result = await runner.runAllAgents();
      
      expect(result.results.size).toBe(2);
      expect(result.results.has('context-awareness')).toBe(true);
      expect(result.results.has('security-audit')).toBe(true);
      expect(result.results.has('build-check')).toBe(false);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle agent execution failures gracefully', async () => {
      // This test ensures the system doesn't crash when individual agents fail
      const result = await runner.runAllAgents();
      
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      // System should continue running even if some agents fail
    });

    it('should handle malformed script output', async () => {
      // Create a custom script that outputs invalid JSON
      const scriptsDir = path.join(testWorkspace, '.autoclaude', 'scripts');
      fs.mkdirSync(scriptsDir, { recursive: true });
      
      const customScript = path.join(scriptsDir, 'broken-agent.sh');
      fs.writeFileSync(customScript, `#!/bin/bash
echo "This is not valid JSON output"
exit 0
`);
      fs.chmodSync(customScript, '755');

      // The system should handle this gracefully
      const result = await runner.runSingleAgent('context-awareness');
      expect(result).toBeDefined();
    });
  });
});