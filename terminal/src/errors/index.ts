/**
 * Base error class for all AutoClaude errors
 */
export class AutoClaudeError extends Error {
    public readonly timestamp: Date;
    public readonly context?: Record<string, any>;

    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: any,
        public readonly recoverable: boolean = false
    ) {
        super(message);
        this.name = 'AutoClaudeError';
        this.timestamp = new Date();
        Error.captureStackTrace(this, this.constructor);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            recoverable: this.recoverable,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

/**
 * Session-related errors
 */
export class SessionError extends AutoClaudeError {
    constructor(message: string, code: string, details?: any, recoverable = true) {
        super(message, code, details, recoverable);
        this.name = 'SessionError';
    }
}

export class SessionTimeoutError extends SessionError {
    constructor(message = 'Session timed out', details?: any) {
        super(message, 'SESSION_TIMEOUT', details, true);
        this.name = 'SessionTimeoutError';
    }
}

export class SessionNotActiveError extends SessionError {
    constructor(message = 'Session is not active', details?: any) {
        super(message, 'SESSION_NOT_ACTIVE', details, true);
        this.name = 'SessionNotActiveError';
    }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AutoClaudeError {
    constructor(message: string, code: string, details?: any) {
        super(message, code, details, false);
        this.name = 'ConfigurationError';
    }
}

export class InvalidConfigError extends ConfigurationError {
    constructor(message: string, details?: any) {
        super(message, 'INVALID_CONFIG', details);
        this.name = 'InvalidConfigError';
    }
}

export class MissingConfigError extends ConfigurationError {
    constructor(configKey: string, details?: any) {
        super(`Missing required configuration: ${configKey}`, 'MISSING_CONFIG', details);
        this.name = 'MissingConfigError';
    }
}

/**
 * Security errors
 */
export class SecurityError extends AutoClaudeError {
    constructor(message: string, code: string, details?: any) {
        super(message, code, details, false);
        this.name = 'SecurityError';
    }
}

export class CommandInjectionError extends SecurityError {
    constructor(message: string, details?: any) {
        super(message, 'COMMAND_INJECTION', details);
        this.name = 'CommandInjectionError';
    }
}

export class PathTraversalError extends SecurityError {
    constructor(path: string, details?: any) {
        super(`Path traversal attempt detected: ${path}`, 'PATH_TRAVERSAL', details);
        this.name = 'PathTraversalError';
    }
}

export class UnauthorizedError extends SecurityError {
    constructor(message = 'Unauthorized access attempt', details?: any) {
        super(message, 'UNAUTHORIZED', details);
        this.name = 'UnauthorizedError';
    }
}

/**
 * Network and external service errors
 */
export class NetworkError extends AutoClaudeError {
    constructor(message: string, code: string, details?: any, recoverable = true) {
        super(message, code, details, recoverable);
        this.name = 'NetworkError';
    }
}

export class ConnectionError extends NetworkError {
    constructor(service: string, details?: any) {
        super(`Failed to connect to ${service}`, 'CONNECTION_ERROR', details);
        this.name = 'ConnectionError';
    }
}

export class TimeoutError extends NetworkError {
    constructor(operation: string, timeoutMs: number, details?: any) {
        super(`Operation '${operation}' timed out after ${timeoutMs}ms`, 'TIMEOUT', details);
        this.name = 'TimeoutError';
    }
}

/**
 * Queue and processing errors
 */
export class QueueError extends AutoClaudeError {
    constructor(message: string, code: string, details?: any, recoverable = true) {
        super(message, code, details, recoverable);
        this.name = 'QueueError';
    }
}

export class MessageProcessingError extends QueueError {
    constructor(messageId: string, reason: string, details?: any) {
        super(`Failed to process message ${messageId}: ${reason}`, 'MESSAGE_PROCESSING_ERROR', details);
        this.name = 'MessageProcessingError';
    }
}

export class QueueFullError extends QueueError {
    constructor(maxSize: number, details?: any) {
        super(`Queue is full (max size: ${maxSize})`, 'QUEUE_FULL', details, false);
        this.name = 'QueueFullError';
    }
}

/**
 * Resource errors
 */
export class ResourceError extends AutoClaudeError {
    constructor(message: string, code: string, details?: any, recoverable = false) {
        super(message, code, details, recoverable);
        this.name = 'ResourceError';
    }
}

export class OutOfMemoryError extends ResourceError {
    constructor(details?: any) {
        super('Out of memory', 'OUT_OF_MEMORY', details);
        this.name = 'OutOfMemoryError';
    }
}

export class DiskSpaceError extends ResourceError {
    constructor(path: string, required: number, available: number, details?: any) {
        super(
            `Insufficient disk space at ${path}: required ${required} bytes, available ${available} bytes`,
            'DISK_SPACE',
            details
        );
        this.name = 'DiskSpaceError';
    }
}

/**
 * Validation errors
 */
export class ValidationError extends AutoClaudeError {
    constructor(message: string, field: string, value: any, details?: any) {
        super(message, 'VALIDATION_ERROR', { field, value, ...details }, false);
        this.name = 'ValidationError';
    }
}

export class InvalidInputError extends ValidationError {
    constructor(field: string, value: any, expectedType: string, details?: any) {
        super(
            `Invalid input for field '${field}': expected ${expectedType}, got ${typeof value}`,
            field,
            value,
            details
        );
        this.name = 'InvalidInputError';
    }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
    constructor(private logger: any) {}

    /**
     * Handle an error with appropriate logging and recovery
     */
    handle(error: Error, context?: Record<string, any>): void {
        if (error instanceof AutoClaudeError) {
            this.logger.error(`${error.name}: ${error.message}`, {
                code: error.code,
                details: error.details,
                recoverable: error.recoverable,
                context,
                stack: error.stack
            });

            if (error.recoverable) {
                this.logger.info('Error is recoverable, attempting recovery...');
                // Emit recovery event
            }
        } else {
            // Unknown error
            this.logger.error('Unexpected error occurred', {
                name: error.name,
                message: error.message,
                context,
                stack: error.stack
            });
        }
    }

    /**
     * Check if an error is recoverable
     */
    isRecoverable(error: Error): boolean {
        return error instanceof AutoClaudeError && error.recoverable;
    }

    /**
     * Get user-friendly error message
     */
    getUserMessage(error: Error): string {
        if (error instanceof AutoClaudeError) {
            switch (error.code) {
                case 'SESSION_TIMEOUT':
                    return 'The session timed out. Please try again.';
                case 'SESSION_NOT_ACTIVE':
                    return 'The Claude session is not active. Restarting...';
                case 'INVALID_CONFIG':
                    return 'Configuration error. Please check your settings.';
                case 'COMMAND_INJECTION':
                    return 'Invalid command detected for security reasons.';
                case 'PATH_TRAVERSAL':
                    return 'Invalid file path detected.';
                case 'CONNECTION_ERROR':
                    return 'Connection failed. Please check your network.';
                case 'QUEUE_FULL':
                    return 'Too many pending tasks. Please wait...';
                case 'OUT_OF_MEMORY':
                    return 'Low memory. Some features may be limited.';
                default:
                    return error.message;
            }
        }
        return 'An unexpected error occurred. Please try again.';
    }
}