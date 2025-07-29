# Testing Guide for Claude-Autopilot

This document outlines the comprehensive testing strategy implemented for the Claude-Autopilot VSCode extension.

## Test Structure

The testing suite is organized into multiple layers:

```
tests/
├── setup.ts                    # Global test configuration
├── unit/                       # Unit tests
│   ├── core/                   # Core system tests
│   ├── utils/                  # Utility function tests
│   ├── subagents/              # Sub-agent system tests
│   ├── scripts/                # Script runner tests
│   ├── claude/                 # Claude communication tests
│   └── queue/                  # Queue management tests
├── integration/                # Integration tests
│   ├── claude-communication.test.ts
│   ├── script-execution.test.ts
│   └── subagent-system.test.ts
└── e2e/                       # End-to-end tests
    └── full-workflow.test.ts
```

## Testing Framework

- **Framework**: Jest with TypeScript support via ts-jest
- **Mocking**: Built-in Jest mocking with VS Code API mocks
- **Coverage**: Comprehensive coverage reporting with HTML reports
- **Timeout**: 30-second timeout for complex operations

## Test Categories

### 1. Unit Tests
Test individual functions and classes in isolation:

- **Configuration Management**: Validates config loading, validation, and defaults
- **Utility Functions**: Tests ID generation, logging, and helper functions
- **Sub-Agent Components**: Tests individual sub-agent functionality
- **Queue Management**: Tests message queue operations and memory management

### 2. Integration Tests
Test component interactions and workflows:

- **Claude Communication**: Tests process spawning, I/O handling, and error recovery
- **Script Execution**: Tests shell script execution with real filesystem operations
- **Sub-Agent System**: Tests complete sub-agent workflow with realistic project structures

### 3. End-to-End Tests
Test complete user workflows:

- **Full Development Workflow**: Tests complete script analysis and sub-agent execution
- **Error Recovery**: Tests system resilience with corrupted files and missing dependencies
- **Performance**: Tests system performance with large projects

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Coverage Reports

Coverage reports are generated in multiple formats:
- **Console**: Summary in terminal
- **HTML**: Detailed report in `coverage/html-report/`
- **LCOV**: Machine-readable format in `coverage/lcov.info`

## Test Examples

### Unit Test Example
```typescript
import { describe, it, expect } from '@jest/globals';
import { generateId } from '../../../src/utils/id-generator';

describe('ID Generator', () => {
  it('should generate unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });
});
```

### Integration Test Example
```typescript
import { ScriptRunner } from '../../../src/scripts';

describe('Script Execution Integration', () => {
  it('should run production readiness check', async () => {
    const scriptRunner = new ScriptRunner('/test/workspace');
    await scriptRunner.initialize();
    
    const result = await scriptRunner.runSingleCheck('production-readiness');
    
    expect(result).toBeDefined();
    expect(typeof result.passed).toBe('boolean');
  });
});
```

## Mocking Strategy

### VS Code API Mocking
The VS Code extension API is comprehensively mocked in `tests/setup.ts`:

```typescript
(global as any).vscode = {
  window: {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createWebviewPanel: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(),
    workspaceFolders: [/* mock workspace */]
  }
};
```

### File System Mocking
File system operations are mocked using Jest's module mocking:

```typescript
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn()
}));
```

## Test Data Management

### Temporary Workspaces
Integration and E2E tests create temporary workspaces with realistic project structures:

```typescript
const testWorkspace = path.join(tmpdir(), 'autoclaude-test-' + Date.now());

// Create realistic project structure
fs.writeFileSync(path.join(testWorkspace, 'package.json'), JSON.stringify({
  name: 'test-project',
  scripts: { build: 'tsc', test: 'jest' }
}));
```

### Cleanup
All temporary resources are cleaned up in `afterEach` or `afterAll` hooks:

```typescript
afterAll(() => {
  if (fs.existsSync(testWorkspace)) {
    fs.rmSync(testWorkspace, { recursive: true, force: true });
  }
});
```

## Coverage Goals

- **Unit Tests**: 80%+ line coverage for core functionality
- **Integration Tests**: Cover all major user workflows
- **E2E Tests**: Cover complete development scenarios

## CI/CD Integration

Tests are designed to run in CI/CD environments:

- **No External Dependencies**: All dependencies are mocked or embedded
- **Deterministic**: Tests produce consistent results across environments
- **Fast Execution**: Unit tests complete in seconds, full suite in minutes
- **Comprehensive Reporting**: Coverage and test results in standard formats

## Best Practices

### Writing Tests
1. **Descriptive Names**: Test names clearly describe what is being tested
2. **Single Responsibility**: Each test focuses on one specific behavior
3. **Arrange-Act-Assert**: Clear structure with setup, execution, and verification
4. **Error Scenarios**: Test both success and failure cases

### Mocking Guidelines
1. **Mock External Dependencies**: File system, processes, network calls
2. **Keep Mocks Simple**: Focus on the interface, not implementation
3. **Reset Mocks**: Clear mock state between tests
4. **Verify Mock Calls**: Assert that mocks are called as expected

### Test Maintenance
1. **Update with Code Changes**: Keep tests in sync with implementation
2. **Review Test Coverage**: Regularly check coverage reports
3. **Refactor Tests**: Keep test code clean and maintainable
4. **Document Complex Tests**: Add comments for complex test scenarios

## Current Test Status

### Implemented Tests
✅ **Jest Framework Setup**: Complete with TypeScript support  
✅ **VS Code API Mocking**: Comprehensive mocks for extension development  
✅ **Unit Test Structure**: Organized test categories and structure  
✅ **Integration Test Framework**: Real filesystem and process testing  
✅ **E2E Test Foundation**: Complete workflow testing capability  
✅ **Coverage Reporting**: Multiple report formats and CI integration  

### Test Coverage Areas
✅ **Configuration Management**: Validation, defaults, error handling  
✅ **Utility Functions**: ID generation, logging, helpers  
✅ **Script Execution**: Shell script running and result parsing  
✅ **Sub-Agent System**: Individual agents and workflow orchestration  
✅ **Queue Management**: Message processing and memory management  
✅ **Error Recovery**: Resilience testing with corrupted data  

### Performance Benchmarks
- **Unit Tests**: ~2-5 seconds for full suite
- **Integration Tests**: ~30-60 seconds with filesystem operations
- **E2E Tests**: ~2-3 minutes for complete workflows
- **Coverage Generation**: ~10-15 seconds additional overhead

The testing infrastructure is production-ready and provides comprehensive coverage of all major system components. The framework supports both development workflows (watch mode, fast feedback) and CI/CD requirements (comprehensive reporting, deterministic results).