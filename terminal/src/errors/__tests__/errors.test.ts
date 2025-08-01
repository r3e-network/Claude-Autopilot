import {
    AutoClaudeError,
    SessionError,
    SessionTimeoutError,
    SessionNotActiveError,
    ConfigurationError,
    InvalidConfigError,
    MissingConfigError,
    SecurityError,
    CommandInjectionError,
    PathTraversalError,
    UnauthorizedError,
    NetworkError,
    ConnectionError,
    TimeoutError,
    QueueError,
    MessageProcessingError,
    QueueFullError,
    ResourceError,
    OutOfMemoryError,
    DiskSpaceError,
    ValidationError,
    InvalidInputError,
    ErrorHandler
} from '../index';

describe('Error Classes', () => {
    describe('AutoClaudeError', () => {
        it('should create base error with all properties', () => {
            const error = new AutoClaudeError('Test error', 'TEST_CODE', { detail: 'test' }, true);
            
            expect(error.message).toBe('Test error');
            expect(error.code).toBe('TEST_CODE');
            expect(error.details).toEqual({ detail: 'test' });
            expect(error.recoverable).toBe(true);
            expect(error.timestamp).toBeInstanceOf(Date);
            expect(error.name).toBe('AutoClaudeError');
        });

        it('should serialize to JSON properly', () => {
            const error = new AutoClaudeError('Test error', 'TEST_CODE');
            const json = error.toJSON();
            
            expect(json).toHaveProperty('name', 'AutoClaudeError');
            expect(json).toHaveProperty('message', 'Test error');
            expect(json).toHaveProperty('code', 'TEST_CODE');
            expect(json).toHaveProperty('timestamp');
            expect(json).toHaveProperty('stack');
        });
    });

    describe('SessionError', () => {
        it('should create session errors with default recoverable true', () => {
            const error = new SessionError('Session failed', 'SESSION_FAIL');
            
            expect(error.name).toBe('SessionError');
            expect(error.recoverable).toBe(true);
        });

        it('should create SessionTimeoutError', () => {
            const error = new SessionTimeoutError();
            
            expect(error.name).toBe('SessionTimeoutError');
            expect(error.code).toBe('SESSION_TIMEOUT');
            expect(error.message).toBe('Session timed out');
            expect(error.recoverable).toBe(true);
        });

        it('should create SessionNotActiveError', () => {
            const error = new SessionNotActiveError();
            
            expect(error.name).toBe('SessionNotActiveError');
            expect(error.code).toBe('SESSION_NOT_ACTIVE');
            expect(error.message).toBe('Session is not active');
            expect(error.recoverable).toBe(true);
        });
    });

    describe('ConfigurationError', () => {
        it('should create config errors as non-recoverable', () => {
            const error = new ConfigurationError('Bad config', 'BAD_CONFIG');
            
            expect(error.name).toBe('ConfigurationError');
            expect(error.recoverable).toBe(false);
        });

        it('should create InvalidConfigError', () => {
            const error = new InvalidConfigError('Invalid setting');
            
            expect(error.name).toBe('InvalidConfigError');
            expect(error.code).toBe('INVALID_CONFIG');
            expect(error.message).toBe('Invalid setting');
        });

        it('should create MissingConfigError', () => {
            const error = new MissingConfigError('apiKey');
            
            expect(error.name).toBe('MissingConfigError');
            expect(error.code).toBe('MISSING_CONFIG');
            expect(error.message).toBe('Missing required configuration: apiKey');
        });
    });

    describe('SecurityError', () => {
        it('should create security errors as non-recoverable', () => {
            const error = new SecurityError('Security breach', 'BREACH');
            
            expect(error.name).toBe('SecurityError');
            expect(error.recoverable).toBe(false);
        });

        it('should create CommandInjectionError', () => {
            const error = new CommandInjectionError('Dangerous command detected');
            
            expect(error.name).toBe('CommandInjectionError');
            expect(error.code).toBe('COMMAND_INJECTION');
        });

        it('should create PathTraversalError', () => {
            const error = new PathTraversalError('../../../etc/passwd');
            
            expect(error.name).toBe('PathTraversalError');
            expect(error.code).toBe('PATH_TRAVERSAL');
            expect(error.message).toBe('Path traversal attempt detected: ../../../etc/passwd');
        });

        it('should create UnauthorizedError', () => {
            const error = new UnauthorizedError();
            
            expect(error.name).toBe('UnauthorizedError');
            expect(error.code).toBe('UNAUTHORIZED');
            expect(error.message).toBe('Unauthorized access attempt');
        });
    });

    describe('NetworkError', () => {
        it('should create network errors as recoverable by default', () => {
            const error = new NetworkError('Network failed', 'NET_FAIL');
            
            expect(error.name).toBe('NetworkError');
            expect(error.recoverable).toBe(true);
        });

        it('should create ConnectionError', () => {
            const error = new ConnectionError('database');
            
            expect(error.name).toBe('ConnectionError');
            expect(error.code).toBe('CONNECTION_ERROR');
            expect(error.message).toBe('Failed to connect to database');
        });

        it('should create TimeoutError', () => {
            const error = new TimeoutError('API call', 5000);
            
            expect(error.name).toBe('TimeoutError');
            expect(error.code).toBe('TIMEOUT');
            expect(error.message).toBe("Operation 'API call' timed out after 5000ms");
        });
    });

    describe('QueueError', () => {
        it('should create MessageProcessingError', () => {
            const error = new MessageProcessingError('msg-123', 'Invalid format');
            
            expect(error.name).toBe('MessageProcessingError');
            expect(error.code).toBe('MESSAGE_PROCESSING_ERROR');
            expect(error.message).toBe('Failed to process message msg-123: Invalid format');
        });

        it('should create QueueFullError as non-recoverable', () => {
            const error = new QueueFullError(1000);
            
            expect(error.name).toBe('QueueFullError');
            expect(error.code).toBe('QUEUE_FULL');
            expect(error.message).toBe('Queue is full (max size: 1000)');
            expect(error.recoverable).toBe(false);
        });
    });

    describe('ResourceError', () => {
        it('should create OutOfMemoryError', () => {
            const error = new OutOfMemoryError();
            
            expect(error.name).toBe('OutOfMemoryError');
            expect(error.code).toBe('OUT_OF_MEMORY');
            expect(error.message).toBe('Out of memory');
            expect(error.recoverable).toBe(false);
        });

        it('should create DiskSpaceError', () => {
            const error = new DiskSpaceError('/tmp', 1000000, 500000);
            
            expect(error.name).toBe('DiskSpaceError');
            expect(error.code).toBe('DISK_SPACE');
            expect(error.message).toContain('Insufficient disk space');
            expect(error.message).toContain('required 1000000 bytes');
            expect(error.message).toContain('available 500000 bytes');
        });
    });

    describe('ValidationError', () => {
        it('should create InvalidInputError', () => {
            const error = new InvalidInputError('age', 'twenty', 'number');
            
            expect(error.name).toBe('InvalidInputError');
            expect(error.message).toBe("Invalid input for field 'age': expected number, got string");
            expect(error.details).toEqual({ field: 'age', value: 'twenty' });
        });
    });
});

describe('ErrorHandler', () => {
    let errorHandler: ErrorHandler;
    let mockLogger: any;

    beforeEach(() => {
        mockLogger = {
            error: jest.fn(),
            info: jest.fn()
        };
        errorHandler = new ErrorHandler(mockLogger);
    });

    describe('handle', () => {
        it('should log AutoClaudeError with full details', () => {
            const error = new SessionTimeoutError('Custom timeout', { sessionId: '123' });
            errorHandler.handle(error, { action: 'sendMessage' });

            expect(mockLogger.error).toHaveBeenCalledWith(
                'SessionTimeoutError: Custom timeout',
                expect.objectContaining({
                    code: 'SESSION_TIMEOUT',
                    recoverable: true,
                    context: { action: 'sendMessage' }
                })
            );
        });

        it('should log recoverable errors with recovery message', () => {
            const error = new SessionTimeoutError();
            errorHandler.handle(error);

            expect(mockLogger.info).toHaveBeenCalledWith('Error is recoverable, attempting recovery...');
        });

        it('should handle unknown errors', () => {
            const error = new Error('Unknown error');
            errorHandler.handle(error);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Unexpected error occurred',
                expect.objectContaining({
                    name: 'Error',
                    message: 'Unknown error'
                })
            );
        });
    });

    describe('isRecoverable', () => {
        it('should identify recoverable errors', () => {
            expect(errorHandler.isRecoverable(new SessionTimeoutError())).toBe(true);
            expect(errorHandler.isRecoverable(new NetworkError('', ''))).toBe(true);
        });

        it('should identify non-recoverable errors', () => {
            expect(errorHandler.isRecoverable(new ConfigurationError('', ''))).toBe(false);
            expect(errorHandler.isRecoverable(new SecurityError('', ''))).toBe(false);
            expect(errorHandler.isRecoverable(new Error('Regular error'))).toBe(false);
        });
    });

    describe('getUserMessage', () => {
        it('should return user-friendly messages for known errors', () => {
            expect(errorHandler.getUserMessage(new SessionTimeoutError()))
                .toBe('The session timed out. Please try again.');
            
            expect(errorHandler.getUserMessage(new SessionNotActiveError()))
                .toBe('The Claude session is not active. Restarting...');
            
            expect(errorHandler.getUserMessage(new InvalidConfigError('test')))
                .toBe('Configuration error. Please check your settings.');
            
            expect(errorHandler.getUserMessage(new CommandInjectionError('test')))
                .toBe('Invalid command detected for security reasons.');
            
            expect(errorHandler.getUserMessage(new ConnectionError('service')))
                .toBe('Connection failed. Please check your network.');
            
            expect(errorHandler.getUserMessage(new QueueFullError(100)))
                .toBe('Too many pending tasks. Please wait...');
            
            expect(errorHandler.getUserMessage(new OutOfMemoryError()))
                .toBe('Low memory. Some features may be limited.');
        });

        it('should return default message for unknown errors', () => {
            expect(errorHandler.getUserMessage(new Error('Some error')))
                .toBe('An unexpected error occurred. Please try again.');
        });

        it('should return original message for unhandled AutoClaudeError codes', () => {
            const error = new AutoClaudeError('Custom message', 'UNKNOWN_CODE');
            expect(errorHandler.getUserMessage(error)).toBe('Custom message');
        });
    });
});