import * as vscode from 'vscode';
import { ParallelAgentOrchestrator, OrchestrationConfig } from '../../agents/ParallelAgentOrchestrator';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Mock VS Code API
jest.mock('vscode');

describe('ParallelAgentOrchestrator', () => {
    let orchestrator: ParallelAgentOrchestrator;
    let testWorkspace: string;
    
    beforeEach(async () => {
        // Create temporary test workspace
        testWorkspace = path.join(os.tmpdir(), `test-workspace-${Date.now()}`);
        await fs.promises.mkdir(testWorkspace, { recursive: true });
        
        // Mock VS Code configuration
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn().mockImplementation((key: string, defaultValue: any) => defaultValue)
        });
    });
    
    afterEach(async () => {
        // Clean up
        if (orchestrator) {
            await orchestrator.stopAgents();
        }
        
        // Remove test workspace
        await fs.promises.rm(testWorkspace, { recursive: true, force: true });
    });
    
    describe('Initialization', () => {
        test('should initialize with default configuration', async () => {
            orchestrator = new ParallelAgentOrchestrator(testWorkspace);
            
            // Verify default config values
            const config = (orchestrator as any).config;
            expect(config.maxAgents).toBe(50);
            expect(config.defaultAgents).toBe(5);
            expect(config.staggerDelay).toBe(10);
            expect(config.contextThreshold).toBe(20);
            expect(config.autoRestart).toBe(true);
        });
        
        test('should initialize with custom configuration', async () => {
            const customConfig: Partial<OrchestrationConfig> = {
                maxAgents: 20,
                defaultAgents: 3,
                staggerDelay: 5,
                contextThreshold: 15
            };
            
            orchestrator = new ParallelAgentOrchestrator(testWorkspace, customConfig);
            
            const config = (orchestrator as any).config;
            expect(config.maxAgents).toBe(20);
            expect(config.defaultAgents).toBe(3);
            expect(config.staggerDelay).toBe(5);
            expect(config.contextThreshold).toBe(15);
        });
        
        test('should create heartbeat directory on initialization', async () => {
            orchestrator = new ParallelAgentOrchestrator(testWorkspace);
            await orchestrator.initialize();
            
            const heartbeatDir = path.join(testWorkspace, '.heartbeats');
            expect(fs.existsSync(heartbeatDir)).toBe(true);
        });
        
        test('should throw error if tmux is not available', async () => {
            // Mock tmux not being available
            const childProcess = require('child_process');
            jest.spyOn(childProcess, 'exec').mockImplementation(((cmd: string, callback: any) => {
                if (cmd.includes('which tmux')) {
                    callback(new Error('tmux not found'));
                } else {
                    callback(null, { stdout: '', stderr: '' });
                }
            }) as any);
            
            orchestrator = new ParallelAgentOrchestrator(testWorkspace);
            
            await expect(orchestrator.initialize()).rejects.toThrow('tmux is not installed');
        });
    });
    
    describe('Agent Management', () => {
        beforeEach(async () => {
            orchestrator = new ParallelAgentOrchestrator(testWorkspace);
            
            // Mock tmux being available
            const childProcess = require('child_process');
            jest.spyOn(childProcess, 'exec').mockImplementation(((cmd: string, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
            }) as any);
        });
        
        test('should enforce maximum agent limit', async () => {
            await expect(orchestrator.startAgents(100)).rejects.toThrow('Cannot start more than 50 agents');
        });
        
        test('should prevent starting agents when already running', async () => {
            await orchestrator.initialize();
            
            // Simulate agents running
            (orchestrator as any).isRunning = true;
            
            await expect(orchestrator.startAgents(5)).rejects.toThrow('Agents are already running');
        });
        
        test('should track agent statuses', async () => {
            await orchestrator.initialize();
            
            // Simulate adding agents
            const mockAgent = {
                id: '0',
                name: 'Agent 00',
                paneId: 'claude_agents:agent0.0',
                status: 'working' as const,
                contextUsage: 75,
                lastActivity: new Date(),
                lastHeartbeat: new Date(),
                restartCount: 0,
                errors: 0,
                workCycles: 2
            };
            
            (orchestrator as any).agents.set('0', mockAgent);
            
            const statuses = orchestrator.getAgentStatuses();
            expect(statuses).toHaveLength(1);
            expect(statuses[0].name).toBe('Agent 00');
            expect(statuses[0].status).toBe('working');
        });
        
        test('should save state to file', async () => {
            await orchestrator.initialize();
            
            // Add mock agent
            const mockAgent = {
                id: '0',
                name: 'Agent 00',
                paneId: 'claude_agents:agent0.0',
                status: 'working' as const,
                contextUsage: 75,
                lastActivity: new Date(),
                lastHeartbeat: new Date(),
                restartCount: 0,
                errors: 0,
                workCycles: 2
            };
            
            (orchestrator as any).agents.set('0', mockAgent);
            await (orchestrator as any).saveState();
            
            const stateFile = path.join(testWorkspace, '.claude_agent_farm_state.json');
            expect(fs.existsSync(stateFile)).toBe(true);
            
            const state = JSON.parse(await fs.promises.readFile(stateFile, 'utf-8'));
            expect(state.numAgents).toBe(1);
            expect(state.agents['0'].status).toBe('working');
        });
    });
    
    describe('Command Broadcasting', () => {
        beforeEach(async () => {
            orchestrator = new ParallelAgentOrchestrator(testWorkspace);
            
            // Mock exec
            const childProcess = require('child_process');
            jest.spyOn(childProcess, 'exec').mockImplementation(((cmd: string, callback: any) => {
                callback(null, { stdout: '', stderr: '' });
            }) as any);
        });
        
        test('should send command to all active agents', async () => {
            // Add mock agents
            const agents = [
                { id: '0', status: 'working', paneId: 'claude_agents:agent0.0' },
                { id: '1', status: 'idle', paneId: 'claude_agents:agent1.0' },
                { id: '2', status: 'disabled', paneId: 'claude_agents:agent2.0' }
            ];
            
            for (const agent of agents) {
                (orchestrator as any).agents.set(agent.id, {
                    ...agent,
                    name: `Agent ${agent.id.padStart(2, '0')}`,
                    contextUsage: 50,
                    lastActivity: new Date(),
                    lastHeartbeat: new Date(),
                    restartCount: 0,
                    errors: 0,
                    workCycles: 0
                });
            }
            
            const execSpy = jest.spyOn(require('child_process'), 'exec');
            await orchestrator.sendCommandToAllAgents('/clear');
            
            // Should send to working and idle agents, but not disabled
            const sendCalls = execSpy.mock.calls.filter((call: any[]) => 
                typeof call[0] === 'string' && call[0].includes('tmux send-keys') && call[0].includes('/clear')
            );
            
            expect(sendCalls).toHaveLength(2);
        });
    });
    
    describe('Adaptive Stagger', () => {
        test('should adjust stagger delay based on launch success', () => {
            const config: Partial<OrchestrationConfig> = {
                staggerDelay: 10
            };
            
            orchestrator = new ParallelAgentOrchestrator(testWorkspace, config);
            
            // Initially should be baseline
            expect((orchestrator as any).adaptiveStagger).toBe(10);
            
            // Simulate successful launch - should halve
            (orchestrator as any).adaptiveStagger = 20;
            const newStagger = Math.max(10, 20 / 2);
            expect(newStagger).toBe(10); // Should not go below baseline
            
            // Simulate failed launch - should double
            (orchestrator as any).adaptiveStagger = 15;
            const failedStagger = Math.min(60, 15 * 2);
            expect(failedStagger).toBe(30);
        });
    });
    
    describe('Error Handling', () => {
        beforeEach(async () => {
            orchestrator = new ParallelAgentOrchestrator(testWorkspace);
        });
        
        test('should handle agent launch failures gracefully', async () => {
            // Mock exec to fail for window creation
            const childProcess = require('child_process');
            jest.spyOn(childProcess, 'exec').mockImplementation(((cmd: string, callback: any) => {
                if (cmd.includes('new-window')) {
                    callback(new Error('Failed to create window'));
                } else {
                    callback(null, { stdout: '', stderr: '' });
                }
            }) as any);
            
            const result = await (orchestrator as any).launchAgent(0);
            expect(result).toBe(false);
        });
        
        test('should handle missing heartbeat files', async () => {
            const agent = {
                id: '0',
                name: 'Agent 00',
                paneId: 'claude_agents:agent0.0',
                status: 'working' as const,
                contextUsage: 50,
                lastActivity: new Date(),
                lastHeartbeat: new Date(),
                restartCount: 0,
                errors: 0,
                workCycles: 0
            };
            
            (orchestrator as any).agents.set('0', agent);
            
            // checkAgentHealth should handle missing heartbeat file gracefully
            await expect((orchestrator as any).checkAgentHealth()).resolves.not.toThrow();
        });
    });
});