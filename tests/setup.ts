import { jest } from '@jest/globals';

// Global test setup
beforeAll(() => {
  // Mock VS Code extension API
  (global as any).vscode = {
    window: {
      showInformationMessage: jest.fn(),
      showWarningMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      createWebviewPanel: jest.fn(),
      withProgress: jest.fn()
    },
    workspace: {
      getConfiguration: jest.fn(() => ({
        get: jest.fn(),
        update: jest.fn()
      })),
      workspaceFolders: [{
        uri: { fsPath: '/test/workspace' },
        name: 'test-workspace',
        index: 0
      }]
    },
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2,
      WorkspaceFolder: 3
    },
    ViewColumn: {
      One: 1,
      Two: 2,
      Three: 3
    },
    ProgressLocation: {
      Notification: 1,
      Window: 2
    }
  };

  // Mock console methods for cleaner test output
  (global as any).console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.VSCODE_CONTEXT = 'test';