export interface MessageItem {
    id: string;
    text: string;
    timestamp: string;
    status: 'pending' | 'processing' | 'completed' | 'error' | 'waiting';
    output?: string;
    error?: string;
    completedAt?: string;
    waitUntil?: number;
    waitSeconds?: number;
    attachedScripts?: string[]; // Array of script IDs to run with this message
}

export interface HistoryRun {
    id: string;
    startTime: string;
    endTime?: string;
    workspacePath: string;
    messages: MessageItem[];
    messageStatusMap: { [messageId: string]: 'pending' | 'processing' | 'completed' | 'error' | 'waiting' };
    totalMessages: number;
    completedMessages: number;
    errorMessages: number;
    waitingMessages: number;
}

export interface QueueSortConfig {
    field: 'timestamp' | 'status' | 'text';
    direction: 'asc' | 'desc';
}

export interface ScriptCheckResult {
    scriptId: string;
    scriptName: string;
    passed: boolean;
    errors: string[];
    warnings?: string[];
    timestamp: string;
}