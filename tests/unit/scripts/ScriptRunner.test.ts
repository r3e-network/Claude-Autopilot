import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  chmodSync: jest.fn(),
  readFile: jest.fn(),
  promises: {
    readFile: jest.fn()
  }
}));

jest.mock('child_process', () => ({
  exec: jest.fn()
}));

jest.mock('../../../src/utils/logging', () => ({
  debugLog: jest.fn()
}));

jest.mock('../../../src/queue', () => ({
  addMessageToQueueFromWebview: jest.fn()
}));

// Mock vscode
(global as any).vscode = {
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn(() => false) // subAgents.enabled = false by default
    }))
  },
  window: {
    showInformationMessage: jest.fn(() => Promise.resolve())
  }
};

const mockExistsSync = fs.existsSync as jest.Mock;
const mockReadFileSync = fs.readFileSync as jest.Mock;
const mockWriteFileSync = fs.writeFileSync as jest.Mock;

// Import after mocking
import { ScriptRunner } from '../../../src/scripts/index';

describe('ScriptRunner', () => {
  let scriptRunner: ScriptRunner;
  const workspacePath = '/test/workspace';
  
  beforeEach(() => {
    jest.clearAllMocks();
    scriptRunner = new ScriptRunner(workspacePath);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with workspace path', () => {
      expect(scriptRunner).toBeDefined();
    });

    it('should create .autoclaude directory during initialization', async () => {
      mockExistsSync.mockReturnValue(false);
      
      await scriptRunner.initialize();
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.join(workspacePath, '.autoclaude', 'scripts'),
        { recursive: true }
      );
    });

    it('should create built-in scripts during initialization', async () => {
      mockExistsSync.mockReturnValue(false);
      
      await scriptRunner.initialize();
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('production-readiness.sh'),
        expect.any(String)
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('build-check.sh'),
        expect.any(String)
      );
    });
  });

  describe('Configuration Management', () => {
    it('should load default configuration when no config file exists', async () => {
      mockExistsSync.mockReturnValue(false);
      
      await scriptRunner.initialize();
      const config = scriptRunner.getConfig();
      
      expect(config.scripts).toBeDefined();
      expect(config.scripts.length).toBeGreaterThan(0);
      expect(config.maxIterations).toBe(5);
    });

    it('should load existing configuration', async () => {
      const existingConfig = {
        scripts: [
          {
            id: 'custom-script',
            name: 'Custom Script',
            description: 'A custom test script',
            enabled: true,
            predefined: false,
            path: '.autoclaude/scripts/custom.sh'
          }
        ],
        maxIterations: 10,
        continueOnError: false
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(existingConfig));
      
      await scriptRunner.initialize();
      const config = scriptRunner.getConfig();
      
      expect(config.maxIterations).toBe(10);
      expect(config.scripts).toHaveLength(1);
      expect(config.scripts[0].id).toBe('custom-script');
    });

    it('should update configuration', async () => {
      const newConfig = {
        scripts: [],
        maxIterations: 3,
        continueOnError: true
      };

      await scriptRunner.updateConfig(newConfig);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('scripts.json'),
        JSON.stringify(newConfig, null, 2)
      );
    });
  });

  describe('Script Execution', () => {
    beforeEach(() => {
      // Mock child_process.exec
      const { exec } = require('child_process');
      exec.mockImplementation((command: string, callback: Function) => {
        // Simulate successful script execution
        const mockResult = JSON.stringify({
          passed: true,
          errors: [],
          warnings: [],
          fixInstructions: 'No issues found'
        });
        callback(null, mockResult, '');
      });
    });

    it('should execute single script check', async () => {
      await scriptRunner.initialize();
      
      const result = await scriptRunner.runSingleCheck('production-readiness');
      
      expect(result).toBeDefined();
      expect(result?.passed).toBe(true);
      expect(result?.errors).toEqual([]);
    });

    it('should return null for non-existent script', async () => {
      await scriptRunner.initialize();
      
      const result = await scriptRunner.runSingleCheck('non-existent-script');
      
      expect(result).toBeNull();
    });

    it('should run all enabled scripts', async () => {
      await scriptRunner.initialize();
      
      const result = await scriptRunner.runChecks();
      
      expect(result.allPassed).toBe(true);
      expect(result.results.size).toBeGreaterThan(0);
    });

    it('should handle script execution errors', async () => {
      const { exec } = require('child_process');
      exec.mockImplementation((command: string, callback: Function) => {
        callback(new Error('Script execution failed'), '', 'Error output');
      });

      await scriptRunner.initialize();
      
      const result = await scriptRunner.runSingleCheck('production-readiness');
      
      expect(result?.passed).toBe(false);
      expect(result?.errors).toContain('Script execution failed');
    });

    it('should handle malformed JSON output', async () => {
      const { exec } = require('child_process');
      exec.mockImplementation((command: string, callback: Function) => {
        callback(null, 'invalid json output', '');
      });

      await scriptRunner.initialize();
      
      const result = await scriptRunner.runSingleCheck('production-readiness');
      
      expect(result?.passed).toBe(false);
      expect(result?.errors).toContain('Invalid script output format');
    });
  });

  describe('Script Loop Execution', () => {
    it('should run script loop until all pass or max iterations', async () => {
      let callCount = 0;
      const { exec } = require('child_process');
      
      exec.mockImplementation((command: string, callback: Function) => {
        callCount++;
        const mockResult = JSON.stringify({
          passed: callCount >= 2, // Fail first time, pass second time
          errors: callCount < 2 ? ['Test error'] : [],
          warnings: [],
          fixInstructions: callCount < 2 ? 'Fix the error' : 'No issues'
        });
        callback(null, mockResult, '');
      });

      // addMessageToQueueFromWebview is already mocked at the top of the file

      await scriptRunner.initialize();
      
      await scriptRunner.runCheckLoop();
      
      // Should have been called at least twice (initial check + retry)
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should respect max iterations limit', async () => {
      const { exec } = require('child_process');
      exec.mockImplementation((command: string, callback: Function) => {
        // Always fail
        const mockResult = JSON.stringify({
          passed: false,
          errors: ['Persistent error'],
          warnings: [],
          fixInstructions: 'Cannot be fixed'
        });
        callback(null, mockResult, '');
      });

      await scriptRunner.initialize();
      
      // Set low max iterations for testing
      const config = scriptRunner.getConfig();
      config.maxIterations = 2;
      await scriptRunner.updateConfig(config);
      
      const startTime = Date.now();
      await scriptRunner.runCheckLoop();
      const endTime = Date.now();
      
      // Should not run indefinitely
      expect(endTime - startTime).toBeLessThan(30000); // 30 seconds max
    });
  });

  describe('User Scripts Loading', () => {
    it('should load user-defined scripts', async () => {
      // Mock finding custom script files
      mockExistsSync.mockImplementation((filePath: unknown) => {
        return typeof filePath === 'string' && filePath.includes('custom-script.sh');
      });

      const mockScript = `#!/bin/bash
echo '{"passed": true, "errors": [], "warnings": []}'`;
      
      mockReadFileSync.mockImplementation((filePath: unknown) => {
        if (typeof filePath === 'string' && filePath.includes('custom-script.sh')) {
          return mockScript;
        }
        return '{"scripts": [], "maxIterations": 5, "continueOnError": false}';
      });

      await scriptRunner.initialize();
      await scriptRunner.loadUserScripts();
      
      const config = scriptRunner.getConfig();
      expect(config.scripts.some(s => s.id === 'custom-script')).toBe(true);
    });
  });
});