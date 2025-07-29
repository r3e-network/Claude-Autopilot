import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getValidatedConfig, validateConfig, resetConfigToDefaults } from '../../../src/core/config';

// Mock vscode
const mockGet = jest.fn();
const mockUpdate = jest.fn();

const mockWorkspaceConfig = {
  get: mockGet,
  update: mockUpdate
};

beforeEach(() => {
  jest.clearAllMocks();
  (global as any).vscode = {
    ...(global as any).vscode,
    workspace: {
      getConfiguration: jest.fn(() => mockWorkspaceConfig)
    }
  };
});

describe('Configuration Management', () => {
  describe('getValidatedConfig', () => {
    it('should return default configuration when no custom config exists', () => {
      mockGet.mockImplementation((key: string, defaultValue: any) => defaultValue);
      
      const config = getValidatedConfig();
      
      expect(config).toBeDefined();
      expect(config.queue).toBeDefined();
      expect(config.session).toBeDefined();
      expect(config.security).toBeDefined();
      expect(config.scriptRunner).toBeDefined();
    });

    it('should merge custom configuration with defaults', () => {
      mockGet.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'queue.maxSize') return 2000;
        if (key === 'session.autoStart') return true;
        return defaultValue;
      });
      
      const config = getValidatedConfig();
      
      expect(config.queue.maxSize).toBe(2000);
      expect(config.session.autoStart).toBe(true);
    });

    it('should validate numeric ranges', () => {
      mockGet.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'queue.maxSize') return -1; // Invalid: below minimum
        if (key === 'queue.maxOutputSize') return 2000000; // Invalid: above maximum
        return defaultValue;
      });
      
      const config = getValidatedConfig();
      
      // Should fall back to defaults for invalid values
      expect(config.queue.maxSize).toBe(1000); // Default value
      expect(config.queue.maxOutputSize).toBe(1000000); // Default max
    });

    it('should validate boolean values', () => {
      mockGet.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'session.autoStart') return 'true'; // Invalid: string instead of boolean
        return defaultValue;
      });
      
      const config = getValidatedConfig();
      
      expect(typeof config.session.autoStart).toBe('boolean');
    });

    it('should validate security settings', () => {
      mockGet.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'security.allowDangerousXssbypass') return 'maybe'; // Invalid
        return defaultValue;
      });
      
      const config = getValidatedConfig();
      
      expect(typeof config.security.allowDangerousXssbypass).toBe('boolean');
      expect(config.security.allowDangerousXssbypass).toBe(false); // Should default to safe value
    });
  });

  describe('validateConfig', () => {
    it('should return validation results', () => {
      mockGet.mockImplementation((key: string, defaultValue: any) => defaultValue);
      
      const validation = validateConfig();
      
      expect(validation).toBeDefined();
      expect(validation.isValid).toBeDefined();
      expect(validation.errors).toBeDefined();
      expect(Array.isArray(validation.errors)).toBe(true);
    });

    it('should detect configuration errors', () => {
      mockGet.mockImplementation((key: string, defaultValue: any) => {
        if (key === 'queue.maxSize') return 'invalid';
        if (key === 'session.autoResumeDelay') return -100;
        return defaultValue;
      });
      
      const validation = validateConfig();
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('resetConfigToDefaults', () => {
    it('should reset all configuration values', () => {
      resetConfigToDefaults();
      
      expect(mockUpdate).toHaveBeenCalledWith('queue', undefined);
      expect(mockUpdate).toHaveBeenCalledWith('session', undefined);
      expect(mockUpdate).toHaveBeenCalledWith('security', undefined);
      expect(mockUpdate).toHaveBeenCalledWith('scriptRunner', undefined);
    });
  });
});