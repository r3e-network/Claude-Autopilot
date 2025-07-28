# AutoClaude - Intelligent Development Automation

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-brightgreen)](https://marketplace.visualstudio.com/items?itemName=r3e.autoclaude)
[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/r3e-network/AutoClaude/releases/tag/v2.0.0)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**AutoClaude** lets you run Claude Code while you sleep, eat, or play with your kids. Set up your tasks, hit start, and come back to completed work. This powerful VS Code extension provides fully automated Claude Code task management with intelligent queue processing and auto-resume functionality.

<div align="center">
  <img src="img/autoclaude.png" alt="AutoClaude Interface" width="600">
</div>

> 💤 **"Queue up 100 tasks Friday evening, wake up Monday with everything done"**

## ✨ Features

### 🚀 **24/7 Automated Processing**

-   **Set It and Forget It**: Queue hundreds of tasks and let AutoClaude work autonomously
-   **Auto-Resume**: Automatically resume processing when Claude usage limits reset - no manual intervention needed
-   **Sleep Prevention**: Keeps your computer awake during processing so work continues overnight
-   **Smart Queue Management**: Process multiple Claude Code tasks automatically with intelligent queueing
-   **Batch Processing**: Handle large workloads efficiently - perfect for weekend or overnight runs

### 🔧 **Robust Process Management**

-   **Dependency Checking**: Automatic detection and validation of Claude Code and Python dependencies
-   **Cross-Platform Support**: Works seamlessly on Windows, macOS, and Linux
-   **IDE Compatibility**: Full support for VS Code and Cursor
-   **Error Recovery**: Comprehensive error handling with automatic retry mechanisms
-   **Health Monitoring**: Continuous monitoring of Claude Code process health

### ⚙️ **Advanced Configuration**

-   **Extensive Settings**: Fine-tune every aspect of AutoClaude behavior
-   **Configuration Validation**: Built-in validation with helpful error messages
-   **Development Mode**: Special features and debugging tools for developers
-   **Sleep Prevention**: Keep your computer awake during long processing sessions

### 🔍 **Script Runner & Quality Checks**

-   **Automated Code Quality Checks**: Run predefined and custom scripts to ensure code quality
-   **Production Readiness Check**: Automatically detect TODOs, FIXMEs, placeholders, and incomplete implementations
-   **Multi-Language Support**: Built-in checks for JavaScript, TypeScript, Go, C++, Rust, C#, Java
-   **Build & Test Verification**: Ensure your project builds and all tests pass
-   **Format Checking**: Verify code formatting standards are met
-   **GitHub Actions Validation**: Check your CI/CD workflows for errors
-   **Fix Loop**: Automatically ask Claude to fix issues and re-run checks until all pass
-   **Message Loop**: Run individual messages in a loop with script checks until they pass
-   **Custom Scripts**: Add your own validation scripts in the `.autoclaude` folder

### 📊 **Rich User Interface**

-   **Interactive Webview**: Intuitive interface for managing queues and monitoring progress
-   **Real-time Updates**: Live status updates and progress tracking
-   **History Browser**: Browse and filter previous processing runs
-   **Command Palette**: Quick access to all AutoClaude commands

## 🚀 Quick Start

### Prerequisites

1. **Claude Code**: Install Claude Code from [https://www.anthropic.com/claude-code](https://www.anthropic.com/claude-code)
2. **Python 3.8+**: Required for process management
3. **VS Code 1.74.0+** or **Cursor**: Compatible with VS Code and Cursor

### Installation

1. Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=r3e.autoclaude)
2. Or install via command palette: `Extensions: Install Extensions` → Search "AutoClaude"
3. Or install from VSIX: `code --install-extension autoclaude-1.0.2.vsix`
4. **Cursor**: AutoClaude works seamlessly in Cursor with the same installation process

### Basic Usage

1. **Start AutoClaude**: Open Command Palette (`Cmd/Ctrl+Shift+P`) → `Claude: Start AutoClaude`
2. **Add Messages**: Queue up all your tasks - add 10, 50, or 200+ messages
3. **Start Processing**: Click "Start Processing" and walk away
4. **Live Your Life**: Go eat dinner, play with kids, sleep, or enjoy your weekend
5. **Return to Completed Work**: AutoClaude handles everything automatically, even through Claude usage limits

### 🔍 Script Runner - Automated Quality Checks

The Script Runner is a powerful feature that ensures your code meets production standards by running automated checks and fixing issues automatically.

#### Overview

The Script Checks section appears directly above the message input area, providing instant access to quality validation tools. All scripts are visible and can be enabled/disabled with checkboxes.

#### Built-in Scripts

1. **Production Readiness Check** 🏭
   - Scans for TODOs, FIXMEs, placeholders, and incomplete implementations
   - Ensures no debug code or temporary solutions remain
   - Validates error handling and edge cases

2. **Build Check** 🔨
   - Automatically detects your project's build system (npm, go, cargo, dotnet, etc.)
   - Runs the appropriate build command
   - Ensures code compiles without errors

3. **Test Check** ✅
   - Detects and runs your test suite
   - Supports multiple test frameworks across languages
   - Ensures all tests pass before proceeding

4. **Format Check** 💅
   - Validates code formatting standards
   - Detects formatters (prettier, gofmt, rustfmt, etc.)
   - Ensures consistent code style

5. **GitHub Actions Check** 🚀
   - Validates workflow YAML syntax
   - Checks for deprecated actions
   - Ensures CI/CD pipelines are correctly configured

#### Using Script Runner

1. **Enable/Disable Scripts**
   - Click checkboxes to select which scripts to run
   - Scripts only run when enabled
   - Your selection is saved automatically

2. **Reorder Scripts** 
   - Drag scripts using the handle icon (☰)
   - Numbers (1, 2, 3...) show execution order
   - Order affects fix priority - earlier scripts are fixed first

3. **Run Individual Scripts** ▶️
   - Each script has its own run button (▶️) on the right
   - Click to run just that specific script
   - Useful for debugging or checking specific aspects
   - Results shown via VS Code notifications

4. **Run All - "Run Checks"** 🔍
   - Executes all enabled scripts once
   - Shows results with ✅ pass or ❌ fail status
   - Displays specific errors found
   - No automatic fixing - just validation

5. **Fix Loop - "Run Loop"** 🔄
   - Runs all enabled scripts
   - If any fail, asks Claude to fix the issues
   - Re-runs scripts after fixes
   - Continues until all pass or max iterations reached
   - Set max iterations (1-20, default: 5)

6. **Custom Scripts** 📝
   - Add your own validation scripts to `.autoclaude/scripts/`
   - Scripts automatically appear in the UI
   - Must output JSON format:
   ```json
   {
     "passed": true/false,
     "errors": ["error1", "error2"],
     "warnings": ["warning1"] // optional
   }
   ```
   - Support any language (bash, python, node, etc.)
   - Examples provided in `.autoclaude/scripts/examples/`

#### Script Configuration

Scripts are configured in `.autoclaude/config.json`:
```json
{
  "scripts": {
    "production-check": {
      "enabled": true,
      "order": 1
    },
    "build": {
      "enabled": true,
      "order": 2
    }
  },
  "maxIterations": 5
}
```

### 🔄 Loop Features - Intelligent Task Refinement

AutoClaude provides two powerful loop features that ensure your tasks are completed to perfection.

#### 1. Script Fix Loop (Global)

The **"Run Loop"** button runs all enabled scripts repeatedly until they pass:

**How it works:**
1. Runs all enabled script checks
2. If any fail, sends errors to Claude with fix request
3. Claude implements fixes based on error messages
4. Scripts run again to verify fixes
5. Continues until all pass or max iterations reached

**Best for:**
- Preparing code for production deployment
- Ensuring all quality standards are met
- Automated code cleanup and refactoring
- Pre-commit quality assurance

**Example workflow:**
```
1. Enable: Production Check, Build, Test, Format
2. Click "Run Loop" with max iterations = 5
3. Claude fixes TODOs → Build errors → Test failures → Formatting
4. All scripts pass → Code is production-ready!
```

#### 2. Message Loop (Individual Tasks)

The **🔄 button** on each message runs that specific task in a quality loop. **Note: Hover over a pending message to see the action buttons including the loop button (🔄).**

**How it works:**
1. Processes the individual message/task
2. Runs enabled script checks on the changes
3. If checks fail, asks Claude to fix while maintaining task completion
4. Re-runs scripts after fixes
5. Ensures task is both complete AND high quality

**Best for:**
- Complex features that need refinement
- Tasks requiring multiple iterations
- Ensuring individual changes meet standards
- Focused quality improvement

**Example workflow:**
```
Message: "Add user authentication with JWT"
1. Click 🔄 on the message
2. Claude implements authentication
3. Scripts find: missing error handling, no tests
4. Claude adds error handling and tests
5. All checks pass → Feature is complete and production-ready!
```

#### Loop Configuration

Control loop behavior with these settings:

- **Max Iterations**: 1-20 (default: 5)
  - Lower for quick fixes
  - Higher for complex refactoring
  
- **Script Selection**: Enable only relevant scripts
  - Faster loops with fewer scripts
  - More thorough with all scripts

- **Smart Ordering**: Drag scripts to prioritize
  - Put critical checks first
  - Format checks last

#### Pro Tips

1. **Start Simple**: Begin with 1-2 scripts, add more as needed
2. **Watch Progress**: Each iteration shows what was fixed
3. **Trust the Process**: Let Claude handle the fixes
4. **Custom Standards**: Add your own scripts for team standards
5. **Combine Features**: Queue messages + loops = fully automated development

## 📋 Commands

| Command                          | Description                                      |
| -------------------------------- | ------------------------------------------------ |
| `Claude: Start AutoClaude` | Start the AutoClaude interface and session |
| `Claude: Stop AutoClaude`  | Stop AutoClaude and close the session      |
| `Claude: Add Message to Queue`   | Add a new message to the processing queue        |
| `Claude: Run Script Checks`      | Run all enabled validation scripts               |
| `Claude: Run Script Check Loop`  | Run scripts and auto-fix issues in a loop       |

## ⚙️ Configuration

AutoClaude offers extensive configuration options. Access settings via `File → Preferences → Settings → Extensions → AutoClaude`.

### Queue Management

```json
{
    "claudeAutopilot.queue.autoMaintenance": true
}
```

### Session Management

```json
{
    "claudeAutopilot.session.autoStart": false,
    "claudeAutopilot.session.skipPermissions": true,
    "claudeAutopilot.session.healthCheckInterval": 30000
}
```

### Sleep Prevention

```json
{
    "claudeAutopilot.sleepPrevention.enabled": true,
    "claudeAutopilot.sleepPrevention.method": "auto"
}
```

### History & Logging

```json
{
    "claudeAutopilot.history.maxRuns": 20,
    "claudeAutopilot.history.autoSave": true,
    "claudeAutopilot.logging.enabled": false,
    "claudeAutopilot.logging.level": "info"
}
```

### Script Runner

```json
{
    "claudeAutopilot.scriptRunner.enabled": true,
    "claudeAutopilot.scriptRunner.maxIterations": 5,
    "claudeAutopilot.scriptRunner.autoCreateFolder": true
}
```

## 🏗️ Architecture

AutoClaude follows a modular architecture with clear separation of concerns:

```
src/
├── core/           # Core state, types, and configuration
├── claude/         # Claude CLI integration and communication
├── queue/          # Queue management and processing
├── scripts/        # Script runner and quality checks
├── services/       # External services (health, sleep, dependencies)
├── ui/             # User interface and webview management
└── utils/          # Shared utilities and logging
```

### Key Components

-   **Queue Manager**: Handles message queueing, processing, and operations
-   **Claude Integration**: Manages Claude Code process and communication
-   **Dependency Checker**: Validates and manages required dependencies
-   **Configuration System**: Comprehensive settings with validation
-   **Script Runner**: Automated quality checks with fix loop capability

## 🔒 Security & Privacy

-   **Local Processing**: All processing happens locally on your machine
-   **No Data Collection**: AutoClaude doesn't collect or transmit personal data
-   **Secure Dependencies**: Validates Claude Code and Python installations
-   **Permission Awareness**: Uses `--dangerously-skip-permissions` only in trusted environments

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/benbasha/AutoClaude.git
cd AutoClaude

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Start watch mode for development
npm run watch

# Package for distribution
vsce package
```

### Creating a Release

To create a new release:

1. Update version in `package.json`
2. Update version badge in `README.md`
3. Add changelog entry in `CHANGELOG.md`
4. Commit changes: `git commit -m "chore: bump version to X.X.X"`
5. Push to main: `git push origin main`
6. Create release branch: `git checkout -b vX.X.X`
7. Push release branch: `git push origin vX.X.X`

The GitHub Actions workflow will automatically:
- Build the extension
- Create a `.vsix` package
- Create a GitHub release with the package as an asset
- Tag the release

### Development Mode

Enable development mode for additional debugging features:

```json
{
    "claudeAutopilot.developmentMode": true
}
```

This enables:

-   Debug logging and diagnostics
-   Configuration validation tools
-   Advanced queue operations

## 🎯 Use Cases

### Perfect for:

-   **Weekend Warriors**: Queue up your entire week's refactoring Friday evening
-   **Large Refactoring Projects**: Process hundreds of files while you sleep
-   **Batch Code Generation**: Generate components, tests, and documentation overnight
-   **Migration Tasks**: Convert frameworks or update dependencies during family time
-   **Quality Assurance**: Run comprehensive code reviews while you're at dinner
-   **Documentation Generation**: Create docs for your entire codebase while you relax

### Real-World Examples:

-   Converting a React class component codebase to functional components
-   Adding TypeScript types to a large JavaScript project
-   Generating API documentation from code comments
-   Migrating from one testing framework to another
-   Adding accessibility features across a web application

## 📚 Wiki & Documentation

### Core Concepts

**Queue Processing**: AutoClaude maintains a persistent queue of messages that can be processed automatically. Each message represents a task or instruction for Claude Code.

**Auto-Resume**: When Claude Code hits usage limits, AutoClaude automatically detects this and schedules the queue to resume when limits reset.

**Workspace Integration**: Each VS Code workspace maintains its own queue and history, allowing you to manage multiple projects independently.

**Dependency Management**: AutoClaude automatically checks for and validates all required dependencies (Claude Code, Python) before starting.

### Advanced Features

**Batch Operations**: Process multiple related tasks in sequence with consistent context and state management.

**Queue Management**: Full CRUD operations on queue items - add, edit, remove, duplicate, and reorder messages as needed.

**History Tracking**: Complete history of all processing runs with filtering and search capabilities.

**Cross-Platform**: Native support for Windows, macOS, and Linux with platform-specific optimizations.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

-   Code style and conventions
-   Testing requirements
-   Pull request process
-   Issue reporting
-   Development environment setup

## 👥 Credits

-   **Original Author**: [Ben Basha](https://github.com/benbasha) - Created the foundational AutoClaude extension
-   **Current Maintainer**: [Jimmy](https://github.com/r3e-network) (jimmy@r3e.network) - Added script runner, quality checks, and message loop features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Known Issues & Troubleshooting

### Common Issues

**Claude Code Not Found**

-   Ensure Claude Code is installed and in your PATH
-   Restart VS Code after installing Claude Code
-   Check dependency status in AutoClaude panel

**Python Not Found**

-   Install Python 3.8 or later
-   Ensure Python is in your PATH
-   On Windows, check "Add Python to PATH" during installation

**Permission Errors**

-   AutoClaude uses `--dangerously-skip-permissions` for automation
-   Only use in trusted development environments
-   Disable if working with sensitive data

### Getting Help

-   🐛 [Bug Reports](https://github.com/r3e-network/AutoClaude/issues/new?template=bug_report.md)
-   💡 [Feature Requests](https://github.com/r3e-network/AutoClaude/issues/new?template=feature_request.md)
-   💬 [Discussions](https://github.com/r3e-network/AutoClaude/discussions)
-   📖 [Wiki Documentation](https://github.com/r3e-network/AutoClaude/wiki)

### Support

If you find AutoClaude helpful, consider:

-   ⭐ Starring the repository
-   🐛 Reporting bugs or suggesting features
-   🤝 Contributing code or documentation
-   💬 Helping others in discussions

---

**Made with ❤️ for the Claude Code community**

_AutoClaude is not affiliated with Anthropic or Claude AI. Claude Code is a product of Anthropic._
