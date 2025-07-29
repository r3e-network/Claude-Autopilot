import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { 
  analyzeClaudeOutput, 
  isClaudeWaitingForInput, 
  hasClaudeStoppedMidTask,
  checkAndResumeTasks 
} from '../../../src/claude/analyzer';

// Mock dependencies
jest.mock('../../../src/core/state', () => ({
  claudeCurrentScreen: ''
}));

jest.mock('../../../src/queue', () => ({
  addMessageToQueueFromWebview: jest.fn()
}));

const mockGet = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  (global as any).vscode = {
    ...(global as any).vscode,
    workspace: {
      getConfiguration: jest.fn(() => ({
        get: mockGet
      }))
    }
  };
});

describe('Claude Output Analyzer', () => {
  describe('analyzeClaudeOutput', () => {
    it('should detect unfinished TODOs', () => {
      const output = `
        I'm working on the feature.
        TODO: Implement error handling
        - [ ] Add validation
        - [x] Create basic structure
      `;
      
      const analysis = analyzeClaudeOutput(output);
      
      expect(analysis.hasUnfinishedTasks).toBe(true);
      expect(analysis.unfinishedTodos).toContain('Implement error handling');
      expect(analysis.unfinishedTodos).toContain('Add validation');
      expect(analysis.confidence).toBe('high');
    });

    it('should detect incomplete steps', () => {
      const output = `
        I'll now implement the following:
        1. Create the database schema
        2. Add API endpoints
        Next, I'll update the frontend components.
      `;
      
      const analysis = analyzeClaudeOutput(output);
      
      expect(analysis.hasUnfinishedTasks).toBe(true);
      expect(analysis.incompleteSteps.length).toBeGreaterThan(0);
      expect(analysis.confidence).toBe('high');
    });

    it('should detect mid-task interruption', () => {
      const output = `
        Let me create the new component
        I'm implementing
      `;
      
      const analysis = analyzeClaudeOutput(output);
      
      expect(analysis.hasUnfinishedTasks).toBe(true);
      expect(analysis.confidence).toBe('low');
    });

    it('should not detect tasks when work is complete', () => {
      const output = `
        I have successfully completed all the tasks.
        ✅ All done!
        Everything is working correctly.
      `;
      
      const analysis = analyzeClaudeOutput(output);
      
      expect(analysis.hasUnfinishedTasks).toBe(false);
    });

    it('should handle empty or null input', () => {
      const analysis1 = analyzeClaudeOutput('');
      const analysis2 = analyzeClaudeOutput(null as any);
      
      expect(analysis1.hasUnfinishedTasks).toBe(false);
      expect(analysis2.hasUnfinishedTasks).toBe(false);
    });

    it('should generate appropriate continuation messages', () => {
      const output = `
        TODO: Fix the bug in login system
        I need to implement user authentication
      `;
      
      const analysis = analyzeClaudeOutput(output);
      
      expect(analysis.suggestedContinuation).toBeDefined();
      expect(analysis.suggestedContinuation).toContain('unfinished tasks');
      expect(analysis.suggestedContinuation).toContain('Fix the bug in login system');
    });
  });

  describe('isClaudeWaitingForInput', () => {
    it('should detect question patterns', () => {
      const outputs = [
        'What would you like me to do next?',
        'Should I proceed with this approach?',
        'Please provide more details about the requirements.',
        'Would you like me to continue?'
      ];
      
      outputs.forEach(output => {
        // Mock the claudeCurrentScreen
        jest.doMock('../../../src/core/state', () => ({
          claudeCurrentScreen: output
        }));
        
        const { isClaudeWaitingForInput } = require('../../../src/claude/analyzer');
        expect(isClaudeWaitingForInput()).toBe(true);
      });
    });

    it('should not detect waiting when Claude is working', () => {
      const outputs = [
        'I am implementing the feature now.',
        'Creating the new component...',
        'The task has been completed successfully.'
      ];
      
      outputs.forEach(output => {
        jest.doMock('../../../src/core/state', () => ({
          claudeCurrentScreen: output
        }));
        
        const { isClaudeWaitingForInput } = require('../../../src/claude/analyzer');
        expect(isClaudeWaitingForInput()).toBe(false);
      });
    });
  });

  describe('hasClaudeStoppedMidTask', () => {
    it('should detect incomplete sentences', () => {
      const outputs = [
        'I am going to implement',
        'Let me create the new',
        'Working on the feature and',
        '1. First step',
        '- Creating'
      ];
      
      outputs.forEach(output => {
        jest.doMock('../../../src/core/state', () => ({
          claudeCurrentScreen: output
        }));
        
        const { hasClaudeStoppedMidTask } = require('../../../src/claude/analyzer');
        expect(hasClaudeStoppedMidTask()).toBe(true);
      });
    });

    it('should not detect mid-task when sentences are complete', () => {
      const outputs = [
        'I have completed the implementation.',
        'The feature is working correctly.',
        'All tests are passing.'
      ];
      
      outputs.forEach(output => {
        jest.doMock('../../../src/core/state', () => ({
          claudeCurrentScreen: output
        }));
        
        const { hasClaudeStoppedMidTask } = require('../../../src/claude/analyzer');
        expect(hasClaudeStoppedMidTask()).toBe(false);
      });
    });
  });

  describe('checkAndResumeTasks', () => {
    it('should return false when no unfinished tasks', async () => {
      mockGet.mockReturnValue(false); // aggressiveTaskDetection = false
      
      jest.doMock('../../../src/core/state', () => ({
        claudeCurrentScreen: 'All tasks completed successfully.'
      }));
      
      const { checkAndResumeTasks } = require('../../../src/claude/analyzer');
      const result = await checkAndResumeTasks();
      
      expect(result).toBe(false);
    });

    it('should return true and add message when tasks found', async () => {
      mockGet.mockReturnValue(false);
      const { addMessageToQueueFromWebview } = require('../../../src/queue');
      
      jest.doMock('../../../src/core/state', () => ({
        claudeCurrentScreen: 'TODO: Complete the implementation'
      }));
      
      const { checkAndResumeTasks } = require('../../../src/claude/analyzer');
      const result = await checkAndResumeTasks();
      
      expect(result).toBe(true);
      expect(addMessageToQueueFromWebview).toHaveBeenCalled();
    });
  });
});