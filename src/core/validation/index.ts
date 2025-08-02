import { ClaudeAutopilotError, ErrorCategory, ErrorSeverity, CommonErrors } from '../errors';

export interface ValidationRule<T = any> {
    name: string;
    validate: (value: T) => boolean;
    message: string;
    sanitize?: (value: T) => T;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    sanitizedValue?: any;
}

export class InputValidator {
    private static readonly MAX_MESSAGE_LENGTH = 1000000; // 1MB
    private static readonly MAX_QUEUE_SIZE = 10000;
    private static readonly MAX_STRING_LENGTH = 1000000;

    static validateMessage(text: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        let sanitizedValue = text;

        // Check if text is defined
        if (text === null || text === undefined) {
            errors.push('Message text cannot be null or undefined');
            return { isValid: false, errors, warnings };
        }

        // Convert to string if not already
        if (typeof text !== 'string') {
            sanitizedValue = String(text);
            warnings.push('Message was converted to string');
        }

        // Check length
        if (sanitizedValue.length === 0) {
            errors.push('Message cannot be empty');
        } else if (sanitizedValue.length > this.MAX_MESSAGE_LENGTH) {
            errors.push(`Message too long (${sanitizedValue.length} chars, max: ${this.MAX_MESSAGE_LENGTH})`);
        }

        // Check for dangerous patterns
        const dangerousPatterns = [
            /rm\s+-rf\s+\//i, // Dangerous rm commands
            /del\s+\/[sq]\s+/i, // Windows delete commands
            />\s*\/dev\/null/i, // Output redirection that might hide errors
            /eval\s*\(/i, // Eval functions
            /exec\s*\(/i, // Exec functions
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(sanitizedValue)) {
                warnings.push(`Potentially dangerous command detected: ${pattern.source}`);
            }
        }

        // Sanitize common issues
        sanitizedValue = sanitizedValue.trim();
        
        // Remove null bytes
        if (sanitizedValue.includes('\0')) {
            sanitizedValue = sanitizedValue.replace(/\0/g, '');
            warnings.push('Removed null bytes from message');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitizedValue
        };
    }

    static validateQueueSize(currentSize: number, maxSize?: number): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const effectiveMaxSize = maxSize || this.MAX_QUEUE_SIZE;

        if (currentSize < 0) {
            errors.push('Queue size cannot be negative');
        } else if (currentSize > effectiveMaxSize) {
            errors.push(`Queue size ${currentSize} exceeds maximum ${effectiveMaxSize}`);
        } else if (currentSize > effectiveMaxSize * 0.8) {
            warnings.push(`Queue size ${currentSize} is approaching maximum ${effectiveMaxSize}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    static validateFilePath(filePath: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        let sanitizedValue = filePath;

        if (!filePath || typeof filePath !== 'string') {
            errors.push('File path must be a non-empty string');
            return { isValid: false, errors, warnings };
        }

        // Sanitize path
        sanitizedValue = filePath.trim();

        // Check for path traversal attempts
        if (sanitizedValue.includes('..')) {
            errors.push('Path traversal not allowed (..)');
        }

        // Check for dangerous paths (Unix/Linux)
        const dangerousPaths = [
            /^\/etc\//i,
            /^\/bin\//i,
            /^\/sbin\//i,
            /^\/usr\/bin\//i,
            /^\/usr\/sbin\//i,
            /^\/root\//i,
        ];

        for (const path of dangerousPaths) {
            if (path.test(sanitizedValue)) {
                warnings.push(`Accessing system directory: ${sanitizedValue}`);
                break;
            }
        }

        // Check length
        if (sanitizedValue.length > 260) { // Windows MAX_PATH
            warnings.push('Path may be too long for some systems');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitizedValue
        };
    }

    static validateScriptName(scriptName: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        let sanitizedValue = scriptName;

        if (!scriptName || typeof scriptName !== 'string') {
            errors.push('Script name must be a non-empty string');
            return { isValid: false, errors, warnings };
        }

        sanitizedValue = scriptName.trim();

        // Check for valid script name pattern
        if (!/^[a-zA-Z0-9_-]+$/.test(sanitizedValue)) {
            errors.push('Script name can only contain letters, numbers, hyphens, and underscores');
        }

        // Check length
        if (sanitizedValue.length > 100) {
            errors.push('Script name too long (max 100 characters)');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitizedValue
        };
    }

    static validateTimeFormat(timeString: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (timeString === '') {
            return { isValid: true, errors, warnings }; // Empty string is valid (disabled)
        }

        if (typeof timeString !== 'string') {
            errors.push('Time must be a string');
            return { isValid: false, errors, warnings };
        }

        // Check HH:MM format
        const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timePattern.test(timeString)) {
            errors.push('Time must be in HH:MM format (e.g., "09:30")');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    static validateUrl(url: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!url || typeof url !== 'string') {
            errors.push('URL must be a non-empty string');
            return { isValid: false, errors, warnings };
        }

        try {
            const urlObj = new URL(url);
            
            // Check protocol
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                warnings.push('Only HTTP and HTTPS URLs are recommended');
            }

            // Check for localhost/local IPs in production
            if (urlObj.hostname === 'localhost' || 
                urlObj.hostname === '127.0.0.1' || 
                urlObj.hostname.startsWith('192.168.') ||
                urlObj.hostname.startsWith('10.') ||
                urlObj.hostname.startsWith('172.')) {
                warnings.push('Local/private IP detected - may not be accessible to all users');
            }

        } catch (error) {
            errors.push('Invalid URL format');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    static validateEmailFormat(email: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!email || typeof email !== 'string') {
            errors.push('Email must be a non-empty string');
            return { isValid: false, errors, warnings };
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            errors.push('Invalid email format');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    static sanitizeHtml(html: string): string {
        if (!html || typeof html !== 'string') {
            return '';
        }

        // Basic HTML sanitization - remove potentially dangerous tags and attributes
        return html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
            .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .replace(/javascript:/gi, '') // Remove javascript: URLs
            .replace(/data:/gi, ''); // Remove data: URLs
    }

    static validateAndSanitizeInput<T>(
        value: T,
        rules: ValidationRule<T>[],
        throwOnError: boolean = false
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        let sanitizedValue = value;

        for (const rule of rules) {
            try {
                if (!rule.validate(value)) {
                    errors.push(`${rule.name}: ${rule.message}`);
                } else if (rule.sanitize) {
                    sanitizedValue = rule.sanitize(sanitizedValue);
                }
            } catch (error) {
                errors.push(`${rule.name}: Validation error - ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        const result = {
            isValid: errors.length === 0,
            errors,
            warnings,
            sanitizedValue
        };

        if (throwOnError && !result.isValid) {
            throw CommonErrors.INVALID_CONFIGURATION('input', value, 'valid input according to rules');
        }

        return result;
    }
}

// Common validation rules
export const ValidationRules = {
    required: <T>(fieldName: string): ValidationRule<T> => ({
        name: `required-${fieldName}`,
        validate: (value) => value !== null && value !== undefined && value !== '',
        message: `${fieldName} is required`
    }),

    minLength: (min: number): ValidationRule<string> => ({
        name: `min-length-${min}`,
        validate: (value) => typeof value === 'string' && value.length >= min,
        message: `Must be at least ${min} characters long`
    }),

    maxLength: (max: number): ValidationRule<string> => ({
        name: `max-length-${max}`,
        validate: (value) => typeof value === 'string' && value.length <= max,
        message: `Must be no more than ${max} characters long`
    }),

    isNumber: (): ValidationRule<any> => ({
        name: 'is-number',
        validate: (value) => typeof value === 'number' && !isNaN(value),
        message: 'Must be a valid number',
        sanitize: (value) => typeof value === 'string' ? parseFloat(value) : value
    }),

    isBoolean: (): ValidationRule<any> => ({
        name: 'is-boolean',
        validate: (value) => typeof value === 'boolean',
        message: 'Must be true or false',
        sanitize: (value) => {
            if (typeof value === 'string') {
                const lower = value.toLowerCase();
                if (lower === 'true') return true;
                if (lower === 'false') return false;
            }
            return value;
        }
    }),

    range: (min: number, max: number): ValidationRule<number> => ({
        name: `range-${min}-${max}`,
        validate: (value) => typeof value === 'number' && value >= min && value <= max,
        message: `Must be between ${min} and ${max}`
    }),

    pattern: (regex: RegExp, message: string): ValidationRule<string> => ({
        name: `pattern-${regex.source}`,
        validate: (value) => typeof value === 'string' && regex.test(value),
        message
    }),

    noHtml: (): ValidationRule<string> => ({
        name: 'no-html',
        validate: (value) => typeof value === 'string' && !/<[^>]*>/.test(value),
        message: 'HTML tags are not allowed',
        sanitize: (value) => typeof value === 'string' ? InputValidator.sanitizeHtml(value) : value
    })
};