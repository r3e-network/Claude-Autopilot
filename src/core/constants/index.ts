export const TIMEOUT_MS = 60 * 60 * 60 * 1000; // 1 hour
export const HEALTH_CHECK_INTERVAL_MS = 30000; // Check Claude process health every 30 seconds
export const CLAUDE_OUTPUT_THROTTLE_MS = 1000; // 1000ms = 1 time per second max (prevent UI freezing)
export const CLAUDE_OUTPUT_AUTO_CLEAR_MS = 30000; // 30 seconds - auto clear output buffer
export const CLAUDE_OUTPUT_MAX_BUFFER_SIZE = 100000; // 100KB max buffer size

export const ANSI_CLEAR_SCREEN_PATTERNS = [
    '\x1b[2J',           // Clear entire screen
    '\x1b[H\x1b[2J',     // Move cursor to home + clear screen
    '\x1b[2J\x1b[H',     // Clear screen + move cursor to home
    '\x1b[1;1H\x1b[2J',  // Move cursor to 1,1 + clear screen
    '\x1b[2J\x1b[1;1H'   // Clear screen + move cursor to 1,1
];