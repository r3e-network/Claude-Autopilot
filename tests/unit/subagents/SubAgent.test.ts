import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SubAgent } from '../../../src/subagents/SubAgent';
import { SubAgentConfig, SubAgentRequest, SubAgentResponse } from '../../../src/subagents/types';

// Mock dependencies
jest.mock('../../../src/utils/logging', () => ({
  debugLog: jest.fn()
}));

class TestSubAgent extends SubAgent {
  async execute(request: SubAgentRequest): Promise<SubAgentResponse> {
    return {
      success: true,
      message: 'Test execution completed',
      confidence: 'high'
    };
  }

  async analyzeResults(context: any): Promise<string> {
    return 'Test analysis result';
  }

  async runCheck() {
    return {
      passed: true,
      errors: [],
      warnings: [],
      fixInstructions: 'No issues found'
    };
  }
}

describe('SubAgent Base Class', () => {
  let config: SubAgentConfig;
  let subAgent: TestSubAgent;

  beforeEach(() => {
    config = {
      id: 'test-agent',
      name: 'Test Agent',
      description: 'A test sub-agent',
      category: 'custom',
      enabled: true,
      capabilities: [
        {
          id: 'test-capability',
          name: 'Test Capability',
          description: 'A test capability',
          action: 'analyze'
        }
      ],
      systemPrompt: 'You are a test agent.',
      checkScript: 'test-script.sh'
    };

    subAgent = new TestSubAgent(config, '/test/workspace');
  });

  describe('Constructor', () => {
    it('should initialize with correct config and workspace', () => {
      expect(subAgent.id).toBe('test-agent');
      expect(subAgent.getCapabilities()).toEqual(config.capabilities);
    });

    it('should handle missing optional properties', () => {
      const minimalConfig: SubAgentConfig = {
        id: 'minimal',
        name: 'Minimal Agent',
        description: 'Minimal test agent',
        category: 'custom',
        enabled: true,
        capabilities: [],
        systemPrompt: 'Minimal prompt'
      };

      const minimalAgent = new TestSubAgent(minimalConfig, '/test');
      expect(minimalAgent.id).toBe('minimal');
    });
  });

  describe('getCapabilities', () => {
    it('should return configured capabilities', () => {
      const capabilities = subAgent.getCapabilities();
      
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].id).toBe('test-capability');
      expect(capabilities[0].action).toBe('analyze');
    });

    it('should return empty array when no capabilities', () => {
      const configWithoutCapabilities = {
        ...config,
        capabilities: []
      };
      
      const agentWithoutCapabilities = new TestSubAgent(configWithoutCapabilities, '/test');
      expect(agentWithoutCapabilities.getCapabilities()).toEqual([]);
    });
  });

  describe('buildClaudeMessage', () => {
    it('should build message with system prompt and context', () => {
      const request: SubAgentRequest = {
        action: 'analyze',
        context: {
          workspacePath: '/test/workspace',
          iterationCount: 1,
          maxIterations: 5
        },
        prompt: 'Test prompt'
      };

      const message = (subAgent as any).buildClaudeMessage(request);
      
      expect(message).toContain('You are a test agent.');
      expect(message).toContain('Test prompt');
      expect(message).toContain('analyze');
    });

    it('should include script results when available', () => {
      const request: SubAgentRequest = {
        action: 'fix',
        context: {
          workspacePath: '/test/workspace',
          iterationCount: 1,
          maxIterations: 5,
          scriptResult: {
            passed: false,
            errors: ['Error 1', 'Error 2'],
            warnings: ['Warning 1'],
            fixInstructions: 'Fix these issues'
          }
        },
        prompt: 'Fix the issues'
      };

      const message = (subAgent as any).buildClaudeMessage(request);
      
      expect(message).toContain('Error 1');
      expect(message).toContain('Error 2');
      expect(message).toContain('Warning 1');
      expect(message).toContain('Fix these issues');
    });

    it('should handle different action types', () => {
      const actions = ['analyze', 'fix', 'suggest', 'refactor', 'generate'] as const;
      
      actions.forEach(action => {
        const request: SubAgentRequest = {
          action,
          context: {
            workspacePath: '/test/workspace',
            iterationCount: 1,
            maxIterations: 5
          },
          prompt: `Test ${action} prompt`
        };

        const message = (subAgent as any).buildClaudeMessage(request);
        expect(message).toContain(action);
      });
    });
  });

  describe('Abstract Methods Implementation', () => {
    it('should implement execute method', async () => {
      const request: SubAgentRequest = {
        action: 'analyze',
        context: {
          workspacePath: '/test/workspace',
          iterationCount: 1,
          maxIterations: 5
        },
        prompt: 'Test prompt'
      };

      const response = await subAgent.execute(request);
      
      expect(response.success).toBe(true);
      expect(response.message).toBe('Test execution completed');
      expect(response.confidence).toBe('high');
    });

    it('should implement runCheck method', async () => {
      const result = await subAgent.runCheck();
      
      expect(result.passed).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.fixInstructions).toBe('No issues found');
    });
  });
});