/**
 * Type guards for safe type assertions
 */

import { LogMetadata } from './logger';

/**
 * Check if a value is an object (not null, not array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if a value is a valid LogMetadata object
 */
export function isLogMetadata(value: unknown): value is LogMetadata {
    if (!isObject(value)) return false;
    
    // LogMetadata has optional fields, so any object is valid
    // But we can check for expected field types if present
    if ('component' in value && typeof value.component !== 'string') return false;
    if ('action' in value && typeof value.action !== 'string') return false;
    if ('userId' in value && typeof value.userId !== 'string') return false;
    if ('sessionId' in value && typeof value.sessionId !== 'string') return false;
    if ('duration' in value && typeof value.duration !== 'number') return false;
    
    return true;
}

/**
 * Safely convert unknown to LogMetadata
 */
export function toLogMetadata(value: unknown): LogMetadata | undefined {
    if (value === undefined || value === null) return undefined;
    if (isLogMetadata(value)) return value;
    
    // If it's an object but not valid LogMetadata, try to extract valid fields
    if (isObject(value)) {
        const metadata: LogMetadata = {};
        
        if (typeof value.component === 'string') metadata.component = value.component;
        if (typeof value.action === 'string') metadata.action = value.action;
        if (typeof value.userId === 'string') metadata.userId = value.userId;
        if (typeof value.sessionId === 'string') metadata.sessionId = value.sessionId;
        if (typeof value.duration === 'number') metadata.duration = value.duration;
        
        // Copy other fields
        for (const [key, val] of Object.entries(value)) {
            if (!(key in metadata)) {
                metadata[key] = val;
            }
        }
        
        return metadata;
    }
    
    // For non-objects, wrap in an object
    return { value };
}

/**
 * Check if error is an Error instance
 */
export function isError(value: unknown): value is Error {
    return value instanceof Error;
}

/**
 * Safely convert unknown to Error
 */
export function toError(value: unknown): Error {
    if (isError(value)) return value;
    if (typeof value === 'string') return new Error(value);
    if (isObject(value) && 'message' in value && typeof value.message === 'string') {
        return new Error(value.message);
    }
    return new Error(String(value));
}

/**
 * Check if value is a string
 */
export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/**
 * Check if value is a number
 */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

/**
 * Check if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

/**
 * Type-safe property access
 */
export function getProperty<T>(obj: unknown, key: string, defaultValue: T): T {
    if (!isObject(obj)) return defaultValue;
    const value = obj[key];
    if (value === undefined) return defaultValue;
    return value as T;
}