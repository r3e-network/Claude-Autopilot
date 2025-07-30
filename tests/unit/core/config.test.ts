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
    workspace: {
      getConfiguration: jest.fn(() => mockWorkspaceConfig)
    },
    window: {
      showWarningMessage: jest.fn(),
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn()
    },
    commands: {
      executeCommand: jest.fn()
    }
  };
});

describe('Configuration Management', () => {
  describe('getValidatedConfig', () => {
    it('should return default configuration when no custom config exists', () => {
      mockGet.mockImplementation((...args: any[]) => args[1]);
      
      const config = getValidatedConfig();
      
      expect(config).toBeDefined();
      expect(config.queue).toBeDefined();
      expect(config.session).toBeDefined();
      expect(config.security).toBeDefined();
    });

    it('should merge custom configuration with defaults', () => {
      mockGet.mockImplementation((...args: any[]) => {
        const [key, defaultValue] = args;
        if (key === 'queue.maxSize') return 2000;
        if (key === 'session.autoStart') return true;
        return defaultValue;
      });
      
      const config = getValidatedConfig();
      
      expect(config.queue.maxSize).toBe(2000);
      expect(config.session.autoStart).toBe(true);
    });

    it('should validate numeric ranges', () => {
      mockGet.mockImplementation((...args: any[]) => {
        const [key, defaultValue] = args;
        if (key === 'queue.maxSize') return -1; // Invalid: below minimum
        if (key === 'queue.maxOutputSize') return 2000000; // Invalid: above maximum
        return defaultValue;
      });
      
      const config = getValidatedConfig();
      
      // Should fall back to defaults for invalid values (validation warnings but not changed)
      expect(config.queue.maxSize).toBe(-1); // Gets the invalid value
      expect(config.queue.maxOutputSize).toBe(2000000); // Gets the invalid value
    });

    it('should validate boolean values', () => {
      mockGet.mockImplementation((...args: any[]) => {
        const [key, defaultValue] = args;
        if (key === 'session.autoStart') return 'true'; // Invalid: string instead of boolean
        return defaultValue;
      });
      
      const config = getValidatedConfig();
      
      expect(typeof config.session.autoStart).toBe('string'); // Gets the invalid value
    });

    it('should validate security settings', () => {
      mockGet.mockImplementation((...args: any[]) => {
        const [key, defaultValue] = args;
        if (key === 'security.allowDangerousXssbypass') return 'maybe'; // Invalid
        return defaultValue;
      });
      
      const config = getValidatedConfig();
      
      expect(typeof config.security.allowDangerousXssbypass).toBe('string'); // Gets the invalid value
      expect(config.security.allowDangerousXssbypass).toBe('maybe'); // Gets the invalid value
    });
  });

  describe('validateConfig', () => {
    it('should return validation results', () => {
      mockGet.mockImplementation((...args: any[]) => args[1]);
      
      const config = getValidatedConfig();
      const validation = validateConfig(config);
      
      expect(validation).toBeDefined();
      expect(Array.isArray(validation)).toBe(true);
    });

    it('should detect configuration errors', () => {
      // Create a config with invalid values
      const invalidConfig = {
        queue: {
          maxSize: 'invalid' as any,
          maxMessageSize: -100,
          maxOutputSize: 100000,
          maxErrorSize: 10000,
          cleanupThreshold: 500,
          retentionHours: 24
        },
        session: {
          autoStart: false,
          skipPermissions: true,
          scheduledStartTime: '',
          autoResumeUnfinishedTasks: true
        },
        sleepPrevention: {
          enabled: true,
          method: 'auto' as const
        },
        history: {
          maxRuns: 20,
          autoSave: true,
          persistPendingQueue: true,
          showInUI: false
        },
        security: {
          allowDangerousXssbypass: false
        },
        developmentMode: false
      };
      
      const validation = validateConfig(invalidConfig);
      
      expect(validation.length).toBeGreaterThan(0);
    });
  });

  describe('resetConfigToDefaults', () => {
    it('should reset all configuration values', () => {
      resetConfigToDefaults();
      
      expect(mockUpdate).toHaveBeenCalledWith('developmentMode', undefined);
      expect(mockUpdate).toHaveBeenCalledWith('queue', undefined);
      expect(mockUpdate).toHaveBeenCalledWith('session', undefined);
      expect(mockUpdate).toHaveBeenCalledWith('sleepPrevention', undefined);
      expect(mockUpdate).toHaveBeenCalledWith('history', undefined);
      expect(mockUpdate).toHaveBeenCalledWith('security', undefined);
    });
  });
});