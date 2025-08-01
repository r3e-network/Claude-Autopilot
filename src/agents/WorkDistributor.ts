import * as path from 'path';
import * as fs from 'fs';
import { debugLog } from '../utils/logging';

const fsAsync = fs.promises;

export interface WorkItem {
    id: string;
    type: 'error' | 'warning' | 'improvement' | 'feature';
    file: string;
    line?: number;
    message: string;
    priority: 'high' | 'medium' | 'low';
    assignedTo?: string;
    status: 'pending' | 'assigned' | 'completed' | 'failed';
    attempts: number;
}

export interface WorkChunk {
    id: string;
    items: WorkItem[];
    assignedTo: string;
    assignedAt: Date;
    completedAt?: Date;
}

export class WorkDistributor {
    private workItems: Map<string, WorkItem> = new Map();
    private chunks: Map<string, WorkChunk> = new Map();
    private completedWork: Set<string> = new Set();
    private workFile: string;
    private stateFile: string;
    private chunkSize: number;

    constructor(workspacePath: string, chunkSize: number = 50) {
        this.workFile = path.join(workspacePath, '.autoclaude', 'work_items.json');
        this.stateFile = path.join(workspacePath, '.autoclaude', 'work_state.json');
        this.chunkSize = chunkSize;
    }

    async initialize(): Promise<void> {
        // Ensure directories exist
        const dir = path.dirname(this.workFile);
        await fsAsync.mkdir(dir, { recursive: true });

        // Load existing state if available
        await this.loadState();
    }

    async loadWorkFromFile(filePath: string): Promise<void> {
        debugLog(`Loading work items from ${filePath}`);
        
        // Validate file path
        if (!filePath || typeof filePath !== 'string') {
            throw new Error('Invalid file path provided');
        }
        
        try {
            // Check if file exists
            const stats = await fsAsync.stat(filePath);
            if (!stats.isFile()) {
                throw new Error(`${filePath} is not a file`);
            }
            
            // Check file size (prevent loading huge files)
            const maxFileSize = 10 * 1024 * 1024; // 10MB
            if (stats.size > maxFileSize) {
                throw new Error(`File too large: ${stats.size} bytes (max: ${maxFileSize})`);
            }
            
            const content = await fsAsync.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            
            // Limit number of lines to process
            const maxLines = 10000;
            if (lines.length > maxLines) {
                debugLog(`Warning: File has ${lines.length} lines, processing only first ${maxLines}`);
            }
            
            for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
                const line = lines[i];
                if (line.trim() && !line.includes('[COMPLETED]')) {
                    const workItem = this.parseWorkItem(line);
                    if (workItem && !this.completedWork.has(workItem.id)) {
                        this.workItems.set(workItem.id, workItem);
                    }
                }
            }
            
            debugLog(`Loaded ${this.workItems.size} work items`);
            await this.saveState();
        } catch (error) {
            debugLog(`Error loading work file: ${error}`);
            throw error;
        }
    }

    private parseWorkItem(line: string): WorkItem | null {
        // Parse different formats of work items
        const errorMatch = line.match(/^(.+?):(\d+):(\d+):\s*error:\s*(.+)$/);
        const warningMatch = line.match(/^(.+?):(\d+):(\d+):\s*warning:\s*(.+)$/);
        const todoMatch = line.match(/^(.+?):\s*TODO:\s*(.+)$/);
        const improvementMatch = line.match(/^(.+?):\s*IMPROVEMENT:\s*(.+)$/);
        
        if (errorMatch) {
            return {
                id: this.generateId(line),
                type: 'error',
                file: errorMatch[1],
                line: parseInt(errorMatch[2]),
                message: errorMatch[4],
                priority: 'high',
                status: 'pending',
                attempts: 0
            };
        } else if (warningMatch) {
            return {
                id: this.generateId(line),
                type: 'warning',
                file: warningMatch[1],
                line: parseInt(warningMatch[2]),
                message: warningMatch[4],
                priority: 'medium',
                status: 'pending',
                attempts: 0
            };
        } else if (todoMatch) {
            return {
                id: this.generateId(line),
                type: 'improvement',
                file: todoMatch[1],
                message: todoMatch[2],
                priority: 'low',
                status: 'pending',
                attempts: 0
            };
        } else if (improvementMatch) {
            return {
                id: this.generateId(line),
                type: 'improvement',
                file: improvementMatch[1],
                message: improvementMatch[2],
                priority: 'medium',
                status: 'pending',
                attempts: 0
            };
        }
        
        return null;
    }

    private generateId(content: string): string {
        // Simple hash function for ID generation
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    async getWorkChunk(agentId: string, preferredSize?: number): Promise<WorkChunk | null> {
        const size = preferredSize || this.calculateDynamicChunkSize();
        
        // Filter available work items
        const availableWork = Array.from(this.workItems.values())
            .filter(item => item.status === 'pending')
            .sort((a, b) => {
                // Sort by priority
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
        
        if (availableWork.length === 0) {
            debugLog('No available work items');
            return null;
        }
        
        // Create chunk
        const chunkItems = availableWork.slice(0, size);
        const chunk: WorkChunk = {
            id: `chunk_${Date.now()}_${agentId}`,
            items: chunkItems,
            assignedTo: agentId,
            assignedAt: new Date()
        };
        
        // Mark items as assigned
        for (const item of chunkItems) {
            item.status = 'assigned';
            item.assignedTo = agentId;
        }
        
        this.chunks.set(chunk.id, chunk);
        await this.saveState();
        
        debugLog(`Assigned chunk ${chunk.id} with ${chunkItems.length} items to agent ${agentId}`);
        return chunk;
    }

    async markChunkCompleted(chunkId: string, completedItems: string[]): Promise<void> {
        const chunk = this.chunks.get(chunkId);
        if (!chunk) {
            throw new Error(`Chunk ${chunkId} not found`);
        }
        
        chunk.completedAt = new Date();
        
        // Mark individual items as completed
        for (const itemId of completedItems) {
            const item = this.workItems.get(itemId);
            if (item) {
                item.status = 'completed';
                this.completedWork.add(itemId);
                this.workItems.delete(itemId);
            }
        }
        
        // Mark any uncompleted items as pending again
        for (const item of chunk.items) {
            if (!completedItems.includes(item.id) && item.status === 'assigned') {
                item.status = 'pending';
                item.attempts++;
                delete item.assignedTo;
            }
        }
        
        await this.saveState();
        debugLog(`Marked chunk ${chunkId} as completed with ${completedItems.length} items`);
    }

    async releaseStaleChunks(maxAge: number = 300000): Promise<void> {
        const now = Date.now();
        const staleChunks: string[] = [];
        
        for (const [id, chunk] of this.chunks) {
            if (!chunk.completedAt && (now - chunk.assignedAt.getTime()) > maxAge) {
                staleChunks.push(id);
                
                // Release items back to pending
                for (const item of chunk.items) {
                    if (item.status === 'assigned') {
                        item.status = 'pending';
                        item.attempts++;
                        delete item.assignedTo;
                    }
                }
            }
        }
        
        // Remove stale chunks
        for (const id of staleChunks) {
            this.chunks.delete(id);
        }
        
        if (staleChunks.length > 0) {
            await this.saveState();
            debugLog(`Released ${staleChunks.length} stale chunks`);
        }
    }

    private calculateDynamicChunkSize(): number {
        const totalPending = Array.from(this.workItems.values())
            .filter(item => item.status === 'pending').length;
        
        // Adjust chunk size based on remaining work
        if (totalPending < 10) {
            return Math.max(1, totalPending);
        } else if (totalPending < 50) {
            return Math.min(10, this.chunkSize);
        } else if (totalPending < 200) {
            return Math.min(25, this.chunkSize);
        }
        
        return this.chunkSize;
    }

    async appendCompletedMarker(filePath: string, completedIds: string[]): Promise<void> {
        try {
            const content = await fsAsync.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            const updatedLines: string[] = [];
            
            for (const line of lines) {
                let isCompleted = false;
                
                // Check if this line corresponds to a completed item
                for (const id of completedIds) {
                    if (this.completedWork.has(id)) {
                        // Find original line that matches this work item
                        const parsedItem = this.parseWorkItem(line);
                        if (parsedItem && parsedItem.id === id) {
                            updatedLines.push(`[COMPLETED] ${line}`);
                            isCompleted = true;
                            break;
                        }
                    }
                }
                
                if (!isCompleted) {
                    updatedLines.push(line);
                }
            }
            
            await fsAsync.writeFile(filePath, updatedLines.join('\n'));
            debugLog(`Updated work file with ${completedIds.length} completed markers`);
        } catch (error) {
            debugLog(`Error updating work file: ${error}`);
        }
    }

    private async loadState(): Promise<void> {
        try {
            const stateData = await fsAsync.readFile(this.stateFile, 'utf-8');
            const state = JSON.parse(stateData);
            
            // Restore work items
            if (state.workItems) {
                this.workItems = new Map(Object.entries(state.workItems));
            }
            
            // Restore completed work
            if (state.completedWork) {
                this.completedWork = new Set(state.completedWork);
            }
            
            // Restore chunks (convert dates)
            if (state.chunks) {
                this.chunks = new Map(
                    Object.entries(state.chunks).map(([id, chunk]: [string, any]) => [
                        id,
                        {
                            ...chunk,
                            assignedAt: new Date(chunk.assignedAt),
                            completedAt: chunk.completedAt ? new Date(chunk.completedAt) : undefined
                        }
                    ])
                );
            }
            
            debugLog('Loaded work distributor state');
        } catch (error) {
            // State file doesn't exist yet
            debugLog('No existing work state found');
        }
    }

    private async saveState(): Promise<void> {
        const state = {
            workItems: Object.fromEntries(this.workItems),
            completedWork: Array.from(this.completedWork),
            chunks: Object.fromEntries(
                Array.from(this.chunks.entries()).map(([id, chunk]) => [
                    id,
                    {
                        ...chunk,
                        assignedAt: chunk.assignedAt.toISOString(),
                        completedAt: chunk.completedAt?.toISOString()
                    }
                ])
            ),
            timestamp: new Date().toISOString()
        };
        
        await fsAsync.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    }

    getStatistics(): {
        total: number;
        pending: number;
        assigned: number;
        completed: number;
        failed: number;
        chunks: number;
        activeChunks: number;
    } {
        const items = Array.from(this.workItems.values());
        const activeChunks = Array.from(this.chunks.values())
            .filter(chunk => !chunk.completedAt).length;
        
        return {
            total: items.length + this.completedWork.size,
            pending: items.filter(i => i.status === 'pending').length,
            assigned: items.filter(i => i.status === 'assigned').length,
            completed: this.completedWork.size,
            failed: items.filter(i => i.status === 'failed').length,
            chunks: this.chunks.size,
            activeChunks
        };
    }
}