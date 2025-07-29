import { describe, it, expect } from '@jest/globals';

describe('Basic Test Suite', () => {
  describe('Math operations', () => {
    it('should add numbers correctly', () => {
      expect(2 + 2).toBe(4);
    });

    it('should subtract numbers correctly', () => {
      expect(5 - 3).toBe(2);
    });

    it('should multiply numbers correctly', () => {
      expect(3 * 4).toBe(12);
    });
  });

  describe('String operations', () => {
    it('should concatenate strings', () => {
      expect('Hello' + ' ' + 'World').toBe('Hello World');
    });

    it('should check string length', () => {
      expect('test'.length).toBe(4);
    });
  });

  describe('Array operations', () => {
    it('should create arrays', () => {
      const arr = [1, 2, 3];
      expect(arr).toHaveLength(3);
      expect(arr).toContain(2);
    });

    it('should map arrays', () => {
      const arr = [1, 2, 3];
      const doubled = arr.map(x => x * 2);
      expect(doubled).toEqual([2, 4, 6]);
    });
  });

  describe('Object operations', () => {
    it('should create objects', () => {
      const obj = { name: 'test', value: 42 };
      expect(obj.name).toBe('test');
      expect(obj.value).toBe(42);
    });

    it('should check object properties', () => {
      const obj = { a: 1, b: 2 };
      expect(obj).toHaveProperty('a');
      expect(obj).toHaveProperty('b', 2);
    });
  });
});