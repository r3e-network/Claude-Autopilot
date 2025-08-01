import { WorkDistributor, WorkItem, WorkChunk } from '../../agents/WorkDistributor';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('WorkDistributor', () => {
    let distributor: WorkDistributor;
    let testWorkspace: string;
    let testWorkFile: string;
    
    beforeEach(async () => {
        // Create temporary test workspace
        testWorkspace = path.join(os.tmpdir(), `test-workspace-${Date.now()}`);
        await fs.promises.mkdir(path.join(testWorkspace, '.autoclaude'), { recursive: true });
        
        testWorkFile = path.join(testWorkspace, 'problems.txt');
        
        distributor = new WorkDistributor(testWorkspace);
        await distributor.initialize();
    });
    
    afterEach(async () => {
        // Clean up
        await fs.promises.rm(testWorkspace, { recursive: true, force: true });
    });
    
    describe('Work Item Parsing', () => {
        test('should parse error format correctly', async () => {
            const errorLine = 'src/main.ts:10:5: error: Type "string" is not assignable to type "number"';
            await fs.promises.writeFile(testWorkFile, errorLine);
            
            await distributor.loadWorkFromFile(testWorkFile);
            const stats = distributor.getStatistics();
            
            expect(stats.total).toBe(1);
            expect(stats.pending).toBe(1);
        });
        
        test('should parse warning format correctly', async () => {
            const warningLine = 'src/utils.ts:25:10: warning: Unused variable "temp"';
            await fs.promises.writeFile(testWorkFile, warningLine);
            
            await distributor.loadWorkFromFile(testWorkFile);
            const stats = distributor.getStatistics();
            
            expect(stats.total).toBe(1);
            expect(stats.pending).toBe(1);
        });
        
        test('should parse TODO format correctly', async () => {
            const todoLine = 'src/api.ts: TODO: Implement error handling';
            await fs.promises.writeFile(testWorkFile, todoLine);
            
            await distributor.loadWorkFromFile(testWorkFile);
            const stats = distributor.getStatistics();
            
            expect(stats.total).toBe(1);
            expect(stats.pending).toBe(1);
        });
        
        test('should skip completed items', async () => {
            const content = `src/main.ts:10:5: error: Type error
[COMPLETED] src/utils.ts:20:10: error: Already fixed
src/api.ts:30:15: warning: Unused import`;
            
            await fs.promises.writeFile(testWorkFile, content);
            await distributor.loadWorkFromFile(testWorkFile);
            
            const stats = distributor.getStatistics();
            expect(stats.total).toBe(2); // Only non-completed items
            expect(stats.pending).toBe(2);
        });
        
        test('should handle empty lines and invalid formats', async () => {
            const content = `src/main.ts:10:5: error: Valid error

Invalid line without proper format
# Comment line
src/api.ts:20:10: warning: Valid warning`;
            
            await fs.promises.writeFile(testWorkFile, content);
            await distributor.loadWorkFromFile(testWorkFile);
            
            const stats = distributor.getStatistics();
            expect(stats.total).toBe(2); // Only valid items
        });
    });
    
    describe('File Validation', () => {
        test('should reject invalid file paths', async () => {
            await expect(distributor.loadWorkFromFile('')).rejects.toThrow('Invalid file path');
            await expect(distributor.loadWorkFromFile(null as any)).rejects.toThrow('Invalid file path');
        });
        
        test('should reject non-existent files', async () => {
            const nonExistentFile = path.join(testWorkspace, 'does-not-exist.txt');
            await expect(distributor.loadWorkFromFile(nonExistentFile)).rejects.toThrow();
        });
        
        test('should reject directories', async () => {
            await expect(distributor.loadWorkFromFile(testWorkspace)).rejects.toThrow('is not a file');
        });
        
        test('should reject files larger than 10MB', async () => {
            // Create a large file (mock by checking size validation)
            const largeFile = path.join(testWorkspace, 'large.txt');
            // Create a smaller test file but mock the stat to report large size
            await fs.promises.writeFile(largeFile, 'test content');
            
            // Mock fs.stat to return large file size
            const originalStat = fs.promises.stat;
            jest.spyOn(fs.promises, 'stat').mockImplementation(async (filePath) => {
                if (filePath === largeFile) {
                    return {
                        isFile: () => true,
                        size: 11 * 1024 * 1024 // 11MB
                    } as any;
                }
                return originalStat(filePath);
            });
            
            await expect(distributor.loadWorkFromFile(largeFile)).rejects.toThrow('File too large');
            
            // Restore original stat
            jest.restoreAllMocks();
        });
    });
    
    describe('Work Chunk Distribution', () => {
        beforeEach(async () => {
            // Create test work items
            const content = `src/file1.ts:10:5: error: Error 1
src/file2.ts:20:10: error: Error 2
src/file3.ts:30:15: warning: Warning 1
src/file4.ts:40:20: warning: Warning 2
src/file5.ts:50:25: error: Error 3`;
            
            await fs.promises.writeFile(testWorkFile, content);
            await distributor.loadWorkFromFile(testWorkFile);
        });
        
        test('should create chunks with proper size', async () => {
            const chunk = await distributor.getWorkChunk('agent1', 3);
            
            expect(chunk).not.toBeNull();
            expect(chunk!.items).toHaveLength(3);
            expect(chunk!.assignedTo).toBe('agent1');
        });
        
        test('should prioritize high priority items', async () => {
            const chunk = await distributor.getWorkChunk('agent1', 3);
            
            // Errors should come before warnings
            const errorCount = chunk!.items.filter(item => item.type === 'error').length;
            expect(errorCount).toBeGreaterThan(0);
        });
        
        test('should mark items as assigned', async () => {
            const chunk = await distributor.getWorkChunk('agent1', 2);
            const statsAfter = distributor.getStatistics();
            
            expect(statsAfter.pending).toBe(3); // 5 total - 2 assigned
            expect(statsAfter.assigned).toBe(2);
        });
        
        test('should handle no available work', async () => {
            // Assign all work
            await distributor.getWorkChunk('agent1', 10);
            
            // Try to get more work
            const chunk = await distributor.getWorkChunk('agent2');
            expect(chunk).toBeNull();
        });
        
        test('should calculate dynamic chunk size', async () => {
            // Test with small number of items (5 total)
            const chunk = await distributor.getWorkChunk('agent1');
            
            // Dynamic sizing should give reasonable chunk
            expect(chunk!.items.length).toBeGreaterThan(0);
            expect(chunk!.items.length).toBeLessThanOrEqual(5);
        });
    });
    
    describe('Chunk Completion', () => {
        let chunkId: string;
        
        beforeEach(async () => {
            const content = `src/file1.ts:10:5: error: Error 1
src/file2.ts:20:10: error: Error 2
src/file3.ts:30:15: warning: Warning 1`;
            
            await fs.promises.writeFile(testWorkFile, content);
            await distributor.loadWorkFromFile(testWorkFile);
            
            const chunk = await distributor.getWorkChunk('agent1', 2);
            chunkId = chunk!.id;
        });
        
        test('should mark completed items correctly', async () => {
            const chunk = (distributor as any).chunks.get(chunkId);
            const completedIds = chunk.items.map((item: WorkItem) => item.id);
            
            await distributor.markChunkCompleted(chunkId, completedIds);
            
            const stats = distributor.getStatistics();
            expect(stats.completed).toBe(2);
            expect(stats.pending).toBe(1);
        });
        
        test('should handle partial completion', async () => {
            const chunk = (distributor as any).chunks.get(chunkId);
            const partialIds = [chunk.items[0].id]; // Complete only first item
            
            await distributor.markChunkCompleted(chunkId, partialIds);
            
            const stats = distributor.getStatistics();
            expect(stats.completed).toBe(1);
            expect(stats.pending).toBe(2); // One returned to pending
        });
        
        test('should increment attempts on uncompleted items', async () => {
            const chunk = (distributor as any).chunks.get(chunkId);
            const itemId = chunk.items[0].id;
            
            await distributor.markChunkCompleted(chunkId, []); // Complete none
            
            const item = (distributor as any).workItems.get(itemId);
            expect(item.attempts).toBe(1);
        });
    });
    
    describe('Stale Chunk Handling', () => {
        test('should release stale chunks', async () => {
            const content = 'src/file1.ts:10:5: error: Error 1';
            await fs.promises.writeFile(testWorkFile, content);
            await distributor.loadWorkFromFile(testWorkFile);
            
            const chunk = await distributor.getWorkChunk('agent1', 1);
            
            // Manually set chunk time to past
            const staleChunk = (distributor as any).chunks.get(chunk!.id);
            staleChunk.assignedAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
            
            await distributor.releaseStaleChunks(5 * 60 * 1000); // 5 minute timeout
            
            const stats = distributor.getStatistics();
            expect(stats.assigned).toBe(0);
            expect(stats.pending).toBe(1);
        });
    });
    
    describe('State Persistence', () => {
        test('should save and restore state', async () => {
            const content = `src/file1.ts:10:5: error: Error 1
src/file2.ts:20:10: warning: Warning 1`;
            
            await fs.promises.writeFile(testWorkFile, content);
            await distributor.loadWorkFromFile(testWorkFile);
            
            // Get a chunk and mark one complete
            const chunk = await distributor.getWorkChunk('agent1', 1);
            await distributor.markChunkCompleted(chunk!.id, [chunk!.items[0].id]);
            
            // Create new distributor and load state
            const newDistributor = new WorkDistributor(testWorkspace);
            await newDistributor.initialize();
            
            const stats = newDistributor.getStatistics();
            expect(stats.completed).toBe(1);
            expect(stats.pending).toBe(1);
        });
    });
    
    describe('Completed Marker Updates', () => {
        test('should append completed markers to work file', async () => {
            const content = `src/file1.ts:10:5: error: Error 1
src/file2.ts:20:10: error: Error 2`;
            
            await fs.promises.writeFile(testWorkFile, content);
            await distributor.loadWorkFromFile(testWorkFile);
            
            const chunk = await distributor.getWorkChunk('agent1', 1);
            const completedId = chunk!.items[0].id;
            
            await distributor.markChunkCompleted(chunk!.id, [completedId]);
            await distributor.appendCompletedMarker(testWorkFile, [completedId]);
            
            const updatedContent = await fs.promises.readFile(testWorkFile, 'utf-8');
            expect(updatedContent).toContain('[COMPLETED]');
        });
    });
});