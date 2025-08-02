import * as vscode from 'vscode';
import { ChildProcess } from 'child_process';
import { MessageItem, HistoryRun, QueueSortConfig } from '../../core/types';

// Workspace-specific session isolation
interface WorkspaceSessionState {
    claudePanel: vscode.WebviewPanel | null;
    isRunning: boolean;
    messageQueue: MessageItem[];
    claudeProcess: ChildProcess | null;
    resumeTimer: NodeJS.Timeout | null;
    countdownInterval: NodeJS.Timeout | null;
    sleepPreventionProcess: ChildProcess | null;
    sleepPreventionActive: boolean;
    healthCheckTimer: NodeJS.Timeout | null;
    sessionReady: boolean;
    currentMessage: MessageItem | null;
    processingQueue: boolean;
    debugMode: boolean;
    currentRun: HistoryRun | null;
    queueSortConfig: QueueSortConfig;
    claudeOutputBuffer: string;
    claudeCurrentScreen: string;
    claudeOutputTimer: NodeJS.Timeout | null;
    claudeAutoClearTimer: NodeJS.Timeout | null;
    lastClaudeOutputTime: number;
    sessionId: string;
    workspaceId: string;
}

// Global registry of workspace sessions to ensure complete isolation
const workspaceSessions = new Map<string, WorkspaceSessionState>();

// Generate unique workspace identifier based on workspace path and VS Code window
function getWorkspaceId(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspacePath = workspaceFolder?.uri.fsPath || 'no-workspace';
    // Include process PID and extension context to ensure uniqueness across VS Code instances
    const instanceId = `${process.pid}-${Date.now()}`;
    return `${workspacePath.replace(/[^a-zA-Z0-9]/g, '_')}-${instanceId}`;
}

// Current active workspace session (cached for performance)
let currentWorkspaceId: string | null = null;
let currentSession: WorkspaceSessionState | null = null;

// Get or create workspace-specific session state
function getWorkspaceSession(): WorkspaceSessionState {
    const workspaceId = getWorkspaceId();
    
    // Use cached session if workspace hasn't changed
    if (currentWorkspaceId === workspaceId && currentSession) {
        return currentSession;
    }
    
    if (!workspaceSessions.has(workspaceId)) {
        const sessionId = `session_${workspaceId}_${Math.random().toString(36).substring(2, 15)}`;
        
        const newSession: WorkspaceSessionState = {
            claudePanel: null,
            isRunning: false,
            messageQueue: [],
            claudeProcess: null,
            resumeTimer: null,
            countdownInterval: null,
            sleepPreventionProcess: null,
            sleepPreventionActive: false,
            healthCheckTimer: null,
            sessionReady: false,
            currentMessage: null,
            processingQueue: false,
            debugMode: false,
            currentRun: null,
            queueSortConfig: { field: 'timestamp', direction: 'asc' },
            claudeOutputBuffer: '',
            claudeCurrentScreen: '',
            claudeOutputTimer: null,
            claudeAutoClearTimer: null,
            lastClaudeOutputTime: 0,
            sessionId,
            workspaceId
        };
        
        workspaceSessions.set(workspaceId, newSession);
        
        console.log(`[Session Isolation] Created new isolated session: ${sessionId} for workspace: ${workspaceId}`);
    }
    
    // Update cache
    currentWorkspaceId = workspaceId;
    currentSession = workspaceSessions.get(workspaceId)!;
    
    return currentSession;
}

// Clean up inactive sessions
function cleanupInactiveSessions(): void {
    for (const [workspaceId, session] of workspaceSessions.entries()) {
        if (!session.claudeProcess && !session.isRunning) {
            // Clear all timers
            if (session.resumeTimer) clearTimeout(session.resumeTimer);
            if (session.countdownInterval) clearInterval(session.countdownInterval);
            if (session.healthCheckTimer) clearTimeout(session.healthCheckTimer);
            if (session.claudeOutputTimer) clearTimeout(session.claudeOutputTimer);
            if (session.claudeAutoClearTimer) clearTimeout(session.claudeAutoClearTimer);
            
            workspaceSessions.delete(workspaceId);
            console.log(`[Session Isolation] Cleaned up inactive session: ${workspaceId}`);
            
            // Clear cache if this was the current session
            if (currentWorkspaceId === workspaceId) {
                currentWorkspaceId = null;
                currentSession = null;
            }
        }
    }
}

// Cleanup inactive sessions every 5 minutes
setInterval(cleanupInactiveSessions, 5 * 60 * 1000);

// Global extension context (shared across workspaces but used safely)
export let extensionContext: vscode.ExtensionContext;

// Backward-compatible variable exports that automatically use workspace-isolated state
export let claudePanel: vscode.WebviewPanel | null;
export let isRunning: boolean;
export let messageQueue: MessageItem[];
export let claudeProcess: ChildProcess | null;
export let resumeTimer: NodeJS.Timeout | null;
export let countdownInterval: NodeJS.Timeout | null;
export let sleepPreventionProcess: ChildProcess | null;
export let sleepPreventionActive: boolean;
export let healthCheckTimer: NodeJS.Timeout | null;
export let sessionReady: boolean;
export let currentMessage: MessageItem | null;
export let processingQueue: boolean;
export let debugMode: boolean;
export let currentRun: HistoryRun | null;
export let queueSortConfig: QueueSortConfig;
export let claudeOutputBuffer: string;
export let claudeCurrentScreen: string;
export let claudeOutputTimer: NodeJS.Timeout | null;
export let claudeAutoClearTimer: NodeJS.Timeout | null;
export let lastClaudeOutputTime: number;

// Sync local variables with workspace session
function syncStateFromWorkspace(): void {
    const session = getWorkspaceSession();
    
    claudePanel = session.claudePanel;
    isRunning = session.isRunning;
    messageQueue = session.messageQueue;
    claudeProcess = session.claudeProcess;
    resumeTimer = session.resumeTimer;
    countdownInterval = session.countdownInterval;
    sleepPreventionProcess = session.sleepPreventionProcess;
    sleepPreventionActive = session.sleepPreventionActive;
    healthCheckTimer = session.healthCheckTimer;
    sessionReady = session.sessionReady;
    currentMessage = session.currentMessage;
    processingQueue = session.processingQueue;
    debugMode = session.debugMode;
    currentRun = session.currentRun;
    queueSortConfig = session.queueSortConfig;
    claudeOutputBuffer = session.claudeOutputBuffer;
    claudeCurrentScreen = session.claudeCurrentScreen;
    claudeOutputTimer = session.claudeOutputTimer;
    claudeAutoClearTimer = session.claudeAutoClearTimer;
    lastClaudeOutputTime = session.lastClaudeOutputTime;
}

// Sync local variables to workspace session
function syncStateToWorkspace(): void {
    const session = getWorkspaceSession();
    
    session.claudePanel = claudePanel;
    session.isRunning = isRunning;
    session.messageQueue = messageQueue;
    session.claudeProcess = claudeProcess;
    session.resumeTimer = resumeTimer;
    session.countdownInterval = countdownInterval;
    session.sleepPreventionProcess = sleepPreventionProcess;
    session.sleepPreventionActive = sleepPreventionActive;
    session.healthCheckTimer = healthCheckTimer;
    session.sessionReady = sessionReady;
    session.currentMessage = currentMessage;
    session.processingQueue = processingQueue;
    session.debugMode = debugMode;
    session.currentRun = currentRun;
    session.queueSortConfig = queueSortConfig;
    session.claudeOutputBuffer = claudeOutputBuffer;
    session.claudeCurrentScreen = claudeCurrentScreen;
    session.claudeOutputTimer = claudeOutputTimer;
    session.claudeAutoClearTimer = claudeAutoClearTimer;
    session.lastClaudeOutputTime = lastClaudeOutputTime;
}

// Initialize state from workspace session on first load
syncStateFromWorkspace();

// Workspace-isolated setters - always modify current workspace session data
export function setClaudePanel(panel: vscode.WebviewPanel | null) {
    claudePanel = panel;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set claudePanel for session: ${getWorkspaceSession().sessionId}`);
}

export function setIsRunning(running: boolean) {
    isRunning = running;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set isRunning=${running} for session: ${getWorkspaceSession().sessionId}`);
}

export function setMessageQueue(queue: MessageItem[]) {
    messageQueue = queue;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set messageQueue (${queue.length} items) for session: ${getWorkspaceSession().sessionId}`);
}

export function setClaudeProcess(process: ChildProcess | null) {
    claudeProcess = process;
    syncStateToWorkspace();
    const pid = process?.pid || 'null';
    console.log(`[Session Isolation] Set claudeProcess (PID: ${pid}) for session: ${getWorkspaceSession().sessionId}`);
}

export function setSessionReady(ready: boolean) {
    sessionReady = ready;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set sessionReady=${ready} for session: ${getWorkspaceSession().sessionId}`);
}

export function setCurrentMessage(message: MessageItem | null) {
    currentMessage = message;
    syncStateToWorkspace();
    const msgId = message?.id || 'null';
    console.log(`[Session Isolation] Set currentMessage (ID: ${msgId}) for session: ${getWorkspaceSession().sessionId}`);
}

export function setProcessingQueue(processing: boolean) {
    processingQueue = processing;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set processingQueue=${processing} for session: ${getWorkspaceSession().sessionId}`);
}

export function setCurrentRun(run: HistoryRun | null) {
    currentRun = run;
    syncStateToWorkspace();
    const runId = run?.id || 'null';
    console.log(`[Session Isolation] Set currentRun (ID: ${runId}) for session: ${getWorkspaceSession().sessionId}`);
}

export function setExtensionContext(context: vscode.ExtensionContext) {
    extensionContext = context;
    console.log(`[Session Isolation] Set global extensionContext`);
}

export function setSleepPreventionProcess(process: ChildProcess | null) {
    sleepPreventionProcess = process;
    syncStateToWorkspace();
    const pid = process?.pid || 'null';
    console.log(`[Session Isolation] Set sleepPreventionProcess (PID: ${pid}) for session: ${getWorkspaceSession().sessionId}`);
}

export function setSleepPreventionActive(active: boolean) {
    sleepPreventionActive = active;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set sleepPreventionActive=${active} for session: ${getWorkspaceSession().sessionId}`);
}

export function setHealthCheckTimer(timer: NodeJS.Timeout | null) {
    healthCheckTimer = timer;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set healthCheckTimer for session: ${getWorkspaceSession().sessionId}`);
}

export function setResumeTimer(timer: NodeJS.Timeout | null) {
    resumeTimer = timer;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set resumeTimer for session: ${getWorkspaceSession().sessionId}`);
}

export function setCountdownInterval(interval: NodeJS.Timeout | null) {
    countdownInterval = interval;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set countdownInterval for session: ${getWorkspaceSession().sessionId}`);
}

export function setClaudeOutputTimer(timer: NodeJS.Timeout | null) {
    claudeOutputTimer = timer;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set claudeOutputTimer for session: ${getWorkspaceSession().sessionId}`);
}

export function setClaudeAutoClearTimer(timer: NodeJS.Timeout | null) {
    claudeAutoClearTimer = timer;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set claudeAutoClearTimer for session: ${getWorkspaceSession().sessionId}`);
}

export function setClaudeOutputBuffer(buffer: string) {
    claudeOutputBuffer = buffer;
    syncStateToWorkspace();
    // Don't log buffer content for performance, just length
    console.log(`[Session Isolation] Set claudeOutputBuffer (${buffer.length} chars) for session: ${getWorkspaceSession().sessionId}`);
}

export function setClaudeCurrentScreen(screen: string) {
    claudeCurrentScreen = screen;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set claudeCurrentScreen (${screen.length} chars) for session: ${getWorkspaceSession().sessionId}`);
}

export function setLastClaudeOutputTime(time: number) {
    lastClaudeOutputTime = time;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set lastClaudeOutputTime=${time} for session: ${getWorkspaceSession().sessionId}`);
}

export function setQueueSortConfig(config: QueueSortConfig) {
    queueSortConfig = config;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set queueSortConfig for session: ${getWorkspaceSession().sessionId}`);
}

export function setDebugMode(debug: boolean) {
    debugMode = debug;
    syncStateToWorkspace();
    console.log(`[Session Isolation] Set debugMode=${debug} for session: ${getWorkspaceSession().sessionId}`);
}

// Ensure state is synced when workspace changes
export function refreshWorkspaceState(): void {
    // Force refresh by clearing cache
    currentWorkspaceId = null;
    currentSession = null;
    syncStateFromWorkspace();
    console.log(`[Session Isolation] Refreshed workspace state for session: ${getWorkspaceSession().sessionId}`);
}

// Additional utility functions for session management
export function getCurrentSessionInfo(): { sessionId: string; workspaceId: string; activeProcessPid: number | null } {
    const session = getWorkspaceSession();
    return {
        sessionId: session.sessionId,
        workspaceId: session.workspaceId,
        activeProcessPid: session.claudeProcess?.pid || null
    };
}

export function getAllActiveSessions(): Array<{ sessionId: string; workspaceId: string; activeProcessPid: number | null }> {
    return Array.from(workspaceSessions.values()).map(session => ({
        sessionId: session.sessionId,
        workspaceId: session.workspaceId,
        activeProcessPid: session.claudeProcess?.pid || null
    }));
}

export function forceCleanupCurrentSession(): void {
    const session = getWorkspaceSession();
    const workspaceId = session.workspaceId;
    
    // Clean up all timers and processes
    if (session.resumeTimer) clearTimeout(session.resumeTimer);
    if (session.countdownInterval) clearInterval(session.countdownInterval);
    if (session.healthCheckTimer) clearTimeout(session.healthCheckTimer);
    if (session.claudeOutputTimer) clearTimeout(session.claudeOutputTimer);
    if (session.claudeAutoClearTimer) clearTimeout(session.claudeAutoClearTimer);
    if (session.claudeProcess) {
        session.claudeProcess.kill();
    }
    if (session.sleepPreventionProcess) {
        session.sleepPreventionProcess.kill();
    }
    
    workspaceSessions.delete(workspaceId);
    
    // Clear cache
    currentWorkspaceId = null;
    currentSession = null;
    
    // Reinitialize with fresh session
    syncStateFromWorkspace();
    
    console.log(`[Session Isolation] Force cleaned up session: ${session.sessionId}`);
}