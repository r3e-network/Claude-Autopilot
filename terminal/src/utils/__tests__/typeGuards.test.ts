import { 
    isObject, 
    isLogMetadata, 
    toLogMetadata, 
    isError, 
    toError,
    isString,
    isNumber,
    isBoolean,
    getProperty
} from '../typeGuards';

describe('typeGuards', () => {
    describe('isObject', () => {
        it('should return true for plain objects', () => {
            expect(isObject({})).toBe(true);
            expect(isObject({ a: 1 })).toBe(true);
        });

        it('should return false for non-objects', () => {
            expect(isObject(null)).toBe(false);
            expect(isObject(undefined)).toBe(false);
            expect(isObject([])).toBe(false);
            expect(isObject('string')).toBe(false);
            expect(isObject(123)).toBe(false);
        });
    });

    describe('isLogMetadata', () => {
        it('should return true for valid LogMetadata', () => {
            expect(isLogMetadata({})).toBe(true);
            expect(isLogMetadata({ component: 'test' })).toBe(true);
            expect(isLogMetadata({ 
                component: 'test',
                action: 'create',
                userId: '123',
                sessionId: 'abc',
                duration: 100
            })).toBe(true);
        });

        it('should return false for invalid LogMetadata', () => {
            expect(isLogMetadata(null)).toBe(false);
            expect(isLogMetadata('string')).toBe(false);
            expect(isLogMetadata({ component: 123 })).toBe(false);
            expect(isLogMetadata({ duration: 'not a number' })).toBe(false);
        });
    });

    describe('toLogMetadata', () => {
        it('should return undefined for null/undefined', () => {
            expect(toLogMetadata(null)).toBeUndefined();
            expect(toLogMetadata(undefined)).toBeUndefined();
        });

        it('should return valid LogMetadata as-is', () => {
            const metadata = { component: 'test', action: 'create' };
            expect(toLogMetadata(metadata)).toBe(metadata);
        });

        it('should extract valid fields from mixed objects', () => {
            const input = {
                component: 'test',
                action: 'create',
                invalidField: 123,
                duration: 'not a number', // Invalid, but will be included as a custom field
                customField: 'valid'
            };
            const result = toLogMetadata(input);
            expect(result).toEqual({
                component: 'test',
                action: 'create',
                invalidField: 123,
                duration: 'not a number', // This is included as a custom field
                customField: 'valid'
            });
        });

        it('should wrap non-objects in an object', () => {
            expect(toLogMetadata('string')).toEqual({ value: 'string' });
            expect(toLogMetadata(123)).toEqual({ value: 123 });
        });
    });

    describe('isError', () => {
        it('should return true for Error instances', () => {
            expect(isError(new Error('test'))).toBe(true);
            expect(isError(new TypeError('test'))).toBe(true);
            expect(isError(new RangeError('test'))).toBe(true);
        });

        it('should return false for non-errors', () => {
            expect(isError('error')).toBe(false);
            expect(isError({ message: 'error' })).toBe(false);
            expect(isError(null)).toBe(false);
        });
    });

    describe('toError', () => {
        it('should return Error instances as-is', () => {
            const error = new Error('test');
            expect(toError(error)).toBe(error);
        });

        it('should convert strings to Errors', () => {
            const result = toError('test error');
            expect(result).toBeInstanceOf(Error);
            expect(result.message).toBe('test error');
        });

        it('should extract message from objects', () => {
            const result = toError({ message: 'object error' });
            expect(result).toBeInstanceOf(Error);
            expect(result.message).toBe('object error');
        });

        it('should convert other types to string errors', () => {
            expect(toError(123).message).toBe('123');
            expect(toError(null).message).toBe('null');
            expect(toError(undefined).message).toBe('undefined');
        });
    });

    describe('isString', () => {
        it('should correctly identify strings', () => {
            expect(isString('test')).toBe(true);
            expect(isString('')).toBe(true);
            expect(isString(123)).toBe(false);
            expect(isString(null)).toBe(false);
        });
    });

    describe('isNumber', () => {
        it('should correctly identify numbers', () => {
            expect(isNumber(123)).toBe(true);
            expect(isNumber(0)).toBe(true);
            expect(isNumber(-123.45)).toBe(true);
            expect(isNumber(NaN)).toBe(false);
            expect(isNumber('123')).toBe(false);
        });
    });

    describe('isBoolean', () => {
        it('should correctly identify booleans', () => {
            expect(isBoolean(true)).toBe(true);
            expect(isBoolean(false)).toBe(true);
            expect(isBoolean(1)).toBe(false);
            expect(isBoolean('true')).toBe(false);
        });
    });

    describe('getProperty', () => {
        it('should safely get properties from objects', () => {
            const obj = { a: 1, b: 'test', c: null };
            expect(getProperty(obj, 'a', 0)).toBe(1);
            expect(getProperty(obj, 'b', 'default')).toBe('test');
            expect(getProperty(obj, 'c', 'default')).toBe(null);
        });

        it('should return default for missing properties', () => {
            const obj = { a: 1 };
            expect(getProperty(obj, 'b', 'default')).toBe('default');
            expect(getProperty(null, 'a', 'default')).toBe('default');
            expect(getProperty('not object', 'a', 'default')).toBe('default');
        });
    });
});