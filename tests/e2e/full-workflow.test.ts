import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

// Create a temporary directory for E2E testing
const testWorkspace = path.join(tmpdir(), 'autoclaude-e2e-test-' + Date.now());

// Mock VS Code environment for E2E testing
const mockVscode = {
  window: {
    showInformationMessage: jest.fn(() => Promise.resolve('Yes')),
    showWarningMessage: jest.fn(() => Promise.resolve('OK')),
    showErrorMessage: jest.fn(() => Promise.resolve('OK')),
    createWebviewPanel: jest.fn(() => ({
      webview: {
        postMessage: jest.fn(),
        html: ''
      },
      onDidDispose: jest.fn(),
      reveal: jest.fn(),
      dispose: jest.fn()
    })),
    withProgress: jest.fn((options, callback) => {
      return (callback as any)({
        report: jest.fn()
      });
    })
  },
  workspace: {
    getConfiguration: jest.fn(() => ({
      get: jest.fn((key: string, defaultValue: any) => {
        const config: any = {
          'developmentMode': false,
          'queue.maxSize': 1000,
          'session.autoStart': false,
          'session.skipPermissions': true,
          'security.allowDangerousXssbypass': false,
          'scriptRunner.enabled': true,
          'subAgents.enabled': true
        };
        return config[key] ?? defaultValue;
      }),
      update: jest.fn()
    })),
    workspaceFolders: [{
      uri: { fsPath: testWorkspace },
      name: 'e2e-test-workspace',
      index: 0
    }],
    findFiles: jest.fn(() => Promise.resolve([]))
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

(global as any).vscode = mockVscode;

// Mock other dependencies
jest.mock('../../../src/utils/logging', () => ({
  debugLog: jest.fn(),
  getDebugMode: jest.fn(() => false),
  setDebugMode: jest.fn()
}));

// Import components after mocking
import { ScriptRunner } from '../../../src/scripts';
import { SubAgentRunner } from '../../../src/subagents';

describe('End-to-End Workflow Tests', () => {
  beforeAll(async () => {
    // Create comprehensive test workspace
    await createComprehensiveTestProject();
  });

  afterAll(() => {
    // Clean up
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  async function createComprehensiveTestProject() {
    // Create workspace directory
    fs.mkdirSync(testWorkspace, { recursive: true });

    // Create package.json with comprehensive configuration
    fs.writeFileSync(path.join(testWorkspace, 'package.json'), JSON.stringify({
      name: 'e2e-test-project',
      version: '1.0.0',
      description: 'Comprehensive test project for E2E testing',
      main: 'dist/index.js',
      scripts: {
        build: 'tsc',
        test: 'jest',
        lint: 'eslint src/**/*.ts --fix',
        format: 'prettier --write src/**/*.ts',
        start: 'node dist/index.js',
        dev: 'ts-node src/index.ts'
      },
      dependencies: {
        express: '^4.18.0',
        cors: '^2.8.5',
        helmet: '^7.0.0',
        dotenv: '^16.0.0'
      },
      devDependencies: {
        typescript: '^4.9.0',
        'ts-node': '^10.9.0',
        '@types/node': '^18.0.0',
        '@types/express': '^4.17.0',
        jest: '^29.0.0',
        '@types/jest': '^29.0.0',
        eslint: '^8.0.0',
        '@typescript-eslint/parser': '^5.0.0',
        '@typescript-eslint/eslint-plugin': '^5.0.0',
        prettier: '^2.8.0'
      }
    }, null, 2));

    // Create TypeScript configuration
    fs.writeFileSync(path.join(testWorkspace, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        lib: ['ES2020'],
        module: 'commonjs',
        declaration: true,
        outDir: './dist',
        rootDir: './src',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noImplicitReturns: true,
        noFallthroughCasesInSwitch: true,
        moduleResolution: 'node',
        baseUrl: './',
        esModuleInterop: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'tests']
    }, null, 2));

    // Create ESLint configuration
    fs.writeFileSync(path.join(testWorkspace, '.eslintrc.json'), JSON.stringify({
      parser: '@typescript-eslint/parser',
      extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended'
      ],
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      },
      rules: {
        'no-unused-vars': 'error',
        'no-console': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn'
      }
    }, null, 2));

    // Create Prettier configuration
    fs.writeFileSync(path.join(testWorkspace, '.prettierrc'), JSON.stringify({
      semi: true,
      trailingComma: 'es5',
      singleQuote: true,
      printWidth: 80,
      tabWidth: 2
    }, null, 2));

    // Create comprehensive source code
    const srcDir = path.join(testWorkspace, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Main application file
    fs.writeFileSync(path.join(srcDir, 'index.ts'), `
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { userRouter } from './routes/users';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', authMiddleware, userRouter);

// Error handling
app.use(errorHandler);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  logger.info(\`Server running on port \${PORT}\`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

export default app;
`);

    // Create routes directory
    const routesDir = path.join(srcDir, 'routes');
    fs.mkdirSync(routesDir, { recursive: true });

    fs.writeFileSync(path.join(routesDir, 'users.ts'), `
import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/UserService';
import { validateUser } from '../validation/userValidation';

export const userRouter = Router();
const userService = new UserService();

userRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

userRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    next(error);
  }
});

userRouter.post('/', validateUser, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userData = req.body;
    const newUser = await userService.createUser(userData);
    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});
`);

    // Create services directory
    const servicesDir = path.join(srcDir, 'services');
    fs.mkdirSync(servicesDir, { recursive: true });

    fs.writeFileSync(path.join(servicesDir, 'UserService.ts'), `
import { User, CreateUserData } from '../types/User';
import { Database } from '../utils/database';
import { logger } from '../utils/logger';

export class UserService {
  private db: Database;

  constructor() {
    this.db = new Database();
  }

  async getAllUsers(): Promise<User[]> {
    try {
      const users = await this.db.query('SELECT * FROM users');
      return users;
    } catch (error) {
      logger.error('Failed to fetch users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const user = await this.db.queryOne('SELECT * FROM users WHERE id = ?', [id]);
      return user;
    } catch (error) {
      logger.error(\`Failed to fetch user \${id}:\`, error);
      throw new Error('Failed to fetch user');
    }
  }

  async createUser(userData: CreateUserData): Promise<User> {
    try {
      const newUser = await this.db.insert('users', userData);
      logger.info(\`Created new user: \${newUser.id}\`);
      return newUser;
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw new Error('Failed to create user');
    }
  }

  async updateUser(id: string, userData: Partial<CreateUserData>): Promise<User | null> {
    try {
      const updatedUser = await this.db.update('users', id, userData);
      return updatedUser;
    } catch (error) {
      logger.error(\`Failed to update user \${id}:\`, error);
      throw new Error('Failed to update user');
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete('users', id);
      return result;
    } catch (error) {
      logger.error(\`Failed to delete user \${id}:\`, error);
      throw new Error('Failed to delete user');
    }
  }
}
`);

    // Create additional supporting files for comprehensive testing...
    await createSupportingFiles(srcDir);
    await createTestFiles();
    await createGitHubActions();
    await createDocumentation();
  }

  async function createSupportingFiles(srcDir: string) {
    // Types
    const typesDir = path.join(srcDir, 'types');
    fs.mkdirSync(typesDir, { recursive: true });

    fs.writeFileSync(path.join(typesDir, 'User.ts'), `
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
}
`);

    // Middleware
    const middlewareDir = path.join(srcDir, 'middleware');
    fs.mkdirSync(middlewareDir, { recursive: true });

    fs.writeFileSync(path.join(middlewareDir, 'auth.ts'), `
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // In a real app, verify JWT token here
    const user = { id: '1', email: 'test@example.com' };
    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication failed:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};
`);

    // Utils
    const utilsDir = path.join(srcDir, 'utils');
    fs.mkdirSync(utilsDir, { recursive: true });

    fs.writeFileSync(path.join(utilsDir, 'logger.ts'), `
export const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(\`[INFO] \${new Date().toISOString()}: \${message}\`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(\`[ERROR] \${new Date().toISOString()}: \${message}\`, ...args);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(\`[WARN] \${new Date().toISOString()}: \${message}\`, ...args);
  }
};
`);
  }

  async function createTestFiles() {
    const testsDir = path.join(testWorkspace, 'tests');
    fs.mkdirSync(testsDir, { recursive: true });

    fs.writeFileSync(path.join(testsDir, 'UserService.test.ts'), `
import { UserService } from '../src/services/UserService';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService();
  });

  test('should create user service instance', () => {
    expect(userService).toBeInstanceOf(UserService);
  });

  test('should handle user operations', async () => {
    // Mock test - in real scenario would test actual functionality
    expect(true).toBe(true);
  });
});
`);
  }

  async function createGitHubActions() {
    const workflowsDir = path.join(testWorkspace, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });

    fs.writeFileSync(path.join(workflowsDir, 'ci.yml'), `
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run linting
      run: npm run lint
      
    - name: Run tests
      run: npm test
      
    - name: Build project
      run: npm run build
`);
  }

  async function createDocumentation() {
    fs.writeFileSync(path.join(testWorkspace, 'README.md'), `
# E2E Test Project

This is a comprehensive test project for AutoClaude E2E testing.

## Features

- Express.js REST API
- TypeScript with strict configuration
- ESLint and Prettier for code quality
- Jest for testing
- Security middleware (Helmet, CORS)
- Structured logging
- Error handling
- GitHub Actions CI/CD

## Getting Started

1. Install dependencies: \`npm install\`
2. Build the project: \`npm run build\`
3. Run tests: \`npm test\`
4. Start development server: \`npm run dev\`
5. Start production server: \`npm start\`

## Development

- \`npm run lint\` - Run ESLint
- \`npm run format\` - Format code with Prettier
- \`npm run test\` - Run tests
- \`npm run build\` - Build for production

## API Endpoints

- \`GET /health\` - Health check
- \`GET /api/users\` - Get all users
- \`GET /api/users/:id\` - Get user by ID
- \`POST /api/users\` - Create new user
`);

    fs.writeFileSync(path.join(testWorkspace, '.gitignore'), `
node_modules/
dist/
coverage/
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.log
.DS_Store
.vscode/
.idea/
`);
  }

  describe('Complete Development Workflow', () => {
    it('should run complete script analysis workflow', async () => {
      const scriptRunner = new ScriptRunner(testWorkspace);
      await scriptRunner.initialize();

      // Run all script checks
      const scriptResults = await scriptRunner.runChecks();

      expect(scriptResults).toBeDefined();
      expect(scriptResults.results.size).toBeGreaterThan(0);

      // Verify each script type ran
      expect(scriptResults.results.has('production-readiness')).toBe(true);
      expect(scriptResults.results.has('build-check')).toBe(true);
      expect(scriptResults.results.has('test-check')).toBe(true);
      expect(scriptResults.results.has('format-check')).toBe(true);
      expect(scriptResults.results.has('github-actions')).toBe(true);

      // Log results for debugging
      console.log('Script Results Summary:');
      for (const [scriptId, result] of scriptResults.results) {
        console.log(`- ${scriptId}: ${result.passed ? 'PASSED' : 'FAILED'}`);
        if (!result.passed) {
          console.log(`  Errors: ${result.errors.slice(0, 3).join(', ')}`);
        }
      }
    }, 60000);

    it('should run complete sub-agent workflow', async () => {
      const subAgentRunner = new SubAgentRunner(testWorkspace);
      await subAgentRunner.initialize();

      // Run all sub-agent checks
      const agentResults = await subAgentRunner.runAllAgents();

      expect(agentResults).toBeDefined();
      expect(agentResults.results.size).toBeGreaterThan(0);

      // Verify core sub-agents ran
      const expectedAgents = [
        'production-readiness',
        'build-check',
        'context-awareness',
        'dependency-resolution',
        'code-understanding',
        'security-audit',
        'performance-optimization',
        'integration-testing'
      ];

      expectedAgents.forEach(agentId => {
        expect(agentResults.results.has(agentId)).toBe(true);
      });

      // Log results for debugging
      console.log('Sub-Agent Results Summary:');
      for (const [agentId, result] of agentResults.results) {
        console.log(`- ${agentId}: ${result.passed ? 'PASSED' : 'FAILED'}`);
        if (!result.passed) {
          console.log(`  Errors: ${result.errors.slice(0, 2).join(', ')}`);
        }
      }
    }, 90000);

    it('should handle realistic development scenarios', async () => {
      // Scenario 1: Developer introduces issues
      fs.writeFileSync(path.join(testWorkspace, 'src', 'buggy-code.ts'), `
// TODO: This code needs review
const hardcodedApiKey = "sk-1234567890abcdef";

export function unsafeFunction(userInput: string) {
  console.log("Debug: processing", userInput);
  
  // Synchronous file operation (performance issue)
  const fs = require('fs');
  const data = fs.readFileSync('config.json', 'utf8');
  
  // SQL injection vulnerability
  const query = "SELECT * FROM users WHERE name = '" + userInput + "'";
  
  // Missing error handling
  return JSON.parse(data);
}
`);

      const scriptRunner = new ScriptRunner(testWorkspace);
      await scriptRunner.initialize();

      const results = await scriptRunner.runChecks();

      // Should detect issues
      const productionReadiness = results.results.get('production-readiness');
      expect(productionReadiness?.passed).toBe(false);
      expect(productionReadiness?.errors.some((e: string) => e.includes('TODO'))).toBe(true);

      // Now fix the issues
      fs.unlinkSync(path.join(testWorkspace, 'src', 'buggy-code.ts'));

      // Run again - should pass
      const fixedResults = await scriptRunner.runChecks();
      const fixedProductionReadiness = fixedResults.results.get('production-readiness');
      expect(fixedProductionReadiness?.passed).toBe(true);
    }, 60000);

    it('should integrate scripts and sub-agents effectively', async () => {
      // Create a comprehensive workflow that uses both systems
      const scriptRunner = new ScriptRunner(testWorkspace);
      const subAgentRunner = new SubAgentRunner(testWorkspace);

      await Promise.all([
        scriptRunner.initialize(),
        subAgentRunner.initialize()
      ]);

      // Run both systems
      const [scriptResults, agentResults] = await Promise.all([
        scriptRunner.runChecks(),
        subAgentRunner.runAllAgents()
      ]);

      // Both should provide complementary analysis
      expect(scriptResults.results.size).toBeGreaterThan(0);
      expect(agentResults.results.size).toBeGreaterThan(0);

      // Some checks should be common between both systems
      const commonChecks = ['production-readiness', 'build-check'];
      
      commonChecks.forEach(checkId => {
        const scriptResult = scriptResults.results.get(checkId);
        const agentResult = agentResults.results.get(checkId);
        
        expect(scriptResult).toBeDefined();
        expect(agentResult).toBeDefined();
        
        // Results should be consistent (both systems checking the same things)
        expect(scriptResult?.passed).toBe(agentResult?.passed);
      });
    }, 120000);
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should handle corrupted project files gracefully', async () => {
      // Corrupt package.json
      fs.writeFileSync(path.join(testWorkspace, 'package.json'), 'invalid json {');

      const scriptRunner = new ScriptRunner(testWorkspace);
      await scriptRunner.initialize();

      // Should not crash, but should report errors
      const results = await scriptRunner.runChecks();
      expect(results).toBeDefined();
      
      // Some checks should fail due to corrupted config
      expect(results.allPassed).toBe(false);
    });

    it('should handle missing dependencies gracefully', async () => {
      // Remove node_modules if it exists
      const nodeModulesPath = path.join(testWorkspace, 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        fs.rmSync(nodeModulesPath, { recursive: true, force: true });
      }

      const subAgentRunner = new SubAgentRunner(testWorkspace);
      await subAgentRunner.initialize();

      // Should handle missing dependencies without crashing
      const results = await subAgentRunner.runAllAgents();
      expect(results).toBeDefined();
      
      // Dependency resolution agent should detect the issue
      const depResult = results.results.get('dependency-resolution');
      expect(depResult?.passed).toBe(false);
    });

    it('should handle very large projects within reasonable time', async () => {
      // Create many files to test performance
      const largeSrcDir = path.join(testWorkspace, 'src', 'large');
      fs.mkdirSync(largeSrcDir, { recursive: true });

      for (let i = 0; i < 50; i++) {
        fs.writeFileSync(path.join(largeSrcDir, `file${i}.ts`), `
export function function${i}() {
  return ${i};
}
`);
      }

      const startTime = Date.now();
      
      const scriptRunner = new ScriptRunner(testWorkspace);
      await scriptRunner.initialize();
      const results = await scriptRunner.runChecks();
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within reasonable time (2 minutes for large project)
      expect(executionTime).toBeLessThan(120000);
      expect(results).toBeDefined();
    }, 150000);
  });
});