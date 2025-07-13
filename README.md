# ClaudeLoop - Automated Claude Code Task Management

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-brightgreen)](https://marketplace.visualstudio.com/items?itemName=benbasha.claude-loop)
[![Version](https://img.shields.io/badge/version-0.0.1--alpha-blue)](https://github.com/benbasha/claudeloop/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**ClaudeLoop** is a powerful VS Code extension that provides automated task management for Claude Code with intelligent queue processing and auto-resume functionality.

## ✨ Features

### 🚀 **Automated Queue Processing**
- **Smart Queue Management**: Process multiple Claude Code tasks automatically with intelligent queueing
- **Auto-Resume**: Automatically resume processing when Claude usage limits reset
- **Batch Processing**: Handle large workloads efficiently with batched message processing
- **Queue Operations**: Add, remove, duplicate, edit, and reorder messages in the queue

### 🔧 **Robust Process Management**
- **Dependency Checking**: Automatic detection and validation of Claude Code and Python dependencies
- **Cross-Platform Support**: Works seamlessly on Windows, macOS, and Linux
- **Error Recovery**: Comprehensive error handling with automatic retry mechanisms
- **Health Monitoring**: Continuous monitoring of Claude Code process health

### ⚙️ **Advanced Configuration**
- **Extensive Settings**: Fine-tune every aspect of ClaudeLoop behavior
- **Configuration Validation**: Built-in validation with helpful error messages
- **Development Mode**: Special features and debugging tools for developers
- **Sleep Prevention**: Keep your computer awake during long processing sessions

### 📊 **Rich User Interface**
- **Interactive Webview**: Intuitive interface for managing queues and monitoring progress
- **Real-time Updates**: Live status updates and progress tracking
- **History Browser**: Browse and filter previous processing runs
- **Command Palette**: Quick access to all ClaudeLoop commands

## 🚀 Quick Start

### Prerequisites

1. **Claude Code**: Install Claude Code from [https://www.anthropic.com/claude-code](https://www.anthropic.com/claude-code)
2. **Python 3.8+**: Required for process management
3. **VS Code 1.74.0+**: Compatible with recent VS Code versions

### Installation

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=benbasha.claude-loop)
2. Or install via command palette: `Extensions: Install Extensions` → Search "ClaudeLoop"
3. Or install from VSIX: `code --install-extension claude-loop-0.0.1.vsix`

### Basic Usage

1. **Start ClaudeLoop**: Open Command Palette (`Cmd/Ctrl+Shift+P`) → `Claude: Start ClaudeLoop`
2. **Add Messages**: Click "Add Message" or use `Claude: Add Message to Queue`
3. **Start Processing**: Click "Start Processing" to begin automated queue processing
4. **Monitor Progress**: Watch real-time updates in the ClaudeLoop panel

## 📋 Commands

| Command | Description |
|---------|-------------|
| `Claude: Start ClaudeLoop` | Start the ClaudeLoop interface and session |
| `Claude: Stop ClaudeLoop` | Stop ClaudeLoop and close the session |
| `Claude: Add Message to Queue` | Add a new message to the processing queue |

## ⚙️ Configuration

ClaudeLoop offers extensive configuration options. Access settings via `File → Preferences → Settings → Extensions → ClaudeLoop`.

### Queue Management
```json
{
  "claudeLoop.queue.autoMaintenance": true
}
```

### Session Management
```json
{
  "claudeLoop.session.autoStart": false,
  "claudeLoop.session.skipPermissions": true,
  "claudeLoop.session.healthCheckInterval": 30000
}
```

### Sleep Prevention
```json
{
  "claudeLoop.sleepPrevention.enabled": true,
  "claudeLoop.sleepPrevention.method": "auto"
}
```

### History & Logging
```json
{
  "claudeLoop.history.maxRuns": 20,
  "claudeLoop.history.autoSave": true,
  "claudeLoop.logging.enabled": false,
  "claudeLoop.logging.level": "info"
}
```

## 🏗️ Architecture

ClaudeLoop follows a modular architecture with clear separation of concerns:

```
src/
├── core/           # Core state, types, and configuration
├── claude/         # Claude CLI integration and communication
├── queue/          # Queue management and processing
├── services/       # External services (health, sleep, dependencies)
├── ui/             # User interface and webview management
└── utils/          # Shared utilities and logging
```

### Key Components

- **Queue Manager**: Handles message queueing, processing, and operations
- **Claude Integration**: Manages Claude Code process and communication
- **Dependency Checker**: Validates and manages required dependencies
- **Configuration System**: Comprehensive settings with validation

## 🔒 Security & Privacy

- **Local Processing**: All processing happens locally on your machine
- **No Data Collection**: ClaudeLoop doesn't collect or transmit personal data
- **Secure Dependencies**: Validates Claude Code and Python installations
- **Permission Awareness**: Uses `--dangerously-skip-permissions` only in trusted environments

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/benbasha/claudeloop.git
cd claudeloop

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Start watch mode for development
npm run watch

# Package for distribution
vsce package
```

### Development Mode

Enable development mode for additional debugging features:

```json
{
  "claudeLoop.developmentMode": true
}
```

This enables:
- Debug logging and diagnostics
- Configuration validation tools
- Advanced queue operations

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code style and conventions
- Testing requirements
- Pull request process
- Issue reporting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues & Troubleshooting

### Common Issues

**Claude Code Not Found**
- Ensure Claude Code is installed and in your PATH
- Restart VS Code after installing Claude Code
- Check dependency status in ClaudeLoop panel

**Python Not Found**
- Install Python 3.8 or later
- Ensure Python is in your PATH
- On Windows, check "Add Python to PATH" during installation

**Permission Errors**
- ClaudeLoop uses `--dangerously-skip-permissions` for automation
- Only use in trusted development environments
- Disable if working with sensitive data

### Getting Help

- 💬 [Discussions](https://github.com/benbasha/claudeloop/discussions)
- 📖 [Documentation](https://github.com/benbasha/claudeloop/wiki)

## 📈 Changelog

### Version 0.0.1-alpha (Latest)
- 🎉 Initial alpha release with Claude Code automation
- ✅ Complete architectural refactor from monolithic to modular design
- ✅ Implemented robust dependency checking and validation
- ✅ Added extensive configuration system with validation
- ✅ Enhanced error handling and recovery mechanisms
- ✅ Cross-platform compatibility improvements
- ✅ Production-ready code with development mode features
- ⚡ Queue processing and auto-resume functionality
- 💤 Sleep prevention during processing
- 📊 Basic history tracking

---

**Made with ❤️ for the Claude Code community**

*ClaudeLoop is not affiliated with Anthropic or Claude AI. Claude Code is a product of Anthropic.*