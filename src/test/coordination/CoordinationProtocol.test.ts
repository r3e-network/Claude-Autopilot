import { CoordinationProtocol, WorkPlan } from '../../coordination/CoordinationProtocol';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('CoordinationProtocol', () => {
    let protocol: CoordinationProtocol;
    let testWorkspace: string;
    
    beforeEach(async () => {
        // Create temporary test workspace
        testWorkspace = path.join(os.tmpdir(), `test-workspace-${Date.now()}`);
        await fs.promises.mkdir(testWorkspace, { recursive: true });
        
        protocol = new CoordinationProtocol(testWorkspace);
        await protocol.initialize();
    });
    
    afterEach(async () => {
        // Clean up
        await fs.promises.rm(testWorkspace, { recursive: true, force: true });
    });
    
    describe('Initialization', () => {
        test('should create coordination directories', async () => {
            const coordDir = path.join(testWorkspace, 'coordination');
            const locksDir = path.join(coordDir, 'agent_locks');
            
            expect(fs.existsSync(coordDir)).toBe(true);
            expect(fs.existsSync(locksDir)).toBe(true);
        });
        
        test('should create empty state files', async () => {
            const files = [
                'active_work_registry.json',
                'completed_work_log.json',
                'planned_work_queue.json'
            ];
            
            for (const file of files) {
                const filePath = path.join(testWorkspace, 'coordination', file);
                expect(fs.existsSync(filePath)).toBe(true);
            }
        });
    });
    
    describe('Work Planning', () => {
        test('should create valid work plan', async () => {
            const planData = {
                agentId: 'agent1',
                title: 'Implement user authentication',
                description: 'Add JWT-based authentication',
                files: ['src/auth.ts', 'src/middleware.ts'],
                features: ['authentication', 'security'],
                priority: 'high' as const,
                businessValue: 'Secure user access',
                technicalJustification: 'Required for multi-user support'
            };
            
            const plan = await protocol.planWork('agent1', planData);
            
            expect(plan.id).toMatch(/^work_\d+_agent1$/);
            expect(plan.status).toBe('planned');
            expect(plan.createdAt).toBeInstanceOf(Date);
        });
        
        test('should detect file conflicts', async () => {
            // Create first plan
            await protocol.planWork('agent1', {
                agentId: 'agent1',
                title: 'Update auth module',
                description: 'Refactor authentication',
                files: ['src/auth.ts'],
                features: ['authentication'],
                priority: 'high',
                businessValue: 'Improve security',
                technicalJustification: 'Legacy code cleanup'
            });
            
            // Claim the work
            await protocol.claimWork('agent1', ['src/auth.ts'], ['authentication'], 'Working on auth');
            
            // Try to plan conflicting work
            await expect(protocol.planWork('agent2', {
                agentId: 'agent2',
                title: 'Fix auth bug',
                description: 'Fix login issue',
                files: ['src/auth.ts'], // Same file
                features: ['bugfix'],
                priority: 'high',
                businessValue: 'Fix critical bug',
                technicalJustification: 'Users cannot login'
            })).rejects.toThrow('Work conflicts detected');
        });
        
        test('should sort planned work by priority', async () => {
            // Add work with different priorities
            await protocol.planWork('agent1', {
                agentId: 'agent1',
                title: 'Low priority task',
                description: 'Documentation update',
                files: ['README.md'],
                features: ['docs'],
                priority: 'low',
                businessValue: 'Better docs',
                technicalJustification: 'Outdated examples'
            });
            
            await protocol.planWork('agent2', {
                agentId: 'agent2',
                title: 'High priority task',
                description: 'Security fix',
                files: ['src/security.ts'],
                features: ['security'],
                priority: 'high',
                businessValue: 'Prevent attacks',
                technicalJustification: 'Vulnerability found'
            });
            
            const status = protocol.getCoordinationStatus();
            expect(status.plannedWork).toBe(2);
            
            // High priority should be first in queue
            const queue = (protocol as any).state.plannedWorkQueue;
            expect(queue[0].priority).toBe('high');
            expect(queue[1].priority).toBe('low');
        });
    });
    
    describe('Work Claims', () => {
        test('should validate agent ID', async () => {
            await expect(protocol.claimWork('', ['file.ts'], ['feature'], 'desc'))
                .rejects.toThrow('Invalid agent ID');
            
            await expect(protocol.claimWork(null as any, ['file.ts'], ['feature'], 'desc'))
                .rejects.toThrow('Invalid agent ID');
        });
        
        test('should validate files and features arrays', async () => {
            await expect(protocol.claimWork('agent1', 'not-array' as any, ['feature'], 'desc'))
                .rejects.toThrow('Files and features must be arrays');
            
            await expect(protocol.claimWork('agent1', ['file.ts'], 'not-array' as any, 'desc'))
                .rejects.toThrow('Files and features must be arrays');
        });
        
        test('should validate description', async () => {
            await expect(protocol.claimWork('agent1', ['file.ts'], ['feature'], ''))
                .rejects.toThrow('Description is required');
            
            await expect(protocol.claimWork('agent1', ['file.ts'], ['feature'], '   '))
                .rejects.toThrow('Description is required');
        });
        
        test('should sanitize file paths', async () => {
            const maliciousFiles = [
                '../../../etc/passwd',
                '/etc/passwd',
                '..\\..\\windows\\system32'
            ];
            
            const result = await protocol.claimWork('agent1', maliciousFiles, ['feature'], 'test');
            expect(result).toBe(true);
            
            // Check that paths were sanitized
            const lock = (protocol as any).state.agentLocks.get('agent1');
            expect(lock.files).not.toContain('../../../etc/passwd');
            expect(lock.files[0]).toBe('etc/passwd');
        });
        
        test('should create lock file', async () => {
            await protocol.claimWork('agent1', ['src/file.ts'], ['feature1'], 'Working on feature');
            
            const lockFile = path.join(testWorkspace, 'coordination', 'agent_locks', 'agent1.lock');
            expect(fs.existsSync(lockFile)).toBe(true);
            
            const lockData = JSON.parse(await fs.promises.readFile(lockFile, 'utf-8'));
            expect(lockData.agentId).toBe('agent1');
            expect(lockData.files).toEqual(['src/file.ts']);
            expect(lockData.features).toEqual(['feature1']);
        });
        
        test('should prevent conflicting claims', async () => {
            await protocol.claimWork('agent1', ['src/shared.ts'], ['feature1'], 'First claim');
            
            const result = await protocol.claimWork('agent2', ['src/shared.ts'], ['feature2'], 'Second claim');
            expect(result).toBe(false);
        });
    });
    
    describe('Work Assignment', () => {
        test('should assign work from queue', async () => {
            // Add work to queue
            await protocol.planWork('planner', {
                agentId: 'planner',
                title: 'Implement feature',
                description: 'New feature implementation',
                files: ['src/feature.ts'],
                features: ['new-feature'],
                priority: 'medium',
                businessValue: 'User requested',
                technicalJustification: 'Improves UX'
            });
            
            // Request work
            const work = await protocol.requestWork('agent1', ['typescript', 'react']);
            
            expect(work).not.toBeNull();
            expect(work!.status).toBe('active');
            expect(work!.agentId).toBe('agent1');
            expect(work!.startedAt).toBeInstanceOf(Date);
        });
        
        test('should not assign work if agent has existing lock', async () => {
            // Agent claims work
            await protocol.claimWork('agent1', ['src/file1.ts'], ['feature1'], 'Working');
            
            // Add more work to queue
            await protocol.planWork('planner', {
                agentId: 'planner',
                title: 'Another task',
                description: 'Different task',
                files: ['src/file2.ts'],
                features: ['feature2'],
                priority: 'high',
                businessValue: 'Important',
                technicalJustification: 'Critical'
            });
            
            // Agent tries to get more work
            const work = await protocol.requestWork('agent1', ['typescript']);
            expect(work).toBeNull();
        });
    });
    
    describe('Work Completion', () => {
        let workId: string;
        
        beforeEach(async () => {
            const plan = await protocol.planWork('agent1', {
                agentId: 'agent1',
                title: 'Test task',
                description: 'Test description',
                files: ['src/test.ts'],
                features: ['test'],
                priority: 'medium',
                businessValue: 'Testing',
                technicalJustification: 'Unit test'
            });
            
            workId = plan.id;
            
            // Activate the work
            const work = await protocol.requestWork('agent1', ['testing']);
            expect(work).not.toBeNull();
        });
        
        test('should complete work successfully', async () => {
            await protocol.completeWork('agent1', workId, true);
            
            const status = protocol.getCoordinationStatus();
            expect(status.completedWork).toBe(1);
            expect(status.activeWork).toBe(0);
        });
        
        test('should handle work failure', async () => {
            await protocol.completeWork('agent1', workId, false);
            
            const completedLog = (protocol as any).state.completedWorkLog;
            expect(completedLog[0].status).toBe('failed');
        });
        
        test('should release lock on completion', async () => {
            await protocol.completeWork('agent1', workId, true);
            
            const lockFile = path.join(testWorkspace, 'coordination', 'agent_locks', 'agent1.lock');
            expect(fs.existsSync(lockFile)).toBe(false);
        });
        
        test('should reject completion by wrong agent', async () => {
            await expect(protocol.completeWork('agent2', workId, true))
                .rejects.toThrow('not assigned to agent');
        });
    });
    
    describe('Stale Lock Cleanup', () => {
        test('should clean up stale locks on initialization', async () => {
            // Create a stale lock file
            const lockData = {
                agentId: 'stale-agent',
                timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours old
                files: ['src/old.ts'],
                features: ['old-feature'],
                description: 'Old work',
                estimatedDuration: 30
            };
            
            const lockFile = path.join(testWorkspace, 'coordination', 'agent_locks', 'stale-agent.lock');
            await fs.promises.writeFile(lockFile, JSON.stringify(lockData));
            
            // Reinitialize protocol
            const newProtocol = new CoordinationProtocol(testWorkspace);
            await newProtocol.initialize();
            
            // Stale lock should be removed
            expect(fs.existsSync(lockFile)).toBe(false);
        });
    });
    
    describe('Status Reporting', () => {
        test('should generate coordination report', async () => {
            // Set up some test data
            await protocol.planWork('agent1', {
                agentId: 'agent1',
                title: 'Task 1',
                description: 'Description 1',
                files: ['file1.ts'],
                features: ['feature1'],
                priority: 'high',
                businessValue: 'Value 1',
                technicalJustification: 'Tech 1'
            });
            
            await protocol.claimWork('agent2', ['file2.ts'], ['feature2'], 'Working on feature 2');
            
            const report = await protocol.generateCoordinationReport();
            
            expect(report).toContain('Coordination Protocol Status Report');
            expect(report).toContain('Planned Work: 1');
            expect(report).toContain('Active Agents: 1');
            expect(report).toContain('Agent agent2');
        });
    });
    
    describe('State Persistence', () => {
        test('should persist and restore state', async () => {
            // Create some state
            await protocol.planWork('agent1', {
                agentId: 'agent1',
                title: 'Persistent task',
                description: 'Should persist',
                files: ['persist.ts'],
                features: ['persistence'],
                priority: 'medium',
                businessValue: 'Testing',
                technicalJustification: 'State test'
            });
            
            await protocol.claimWork('agent2', ['lock.ts'], ['locking'], 'Testing locks');
            
            // Create new protocol instance
            const newProtocol = new CoordinationProtocol(testWorkspace);
            await newProtocol.initialize();
            
            const status = newProtocol.getCoordinationStatus();
            expect(status.plannedWork).toBe(1);
            expect(status.activeLocks).toBe(1);
        });
    });
});