const vscode = acquireVsCodeApi();
let messageQueue = [];
let sessionState = {
    isSessionRunning: false,  // Claude session/process is active
    isProcessing: false,      // Currently processing messages
    wasStopped: false,        // User manually stopped processing
    justStarted: false        // Just clicked start (prevent backend override)
};
let historyData = [];
let draggedIndex = -1;

function addMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) {
        return;
    }

    vscode.postMessage({
        command: 'addMessage',
        text: message
    });

    input.value = '';
}

function startProcessing() {
    console.log('Frontend: User clicked Start Processing');
    const skipPermissions = document.getElementById('skipPermissions').checked;
    sessionState.isProcessing = true;
    sessionState.wasStopped = false; // Reset stopped state when starting
    
    // Mark that we just started processing (to prevent backend override)
    sessionState.justStarted = true;
    setTimeout(() => {
        sessionState.justStarted = false;
    }, 2000); // Clear flag after 2 seconds
    
    updateButtonStates();
    vscode.postMessage({
        command: 'startProcessing',
        skipPermissions: skipPermissions
    });
}

function stopProcessing() {
    console.log('Frontend: User clicked Stop Processing');
    sessionState.isProcessing = false;
    sessionState.wasStopped = true; // Mark that user manually stopped
    updateButtonStates();
    vscode.postMessage({
        command: 'stopProcessing'
    });
}

function clearQueue() {
    vscode.postMessage({
        command: 'clearQueue'
    });
}

function resetSession() {
    sessionState.isSessionRunning = false;
    sessionState.isProcessing = false;
    sessionState.wasStopped = false; // Reset stopped state on session reset
    updateButtonStates();
    vscode.postMessage({
        command: 'resetSession'
    });
}

function clearClaudeOutput() {
    const claudeContainer = document.getElementById('claudeOutputContainer');
    let claudeOutput = claudeContainer.querySelector('.claude-live-output');
    if (claudeOutput) {
        claudeOutput.innerHTML = `
            <div class="claude-ready-message">
                <div class="pulse-dot"></div>
                <span>Output cleared - ready for new Claude output...</span>
            </div>
        `;
    }
}

function updateQueue(queue) {
    messageQueue = queue;
    renderQueue();
    updateButtonStates();
}

function renderQueue() {
    const container = document.getElementById('queueContainer');

    if (messageQueue.length === 0) {
        container.innerHTML = '<div class="empty-queue">No messages in queue</div>';
        return;
    }

    container.innerHTML = messageQueue.map((item, index) => {
        let statusText = item.status;
        let timeText = new Date(item.timestamp).toLocaleString();
        let additionalContent = '';

        if (item.status === 'waiting' && item.waitSeconds > 0) {
            const hours = Math.floor(item.waitSeconds / 3600);
            const minutes = Math.floor((item.waitSeconds % 3600) / 60);
            const seconds = item.waitSeconds % 60;
            statusText = `waiting - ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            additionalContent = `<div class="countdown">Resuming in ${hours}h ${minutes}m ${seconds}s</div>`;
        }

        if (item.status === 'completed' && item.output) {
            additionalContent = `<div class="queue-item-output">${item.output}</div>`;
        }

        if (item.status === 'error' && item.error) {
            additionalContent = `<div class="queue-item-error">Error: ${item.error}</div>`;
        }

        return `
            <div class="queue-item ${item.status}" 
                 draggable="true" 
                 ondragstart="handleDragStart(event, ${index})"
                 ondragover="handleDragOver(event)"
                 ondrop="handleDrop(event, ${index})"
                 data-index="${index}">
                <div class="queue-item-actions">
                    <button class="queue-item-action remove" onclick="removeMessage(${item.id})" title="Remove message">
                        ✕
                    </button>
                </div>
                <div class="queue-item-header">
                    <span class="queue-item-status">${statusText}</span>
                    <span class="queue-item-time">${timeText}</span>
                </div>
                <div class="queue-item-text">${item.text}</div>
                ${additionalContent}
            </div>
        `;
    }).join('');
}

function updateButtonStates() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const resetBtn = document.getElementById('resetBtn');
    const clearBtn = document.getElementById('clearBtn');
    
    console.log('Button State Update:', {
        isSessionRunning: sessionState.isSessionRunning,
        isProcessing: sessionState.isProcessing,
        queueLength: messageQueue.length
    });
    
    // Update start button text and state based on session and queue status
    if (!sessionState.isSessionRunning) {
        startBtn.innerHTML = '<span class="btn-icon">🚀</span>Start Session';
        startBtn.disabled = sessionState.isProcessing;
    } else if (sessionState.wasStopped && !sessionState.isProcessing) {
        // Show "Start Processing" only if user manually stopped processing
        startBtn.innerHTML = '<span class="btn-icon">▶️</span>Start Processing';
        startBtn.disabled = messageQueue.length === 0; // Disable only if no messages
    } else if (sessionState.isProcessing) {
        startBtn.innerHTML = '<span class="btn-icon">▶️</span>Processing...';
        startBtn.disabled = true; // Currently processing
    } else {
        // Session running, not stopped by user - show ready state
        startBtn.innerHTML = '<span class="btn-icon">⏳</span>Session Ready';
        startBtn.disabled = true;
    }
    
    console.log('Start button state:', {
        text: startBtn.innerHTML.replace(/<[^>]*>/g, ''),
        disabled: startBtn.disabled,
        wasStopped: sessionState.wasStopped,
        reason: !sessionState.isSessionRunning ? 'no session' : 
               sessionState.wasStopped ? 'manually stopped' :
               sessionState.isProcessing ? 'processing' : 'session ready'
    });
    
    // Stop button: enabled when processing
    stopBtn.disabled = !sessionState.isProcessing;
    
    // Reset button: enabled when session is running but not processing
    resetBtn.disabled = !sessionState.isSessionRunning || sessionState.isProcessing;
    
    // Clear button: always enabled when queue has messages
    clearBtn.disabled = messageQueue.length === 0;
}

// Queue Management Functions
function removeMessage(messageId) {
    vscode.postMessage({
        command: 'removeMessage',
        messageId: messageId
    });
}

function sortQueue() {
    const field = document.getElementById('sortField').value;
    const direction = document.getElementById('sortDirection').value;
    
    vscode.postMessage({
        command: 'sortQueue',
        field: field,
        direction: direction
    });
}

// Drag and Drop Functions
function handleDragStart(event, index) {
    draggedIndex = index;
    event.dataTransfer.effectAllowed = 'move';
    event.target.style.opacity = '0.5';
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function handleDrop(event, targetIndex) {
    event.preventDefault();
    
    if (draggedIndex !== -1 && draggedIndex !== targetIndex) {
        vscode.postMessage({
            command: 'reorderQueue',
            fromIndex: draggedIndex,
            toIndex: targetIndex
        });
    }
    
    // Reset drag styling
    const draggedElement = document.querySelector(`[data-index="${draggedIndex}"]`);
    if (draggedElement) {
        draggedElement.style.opacity = '1';
    }
    
    draggedIndex = -1;
}

// History Management Functions
function loadHistory() {
    vscode.postMessage({
        command: 'loadHistory'
    });
}

function filterHistory() {
    const filter = document.getElementById('historyFilter').value;
    vscode.postMessage({
        command: 'filterHistory',
        filter: filter
    });
}

function renderHistory(history) {
    const container = document.getElementById('historyContainer');
    
    if (!history || history.length === 0) {
        container.innerHTML = '<div class="empty-history">No previous runs found for this workspace</div>';
        return;
    }
    
    container.innerHTML = history.map(run => {
        const startTime = new Date(run.startTime).toLocaleString();
        const endTime = run.endTime ? new Date(run.endTime).toLocaleString() : 'In Progress';
        const duration = run.endTime ? 
            Math.round((new Date(run.endTime) - new Date(run.startTime)) / 1000 / 60) + ' min' : 
            'Ongoing';
        
        return `
            <div class="history-item">
                <div class="history-item-header">
                    <div class="history-item-title">Run ${run.id.split('_')[1]}</div>
                    <div class="history-item-time">${startTime} (${duration})</div>
                </div>
                <div class="history-item-stats">
                    <div class="history-stat history-stat-total">
                        📊 Total: ${run.totalMessages}
                    </div>
                    <div class="history-stat history-stat-completed">
                        ✅ Completed: ${run.completedMessages}
                    </div>
                    <div class="history-stat history-stat-errors">
                        ❌ Errors: ${run.errorMessages}
                    </div>
                    <div class="history-stat history-stat-waiting">
                        ⏳ Waiting: ${run.waitingMessages}
                    </div>
                </div>
                <div class="history-item-messages">
                    ${run.messages.map(msg => `
                        <div class="history-message">
                            <div class="history-message-text">${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}</div>
                            <div class="history-message-meta">
                                <span class="status-${msg.status}">${msg.status.toUpperCase()}</span>
                                <span>${new Date(msg.timestamp).toLocaleTimeString()}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'updateQueue':
            updateQueue(message.queue);
            break;
        case 'terminalOutput':
            appendToTerminal(message.output);
            break;
        case 'claudeOutput':
            appendToClaudeOutput(message.output);
            break;
        case 'sessionStateChanged':
            console.log('Backend state update:', {
                backendSessionRunning: message.isSessionRunning,
                backendProcessing: message.isProcessing,
                frontendWasStopped: sessionState.wasStopped,
                frontendProcessing: sessionState.isProcessing,
                justStarted: sessionState.justStarted
            });
            
            sessionState.isSessionRunning = message.isSessionRunning;
            
            // If processing finished naturally (backend says processing stopped but user didn't click stop), 
            // reset wasStopped so it goes back to auto-processing mode
            if (sessionState.isProcessing && !message.isProcessing && !sessionState.wasStopped) {
                // Processing finished naturally - keep wasStopped as false
                sessionState.wasStopped = false;
            }
            
            // Don't override wasStopped if user just clicked start and backend hasn't caught up yet
            if (sessionState.wasStopped && message.isProcessing) {
                // User clicked start, backend is now processing - reset wasStopped
                sessionState.wasStopped = false;
            }
            
            // Don't override frontend processing state if user just clicked start
            if (!sessionState.justStarted) {
                sessionState.isProcessing = message.isProcessing;
            } else if (message.isProcessing) {
                // Backend caught up and is processing - good to sync
                sessionState.isProcessing = message.isProcessing;
                sessionState.justStarted = false;
            }
            
            updateButtonStates();
            break;
        case 'historyLoaded':
            historyData = message.history;
            renderHistory(historyData);
            break;
        case 'historyFiltered':
            renderHistory(message.history);
            break;
        case 'queueSorted':
            const sortField = document.getElementById('sortField');
            const sortDirection = document.getElementById('sortDirection');
            sortField.value = message.sortConfig.field;
            sortDirection.value = message.sortConfig.direction;
            break;
    }
});

// Store terminal content separately
let debugTerminalContent = '';

function appendToTerminal(output) {
    const terminalContainer = document.getElementById('terminalContainer');
    let terminalOutput = terminalContainer.querySelector('.terminal-output');

    if (!terminalOutput) {
        terminalOutput = document.createElement('div');
        terminalOutput.className = 'terminal-output';
        terminalContainer.appendChild(terminalOutput);
    }

    // Clear the ready message on first output
    const readyMessage = terminalOutput.querySelector('.terminal-ready-message');
    if (readyMessage) {
        terminalOutput.innerHTML = '';
        debugTerminalContent = '';
    }

    // Filter out Claude output debug messages (🤖 [CLAUDE timestamp])
    if (output.includes('🤖 [CLAUDE') && output.includes(']')) {
        // Skip Claude output messages in terminal section
        return;
    }

    // Add to debug terminal content (this is just debug info, so we append)
    debugTerminalContent += output;

    // Parse ANSI escape codes for terminal output
    const htmlOutput = parseAnsiToHtml(debugTerminalContent);

    // Replace the entire content
    terminalOutput.innerHTML = '';
    const outputElement = document.createElement('div');
    outputElement.style.cssText = 'white-space: pre; word-wrap: break-word; line-height: 1.4; font-family: inherit;';
    outputElement.innerHTML = htmlOutput;
    terminalOutput.appendChild(outputElement);

    // Auto-scroll to bottom
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

// ANSI Color palette for 256-color mode
const ansiColors = {
    // Standard colors (0-15)
    0: '#000000', 1: '#cd0000', 2: '#00cd00', 3: '#cdcd00', 4: '#0000ee', 5: '#cd00cd', 6: '#00cdcd', 7: '#e5e5e5',
    8: '#7f7f7f', 9: '#ff0000', 10: '#00ff00', 11: '#ffff00', 12: '#5c5cff', 13: '#ff00ff', 14: '#00ffff', 15: '#ffffff',
    // More colors including common Claude colors
    52: '#5f0000', 88: '#870000', 124: '#af0000', 160: '#d70000', 196: '#ff0000',
    114: '#87d787', 118: '#87ff00', 148: '#afd700', 154: '#afff00', 190: '#d7ff00',
    174: '#d787af', 175: '#d787d7', 176: '#d787ff', 177: '#d7af5f', 178: '#d7af87',
    179: '#d7afaf', 180: '#d7afd7', 181: '#d7afff', 182: '#d7d75f', 183: '#d7d787',
    184: '#d7d7af', 185: '#d7d7d7', 186: '#d7d7ff', 187: '#d7ff5f', 188: '#d7ff87',
    189: '#d7ffaf', 190: '#d7ffd7', 191: '#d7ffff', 192: '#ff5f5f', 193: '#ff5f87',
    194: '#ff5faf', 195: '#ff5fd7', 196: '#ff5fff', 197: '#ff875f', 198: '#ff8787',
    199: '#ff87af', 200: '#ff87d7', 201: '#ff87ff', 202: '#ffaf5f', 203: '#ffaf87',
    204: '#ffafaf', 205: '#ffafd7', 206: '#ffafff', 207: '#ffd75f', 208: '#ffd787',
    209: '#ffd7af', 210: '#ffd7d7', 211: '#ffd7ff', 212: '#ffff5f', 213: '#ffff87',
    214: '#ffffaf', 215: '#ffffd7', 216: '#ffffff',
    // Claude specific colors
    220: '#ffd700', 231: '#ffffff', 244: '#808080', 246: '#949494',
    // Grays and commonly used colors
    232: '#080808', 233: '#121212', 234: '#1c1c1c', 235: '#262626', 236: '#303030', 237: '#3a3a3a',
    238: '#444444', 239: '#4e4e4e', 240: '#585858', 241: '#626262', 242: '#6c6c6c', 243: '#767676',
    244: '#808080', 245: '#8a8a8a', 246: '#949494', 247: '#9e9e9e', 248: '#a8a8a8', 249: '#b2b2b2',
    250: '#bcbcbc', 251: '#c6c6c6', 252: '#d0d0d0', 253: '#dadada', 254: '#e4e4e4', 255: '#eeeeee'
};

function parseAnsiToHtml(text) {
    // Remove cursor control sequences that don't affect display
    text = text.replace(/\x1b\[\?25[lh]/g, ''); // Show/hide cursor
    text = text.replace(/\x1b\[\?2004[lh]/g, ''); // Bracketed paste mode
    text = text.replace(/\x1b\[\?1004[lh]/g, ''); // Focus reporting
    text = text.replace(/\x1b\[[2-3]J/g, ''); // §
    text = text.replace(/\x1b\[H/g, ''); // Move cursor to home

    // Process the text line by line to handle carriage returns properly
    const lines = text.split('\n');
    const processedLines = [];

    for (let lineText of lines) {
        // Handle carriage returns within the line
        const parts = lineText.split('\r');
        let finalLine = '';

        for (let i = 0; i < parts.length; i++) {
            if (i === parts.length - 1) {
                // Last part - append normally
                finalLine += processAnsiInText(parts[i]);
            } else {
                // Not the last part - this will be overwritten by the next part
                finalLine = processAnsiInText(parts[i]);
            }
        }

        processedLines.push(finalLine);
    }

    return processedLines.join('\n');
}

function processAnsiInText(text) {
    let html = '';
    let currentStyles = {
        color: null,
        bold: false,
        italic: false,
        dim: false,
        reverse: false
    };

    // Split text into parts: text and ANSI escape sequences
    const parts = text.split(/(\x1b\[[0-9;]*m)/);

    for (let part of parts) {
        if (part.startsWith('\x1b[') && part.endsWith('m')) {
            // This is an ANSI color/style code
            const codes = part.slice(2, -1).split(';').filter(c => c !== '').map(Number);

            for (const code of codes) {
                if (code === 0 || code === 39) {
                    // Reset or default foreground color
                    currentStyles.color = null;
                    currentStyles.bold = false;
                    currentStyles.italic = false;
                    currentStyles.dim = false;
                    currentStyles.reverse = false;
                } else if (code === 1) {
                    currentStyles.bold = true;
                } else if (code === 22) {
                    currentStyles.bold = false;
                    currentStyles.dim = false;
                } else if (code === 2) {
                    currentStyles.dim = true;
                } else if (code === 3) {
                    currentStyles.italic = true;
                } else if (code === 23) {
                    currentStyles.italic = false;
                } else if (code === 7) {
                    currentStyles.reverse = true;
                } else if (code === 27) {
                    currentStyles.reverse = false;
                }
            }

            // Handle 256-color mode (38;5;n)
            for (let j = 0; j < codes.length - 2; j++) {
                if (codes[j] === 38 && codes[j + 1] === 5) {
                    const colorCode = codes[j + 2];
                    currentStyles.color = ansiColors[colorCode] || '#ffffff';
                    break;
                }
            }
        } else if (part.length > 0) {
            // This is actual text content
            let style = '';
            if (currentStyles.color) style += `color: ${currentStyles.color};`;
            if (currentStyles.bold) style += 'font-weight: bold;';
            if (currentStyles.italic) style += 'font-style: italic;';
            if (currentStyles.dim) style += 'opacity: 0.6;';
            if (currentStyles.reverse) style += 'background-color: #ffffff; color: #000000;';

            // Escape HTML characters
            const escapedText = part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            if (style) {
                html += `<span style="${style}">${escapedText}</span>`;
            } else {
                html += escapedText;
            }
        }
    }

    return html;
}

// Store Claude output content 
let claudeContent = '';

function appendToClaudeOutput(output) {
    const claudeContainer = document.getElementById('claudeOutputContainer');
    let claudeOutput = claudeContainer.querySelector('.claude-live-output');

    if (!claudeOutput) {
        claudeOutput = document.createElement('div');
        claudeOutput.className = 'claude-live-output';
        claudeContainer.appendChild(claudeOutput);
    }

    // Clear the ready message on first output
    const readyMessage = claudeOutput.querySelector('.claude-ready-message');
    if (readyMessage) {
        claudeOutput.innerHTML = '';
        claudeContent = '';
    }

    // Check if this output contains screen clearing commands
    if (output.includes('\x1b[2J') || output.includes('\x1b[3J') || output.includes('\x1b[H')) {
        // Only clear when we receive actual clear screen ANSI codes
        claudeContent = '';
        claudeOutput.innerHTML = '';
    }

    // Add new output to Claude content
    claudeContent += output;

    // Parse ANSI escape codes and convert to HTML
    const htmlOutput = parseAnsiToHtml(claudeContent);

    // Replace the content with the accumulated output
    claudeOutput.innerHTML = '';
    const outputElement = document.createElement('div');
    outputElement.style.cssText = 'white-space: pre; word-wrap: break-word; line-height: 1.4; font-family: inherit;';
    outputElement.innerHTML = htmlOutput;
    claudeOutput.appendChild(outputElement);

    // Auto-scroll to bottom
    claudeOutput.scrollTop = claudeOutput.scrollHeight;

    // Highlight the Claude output section briefly with new colors
    claudeOutput.style.borderColor = '#00ff88';
    claudeOutput.style.boxShadow = '0 0 20px rgba(0, 255, 136, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    setTimeout(() => {
        claudeOutput.style.borderColor = '#4a9eff';
        claudeOutput.style.boxShadow = '0 0 20px rgba(74, 158, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
    }, 800);
}

// Handle Enter key in textarea
document.getElementById('messageInput').addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && event.ctrlKey) {
        addMessage();
    }
});

// Handle keyboard navigation in Claude output area
document.addEventListener('DOMContentLoaded', function () {
    const claudeOutput = document.getElementById('claudeOutputContainer');

    // Make the Claude output area focusable
    claudeOutput.addEventListener('click', function () {
        const outputElement = claudeOutput.querySelector('.claude-live-output');
        if (outputElement) {
            outputElement.focus();
        }
    });

    // Handle keyboard navigation when Claude output is focused
    claudeOutput.addEventListener('keydown', function (event) {
        const outputElement = claudeOutput.querySelector('.claude-live-output');
        if (!outputElement || document.activeElement !== outputElement) {
            return;
        }

        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                // Send up arrow to Claude
                vscode.postMessage({
                    command: 'claudeKeypress',
                    key: 'up'
                });
                break;
            case 'ArrowDown':
                event.preventDefault();
                // Send down arrow to Claude
                vscode.postMessage({
                    command: 'claudeKeypress',
                    key: 'down'
                });
                break;
            case 'ArrowLeft':
                event.preventDefault();
                // Send left arrow to Claude
                vscode.postMessage({
                    command: 'claudeKeypress',
                    key: 'left'
                });
                break;
            case 'ArrowRight':
                event.preventDefault();
                // Send right arrow to Claude
                vscode.postMessage({
                    command: 'claudeKeypress',
                    key: 'right'
                });
                break;
            case 'Enter':
                event.preventDefault();
                // Send enter to Claude
                vscode.postMessage({
                    command: 'claudeKeypress',
                    key: 'enter'
                });
                break;
            case 'Escape':
                event.preventDefault();
                // Send escape to Claude
                vscode.postMessage({
                    command: 'claudeKeypress',
                    key: 'escape'
                });
                break;
        }
    });
    
    // Initialize button states and load history
    updateButtonStates();
    loadHistory();
});