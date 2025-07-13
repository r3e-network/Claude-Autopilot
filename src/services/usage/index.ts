import * as vscode from 'vscode';
import { MessageItem } from '../../core/types';
import { messageQueue, processingQueue, resumeTimer, countdownInterval, setProcessingQueue, setResumeTimer, setCountdownInterval } from '../../core/state';
import { debugLog } from '../../utils/logging';
import { updateWebviewContent } from '../../ui/webview';

export function isCurrentUsageLimit(output: string): boolean {
    try {
        const usageLimitPattern = /(Claude\s+)?usage\s+limit\s+reached[^.]*reset\s+at\s+(\d{1,2}[:\d]*(?:\s*[APM]{2})?(?:\s*\([^)]+\))?)/gi;
        const matches = [];
        let match;
        
        while ((match = usageLimitPattern.exec(output)) !== null) {
            matches.push({
                fullMatch: match[0],
                resetTime: match[2],
                index: match.index
            });
        }
        
        if (matches.length === 0) {
            debugLog('⚠️ No usage limit with reset time found in output');
            return false;
        }
        
        const lastMatch = matches[matches.length - 1];
        const resetTime = lastMatch.resetTime;
        
        debugLog(`🕐 Found ${matches.length} usage limit occurrence(s), checking last one: "${lastMatch.fullMatch}"`);
        debugLog(`⏰ Reset time from last occurrence: "${resetTime}"`);
        
        const now = new Date();
        const resetDate = parseResetTime(resetTime, now);
        
        if (!resetDate) {
            debugLog('❌ Could not parse reset time, treating as current limit');
            return true;
        }
        
        const timeDiffMs = resetDate.getTime() - now.getTime();
        const timeDiffHours = timeDiffMs / (1000 * 60 * 60);
        
        debugLog(`⏱️ Time until reset: ${timeDiffHours.toFixed(2)} hours`);
        
        const isWithin6Hours = timeDiffMs > 0 && timeDiffHours <= 6;
        
        debugLog(`✅ Is within 6-hour window: ${isWithin6Hours}`);
        return isWithin6Hours;
        
    } catch (error) {
        debugLog(`❌ Error checking usage limit timing: ${error}`);
        return true;
    }
}

function parseResetTime(resetTime: string, referenceTime: Date): Date | null {
    try {
        const cleanTime = resetTime.replace(/\s*\([^)]+\)/, '').trim();
        const [timePart, ampm] = cleanTime.split(' ');
        
        let hours: number, minutes: number;
        if (timePart.includes(':')) {
            [hours, minutes] = timePart.split(':').map(Number);
        } else {
            hours = parseInt(timePart.replace(/[^\d]/g, ''));
            minutes = 0;
        }
        
        const resetDate = new Date(referenceTime);
        let resetHours = hours;
        
        if (ampm || /[ap]m/i.test(timePart)) {
            const isPM = /pm/i.test(ampm || timePart);
            const isAM = /am/i.test(ampm || timePart);
            
            if (isPM && hours !== 12) {
                resetHours = hours + 12;
            } else if (isAM && hours === 12) {
                resetHours = 0;
            }
        }
        
        resetDate.setHours(resetHours, minutes, 0, 0);
        
        if (resetDate <= referenceTime) {
            resetDate.setDate(resetDate.getDate() + 1);
        }
        
        return resetDate;
    } catch (error) {
        debugLog(`❌ Error parsing reset time "${resetTime}": ${error}`);
        return null;
    }
}

function calculateWaitTime(resetTime: string): number {
    if (resetTime === 'unknown time') {
        return 60;
    }
    
    try {
        const now = new Date();
        const resetDate = parseResetTime(resetTime, now);
        
        if (!resetDate) {
            debugLog('❌ Could not parse reset time for wait calculation');
            return 60;
        }
        
        const waitMs = resetDate.getTime() - now.getTime();
        return Math.max(1, Math.ceil(waitMs / (1000 * 60)));
    } catch (error) {
        return 60;
    }
}

export function handleUsageLimit(output: string, message: MessageItem): void {
    const resetTimeMatch = output.match(/reset at (\d{1,2}[:\d]*(?:\s*[APM]{2})?(?:\s*\([^)]+\))?)/i);
    const resetTime = resetTimeMatch ? resetTimeMatch[1] : 'unknown time';
    
    setProcessingQueue(false);
    
    message.status = 'completed';
    message.completedAt = new Date().toISOString();
    message.output = 'Completed but hit usage limit';
    
    const existingContinue = messageQueue.find(msg => msg.text === 'continue' && msg.status === 'waiting');
    if (existingContinue) {
        debugLog('⚠️ Continue message already exists - not adding duplicate');
        return;
    }
    
    const currentMessageIndex = messageQueue.findIndex(msg => msg.id === message.id);
    
    const continueMessage: MessageItem = {
        id: Date.now() + 1,
        text: 'continue',
        timestamp: new Date().toISOString(),
        status: 'waiting',
        error: `Usage limit reached - will resume at ${resetTime}`,
        waitUntil: Date.now() + (calculateWaitTime(resetTime) * 60 * 1000)
    };
    
    if (currentMessageIndex >= 0) {
        messageQueue.splice(currentMessageIndex + 1, 0, continueMessage);
    } else {
        messageQueue.push(continueMessage);
    }
    
    updateWebviewContent();
    
    const waitMinutes = calculateWaitTime(resetTime);
    const waitSeconds = waitMinutes * 60;
    
    vscode.window.showWarningMessage(`Claude usage limit reached. Added "continue" message to queue. Will automatically resume processing at ${resetTime} (${waitMinutes} minutes)`);
    
    startCountdownTimer(continueMessage, waitSeconds);
}

function startCountdownTimer(message: MessageItem, waitSeconds: number): void {
    if (resumeTimer) {
        clearTimeout(resumeTimer);
        setResumeTimer(null);
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        setCountdownInterval(null);
    }
    
    let remainingSeconds = waitSeconds;
    
    message.waitUntil = Date.now() + (remainingSeconds * 1000);
    
    const interval = setInterval(() => {
        remainingSeconds--;
        message.waitSeconds = remainingSeconds;
        
        const timeLeft = Math.max(0, Math.floor((message.waitUntil! - Date.now()) / 1000));
        if (timeLeft !== remainingSeconds) {
            remainingSeconds = timeLeft;
            message.waitSeconds = remainingSeconds;
        }
        
        updateWebviewContent();

        if (remainingSeconds <= 0) {
            if (countdownInterval) {
                clearInterval(countdownInterval);
                setCountdownInterval(null);
            }
            
            resumeProcessingFromWait(message);
        }
    }, 1000);
    
    setCountdownInterval(interval);

    const timer = setTimeout(() => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            setCountdownInterval(null);
        }
        resumeProcessingFromWait(message);
    }, remainingSeconds * 1000);
    
    setResumeTimer(timer);
}

function resumeProcessingFromWait(message: MessageItem): void {
    message.status = 'pending';
    message.error = undefined;
    message.waitSeconds = undefined;
    message.waitUntil = undefined;
    updateWebviewContent();
    
    debugLog(`🔄 Resumed processing from wait - message ${message.id} status updated`);
    
    vscode.window.showInformationMessage('Usage limit has reset. Resuming processing with "continue" message...');
    
    if (!processingQueue) {
        setProcessingQueue(true);
        setTimeout(() => {
            // processNextMessage(); // This would need to be imported
        }, 2000);
    }
}

export function recoverWaitingMessages(): void {
    const now = Date.now();
    
    messageQueue.forEach(message => {
        if (message.status === 'waiting' && message.waitUntil) {
            const timeLeft = Math.max(0, Math.floor((message.waitUntil - now) / 1000));
            
            if (timeLeft <= 0) {
                debugLog(`⏰ Timer expired for message ${message.id} - resuming immediately`);
                resumeProcessingFromWait(message);
            } else {
                debugLog(`⏰ Recovering timer for message ${message.id} - ${timeLeft} seconds remaining`);
                message.waitSeconds = timeLeft;
                startCountdownTimer(message, timeLeft);
            }
        }
    });
}