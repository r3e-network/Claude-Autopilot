export interface MessageItem {
    id: number;
    text: string;
    timestamp: string;
    status: 'pending' | 'processing' | 'completed' | 'error' | 'waiting';
    output?: string;
    error?: string;
    completedAt?: string;
    waitUntil?: number;
    waitSeconds?: number;
}

export interface HistoryRun {
    id: string;
    startTime: string;
    endTime?: string;
    workspacePath: string;
    messages: MessageItem[];
    totalMessages: number;
    completedMessages: number;
    errorMessages: number;
    waitingMessages: number;
}

export interface QueueSortConfig {
    field: 'timestamp' | 'status' | 'text';
    direction: 'asc' | 'desc';
}