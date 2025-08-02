import { describe, it, expect } from '@jest/globals';
import { 
    InputValidator, 
    ValidationRules, 
    ValidationResult 
} from '../../../src/core/validation';

describe('InputValidator', () => {
    describe('validateMessage', () => {
        it('should accept valid messages', () => {
            const result = InputValidator.validateMessage('Hello, this is a valid message');
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.sanitizedValue).toBe('Hello, this is a valid message');
        });

        it('should reject null/undefined messages', () => {
            const resultNull = InputValidator.validateMessage(null as any);
            const resultUndefined = InputValidator.validateMessage(undefined as any);
            
            expect(resultNull.isValid).toBe(false);
            expect(resultNull.errors).toContain('Message text cannot be null or undefined');
            
            expect(resultUndefined.isValid).toBe(false);
            expect(resultUndefined.errors).toContain('Message text cannot be null or undefined');
        });

        it('should reject empty messages', () => {
            const result = InputValidator.validateMessage('');
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Message cannot be empty');
        });

        it('should reject messages that are too long', () => {
            const longMessage = 'a'.repeat(1000001); // Over 1MB
            const result = InputValidator.validateMessage(longMessage);
            
            expect(result.isValid).toBe(false);
            expect(result.errors[0]).toMatch(/Message too long/);
        });

        it('should convert non-strings to strings with warning', () => {
            const result = InputValidator.validateMessage(123 as any);
            
            expect(result.isValid).toBe(true);
            expect(result.warnings).toContain('Message was converted to string');
            expect(result.sanitizedValue).toBe('123');
        });

        it('should detect dangerous patterns', () => {
            const dangerousCommands = [
                'rm -rf /',
                'del /sq C:',
                'echo "test" > /dev/null',
                'eval(dangerous)',
                'exec("rm -rf")'
            ];

            dangerousCommands.forEach(cmd => {
                const result = InputValidator.validateMessage(cmd);
                expect(result.warnings.length).toBeGreaterThan(0);
                expect(result.warnings[0]).toMatch(/dangerous command detected/i);
            });
        });

        it('should sanitize null bytes', () => {
            const messageWithNulls = 'Hello\0World\0Test';
            const result = InputValidator.validateMessage(messageWithNulls);
            
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBe('HelloWorldTest');
            expect(result.warnings).toContain('Removed null bytes from message');
        });

        it('should trim whitespace', () => {
            const result = InputValidator.validateMessage('  Hello World  ');
            
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBe('Hello World');
        });
    });

    describe('validateQueueSize', () => {
        it('should accept valid queue sizes', () => {
            const result = InputValidator.validateQueueSize(50, 100);
            
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject negative queue sizes', () => {
            const result = InputValidator.validateQueueSize(-1);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Queue size cannot be negative');
        });

        it('should reject queue sizes exceeding maximum', () => {
            const result = InputValidator.validateQueueSize(150, 100);
            
            expect(result.isValid).toBe(false);
            expect(result.errors[0]).toMatch(/exceeds maximum/);
        });

        it('should warn when approaching maximum', () => {
            const result = InputValidator.validateQueueSize(85, 100); // 85% of max
            
            expect(result.isValid).toBe(true);
            expect(result.warnings[0]).toMatch(/approaching maximum/);
        });

        it('should use default maximum when not provided', () => {
            const result = InputValidator.validateQueueSize(15000); // Over default 10000
            
            expect(result.isValid).toBe(false);
            expect(result.errors[0]).toMatch(/exceeds maximum 10000/);
        });
    });

    describe('validateFilePath', () => {
        it('should accept valid file paths', () => {
            const validPaths = [
                '/home/user/file.txt',
                'C:\\Users\\user\\file.txt',
                './relative/path.js',
                'simple-file.md'
            ];

            validPaths.forEach(path => {
                const result = InputValidator.validateFilePath(path);
                expect(result.isValid).toBe(true);
            });
        });

        it('should reject empty or non-string paths', () => {
            const invalidPaths = ['', null, undefined, 123];

            invalidPaths.forEach(path => {
                const result = InputValidator.validateFilePath(path as any);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('File path must be a non-empty string');
            });
        });

        it('should reject path traversal attempts', () => {
            const traversalPaths = [
                '../../../etc/passwd',
                'dir/../../../secret',
                '..\\..\\windows\\system32'
            ];

            traversalPaths.forEach(path => {
                const result = InputValidator.validateFilePath(path);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Path traversal not allowed (..)');
            });
        });

        it('should warn about dangerous system paths', () => {
            const dangerousPaths = [
                '/etc/passwd',
                '/bin/sh',
                '/usr/bin/sudo',
                '/root/secret'
            ];

            dangerousPaths.forEach(path => {
                const result = InputValidator.validateFilePath(path);
                expect(result.warnings.length).toBeGreaterThan(0);
                expect(result.warnings[0]).toMatch(/system directory/i);
            });
        });

        it('should warn about very long paths', () => {
            const longPath = '/very/long/path/' + 'a'.repeat(300);
            const result = InputValidator.validateFilePath(longPath);
            
            expect(result.isValid).toBe(true);
            expect(result.warnings).toContain('Path may be too long for some systems');
        });

        it('should trim whitespace from paths', () => {
            const result = InputValidator.validateFilePath('  /home/user/file.txt  ');
            
            expect(result.isValid).toBe(true);
            expect(result.sanitizedValue).toBe('/home/user/file.txt');
        });
    });

    describe('validateScriptName', () => {
        it('should accept valid script names', () => {
            const validNames = [
                'test-script',
                'script_name',
                'MyScript123',
                'a',
                '123'
            ];

            validNames.forEach(name => {
                const result = InputValidator.validateScriptName(name);
                expect(result.isValid).toBe(true);
            });
        });

        it('should reject invalid characters', () => {
            const invalidNames = [
                'script with spaces',
                'script@name',
                'script.name',
                'script/name',
                'script\\name'
            ];

            invalidNames.forEach(name => {
                const result = InputValidator.validateScriptName(name);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Script name can only contain letters, numbers, hyphens, and underscores');
            });
        });

        it('should reject names that are too long', () => {
            const longName = 'a'.repeat(101);
            const result = InputValidator.validateScriptName(longName);
            
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Script name too long (max 100 characters)');
        });
    });

    describe('validateTimeFormat', () => {
        it('should accept valid time formats', () => {
            const validTimes = [
                '09:30',
                '23:59',
                '00:00',
                '12:00',
                ''  // Empty string is valid (disabled)
            ];

            validTimes.forEach(time => {
                const result = InputValidator.validateTimeFormat(time);
                expect(result.isValid).toBe(true);
            });
        });

        it('should reject invalid time formats', () => {
            const invalidTimes = [
                '9:30',    // Missing leading zero
                '25:00',   // Invalid hour
                '12:60',   // Invalid minute
                'noon',    // Not numeric
                '12:30:45' // Too many parts
            ];

            invalidTimes.forEach(time => {
                const result = InputValidator.validateTimeFormat(time);
                expect(result.isValid).toBe(false);
                expect(result.errors).toContain('Time must be in HH:MM format (e.g., "09:30")');
            });
        });
    });

    describe('validateUrl', () => {
        it('should accept valid URLs', () => {
            const validUrls = [
                'https://example.com',
                'http://localhost:3000',
                'https://api.example.com/v1/endpoint'
            ];

            validUrls.forEach(url => {
                const result = InputValidator.validateUrl(url);
                expect(result.isValid).toBe(true);
            });
        });

        it('should reject invalid URLs', () => {
            const invalidUrls = [
                'not-a-url',
                'ftp://example.com',  // Invalid protocol
                '',
                'http://',
                'https://.com'
            ];

            invalidUrls.forEach(url => {
                const result = InputValidator.validateUrl(url);
                expect(result.isValid).toBe(false);
            });
        });

        it('should warn about local URLs', () => {
            const localUrls = [
                'http://localhost:3000',
                'https://127.0.0.1:8080',
                'http://192.168.1.1',
                'https://10.0.0.1'
            ];

            localUrls.forEach(url => {
                const result = InputValidator.validateUrl(url);
                expect(result.isValid).toBe(true);
                expect(result.warnings.length).toBeGreaterThan(0);
                expect(result.warnings[0]).toMatch(/local.*private.*IP/i);
            });
        });
    });

    describe('sanitizeHtml', () => {
        it('should remove dangerous tags', () => {
            const dangerousHtml = '<script>alert("xss")</script><p>Safe content</p><iframe src="evil"></iframe>';
            const sanitized = InputValidator.sanitizeHtml(dangerousHtml);
            
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).not.toContain('<iframe>');
            expect(sanitized).toContain('<p>Safe content</p>');
        });

        it('should remove event handlers', () => {
            const htmlWithEvents = '<div onclick="evil()">Click me</div>';
            const sanitized = InputValidator.sanitizeHtml(htmlWithEvents);
            
            expect(sanitized).not.toContain('onclick');
            expect(sanitized).toContain('<div>Click me</div>');
        });

        it('should remove javascript: and data: URLs', () => {
            const htmlWithUrls = '<a href="javascript:alert()">Link</a><img src="data:image/png,abc">';
            const sanitized = InputValidator.sanitizeHtml(htmlWithUrls);
            
            expect(sanitized).not.toContain('javascript:');
            expect(sanitized).not.toContain('data:');
        });
    });
});

describe('ValidationRules', () => {
    describe('required rule', () => {
        const rule = ValidationRules.required('testField');

        it('should accept non-empty values', () => {
            expect(rule.validate('test')).toBe(true);
            expect(rule.validate(123)).toBe(true);
            expect(rule.validate([])).toBe(true);
        });

        it('should reject empty values', () => {
            expect(rule.validate('')).toBe(false);
            expect(rule.validate(null)).toBe(false);
            expect(rule.validate(undefined)).toBe(false);
        });
    });

    describe('minLength rule', () => {
        const rule = ValidationRules.minLength(5);

        it('should accept strings meeting minimum length', () => {
            expect(rule.validate('12345')).toBe(true);
            expect(rule.validate('123456')).toBe(true);
        });

        it('should reject strings below minimum length', () => {
            expect(rule.validate('1234')).toBe(false);
            expect(rule.validate('')).toBe(false);
        });
    });

    describe('maxLength rule', () => {
        const rule = ValidationRules.maxLength(10);

        it('should accept strings within maximum length', () => {
            expect(rule.validate('1234567890')).toBe(true);
            expect(rule.validate('123')).toBe(true);
        });

        it('should reject strings exceeding maximum length', () => {
            expect(rule.validate('12345678901')).toBe(false);
        });
    });

    describe('isNumber rule', () => {
        const rule = ValidationRules.isNumber();

        it('should accept valid numbers', () => {
            expect(rule.validate(123)).toBe(true);
            expect(rule.validate(123.45)).toBe(true);
            expect(rule.validate(0)).toBe(true);
        });

        it('should reject non-numbers', () => {
            expect(rule.validate('123')).toBe(false);
            expect(rule.validate(NaN)).toBe(false);
            expect(rule.validate(null)).toBe(false);
        });

        it('should sanitize string numbers', () => {
            expect(rule.sanitize!('123')).toBe(123);
            expect(rule.sanitize!('123.45')).toBe(123.45);
        });
    });

    describe('range rule', () => {
        const rule = ValidationRules.range(1, 10);

        it('should accept numbers within range', () => {
            expect(rule.validate(1)).toBe(true);
            expect(rule.validate(5)).toBe(true);
            expect(rule.validate(10)).toBe(true);
        });

        it('should reject numbers outside range', () => {
            expect(rule.validate(0)).toBe(false);
            expect(rule.validate(11)).toBe(false);
        });
    });

    describe('pattern rule', () => {
        const rule = ValidationRules.pattern(/^[A-Z]+$/, 'Must be uppercase letters only');

        it('should accept strings matching pattern', () => {
            expect(rule.validate('ABC')).toBe(true);
            expect(rule.validate('HELLO')).toBe(true);
        });

        it('should reject strings not matching pattern', () => {
            expect(rule.validate('abc')).toBe(false);
            expect(rule.validate('123')).toBe(false);
            expect(rule.validate('Hello')).toBe(false);
        });
    });

    describe('noHtml rule', () => {
        const rule = ValidationRules.noHtml();

        it('should accept strings without HTML', () => {
            expect(rule.validate('Plain text')).toBe(true);
            expect(rule.validate('Text with & symbols')).toBe(true);
        });

        it('should reject strings with HTML tags', () => {
            expect(rule.validate('<p>HTML content</p>')).toBe(false);
            expect(rule.validate('Text with <script> tags')).toBe(false);
        });

        it('should sanitize HTML', () => {
            const sanitized = rule.sanitize!('<script>alert()</script>Safe text');
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('Safe text');
        });
    });
});