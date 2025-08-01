# Session Termination Fix Summary

## Problem
The plugin could stop a session while tasks were still actively working due to:
1. Inaccurate tracking of active messages
2. Race conditions in the session timeout mechanism
3. No protection against shutdown while tasks are processing

## Root Causes
1. **Session Timeout Race Condition** (session.ts:602): The session would timeout after 10 minutes even if messages were being processed
2. **Inaccurate Active Message Tracking**: The `activeMessageCount` could become inaccurate if messages failed or cleanup happened out of order
3. **No Graceful Shutdown**: Terminal mode didn't check for active tasks before shutting down

## Fixes Implemented

### 1. Enhanced Session Activity Tracking (session.ts)
- Added `lastMessageStartTime` to track when message processing started
- Added `messageTimeouts` Set to properly track and cleanup message timeouts
- Improved timeout check to consider:
  - Active message count
  - Processing flag
  - Recent message starts (5-minute grace period)
- Better cleanup of message tracking state

### 2. Task Tracking in Terminal Mode (terminalMode.ts)
- Added `activeTasks` Set to track all active tasks by ID
- Added `taskProcessingStartTime` to track when processing started
- Tasks are properly added/removed from active set
- Shutdown now:
  - Checks for active tasks
  - Warns user about active tasks
  - Waits up to 30 seconds for completion

### 3. Improved isActivelyProcessing() Method
- Now considers multiple factors:
  - Active message count
  - Processing flag
  - Recent message activity (within 5 minutes)
- Prevents false negatives that could lead to premature termination

## Testing
The changes have been compiled successfully with TypeScript and the system is ready for testing.

## Impact
These changes ensure that:
- Sessions won't be terminated while tasks are actively processing
- Users get warnings if they try to shut down with active tasks
- Better resilience against race conditions and edge cases