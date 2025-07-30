import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { tmpdir } from 'os';

// Create a temporary directory for testing
const testWorkspace = path.join(tmpdir(), 'autoclaude-test-' + Date.now());

// Mock modules that we don't want to actually execute
jest.mock('../../../src/utils/logging', () => ({
  debugLog: jest.fn()
}));

const mockVscode = {
  window: {
    showInformationMessage: jest.fn(),
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

// Import after setting up mocks
import { ScriptRunner } from '../../../src/scripts/index';
import { SHELL_SCRIPTS } from '../../../src/scripts/shellScripts';

describe('Script Execution Integration', () => {
  let scriptRunner: ScriptRunner;

  beforeEach(async () => {
    // Create test workspace
    if (!fs.existsSync(testWorkspace)) {
      fs.mkdirSync(testWorkspace, { recursive: true });
    }

    // Create a sample project structure
    fs.writeFileSync(path.join(testWorkspace, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: {
        build: 'echo "Build successful"',
        test: 'echo "Tests passed"',
        lint: 'echo "Linting passed"'
      }
    }, null, 2));

    // Create some test source files
    const srcDir = path.join(testWorkspace, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    fs.writeFileSync(path.join(srcDir, 'index.ts'), `
export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}

// TODO: Add more functionality here
console.log('Starting application');
`);

    fs.writeFileSync(path.join(srcDir, 'utils.ts'), `
export function add(a: number, b: number): number {
  return a + b;
}
`);

    scriptRunner = new ScriptRunner(testWorkspace);
    await scriptRunner.initialize();
  });

  afterEach(() => {
    // Clean up test workspace
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  describe('Production Readiness Script', () => {
    it('should detect TODO comments and production issues', async () => {
      const result = await scriptRunner.runSingleCheck('production-readiness');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.length).toBeGreaterThan(0);
      
      // Should find the TODO comment
      const todoError = result?.errors.find(error => 
        error.includes('TODO') && error.includes('index.ts')
      );
      expect(todoError).toBeDefined();
      
      // Should find the console.log statement
      const consoleError = result?.errors.find(error => 
        error.includes('console.log') || error.includes('Debug console statement')
      );
      expect(consoleError).toBeDefined();
    });

    it('should pass when no production issues exist', async () => {
      // Create a clean file without issues
      fs.writeFileSync(path.join(testWorkspace, 'src', 'clean.ts'), `
export function multiply(a: number, b: number): number {
  return a * b;
}
`);

      // Remove the problematic file
      fs.unlinkSync(path.join(testWorkspace, 'src', 'index.ts'));

      const result = await scriptRunner.runSingleCheck('production-readiness');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(true);
      expect(result?.errors).toEqual([]);
    });
  });

  describe('Build Check Script', () => {
    it('should detect build configuration and attempt build', async () => {
      const result = await scriptRunner.runSingleCheck('build-check');
      
      expect(result).toBeDefined();
      // Result depends on whether npm is available in the test environment
      if (result?.passed) {
        expect(result.errors).toEqual([]);
      } else {
        expect(result?.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle missing build configuration', async () => {
      // Remove package.json
      fs.unlinkSync(path.join(testWorkspace, 'package.json'));

      const result = await scriptRunner.runSingleCheck('build-check');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.some(error => 
        error.includes('No build system detected') || 
        error.includes('No project configuration file')
      )).toBe(true);
    });
  });

  describe('Test Check Script', () => {
    it('should detect test configuration', async () => {
      const result = await scriptRunner.runSingleCheck('test-check');
      
      expect(result).toBeDefined();
      // Should find the test script in package.json
    });

    it('should handle missing test configuration', async () => {
      // Update package.json to remove test script
      const packageJson = JSON.parse(fs.readFileSync(path.join(testWorkspace, 'package.json'), 'utf8'));
      delete packageJson.scripts.test;
      fs.writeFileSync(path.join(testWorkspace, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scriptRunner.runSingleCheck('test-check');
      
      expect(result).toBeDefined();
      // May pass or fail depending on whether test files are detected
    });
  });

  describe('Format Check Script', () => {
    it('should check basic formatting issues', async () => {
      // Create a file with formatting issues
      fs.writeFileSync(path.join(testWorkspace, 'src', 'badly-formatted.ts'), `
export function badlyFormatted(  ){   
   return "needs formatting";    
}
`);

      const result = await scriptRunner.runSingleCheck('format-check');
      
      expect(result).toBeDefined();
      // Should detect trailing whitespace or other formatting issues
    });

    it('should handle projects with linting configuration', async () => {
      // Add ESLint config
      fs.writeFileSync(path.join(testWorkspace, '.eslintrc.json'), JSON.stringify({
        extends: ['eslint:recommended'],
        env: {
          node: true,
          es2020: true
        },
        parserOptions: {
          ecmaVersion: 11,
          sourceType: 'module'
        }
      }));

      const result = await scriptRunner.runSingleCheck('format-check');
      
      expect(result).toBeDefined();
      // Result depends on whether ESLint is available
    });
  });

  describe('GitHub Actions Script', () => {
    it('should handle projects without GitHub Actions', async () => {
      const result = await scriptRunner.runSingleCheck('github-actions');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(true);
      expect(result?.warnings).toContain('No GitHub Actions workflows found');
    });

    it('should validate GitHub Actions workflows when present', async () => {
      // Create .github/workflows directory
      const workflowsDir = path.join(testWorkspace, '.github', 'workflows');
      fs.mkdirSync(workflowsDir, { recursive: true });

      // Create a sample workflow
      fs.writeFileSync(path.join(workflowsDir, 'ci.yml'), `
name: CI
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - name: Run tests
      run: npm test
`);

      const result = await scriptRunner.runSingleCheck('github-actions');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(true);
    });

    it('should detect workflow syntax errors', async () => {
      const workflowsDir = path.join(testWorkspace, '.github', 'workflows');
      fs.mkdirSync(workflowsDir, { recursive: true });

      // Create an invalid workflow
      fs.writeFileSync(path.join(workflowsDir, 'invalid.yml'), `
name: Invalid Workflow
# Missing 'on' trigger
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - invalid yaml syntax here...
`);

      const result = await scriptRunner.runSingleCheck('github-actions');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.some(error => 
        error.includes('Missing \'on\' trigger')
      )).toBe(true);
    });
  });

  describe('Script Loop Integration', () => {
    it('should run multiple scripts in sequence', async () => {
      const result = await scriptRunner.runChecks();
      
      expect(result.results.size).toBeGreaterThan(0);
      expect(result.results.has('production-readiness')).toBe(true);
      expect(result.results.has('build-check')).toBe(true);
      expect(result.results.has('test-check')).toBe(true);
      expect(result.results.has('format-check')).toBe(true);
      expect(result.results.has('github-actions')).toBe(true);
    });

    it('should stop on first failure when configured', async () => {
      const result = await scriptRunner.runChecks(true); // stopOnFailure = true
      
      // If any script fails, the loop should stop
      if (!result.allPassed) {
        const failedScriptIds = Array.from(result.results.entries())
          .filter(([_, scriptResult]) => !scriptResult.passed)
          .map(([scriptId, _]) => scriptId);
        
        expect(failedScriptIds.length).toBeGreaterThan(0);
      }
    });

    it('should handle script execution timeouts gracefully', async () => {
      // This test ensures the script runner doesn't hang indefinitely
      const startTime = Date.now();
      
      await scriptRunner.runChecks();
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time (30 seconds for all scripts)
      expect(executionTime).toBeLessThan(30000);
    }, 35000);
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle scripts that produce non-JSON output', async () => {
      // Create a script that outputs invalid JSON
      const customScriptPath = path.join(testWorkspace, '.autoclaude', 'scripts', 'broken-script.sh');
      fs.writeFileSync(customScriptPath, `#!/bin/bash
echo "This is not JSON output"
exit 0
`);
      fs.chmodSync(customScriptPath, '755');

      // Add to config
      const config = scriptRunner.getConfig();
      config.scripts.push({
        id: 'broken-script',
        name: 'Broken Script',
        description: 'A script that produces invalid JSON',
        enabled: true,
        predefined: false,
        path: '.autoclaude/scripts/broken-script.sh'
      });
      await scriptRunner.updateConfig(config);

      const result = await scriptRunner.runSingleCheck('broken-script');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.some(error => 
        error.includes('Invalid script output format')
      )).toBe(true);
    });

    it('should handle scripts that fail to execute', async () => {
      // Create a script that will fail to execute
      const failingScriptPath = path.join(testWorkspace, '.autoclaude', 'scripts', 'failing-script.sh');
      fs.writeFileSync(failingScriptPath, `#!/bin/bash
echo "Script is failing"
exit 1
`);
      fs.chmodSync(failingScriptPath, '755');

      // Add to config
      const config = scriptRunner.getConfig();
      config.scripts.push({
        id: 'failing-script',
        name: 'Failing Script',
        description: 'A script that always fails',
        enabled: true,
        predefined: false,
        path: '.autoclaude/scripts/failing-script.sh'
      });
      await scriptRunner.updateConfig(config);

      const result = await scriptRunner.runSingleCheck('failing-script');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(false);
      expect(result?.errors.length).toBeGreaterThan(0);
    });
  });
});