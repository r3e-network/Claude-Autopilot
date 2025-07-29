import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { debugLog, setDebugMode, getDebugMode } from '../../../src/utils/logging';

const originalConsole = console;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset debug mode
  setDebugMode(false);
});

describe('Logging Utilities', () => {
  describe('setDebugMode and getDebugMode', () => {
    it('should set and get debug mode correctly', () => {
      expect(getDebugMode()).toBe(false);
      
      setDebugMode(true);
      expect(getDebugMode()).toBe(true);
      
      setDebugMode(false);
      expect(getDebugMode()).toBe(false);
    });
  });

  describe('debugLog', () => {
    it('should not log when debug mode is disabled', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      setDebugMode(false);
      
      debugLog('Test message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log when debug mode is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      setDebugMode(true);
      
      debugLog('Test message');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AutoClaude]'),
        'Test message'
      );
      consoleSpy.mockRestore();
    });

    it('should include timestamp in log output', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      setDebugMode(true);
      
      debugLog('Test with timestamp');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/^\[AutoClaude \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/),
        'Test with timestamp'
      );
      consoleSpy.mockRestore();
    });

    it('should handle multiple arguments', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      setDebugMode(true);
      
      debugLog('Message with', 'multiple', 'arguments', 123);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AutoClaude]'),
        'Message with',
        'multiple',
        'arguments',
        123
      );
      consoleSpy.mockRestore();
    });

    it('should handle objects and complex data types', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      setDebugMode(true);
      
      const testObject = { key: 'value', number: 42 };
      debugLog('Object test:', testObject);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AutoClaude]'),
        'Object test:',
        testObject
      );
      consoleSpy.mockRestore();
    });

    it('should handle undefined and null values', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      setDebugMode(true);
      
      debugLog('Null test:', null, undefined);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AutoClaude]'),
        'Null test:',
        null,
        undefined
      );
      consoleSpy.mockRestore();
    });
  });
});