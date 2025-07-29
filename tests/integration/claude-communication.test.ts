import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

// Mock child_process
jest.mock('child_process');

// Mock VS Code API
const mockPostMessage = jest.fn();
const mockPanel = {
  webview: {
    postMessage: mockPostMessage
  }
};

jest.mock('../../../src/core/state', () => ({
  claudePanel: mockPanel,
  messageQueue: [],
  currentMessage: null,
  claudeCurrentScreen: '',
  isProcessing: false
}));

jest.mock('../../../src/utils/logging', () => ({
  debugLog: jest.fn()
}));

// Import after mocking
import { startClaudeSession, handleClaudeKeypress, clearClaudeOutput } from '../../../src/claude/session';

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = {
    write: jest.fn(),
    end: jest.fn()
  };
  
  constructor() {
    super();
  }
  
  kill() {
    this.emit('close', 0, 'SIGTERM');
  }
}

describe('Claude Communication Integration', () => {
  let mockProcess: MockChildProcess;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockProcess = new MockChildProcess();
    
    // Mock spawn to return our mock process
    (child_process.spawn as jest.Mock).mockReturnValue(mockProcess);
  });

  afterEach(() => {
    if (mockProcess) {
      mockProcess.removeAllListeners();
    }
  });

  describe('Claude Session Management', () => {
    it('should start Claude session successfully', async () => {
      const sessionPromise = startClaudeSession(true);
      
      // Simulate successful process start
      setTimeout(() => {
        mockProcess.stdout.emit('data', 'Claude session started\n');
        mockProcess.emit('spawn');
      }, 10);
      
      await expect(sessionPromise).resolves.toBeUndefined();
      
      expect(child_process.spawn).toHaveBeenCalledWith(
        'python3',
        expect.arrayContaining([
          expect.stringContaining('claude_pty_wrapper.py'),
          'claude',
          'chat',
          '--dangerously-skip-permissions'
        ]),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          env: expect.any(Object)
        })
      );
    });

    it('should handle Claude session startup failure', async () => {
      const sessionPromise = startClaudeSession(true);
      
      // Simulate process startup error
      setTimeout(() => {
        mockProcess.emit('error', new Error('Failed to start Claude'));
      }, 10);
      
      await expect(sessionPromise).rejects.toThrow('Failed to start Claude');
    });

    it('should handle Claude authentication error', async () => {
      const sessionPromise = startClaudeSession(true);
      
      // Simulate authentication error
      setTimeout(() => {
        mockProcess.stderr.emit('data', 'Authentication failed: Invalid API key\n');
        mockProcess.emit('close', 1);
      }, 10);
      
      await expect(sessionPromise).rejects.toThrow();
    });

    it('should process Claude output and update UI', async () => {
      const sessionPromise = startClaudeSession(true);
      
      // Start the session
      setTimeout(() => {
        mockProcess.emit('spawn');
        
        // Simulate Claude output
        mockProcess.stdout.emit('data', 'Hello! How can I help you today?\n');
        mockProcess.stdout.emit('data', 'I\'m ready to assist with your development tasks.\n');
      }, 10);
      
      await sessionPromise;
      
      // Wait for output processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'updateClaudeOutput'
        })
      );
    });
  });

  describe('Claude Input Handling', () => {
    beforeEach(async () => {
      // Start a session for input testing
      const sessionPromise = startClaudeSession(true);
      setTimeout(() => {
        mockProcess.emit('spawn');
      }, 10);
      await sessionPromise;
    });

    it('should send keypress to Claude process', () => {
      const testKey = 'Hello, Claude!\n';
      
      handleClaudeKeypress(testKey);
      
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(testKey);
    });

    it('should handle special keys correctly', () => {
      const specialKeys = ['\n', '\t', '\x03', '\x04']; // Enter, Tab, Ctrl+C, Ctrl+D
      
      specialKeys.forEach(key => {
        handleClaudeKeypress(key);
        expect(mockProcess.stdin.write).toHaveBeenCalledWith(key);
      });
    });

    it('should handle empty or null input gracefully', () => {
      handleClaudeKeypress('');
      handleClaudeKeypress(null as any);
      handleClaudeKeypress(undefined as any);
      
      // Should not crash, but may or may not write empty strings
      expect(mockProcess.stdin.write).toHaveBeenCalled();
    });
  });

  describe('Claude Output Processing', () => {
    beforeEach(async () => {
      const sessionPromise = startClaudeSession(true);
      setTimeout(() => {
        mockProcess.emit('spawn');
      }, 10);
      await sessionPromise;
    });

    it('should accumulate and process streaming output', async () => {
      // Simulate streaming output
      mockProcess.stdout.emit('data', 'This is a ');
      mockProcess.stdout.emit('data', 'long message ');
      mockProcess.stdout.emit('data', 'split across multiple chunks.\n');
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'updateClaudeOutput',
          output: expect.stringContaining('This is a long message split across multiple chunks.')
        })
      );
    });

    it('should handle ANSI escape sequences', async () => {
      // Simulate output with ANSI codes
      mockProcess.stdout.emit('data', '\x1b[32mGreen text\x1b[0m\n');
      mockProcess.stdout.emit('data', '\x1b[1mBold text\x1b[0m\n');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'updateClaudeOutput'
        })
      );
    });

    it('should detect and handle usage limit warnings', async () => {
      mockProcess.stdout.emit('data', 'Warning: You are approaching your usage limit\n');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'usageLimitWarning'
        })
      );
    });

    it('should clear output when requested', () => {
      clearClaudeOutput();
      
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'clearClaudeOutput'
        })
      );
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle process unexpected termination', async () => {
      const sessionPromise = startClaudeSession(true);
      
      setTimeout(() => {
        mockProcess.emit('spawn');
        // Simulate unexpected termination
        setTimeout(() => {
          mockProcess.emit('close', 1, null);
        }, 50);
      }, 10);
      
      await sessionPromise;
      
      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'sessionError'
        })
      );
    });

    it('should handle stderr output appropriately', async () => {
      const sessionPromise = startClaudeSession(true);
      
      setTimeout(() => {
        mockProcess.emit('spawn');
        mockProcess.stderr.emit('data', 'Warning: Something might be wrong\n');
      }, 10);
      
      await sessionPromise;
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should continue running despite stderr output
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'updateClaudeOutput'
        })
      );
    });

    it('should handle process timeout scenarios', async () => {
      const sessionPromise = startClaudeSession(true);
      
      // Don't emit spawn event to simulate timeout
      
      // The session should handle this gracefully
      await expect(sessionPromise).rejects.toThrow();
    }, 15000); // Increase timeout for this test
  });

  describe('Message Queue Integration', () => {
    it('should process queued messages when session is ready', async () => {
      // Mock message queue
      const { messageQueue } = require('../../../src/core/state');
      messageQueue.push({
        id: 'test-message-1',
        text: 'Hello Claude, please help with testing',
        status: 'pending',
        timestamp: new Date(),
        attachedScripts: []
      });

      const sessionPromise = startClaudeSession(true);
      
      setTimeout(() => {
        mockProcess.emit('spawn');
        // Simulate Claude ready state
        mockProcess.stdout.emit('data', 'How can I help you?\n');
      }, 10);
      
      await sessionPromise;
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have sent the queued message
      expect(mockProcess.stdin.write).toHaveBeenCalledWith(
        expect.stringContaining('Hello Claude, please help with testing')
      );
    });
  });
});