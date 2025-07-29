import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SubAgentRunner } from '../../../src/subagents/SubAgentRunner';

// Mock dependencies
jest.mock('../../../src/subagents/registry', () => ({
  SubAgentRegistry: jest.fn().mockImplementation(() => ({
    loadCustomAgents: jest.fn(),
    getAgent: jest.fn(),
    getAllAgents: jest.fn(() => [])
  }))
}));

jest.mock('../../../src/utils/logging', () => ({
  debugLog: jest.fn()
}));

jest.mock('../../../src/core/state', () => ({
  messageQueue: []
}));

const mockShowInformationMessage = jest.fn();
const mockShowWarningMessage = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).vscode = {
    ...(global as any).vscode,
    window: {
      showInformationMessage: mockShowInformationMessage,
      showWarningMessage: mockShowWarningMessage,
      showErrorMessage: jest.fn(),
      createWebviewPanel: jest.fn(),
      withProgress: jest.fn()
    }
  };
});

describe('SubAgentRunner', () => {
  let runner: SubAgentRunner;
  const workspacePath = '/test/workspace';

  beforeEach(() => {
    runner = new SubAgentRunner(workspacePath);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with correct workspace path', () => {
      expect(runner).toBeDefined();
      expect(runner.getConfig()).toBeDefined();
    });

    it('should have default configuration', () => {
      const config = runner.getConfig();
      
      expect(config.enabledAgents).toContain('production-readiness');
      expect(config.enabledAgents).toContain('build-check');
      expect(config.enabledAgents).toContain('context-awareness');
      expect(config.maxIterations).toBe(5);
      expect(config.continueOnError).toBe(false);
    });

    it('should initialize registry and load config', async () => {
      const registry = runner.getRegistry();
      
      await runner.initialize();
      
      expect(registry.loadCustomAgents).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', async () => {
      const newConfig = {
        maxIterations: 10,
        continueOnError: true
      };

      await runner.updateConfig(newConfig);
      
      const config = runner.getConfig();
      expect(config.maxIterations).toBe(10);
      expect(config.continueOnError).toBe(true);
    });

    it('should merge partial configuration updates', async () => {
      const originalConfig = runner.getConfig();
      const originalEnabledAgents = [...originalConfig.enabledAgents];

      await runner.updateConfig({ maxIterations: 7 });
      
      const updatedConfig = runner.getConfig();
      expect(updatedConfig.maxIterations).toBe(7);
      expect(updatedConfig.enabledAgents).toEqual(originalEnabledAgents);
    });
  });

  describe('Single Agent Execution', () => {
    it('should run single agent when agent exists', async () => {
      const mockAgent = {
        id: 'test-agent',
        runCheck: jest.fn().mockResolvedValue({
          passed: true,
          errors: [],
          warnings: []
        })
      };

      const registry = runner.getRegistry();
      (registry.getAgent as jest.Mock).mockReturnValue(mockAgent);

      const result = await runner.runSingleAgent('test-agent');
      
      expect(mockAgent.runCheck).toHaveBeenCalled();
      expect(result).toEqual({
        passed: true,
        errors: [],
        warnings: []
      });
    });

    it('should return null when agent does not exist', async () => {
      const registry = runner.getRegistry();
      (registry.getAgent as jest.Mock).mockReturnValue(undefined);

      const result = await runner.runSingleAgent('non-existent-agent');
      
      expect(result).toBeNull();
    });
  });

  describe('Agent Analysis', () => {
    it('should run agent analysis with script results', async () => {
      const mockAgent = {
        id: 'test-agent',
        execute: jest.fn().mockResolvedValue({
          success: true,
          message: 'Analysis complete'
        })
      };

      const registry = runner.getRegistry();
      (registry.getAgent as jest.Mock).mockReturnValue(mockAgent);

      const scriptResult = {
        passed: false,
        errors: ['Test error'],
        warnings: [],
        fixInstructions: 'Fix the error'
      };

      await runner.runAgentAnalysis('test-agent', scriptResult);
      
      expect(mockAgent.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'analyze',
          context: expect.objectContaining({
            workspacePath,
            scriptResult
          })
        })
      );
    });
  });

  describe('All Agents Execution', () => {
    it('should run all enabled agents', async () => {
      const mockAgent1 = {
        id: 'agent-1',
        runCheck: jest.fn().mockResolvedValue({ passed: true, errors: [], warnings: [] })
      };
      const mockAgent2 = {
        id: 'agent-2',
        runCheck: jest.fn().mockResolvedValue({ passed: false, errors: ['Error'], warnings: [] })
      };

      const registry = runner.getRegistry();
      (registry.getAgent as jest.Mock)
        .mockReturnValueOnce(mockAgent1)
        .mockReturnValueOnce(mockAgent2);

      // Update config to only include these test agents
      await runner.updateConfig({
        enabledAgents: ['agent-1', 'agent-2']
      });

      const result = await runner.runAllAgents();
      
      expect(result.allPassed).toBe(false);
      expect(result.results.size).toBe(2);
      expect(result.results.get('agent-1')?.passed).toBe(true);
      expect(result.results.get('agent-2')?.passed).toBe(false);
    });

    it('should stop on first failure when stopOnFailure is true', async () => {
      const mockAgent1 = {
        id: 'agent-1',
        runCheck: jest.fn().mockResolvedValue({ passed: false, errors: ['Error'], warnings: [] })
      };
      const mockAgent2 = {
        id: 'agent-2',
        runCheck: jest.fn().mockResolvedValue({ passed: true, errors: [], warnings: [] })
      };

      const registry = runner.getRegistry();
      (registry.getAgent as jest.Mock)
        .mockReturnValueOnce(mockAgent1)
        .mockReturnValueOnce(mockAgent2);

      await runner.updateConfig({
        enabledAgents: ['agent-1', 'agent-2']
      });

      const result = await runner.runAllAgents(true);
      
      expect(mockAgent1.runCheck).toHaveBeenCalled();
      expect(mockAgent2.runCheck).not.toHaveBeenCalled();
      expect(result.results.size).toBe(1);
    });
  });

  describe('Agent Loop', () => {
    it('should handle all agents passing initially', async () => {
      const mockAgent = {
        id: 'test-agent',
        runCheck: jest.fn().mockResolvedValue({ passed: true, errors: [], warnings: [] })
      };

      const registry = runner.getRegistry();
      (registry.getAgent as jest.Mock).mockReturnValue(mockAgent);

      await runner.updateConfig({
        enabledAgents: ['test-agent']
      });

      mockShowInformationMessage.mockResolvedValue('No, Exit');

      await runner.runAgentLoop();
      
      expect(mockShowInformationMessage).toHaveBeenCalledWith(
        'All agent checks pass! Would you like the agents to analyze for improvements anyway?',
        'Yes, Analyze',
        'No, Exit'
      );
    });

    it('should handle forced analysis mode', async () => {
      const mockAgent = {
        id: 'test-agent',
        runCheck: jest.fn().mockResolvedValue({ passed: true, errors: [], warnings: [] }),
        execute: jest.fn().mockResolvedValue({ success: true, message: 'Analysis complete' })
      };

      const registry = runner.getRegistry();
      (registry.getAgent as jest.Mock).mockReturnValue(mockAgent);

      await runner.updateConfig({
        enabledAgents: ['test-agent']
      });

      await runner.runAgentLoop(true);
      
      expect(mockAgent.execute).toHaveBeenCalled();
    });
  });
});