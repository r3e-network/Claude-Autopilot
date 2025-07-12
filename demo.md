# ClaudeLoop Extension Demo

This guide shows how to use the ClaudeLoop VS Code extension.

## Quick Start

1. **Install the Extension**

    - Open VS Code
    - Press `F5` to run the extension in development mode
    - A new Extension Development Host window will open

2. **Start the Extension**

    - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
    - Type "Claude: Start ClaudeLoop"
    - Select the command to open the extension panel

3. **Add Messages to Queue**

    - In the extension panel, enter your message in the text area
    - Click "Add Message" or press `Ctrl+Enter`
    - Add multiple messages to create a queue

4. **Configure Output Display**
    - Use the "Settings" section to control where outputs are shown:
      - ✅ "Show outputs in terminal" - Display in VS Code terminal (default)
      - ⬜ "Show outputs in interface" - Display directly in the webview
    - Both options can be enabled for maximum visibility

5. **Start Processing**
    - Click "Start Processing" to begin
    - The extension will process messages one by one
    - If usage limits are reached, it will automatically wait and resume

## Example Usage Scenarios

### Scenario 1: Code Review Queue

```
Message 1: "Review this JavaScript function for security issues: function validateUser(input) { eval(input); }"
Message 2: "Suggest improvements for this React component's performance"
Message 3: "Explain the SOLID principles with examples"
```

### Scenario 2: Documentation Generation

```
Message 1: "Generate JSDoc comments for this function: function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }"
Message 2: "Create a README file structure for a React TypeScript project"
Message 3: "Write API documentation for a REST endpoint that handles user authentication"
```

### Scenario 3: Learning and Research

```
Message 1: "Explain the difference between TypeScript interfaces and types"
Message 2: "What are the best practices for error handling in Node.js?"
Message 3: "How does the V8 garbage collector work?"
```

## Features in Action

### Auto-Resume Functionality

When Claude usage limits are reached:

-   ⏱️ **Automatic Detection**: Extension detects usage limit messages
-   🕐 **Countdown Timer**: Shows real-time countdown until resumption
-   🔄 **Automatic Resumption**: Continues processing when limits are lifted
-   🌐 **Network Checks**: Verifies connectivity before resuming

### Status Indicators

-   🟡 **Yellow**: Pending messages waiting to be processed
-   🔵 **Blue**: Currently processing
-   🟢 **Green**: Completed successfully
-   🔴 **Red**: Error occurred
-   🟠 **Orange**: Waiting for usage limit to reset

### Output Display Options

-   **Terminal Integration**: Optional display in dedicated VS Code terminal
-   **Webview Integration**: Optional display directly in the extension interface
-   **Dual Display**: Enable both options for comprehensive output viewing
-   **User Control**: Toggle options on/off as needed during operation

## Commands Available

### From Command Palette

-   `Claude: Start ClaudeLoop` - Open main interface
-   `Claude: Stop ClaudeLoop` - Stop processing and close
-   `Claude: Add Message to Queue` - Quick message input

### From Extension Panel

-   **Add Message** - Add message to queue
-   **Start Processing** - Begin processing queue
-   **Stop Processing** - Stop current processing
-   **Clear Queue** - Remove all messages

### Settings Controls

-   **Show outputs in terminal** - Toggle terminal output display
-   **Show outputs in interface** - Toggle webview output display

## Tips for Best Results

1. **Message Quality**: Write clear, specific messages for better responses
2. **Queue Management**: Use the queue to batch similar tasks
3. **Output Display**: Choose your preferred output method:
   - Enable terminal output for external reference and copy/paste
   - Enable webview output for integrated viewing and scrollable history
   - Use both options for maximum accessibility
4. **Network Stability**: Ensure stable internet connection for best results
5. **Error Handling**: Check error messages if processing fails
6. **Resource Management**: Use "Stop Processing" to pause when needed

## Troubleshooting

### Common Issues

1. **"Claude CLI not found"**

    - Install Claude CLI following instructions at https://claude.ai/code
    - Ensure `claude` command is in your system PATH

2. **"Network connectivity failed"**

    - Check internet connection
    - Try again after network issues are resolved

3. **"Operation timed out"**
    - Claude service may be slow
    - Try again in a few minutes

### Debug Information

-   Check VS Code Developer Console for detailed logs
-   Help → Toggle Developer Tools → Console tab

## Security Note

⚠️ **Important**: This extension uses `--dangerously-skip-permissions` flag for automated processing. Only use in trusted environments where you understand the security implications.

## Next Steps

-   Try the example scenarios above
-   Experiment with different types of messages
-   Use the queue feature for batch processing
-   Monitor the auto-resume functionality during peak usage times
