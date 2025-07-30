import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { Config } from '../core/config';
import { Logger } from '../utils/logger';

export interface Message {
    id?: string;
    text: string;
    timestamp: number;
    status: 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';
    output?: string;
    error?: string;
    attachedScripts?: string[];
    retryCount?: number;
}

export class MessageQueue extends EventEmitter {
    private config: Config;
    private logger: Logger;
    private messages: Map<string, Message> = new Map();
    private queueFile: string;
    private saveTimer: NodeJS.Timeout | null = null;
    private readonly SAVE_DELAY = 1000;

    constructor(config: Config, logger: Logger) {
        super();
        this.config = config;
        this.logger = logger;
        this.queueFile = path.join(config.get('paths', 'dataDir'), 'queue.json');
    }

    async initialize(): Promise<void> {
        try {
            await this.load();
            this.startAutoSave();
            this.logger.info(`Message queue initialized with ${this.messages.size} messages`);
        } catch (error) {
            this.logger.error('Failed to initialize queue:', error);
        }
    }

    async addMessage(message: Omit<Message, 'id'>): Promise<string> {
        const id = uuidv4();
        const fullMessage: Message = {
            ...message,
            id,
            status: message.status || 'pending',
            retryCount: 0
        };

        // Check queue size limit
        const maxSize = this.config.get('queue', 'maxSize');
        if (this.messages.size >= maxSize) {
            throw new Error(`Queue is full (max ${maxSize} messages)`);
        }

        // Check message size
        const maxMessageSize = this.config.get('queue', 'maxMessageSize');
        if (message.text.length > maxMessageSize) {
            throw new Error(`Message too large (max ${maxMessageSize} characters)`);
        }

        this.messages.set(id, fullMessage);
        this.emit('messageAdded', fullMessage);
        this.scheduleSave();
        
        this.logger.debug(`Added message ${id} to queue`);
        return id;
    }

    async removeMessage(id: string): Promise<void> {
        if (this.messages.has(id)) {
            const message = this.messages.get(id)!;
            
            if (message.status === 'processing') {
                throw new Error('Cannot remove message that is being processed');
            }
            
            this.messages.delete(id);
            this.emit('messageRemoved', message);
            this.scheduleSave();
            
            this.logger.debug(`Removed message ${id} from queue`);
        }
    }

    async updateMessageStatus(id: string, status: Message['status'], output?: string, error?: string): Promise<void> {
        const message = this.messages.get(id);
        if (!message) {
            throw new Error(`Message ${id} not found`);
        }

        message.status = status;
        if (output) message.output = output;
        if (error) message.error = error;

        this.emit('messageUpdated', message);
        this.scheduleSave();
        
        this.logger.debug(`Updated message ${id} status to ${status}`);
    }

    async getNextMessage(): Promise<Message | null> {
        // Find next pending message
        for (const [id, message] of this.messages) {
            if (message.status === 'pending') {
                return message;
            }
        }
        return null;
    }

    getAllMessages(): Message[] {
        return Array.from(this.messages.values()).sort((a, b) => a.timestamp - b.timestamp);
    }

    getPendingMessages(): Message[] {
        return this.getAllMessages().filter(m => m.status === 'pending');
    }

    getProcessingMessages(): Message[] {
        return this.getAllMessages().filter(m => m.status === 'processing');
    }

    getCompletedMessages(): Message[] {
        return this.getAllMessages().filter(m => m.status === 'completed');
    }

    async clear(): Promise<void> {
        // Don't clear messages that are being processed
        const processingMessages = this.getProcessingMessages();
        
        this.messages.clear();
        
        // Re-add processing messages
        processingMessages.forEach(msg => {
            this.messages.set(msg.id!, msg);
        });

        this.emit('queueCleared');
        this.scheduleSave();
        
        this.logger.info('Queue cleared');
    }

    async retryFailedMessages(): Promise<void> {
        const failedMessages = this.getAllMessages().filter(m => m.status === 'error');
        
        for (const message of failedMessages) {
            if (message.retryCount && message.retryCount >= 3) {
                continue; // Skip messages that have been retried too many times
            }
            
            message.status = 'pending';
            message.retryCount = (message.retryCount || 0) + 1;
            message.error = undefined;
            
            this.emit('messageUpdated', message);
        }
        
        this.scheduleSave();
        this.logger.info(`Retrying ${failedMessages.length} failed messages`);
    }

    async performMaintenance(): Promise<void> {
        const now = Date.now();
        const retentionMs = this.config.get('queue', 'retentionHours') * 60 * 60 * 1000;
        let removedCount = 0;

        // Remove old completed messages
        for (const [id, message] of this.messages) {
            if (message.status === 'completed' && (now - message.timestamp) > retentionMs) {
                this.messages.delete(id);
                removedCount++;
            }
        }

        if (removedCount > 0) {
            this.logger.info(`Removed ${removedCount} old messages during maintenance`);
            this.scheduleSave();
        }
    }

    getStatistics(): {
        total: number;
        pending: number;
        processing: number;
        completed: number;
        failed: number;
    } {
        const messages = this.getAllMessages();
        return {
            total: messages.length,
            pending: messages.filter(m => m.status === 'pending').length,
            processing: messages.filter(m => m.status === 'processing').length,
            completed: messages.filter(m => m.status === 'completed').length,
            failed: messages.filter(m => m.status === 'error').length
        };
    }

    private async load(): Promise<void> {
        try {
            const data = await fs.readFile(this.queueFile, 'utf-8');
            const messages = JSON.parse(data) as Message[];
            
            this.messages.clear();
            messages.forEach(msg => {
                if (msg.id) {
                    // Reset processing messages to pending
                    if (msg.status === 'processing') {
                        msg.status = 'pending';
                    }
                    this.messages.set(msg.id, msg);
                }
            });
            
        } catch (error) {
            if ((error as any).code !== 'ENOENT') {
                this.logger.error('Failed to load queue:', error);
            }
        }
    }

    async save(): Promise<void> {
        try {
            const messages = Array.from(this.messages.values());
            const dir = path.dirname(this.queueFile);
            
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.queueFile, JSON.stringify(messages, null, 2));
            
            this.logger.debug('Queue saved to disk');
        } catch (error) {
            this.logger.error('Failed to save queue:', error);
        }
    }

    private scheduleSave(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        
        this.saveTimer = setTimeout(() => {
            this.save();
        }, this.SAVE_DELAY);
    }

    private startAutoSave(): void {
        // Save queue every 30 seconds
        setInterval(() => {
            this.save();
        }, 30000);

        // Perform maintenance every hour
        setInterval(() => {
            this.performMaintenance();
        }, 3600000);
    }

    destroy(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.save();
    }
}