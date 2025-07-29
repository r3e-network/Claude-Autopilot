import { debugLog } from '../../utils/logging';
import { claudeCurrentScreen } from '../../core/state';
import { addMessageToQueueFromWebview } from '../../queue';

export interface TaskAnalysis {
    hasUnfinishedTasks: boolean;
    unfinishedTodos: string[];
    incompleteSteps: string[];
    lastCommand: string | null;
    suggestedContinuation: string | null;
    confidence: 'high' | 'medium' | 'low';
}

// Patterns to detect unfinished work
const UNFINISHED_PATTERNS = {
    // TODO patterns
    todos: [
        /TODO:\s*(.+)/gi,
        /\[ \]\s+(.+)/g,  // Unchecked checkboxes
        /- \[ \]\s+(.+)/g, // Markdown unchecked items
        /FIXME:\s*(.+)/gi,
        /XXX:\s*(.+)/gi,
        /HACK:\s*(.+)/gi,
        /NOTE:\s*implement\s+(.+)/gi,
        /need(?:s)?\s+to\s+implement\s+(.+)/gi,
    ],
    
    // Incomplete task indicators
    incompleteIndicators: [
        /(?:i'?ll|let me|going to|need to|should|will)\s+(?:now|next|continue|proceed to|implement|create|add|update|fix)\s+(.+)/gi,
        /(?:next|then),?\s+(?:i'?ll|let me|we need to|should)\s+(.+)/gi,
        /(?:after that|following this),?\s+(?:i'?ll|we'll|need to)\s+(.+)/gi,
        /step\s+\d+:\s*(?:implement|create|add|update|fix)\s+(.+)/gi,
        /\d+\.\s*(?:implement|create|add|update|fix)\s+(.+)/gi,
        /(?:haven't|hasn't|didn't|don't have)\s+(?:implemented|created|added|updated|fixed)\s+(.+)\s+yet/gi,
        /(?:still need to|remaining task:|left to do:|pending:)\s*(.+)/gi,
    ],
    
    // Error patterns that suggest work stopped
    errorIndicators: [
        /error:?\s+(.+)/gi,
        /failed:?\s+(.+)/gi,
        /cannot\s+(.+)/gi,
        /unable to\s+(.+)/gi,
        /issue:?\s+(.+)/gi,
        /problem:?\s+(.+)/gi,
    ],
    
    // Patterns suggesting Claude was in the middle of something
    midTaskIndicators: [
        /^(?:Creating|Updating|Implementing|Adding|Fixing|Writing|Modifying)\s+(.+)$/gm,
        /^Let me\s+(.+)$/gm,
        /^I'?(?:ll|m going to|m)\s+(.+)$/gm,
        /^Now I'?(?:ll|m going to)\s+(.+)$/gm,
    ]
};

// Patterns to detect what Claude was last doing
const LAST_ACTION_PATTERNS = [
    /(?:just|successfully|now)\s+(?:created|updated|implemented|added|fixed|wrote|modified)\s+(.+)/gi,
    /(?:i've|i have)\s+(?:created|updated|implemented|added|fixed|written|modified)\s+(.+)/gi,
    /finished\s+(?:creating|updating|implementing|adding|fixing|writing|modifying)\s+(.+)/gi,
];

export function analyzeClaudeOutput(output?: string): TaskAnalysis {
    const screenContent = output || claudeCurrentScreen;
    
    if (!screenContent || screenContent.trim().length === 0) {
        return {
            hasUnfinishedTasks: false,
            unfinishedTodos: [],
            incompleteSteps: [],
            lastCommand: null,
            suggestedContinuation: null,
            confidence: 'low'
        };
    }
    
    debugLog('🔍 Analyzing Claude output for unfinished tasks...');
    
    const analysis: TaskAnalysis = {
        hasUnfinishedTasks: false,
        unfinishedTodos: [],
        incompleteSteps: [],
        lastCommand: null,
        suggestedContinuation: null,
        confidence: 'low'
    };
    
    // Extract last 50 lines for more focused analysis
    const lines = screenContent.split('\n');
    const recentLines = lines.slice(-50).join('\n');
    
    // Check for TODOs and unchecked items
    for (const pattern of UNFINISHED_PATTERNS.todos) {
        const matches = [...recentLines.matchAll(pattern)];
        for (const match of matches) {
            if (match[1] && match[1].trim()) {
                analysis.unfinishedTodos.push(match[1].trim());
            }
        }
    }
    
    // Check for incomplete task indicators
    for (const pattern of UNFINISHED_PATTERNS.incompleteIndicators) {
        const matches = [...recentLines.matchAll(pattern)];
        for (const match of matches) {
            if (match[1] && match[1].trim()) {
                analysis.incompleteSteps.push(match[1].trim());
            }
        }
    }
    
    // Check if Claude was in the middle of a task
    for (const pattern of UNFINISHED_PATTERNS.midTaskIndicators) {
        const matches = [...recentLines.matchAll(pattern)];
        for (const match of matches) {
            if (match[1] && match[1].trim()) {
                analysis.incompleteSteps.push(`Continue: ${match[1].trim()}`);
            }
        }
    }
    
    // Check for errors that might have stopped work
    const errorMatches = [];
    for (const pattern of UNFINISHED_PATTERNS.errorIndicators) {
        const matches = [...recentLines.matchAll(pattern)];
        errorMatches.push(...matches);
    }
    
    // Determine if there are unfinished tasks
    if (analysis.unfinishedTodos.length > 0 || analysis.incompleteSteps.length > 0) {
        analysis.hasUnfinishedTasks = true;
        analysis.confidence = 'high';
    } else if (errorMatches.length > 0) {
        analysis.hasUnfinishedTasks = true;
        analysis.confidence = 'medium';
    }
    
    // Try to detect what Claude was last working on
    for (const pattern of LAST_ACTION_PATTERNS) {
        const matches = [...recentLines.matchAll(pattern)];
        if (matches.length > 0) {
            const lastMatch = matches[matches.length - 1];
            if (lastMatch[1]) {
                analysis.lastCommand = `Working on: ${lastMatch[1].trim()}`;
            }
        }
    }
    
    // Generate suggested continuation message
    if (analysis.hasUnfinishedTasks) {
        analysis.suggestedContinuation = generateContinuationMessage(analysis);
    }
    
    debugLog(`📊 Analysis complete: ${analysis.hasUnfinishedTasks ? 'Found unfinished tasks' : 'No unfinished tasks detected'}`);
    debugLog(`   TODOs: ${analysis.unfinishedTodos.length}`);
    debugLog(`   Incomplete steps: ${analysis.incompleteSteps.length}`);
    debugLog(`   Confidence: ${analysis.confidence}`);
    
    return analysis;
}

function generateContinuationMessage(analysis: TaskAnalysis): string {
    const parts: string[] = [];
    
    // Add context about resuming
    parts.push("Please continue with the previous task. ");
    
    // Add specific todos if found
    if (analysis.unfinishedTodos.length > 0) {
        parts.push("\n\nRemaining TODOs:");
        analysis.unfinishedTodos.slice(0, 5).forEach(todo => {
            parts.push(`- ${todo}`);
        });
        if (analysis.unfinishedTodos.length > 5) {
            parts.push(`- ... and ${analysis.unfinishedTodos.length - 5} more`);
        }
    }
    
    // Add incomplete steps if found
    if (analysis.incompleteSteps.length > 0) {
        parts.push("\n\nIncomplete steps detected:");
        analysis.incompleteSteps.slice(0, 5).forEach(step => {
            parts.push(`- ${step}`);
        });
        if (analysis.incompleteSteps.length > 5) {
            parts.push(`- ... and ${analysis.incompleteSteps.length - 5} more`);
        }
    }
    
    // Add instruction to complete the work
    parts.push("\n\nPlease complete all remaining tasks and ensure everything is fully implemented and working correctly.");
    
    return parts.join('\n');
}

export async function checkAndResumeTasks(): Promise<boolean> {
    const analysis = analyzeClaudeOutput();
    
    if (!analysis.hasUnfinishedTasks || !analysis.suggestedContinuation) {
        debugLog('✅ No unfinished tasks detected');
        return false;
    }
    
    debugLog(`🔄 Automatically resuming unfinished tasks (confidence: ${analysis.confidence})`);
    
    try {
        // Add continuation message to queue
        addMessageToQueueFromWebview(analysis.suggestedContinuation);
        debugLog('✅ Added task continuation message to queue');
        return true;
    } catch (error) {
        debugLog(`❌ Failed to add continuation message: ${error}`);
        return false;
    }
}

// Pattern to detect if Claude is waiting for user input
export function isClaudeWaitingForInput(): boolean {
    const output = claudeCurrentScreen;
    if (!output) return false;
    
    const waitingPatterns = [
        /\?\s*$/,  // Ends with question mark
        /\?\s*\n\s*$/,  // Question mark at end with newline
        /please\s+(?:provide|specify|enter|tell|clarify|confirm)/i,
        /would you like/i,
        /do you want/i,
        /should i/i,
        /waiting for/i,
        /need(?:s)?\s+(?:more\s+)?(?:information|clarification|details)/i,
    ];
    
    // Check last 10 lines
    const lines = output.split('\n');
    const recentLines = lines.slice(-10).join('\n');
    
    return waitingPatterns.some(pattern => pattern.test(recentLines));
}

// Check if Claude appears to have stopped mid-task
export function hasClaudeStoppedMidTask(): boolean {
    const output = claudeCurrentScreen;
    if (!output) return false;
    
    // Get last line that has content
    const lines = output.split('\n').filter(line => line.trim());
    if (lines.length === 0) return false;
    
    const lastLine = lines[lines.length - 1].trim();
    
    // Patterns that suggest incomplete work
    const incompleteSentencePatterns = [
        /[^.!?]\s*$/,  // Doesn't end with punctuation
        /,\s*$/,       // Ends with comma
        /:\s*$/,       // Ends with colon
        /\.\.\.\s*$/,  // Ends with ellipsis
        /^(?:Creating|Updating|Implementing|Adding|Fixing|Writing|Modifying)/i,
        /^(?:Let me|I'll|I'm going to|Now)/i,
    ];
    
    return incompleteSentencePatterns.some(pattern => pattern.test(lastLine));
}