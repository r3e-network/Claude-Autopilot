import * as path from 'path';
import * as fs from 'fs';
import { debugLog } from '../utils/logging';

const fsAsync = fs.promises;

export interface AgentLock {
    agentId: string;
    timestamp: Date;
    files: string[];
    features: string[];
    description: string;
    estimatedDuration: number; // minutes
}

export interface WorkPlan {
    id: string;
    agentId: string;
    title: string;
    description: string;
    files: string[];
    features: string[];
    priority: 'high' | 'medium' | 'low';
    status: 'planned' | 'active' | 'completed' | 'failed';
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    businessValue: string;
    technicalJustification: string;
}

export interface CoordinationState {
    activeWorkRegistry: Map<string, WorkPlan>;
    completedWorkLog: WorkPlan[];
    agentLocks: Map<string, AgentLock>;
    plannedWorkQueue: WorkPlan[];
}

export class CoordinationProtocol {
    private coordinationDir: string;
    private activeWorkFile: string;
    private completedWorkFile: string;
    private plannedWorkFile: string;
    private locksDir: string;
    private state: CoordinationState;
    private staleTimeout: number = 2 * 60 * 60 * 1000; // 2 hours

    constructor(workspacePath: string) {
        this.coordinationDir = path.join(workspacePath, 'coordination');
        this.activeWorkFile = path.join(this.coordinationDir, 'active_work_registry.json');
        this.completedWorkFile = path.join(this.coordinationDir, 'completed_work_log.json');
        this.plannedWorkFile = path.join(this.coordinationDir, 'planned_work_queue.json');
        this.locksDir = path.join(this.coordinationDir, 'agent_locks');
        
        this.state = {
            activeWorkRegistry: new Map(),
            completedWorkLog: [],
            agentLocks: new Map(),
            plannedWorkQueue: []
        };
    }

    async initialize(): Promise<void> {
        debugLog('Initializing coordination protocol');
        
        // Create coordination directories
        await fsAsync.mkdir(this.coordinationDir, { recursive: true });
        await fsAsync.mkdir(this.locksDir, { recursive: true });
        
        // Initialize state files
        await this.initializeStateFiles();
        
        // Load existing state
        await this.loadState();
        
        // Clean up stale locks
        await this.cleanupStaleLocks();
    }

    async requestWork(agentId: string, capabilities: string[]): Promise<WorkPlan | null> {
        debugLog(`Agent ${agentId} requesting work with capabilities: ${capabilities.join(', ')}`);
        
        // First, check planned work queue
        for (let i = 0; i < this.state.plannedWorkQueue.length; i++) {
            const plan = this.state.plannedWorkQueue[i];
            
            // Check if agent can take this work
            if (await this.canAgentTakeWork(agentId, plan)) {
                // Remove from queue and activate
                this.state.plannedWorkQueue.splice(i, 1);
                plan.status = 'active';
                plan.agentId = agentId;
                plan.startedAt = new Date();
                
                // Create lock
                await this.createLock(agentId, plan.files, plan.features, plan.description);
                
                // Add to active registry
                this.state.activeWorkRegistry.set(plan.id, plan);
                
                await this.saveState();
                return plan;
            }
        }
        
        // No suitable work found
        return null;
    }

    async planWork(agentId: string, plan: Omit<WorkPlan, 'id' | 'status' | 'createdAt'>): Promise<WorkPlan> {
        debugLog(`Agent ${agentId} planning work: ${plan.title}`);
        
        // Check for conflicts
        const conflicts = await this.checkConflicts(plan.files, plan.features);
        if (conflicts.length > 0) {
            throw new Error(`Work conflicts detected: ${conflicts.join(', ')}`);
        }
        
        // Create work plan
        const workPlan: WorkPlan = {
            ...plan,
            id: `work_${Date.now()}_${agentId}`,
            status: 'planned',
            createdAt: new Date()
        };
        
        // Add to planned queue
        this.state.plannedWorkQueue.push(workPlan);
        
        // Sort queue by priority
        this.state.plannedWorkQueue.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        
        await this.saveState();
        return workPlan;
    }

    async claimWork(agentId: string, files: string[], features: string[], description: string): Promise<boolean> {
        // Validate inputs
        if (!agentId || typeof agentId !== 'string') {
            throw new Error('Invalid agent ID');
        }
        
        if (!Array.isArray(files) || !Array.isArray(features)) {
            throw new Error('Files and features must be arrays');
        }
        
        if (!description || typeof description !== 'string' || description.trim().length === 0) {
            throw new Error('Description is required');
        }
        
        // Sanitize file paths
        const sanitizedFiles = files.map(file => {
            // Remove any path traversal attempts and leading slashes
            return file.replace(/\.\./g, '').replace(/^\/+/, '');
        });
        
        debugLog(`Agent ${agentId} attempting to claim work`);
        
        // Check for conflicts
        const conflicts = await this.checkConflicts(sanitizedFiles, features);
        if (conflicts.length > 0) {
            debugLog(`Claim rejected due to conflicts: ${conflicts.join(', ')}`);
            return false;
        }
        
        // Create lock
        await this.createLock(agentId, sanitizedFiles, features, description);
        
        debugLog(`Agent ${agentId} successfully claimed work`);
        return true;
    }

    async releaseWork(agentId: string): Promise<void> {
        debugLog(`Agent ${agentId} releasing work`);
        
        // Remove lock
        const lockFile = path.join(this.locksDir, `${agentId}.lock`);
        try {
            await fsAsync.unlink(lockFile);
        } catch {
            // Lock file might not exist
        }
        
        // Remove from state
        this.state.agentLocks.delete(agentId);
        
        // Move any active work to completed or back to planned
        for (const [id, work] of this.state.activeWorkRegistry) {
            if (work.agentId === agentId) {
                if (work.status === 'active') {
                    // Move back to planned queue
                    work.status = 'planned';
                    work.agentId = work.agentId; // Keep original assignment for tracking
                    work.startedAt = undefined;
                    this.state.plannedWorkQueue.push(work);
                }
                this.state.activeWorkRegistry.delete(id);
            }
        }
        
        await this.saveState();
    }

    async completeWork(agentId: string, workId: string, success: boolean = true): Promise<void> {
        debugLog(`Agent ${agentId} completing work ${workId}`);
        
        const work = this.state.activeWorkRegistry.get(workId);
        if (!work || work.agentId !== agentId) {
            throw new Error(`Work ${workId} not found or not assigned to agent ${agentId}`);
        }
        
        // Update work status
        work.status = success ? 'completed' : 'failed';
        work.completedAt = new Date();
        
        // Move to completed log
        this.state.completedWorkLog.push(work);
        this.state.activeWorkRegistry.delete(workId);
        
        // Release lock
        await this.releaseWork(agentId);
        
        await this.saveState();
    }

    private async canAgentTakeWork(agentId: string, plan: WorkPlan): Promise<boolean> {
        // Check if agent already has a lock
        if (this.state.agentLocks.has(agentId)) {
            return false;
        }
        
        // Check for conflicts
        const conflicts = await this.checkConflicts(plan.files, plan.features);
        return conflicts.length === 0;
    }

    private async checkConflicts(files: string[], features: string[]): Promise<string[]> {
        const conflicts: string[] = [];
        
        // Check all active locks
        for (const [agentId, lock] of this.state.agentLocks) {
            // Check file conflicts
            for (const file of files) {
                if (lock.files.includes(file)) {
                    conflicts.push(`File ${file} locked by ${agentId}`);
                }
            }
            
            // Check feature conflicts
            for (const feature of features) {
                if (lock.features.includes(feature)) {
                    conflicts.push(`Feature ${feature} locked by ${agentId}`);
                }
            }
        }
        
        return conflicts;
    }

    private async createLock(agentId: string, files: string[], features: string[], description: string): Promise<void> {
        const lock: AgentLock = {
            agentId,
            timestamp: new Date(),
            files,
            features,
            description,
            estimatedDuration: 30 // Default 30 minutes
        };
        
        // Save to file
        const lockFile = path.join(this.locksDir, `${agentId}.lock`);
        await fsAsync.writeFile(lockFile, JSON.stringify(lock, null, 2));
        
        // Update state
        this.state.agentLocks.set(agentId, lock);
    }

    private async cleanupStaleLocks(): Promise<void> {
        debugLog('Cleaning up stale locks');
        
        const now = Date.now();
        const staleLocks: string[] = [];
        
        // Check lock files
        try {
            const lockFiles = await fsAsync.readdir(this.locksDir);
            
            for (const file of lockFiles) {
                if (file.endsWith('.lock')) {
                    const lockPath = path.join(this.locksDir, file);
                    const content = await fsAsync.readFile(lockPath, 'utf-8');
                    const lock: AgentLock = JSON.parse(content);
                    
                    const age = now - new Date(lock.timestamp).getTime();
                    if (age > this.staleTimeout) {
                        staleLocks.push(lock.agentId);
                        await fsAsync.unlink(lockPath);
                        debugLog(`Removed stale lock for agent ${lock.agentId}`);
                    } else {
                        // Add to state if not stale
                        this.state.agentLocks.set(lock.agentId, lock);
                    }
                }
            }
        } catch (error) {
            debugLog(`Error cleaning up locks: ${error}`);
        }
        
        // Clean up related work
        for (const agentId of staleLocks) {
            await this.releaseWork(agentId);
        }
    }

    private async loadState(): Promise<void> {
        // Load active work registry
        try {
            const activeData = await fsAsync.readFile(this.activeWorkFile, 'utf-8');
            const activeWork = JSON.parse(activeData);
            this.state.activeWorkRegistry = new Map(Object.entries(activeWork));
        } catch {
            // File doesn't exist yet
        }
        
        // Load completed work log
        try {
            const completedData = await fsAsync.readFile(this.completedWorkFile, 'utf-8');
            this.state.completedWorkLog = JSON.parse(completedData);
        } catch {
            // File doesn't exist yet
        }
        
        // Load planned work queue
        try {
            const plannedData = await fsAsync.readFile(this.plannedWorkFile, 'utf-8');
            this.state.plannedWorkQueue = JSON.parse(plannedData);
        } catch {
            // File doesn't exist yet
        }
    }

    private async saveState(): Promise<void> {
        // Save active work registry
        const activeWork = Object.fromEntries(this.state.activeWorkRegistry);
        await fsAsync.writeFile(this.activeWorkFile, JSON.stringify(activeWork, null, 2));
        
        // Save completed work log
        await fsAsync.writeFile(this.completedWorkFile, JSON.stringify(this.state.completedWorkLog, null, 2));
        
        // Save planned work queue
        await fsAsync.writeFile(this.plannedWorkFile, JSON.stringify(this.state.plannedWorkQueue, null, 2));
    }
    
    private async initializeStateFiles(): Promise<void> {
        // Initialize empty state files if they don't exist
        const files = [
            { path: this.activeWorkFile, content: '{}' },
            { path: this.completedWorkFile, content: '[]' },
            { path: this.plannedWorkFile, content: '[]' }
        ];
        
        for (const file of files) {
            try {
                await fsAsync.access(file.path);
            } catch {
                await fsAsync.writeFile(file.path, file.content);
            }
        }
    }

    getCoordinationStatus(): {
        activeWork: number;
        completedWork: number;
        plannedWork: number;
        activeLocks: number;
        agents: string[];
    } {
        return {
            activeWork: this.state.activeWorkRegistry.size,
            completedWork: this.state.completedWorkLog.length,
            plannedWork: this.state.plannedWorkQueue.length,
            activeLocks: this.state.agentLocks.size,
            agents: Array.from(this.state.agentLocks.keys())
        };
    }

    async generateCoordinationReport(): Promise<string> {
        const status = this.getCoordinationStatus();
        const report: string[] = [
            '# Coordination Protocol Status Report',
            '',
            `Generated: ${new Date().toLocaleString()}`,
            '',
            '## Summary',
            `- Active Work: ${status.activeWork}`,
            `- Completed Work: ${status.completedWork}`,
            `- Planned Work: ${status.plannedWork}`,
            `- Active Agents: ${status.activeLocks}`,
            '',
            '## Active Work',
            ''
        ];
        
        for (const [id, work] of this.state.activeWorkRegistry) {
            report.push(`### ${work.title}`);
            report.push(`- ID: ${id}`);
            report.push(`- Agent: ${work.agentId}`);
            report.push(`- Status: ${work.status}`);
            report.push(`- Files: ${work.files.join(', ')}`);
            report.push(`- Started: ${work.startedAt?.toLocaleString()}`);
            report.push('');
        }
        
        report.push('## Agent Locks', '');
        for (const [agentId, lock] of this.state.agentLocks) {
            report.push(`### Agent ${agentId}`);
            report.push(`- Files: ${lock.files.join(', ')}`);
            report.push(`- Features: ${lock.features.join(', ')}`);
            report.push(`- Description: ${lock.description}`);
            report.push(`- Locked at: ${new Date(lock.timestamp).toLocaleString()}`);
            report.push('');
        }
        
        return report.join('\n');
    }
}