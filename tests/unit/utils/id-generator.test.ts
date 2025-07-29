import { describe, it, expect } from '@jest/globals';
import { generateId, generateUniqueId } from '../../../src/utils/id-generator';

describe('ID Generator', () => {
  describe('generateId', () => {
    it('should generate a non-empty string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with consistent format', () => {
      const id = generateId();
      // Should be alphanumeric or contain hyphens/underscores
      expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
    });
  });

  describe('generateUniqueId', () => {
    it('should generate unique IDs with prefix', () => {
      const id1 = generateUniqueId('test');
      const id2 = generateUniqueId('test');
      
      expect(id1).toContain('test');
      expect(id2).toContain('test');
      expect(id1).not.toBe(id2);
    });

    it('should handle empty prefix', () => {
      const id = generateUniqueId('');
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should generate timestamp-based uniqueness', () => {
      const id1 = generateUniqueId('msg');
      
      // Wait a small amount to ensure different timestamp
      return new Promise(resolve => {
        setTimeout(() => {
          const id2 = generateUniqueId('msg');
          expect(id1).not.toBe(id2);
          resolve(undefined);
        }, 2);
      });
    });
  });
});