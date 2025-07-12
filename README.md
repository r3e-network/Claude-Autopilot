# ClaudeLoop VS Code Extension

Automatically resume Claude CLI tasks when usage limits are reached. This extension provides a user-friendly interface for managing Claude CLI command queues with intelligent auto-resume functionality.

## Features

-   **Message Queue Management**: Add multiple messages to a queue for sequential processing
-   **Auto-Resume**: Automatically detects Claude usage limits and resumes tasks when limits are lifted
-   **Real-time Status Updates**: Live countdown timer showing when tasks will resume
-   **Flexible Output Display**: Choose to show outputs in VS Code terminal, webview interface, or both
-   **Network Connectivity Checks**: Ensures stable connection before processing
-   **Error Handling**: Comprehensive error handling with user-friendly messages

## Prerequisites

-   VS Code 1.74.0 or higher
-   Claude CLI installed and configured
-   Node.js (for development)

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`)
3. Search for "ClaudeLoop"
4. Click "Install"

### From VSIX Package

1. Download the `.vsix` file from the releases page
2. Open VS Code
3. Go to Extensions view
4. Click "..." menu → "Install from VSIX..."
5. Select the downloaded `.vsix` file

### From Source

1. Clone or download this repository
2. Open the project in VS Code
3. Run `npm install` to install dependencies
4. Press `F5` to launch the extension in a new Extension Development Host window

### Installing Claude CLI

Make sure you have Claude CLI installed:

```bash
# Follow instructions at https://claude.ai/code
```

## Usage

### Starting the Extension

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Type "Claude: Start ClaudeLoop"
3. The extension will open a new webview panel

### Adding Messages to Queue

1. In the webview panel, enter your message in the text area
2. Click "Add Message" or press `Ctrl+Enter`
3. Messages will appear in the queue below

### Processing Messages

1. Click "Start Processing" to begin processing the queue
2. The extension will:
    - Check network connectivity
    - Verify Claude CLI is available
    - Process messages one by one
    - Handle usage limits automatically
    - Display results in the terminal

### Auto-Resume Functionality

When Claude usage limits are reached:

-   The extension detects the limit automatically
-   Shows a countdown timer until the limit resets
-   Automatically resumes processing when the limit is lifted
-   Displays progress in real-time

### Output Display Options

Control where Claude responses are shown:

-   **Show outputs in terminal** (default: enabled): Displays responses in VS Code terminal
-   **Show outputs in interface** (default: disabled): Shows responses directly in the webview
-   Both options can be enabled simultaneously for maximum visibility
-   Settings are preserved during the session

### Commands

-   `Claude: Start ClaudeLoop` - Open the main interface
-   `Claude: Stop ClaudeLoop` - Stop all processing and close interface
-   `Claude: Add Message to Queue` - Quick add a message via input box

## Interface Elements

### Status Colors

-   **Yellow**: Pending messages waiting to be processed
-   **Blue**: Currently processing
-   **Green**: Completed successfully
-   **Red**: Error occurred
-   **Orange**: Waiting for usage limit to reset

### Controls

-   **Add Message**: Add new message to queue
-   **Start Processing**: Begin processing pending messages
-   **Stop Processing**: Stop current processing
-   **Clear Queue**: Remove all messages from queue

### Settings

-   **Show outputs in terminal**: Toggle display of outputs in VS Code terminal
-   **Show outputs in interface**: Toggle display of outputs in the webview interface

## Configuration

The extension works with Claude CLI's default configuration. Make sure Claude CLI is properly authenticated and accessible from your terminal.

## Troubleshooting

### Common Issues

1. **Claude CLI not found**

    - Ensure Claude CLI is installed and in your PATH
    - Try running `claude --help` in terminal

2. **Network connectivity issues**

    - Check your internet connection
    - The extension tests connectivity before processing

3. **Permission errors**
    - The extension uses `--dangerously-skip-permissions` flag
    - Only use in trusted environments

### Debug Mode

Enable debug logging by checking the VS Code Developer Console:

1. Help → Toggle Developer Tools
2. Check Console tab for extension logs

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package extension (requires vsce)
npm install -g vsce
vsce package
```

### Project Structure

```
├── src/
│   ├── extension.ts          # Main extension logic
│   └── webview.html          # UI interface
├── out/
│   └── extension.js          # Compiled JavaScript
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## Security Considerations

⚠️ **Important**: This extension uses Claude CLI's `--dangerously-skip-permissions` flag for automated processing. Only use this extension in trusted environments where you understand the security implications.

## License

This project is provided as-is for educational and productivity purposes.

## Contributing

Feel free to submit issues and pull requests to improve the extension.

## Support

For issues related to:

-   Claude CLI: Visit https://claude.ai/code
-   VS Code Extension Development: Visit https://code.visualstudio.com/api
