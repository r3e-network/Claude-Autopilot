import * as vscode from 'vscode';
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
        // Claude's specific patterns
        /Here's what I'll do:\s*\n((?:[-•*]\s*.+\n?)+)/gi,
        /I'll\s+(?:need to|now|next)\s+(.+)/gi,
        /Let me\s+(?:now|next|first|also)\s+(.+)/gi,
        /Next,?\s+I'll\s+(.+)/gi,
        /Now I'll\s+(.+)/gi,
        /\d+\.\s*\[\s*\]\s+(.+)/g, // Numbered unchecked items
        // Claude Code specific patterns
        /Let's\s+(?:start|begin|continue)\s+(?:by|with)\s+(.+)/gi,
        /First,?\s+I'll\s+(.+)/gi,
        /I'm going to\s+(.+)/gi,
        /Working on:\s*(.+)/gi,
        /In progress:\s*(.+)/gi,
        /Currently:\s*(.+)/gi,
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
        // More Claude-specific patterns
        /Now let's\s+(.+)/gi,
        /Let's\s+(?:also|now|next)\s+(.+)/gi,
        /I need to\s+(.+)/gi,
        /We should\s+(.+)/gi,
        /Making sure to\s+(.+)/gi,
        /Don't forget to\s+(.+)/gi,
        // Claude Code specific incomplete patterns
        /About to\s+(.+)/gi,
        /Planning to\s+(.+)/gi,
        /Going to\s+(?:start|begin|continue)\s+(.+)/gi,
        /Will\s+(?:now|next)\s+(.+)/gi,
        /Preparing to\s+(.+)/gi,
        /Ready to\s+(.+)/gi,
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
        // More specific mid-task patterns
        /^(?:Starting|Beginning|Continuing)\s+(.+)$/gm,
        /^Working on\s+(.+)$/gm,
        /^Processing\s+(.+)$/gm,
        /^Analyzing\s+(.+)$/gm,
        /^Checking\s+(.+)$/gm,
        /^Looking at\s+(.+)$/gm,
    ],
    
    // Patterns indicating a task list or plan
    taskListIndicators: [
        /(?:Here's|This is)\s+(?:the|my)\s+plan:/gi,
        /(?:I'll|Let me)\s+do\s+the\s+following:/gi,
        /Tasks?\s+to\s+complete:/gi,
        /Steps?\s+to\s+(?:take|follow):/gi,
        /What\s+I'll\s+do:/gi,
        /My\s+approach:/gi,
        /Plan\s+of\s+action:/gi,
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
    
    // Extract last 100 lines for more comprehensive analysis
    const lines = screenContent.split('\n');
    const recentLines = lines.slice(-100).join('\n');
    
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
    
    // Check for task lists that might indicate planned work
    let hasTaskList = false;
    for (const pattern of UNFINISHED_PATTERNS.taskListIndicators) {
        if (pattern.test(recentLines)) {
            hasTaskList = true;
            break;
        }
    }
    
    // If we found a task list, look for numbered or bulleted items after it
    if (hasTaskList) {
        const taskItemPatterns = [
            /^\s*\d+\.\s+(.+)$/gm,
            /^\s*[-•*]\s+(.+)$/gm,
            /^\s*\[\s*\]\s+(.+)$/gm,
        ];
        
        for (const pattern of taskItemPatterns) {
            const matches = [...recentLines.matchAll(pattern)];
            for (const match of matches) {
                if (match[1] && match[1].trim()) {
                    analysis.incompleteSteps.push(`Task: ${match[1].trim()}`);
                }
            }
        }
    }
    
    // Check for errors that might have stopped work
    const errorMatches = [];
    for (const pattern of UNFINISHED_PATTERNS.errorIndicators) {
        const matches = [...recentLines.matchAll(pattern)];
        errorMatches.push(...matches);
    }
    
    // Additional check: Look for completion indicators
    const completionPatterns = [
        /(?:all|everything)\s+(?:is|looks|seems)\s+(?:done|complete|finished|good|working)/gi,
        /(?:completed|finished|done)\s+(?:all|everything)/gi,
        /nothing\s+(?:more|else|left)\s+to\s+do/gi,
        /task(?:s)?\s+(?:completed|finished|done)/gi,
        /successfully\s+(?:completed|finished|implemented)/gi,
        /✓\s*All\s+(?:done|complete|finished)/gi,
        /✅\s*(?:Done|Complete|Finished)/gi,
    ];
    
    let hasCompletionIndicator = false;
    for (const pattern of completionPatterns) {
        if (pattern.test(recentLines)) {
            hasCompletionIndicator = true;
            break;
        }
    }
    
    // Aggressive mode: Check if Claude mentioned any future actions at all
    const futureActionPatterns = [
        /\b(?:will|would|could|should|might|may|can)\s+(?:now|next|then)?\s*(?:implement|create|add|update|fix|check|test|verify|ensure|make|build|write|modify|change)/gi,
        /\b(?:let's|let me|i'll|i will|i'm going to|going to|need to|have to|must|should)\b/gi,
        /\b(?:next|then|after|following|subsequently)\b.*\b(?:step|task|action|item)\b/gi,
    ];
    
    let hasFutureActions = false;
    for (const pattern of futureActionPatterns) {
        if (pattern.test(recentLines)) {
            hasFutureActions = true;
            break;
        }
    }
    
    // Determine if there are unfinished tasks with more nuanced logic
    if (analysis.unfinishedTodos.length > 0 || analysis.incompleteSteps.length > 0) {
        // If we have explicit TODOs or incomplete steps, high confidence
        analysis.hasUnfinishedTasks = true;
        analysis.confidence = hasCompletionIndicator ? 'medium' : 'high';
    } else if (errorMatches.length > 0 && !hasCompletionIndicator) {
        // If we have errors and no completion indicator, medium confidence
        analysis.hasUnfinishedTasks = true;
        analysis.confidence = 'medium';
    } else if (hasFutureActions && !hasCompletionIndicator && hasTaskList) {
        // If we have future actions, a task list, and no completion indicator, medium confidence
        analysis.hasUnfinishedTasks = true;
        analysis.confidence = 'medium';
        analysis.incompleteSteps.push('Detected planned actions that may not have been completed');
    } else if (hasClaudeStoppedMidTask() && !hasCompletionIndicator) {
        // If Claude stopped mid-sentence and there's no completion indicator, low confidence
        analysis.hasUnfinishedTasks = true;
        analysis.confidence = 'low';
        analysis.incompleteSteps.push('Claude appears to have stopped mid-task');
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
    
    // Customize message based on confidence level
    if (analysis.confidence === 'high') {
        parts.push("I noticed you have unfinished tasks. Please continue with the previous work.");
    } else if (analysis.confidence === 'medium') {
        parts.push("It appears there may be incomplete work from the previous task. Please review and continue if needed.");
    } else {
        parts.push("The previous session may have ended with incomplete work. Please check if there's anything left to finish.");
    }
    
    // Add specific context if we detected what Claude was working on
    if (analysis.lastCommand) {
        parts.push(`\n\nLast detected activity: ${analysis.lastCommand}`);
    }
    
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
        if (analysis.incompleteSteps.some(step => step.startsWith('Continue:'))) {
            parts.push("\n\nTasks to continue:");
        } else if (analysis.incompleteSteps.some(step => step.startsWith('Task:'))) {
            parts.push("\n\nPlanned tasks detected:");
        } else {
            parts.push("\n\nIncomplete steps detected:");
        }
        
        const uniqueSteps = [...new Set(analysis.incompleteSteps)]; // Remove duplicates
        uniqueSteps.slice(0, 5).forEach(step => {
            parts.push(`- ${step}`);
        });
        if (uniqueSteps.length > 5) {
            parts.push(`- ... and ${uniqueSteps.length - 5} more`);
        }
    }
    
    // Add appropriate closing instruction based on confidence
    if (analysis.confidence === 'high') {
        parts.push("\n\nPlease complete all remaining tasks and ensure everything is fully implemented and working correctly.");
    } else if (analysis.confidence === 'medium') {
        parts.push("\n\nIf there are any incomplete tasks, please finish them. Otherwise, confirm that everything is complete.");
    } else {
        parts.push("\n\nPlease review the previous work and continue if anything was left incomplete.");
    }
    
    return parts.join('\n');
}

export async function checkAndResumeTasks(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('autoclaude');
    const aggressiveMode = config.get<boolean>('session.aggressiveTaskDetection', false);
    
    const analysis = analyzeClaudeOutput();
    
    // In aggressive mode, also check for any hint of incomplete work
    if (aggressiveMode && !analysis.hasUnfinishedTasks) {
        // Do another pass with more aggressive detection
        const aggressiveAnalysis = analyzeClaudeOutputAggressive();
        if (aggressiveAnalysis.hasUnfinishedTasks) {
            debugLog('🔍 Aggressive mode detected potential unfinished tasks');
            return checkAndResumeTasksWithAnalysis(aggressiveAnalysis);
        }
    }
    
    if (!analysis.hasUnfinishedTasks || !analysis.suggestedContinuation) {
        debugLog('✅ No unfinished tasks detected');
        return false;
    }
    
    return checkAndResumeTasksWithAnalysis(analysis);
}

function checkAndResumeTasksWithAnalysis(analysis: TaskAnalysis): boolean {
    debugLog(`🔄 Automatically resuming unfinished tasks (confidence: ${analysis.confidence})`);
    
    try {
        // Add continuation message to queue
        if (analysis.suggestedContinuation) {
            addMessageToQueueFromWebview(analysis.suggestedContinuation);
            debugLog('✅ Added task continuation message to queue');
        } else {
            debugLog('❌ No continuation message generated');
        }
        return true;
    } catch (error) {
        debugLog(`❌ Failed to add continuation message: ${error}`);
        return false;
    }
}

// More aggressive analysis for edge cases
function analyzeClaudeOutputAggressive(): TaskAnalysis {
    const screenContent = claudeCurrentScreen;
    
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
    
    debugLog('🔍 Running aggressive task analysis...');
    
    const analysis: TaskAnalysis = {
        hasUnfinishedTasks: false,
        unfinishedTodos: [],
        incompleteSteps: [],
        lastCommand: null,
        suggestedContinuation: null,
        confidence: 'low'
    };
    
    // Check entire output for any TODO-like patterns
    const aggressivePatterns = [
        /\btodo\b/gi,
        /\bfixme\b/gi,
        /\bimplement\b.*\blater\b/gi,
        /\bneed(?:s)?\\s+to\\s+be\\s+(?:done|completed|implemented|fixed)/gi,
        /\bincomplete\b/gi,
        /\bunfinished\b/gi,
        /\bpending\b/gi,
        /\bremaining\b/gi,
        /\bnot\\s+(?:yet|done|complete|finished)/gi,
    ];
    
    const hasAggressiveMatch = aggressivePatterns.some(pattern => pattern.test(screenContent));
    
    if (hasAggressiveMatch || hasClaudeStoppedMidTask()) {
        analysis.hasUnfinishedTasks = true;
        analysis.confidence = 'low';
        analysis.incompleteSteps.push('Aggressive detection found potential incomplete work');
        analysis.suggestedContinuation = generateContinuationMessage(analysis);
    }
    
    return analysis;
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
        /what\s+(?:should|would|do)\s+you/i,
        /how\s+(?:should|would|do)\s+you\s+(?:want|like|prefer)/i,
        /(?:is|are)\s+(?:this|that|these|those)\s+(?:correct|right|okay|ok)\?/i,
        /(?:let|tell)\s+me\s+know/i,
        /awaiting\s+(?:your)?\s*(?:response|input|feedback|direction)/i,
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
    
    // Get last few lines that have content
    const lines = output.split('\n').filter(line => line.trim());
    if (lines.length === 0) return false;
    
    // Check last 3 lines for incomplete patterns
    const lastFewLines = lines.slice(-3);
    
    // Patterns that suggest incomplete work
    const incompleteSentencePatterns = [
        /[^.!?]\s*$/,  // Doesn't end with punctuation
        /,\s*$/,       // Ends with comma
        /:\s*$/,       // Ends with colon
        /\.\.\.\s*$/,  // Ends with ellipsis
        /^(?:Creating|Updating|Implementing|Adding|Fixing|Writing|Modifying)/i,
        /^(?:Let me|I'll|I'm going to|Now)/i,
        /^(?:Starting|Beginning|Working on|Processing|Analyzing)/i,
        /^\d+\.\s*$/,  // Just a number (like "1." with nothing after)
        /^[-•*]\s*$/,  // Just a bullet with nothing after
        /\band\s*$/i,  // Ends with "and"
        /\bor\s*$/i,   // Ends with "or"
        /\bbut\s*$/i,  // Ends with "but"
        /\bto\s*$/i,   // Ends with "to"
    ];
    
    // Check if any of the last few lines match incomplete patterns
    return lastFewLines.some(line => {
        const trimmedLine = line.trim();
        return incompleteSentencePatterns.some(pattern => pattern.test(trimmedLine));
    });
}