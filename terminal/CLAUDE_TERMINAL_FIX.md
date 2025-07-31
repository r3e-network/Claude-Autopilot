# Claude Terminal Connection Issue Analysis

## Problem
The terminal tool cannot connect to Claude Code CLI because:

1. **Claude Code CLI v1.0.64 uses a rich TUI interface** with boxes, colors, and interactive prompts
2. **The terminal tool expects plain text responses** like "Claude>" or simple output
3. **Claude Code shows a multi-line input box** that doesn't match the expected patterns

## Current Claude Code Behavior
When spawned, Claude Code shows:
```
╭───────────────────────────────────────────────────╮
│ ✻ Welcome to Claude Code!                         │
│                                                   │
│   /help for help, /status for your current setup │
│                                                   │
│   cwd: /home/neo/git/Claude-Autopilot/terminal   │
╰───────────────────────────────────────────────────╯

╭──────────────────────────────────────────────────────────────────────────────╮
│ > [cursor]                                                                   │
╰──────────────────────────────────────────────────────────────────────────────╯
  ? for shortcuts                                        Bypassing Permissions
```

## Why It Fails
1. The terminal tool waits for the message to be "echoed" but Claude shows it in a box
2. Response completion detection looks for patterns like `\n>` but Claude uses box drawing
3. The rich UI uses ANSI escape codes that interfere with text matching

## Solutions

### Option 1: Use Claude Code in Plain Mode (if available)
Check if Claude Code has a plain text mode or API mode:
```bash
claude --help | grep -i "plain\|text\|api"
```

### Option 2: Update Terminal Tool for Rich UI
The terminal tool needs to:
1. Parse the box-drawing UI to extract actual messages
2. Detect when Claude is ready by looking for the input box pattern
3. Handle multi-line responses within boxes

### Option 3: Use VS Code Extension Approach
The VS Code extension works because it uses a Python PTY wrapper that might handle the rich UI better.

### Temporary Workaround
For now, use the VS Code extension instead of the terminal tool, as it properly handles Claude Code's interface.

## Next Steps
1. Check if Claude Code has a plain text mode
2. If not, the terminal tool needs significant updates to parse the rich UI
3. Consider using the same Python PTY wrapper approach as VS Code extension