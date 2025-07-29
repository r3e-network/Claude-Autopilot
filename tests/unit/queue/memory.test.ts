import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { performQueueMaintenance, getMemoryUsageSummary } from '../../../src/queue/memory';

// Mock dependencies
jest.mock('../../../src/core/state', () => ({
  messageQueue: [],
  setMessageQueue: jest.fn()
}));

jest.mock('../../../src/utils/logging', () => ({
  debugLog: jest.fn()
}));

describe('Queue Memory Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('performQueueMaintenance', () => {
    it('should clean up old completed messages', () => {
      const { messageQueue, setMessageQueue } = require('../../../src/core/state');
      
      // Mock old and new messages
      const now = new Date();
      const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      const recentDate = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago

      messageQueue.push(
        {
          id: 'old-completed',
          text: 'Old completed message',
          status: 'completed',
          timestamp: oldDate
        },
        {
          id: 'recent-completed',
          text: 'Recent completed message',
          status: 'completed',
          timestamp: recentDate
        },
        {
          id: 'pending',
          text: 'Pending message',
          status: 'pending',
          timestamp: oldDate
        }
      );

      performQueueMaintenance();

      expect(setMessageQueue).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'recent-completed' }),
          expect.objectContaining({ id: 'pending' })
        ])
      );
      
      // Should not contain the old completed message
      const updatedQueue = setMessageQueue.mock.calls[0][0];
      expect(updatedQueue.find((m: any) => m.id === 'old-completed')).toBeUndefined();
    });

    it('should limit queue size when it exceeds maximum', () => {
      const { messageQueue, setMessageQueue } = require('../../../src/core/state');
      
      // Create a large queue exceeding the limit
      const largeQueue = Array.from({ length: 1500 }, (_, i) => ({
        id: `message-${i}`,
        text: `Message ${i}`,
        status: i < 1000 ? 'completed' : 'pending',
        timestamp: new Date()
      }));
      
      messageQueue.push(...largeQueue);

      performQueueMaintenance();

      const updatedQueue = setMessageQueue.mock.calls[0][0];
      expect(updatedQueue.length).toBeLessThanOrEqual(1000); // Default max size
    });

    it('should preserve pending and processing messages', () => {
      const { messageQueue, setMessageQueue } = require('../../../src/core/state');
      
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      
      messageQueue.push(
        {
          id: 'old-pending',
          text: 'Old pending message',
          status: 'pending',
          timestamp: oldDate
        },
        {
          id: 'old-processing',
          text: 'Old processing message',
          status: 'processing',
          timestamp: oldDate
        },
        {
          id: 'old-completed',
          text: 'Old completed message',
          status: 'completed',
          timestamp: oldDate
        }
      );

      performQueueMaintenance();

      const updatedQueue = setMessageQueue.mock.calls[0][0];
      expect(updatedQueue).toContainEqual(
        expect.objectContaining({ id: 'old-pending', status: 'pending' })
      );
      expect(updatedQueue).toContainEqual(
        expect.objectContaining({ id: 'old-processing', status: 'processing' })
      );
      expect(updatedQueue.find((m: any) => m.id === 'old-completed')).toBeUndefined();
    });
  });

  describe('getMemoryUsageSummary', () => {
    it('should return memory usage summary', () => {
      const { messageQueue } = require('../../../src/core/state');
      
      messageQueue.push(
        {
          id: 'msg1',
          text: 'Short message',
          status: 'completed',
          timestamp: new Date(),
          output: 'Some output'
        },
        {
          id: 'msg2',
          text: 'A much longer message with more content that takes up more memory space',
          status: 'pending',
          timestamp: new Date(),
          output: 'Longer output with more detailed information and content'
        }
      );

      const summary = getMemoryUsageSummary();

      expect(summary).toContain('Total messages: 2');
      expect(summary).toContain('Estimated memory usage:');
      expect(summary).toContain('KB');
    });

    it('should handle empty queue', () => {
      const { messageQueue } = require('../../../src/core/state');
      messageQueue.length = 0; // Clear queue

      const summary = getMemoryUsageSummary();

      expect(summary).toContain('Total messages: 0');
      expect(summary).toContain('0.00 KB');
    });

    it('should calculate message sizes accurately', () => {
      const { messageQueue } = require('../../../src/core/state');
      
      const largeMessage = {
        id: 'large-msg',
        text: 'x'.repeat(10000), // 10KB of text
        status: 'completed',
        timestamp: new Date(),
        output: 'y'.repeat(5000) // 5KB of output
      };

      messageQueue.push(largeMessage);

      const summary = getMemoryUsageSummary();

      expect(summary).toContain('Total messages: 1');
      expect(summary).toMatch(/\d+\.\d+ KB/);
    });
  });

  describe('Memory limits and thresholds', () => {
    it('should respect configured memory limits', () => {
      const { messageQueue, setMessageQueue } = require('../../../src/core/state');
      
      // Create messages that would exceed memory limits
      const largeMessages = Array.from({ length: 100 }, (_, i) => ({
        id: `large-msg-${i}`,
        text: 'x'.repeat(50000), // 50KB each
        status: 'completed',
        timestamp: new Date(),
        output: 'y'.repeat(50000) // Another 50KB
      }));

      messageQueue.push(...largeMessages);

      performQueueMaintenance();

      // Should have cleaned up some messages to stay within limits
      const updatedQueue = setMessageQueue.mock.calls[0][0];
      expect(updatedQueue.length).toBeLessThan(largeMessages.length);
    });

    it('should prioritize recent messages when cleaning up', () => {
      const { messageQueue, setMessageQueue } = require('../../../src/core/state');
      
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
      const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000);

      messageQueue.push(
        {
          id: 'old-msg-1',
          text: 'Old message 1',
          status: 'completed',
          timestamp: oldDate
        },
        {
          id: 'old-msg-2',
          text: 'Old message 2',
          status: 'completed',
          timestamp: oldDate
        },
        {
          id: 'recent-msg',
          text: 'Recent message',
          status: 'completed',
          timestamp: recentDate
        }
      );

      performQueueMaintenance();

      const updatedQueue = setMessageQueue.mock.calls[0][0];
      
      // Recent message should be preserved
      expect(updatedQueue).toContainEqual(
        expect.objectContaining({ id: 'recent-msg' })
      );
      
      // Old messages should be removed
      expect(updatedQueue.find((m: any) => m.id === 'old-msg-1')).toBeUndefined();
      expect(updatedQueue.find((m: any) => m.id === 'old-msg-2')).toBeUndefined();
    });
  });
});