# AutoClaude v3.2.9 Release Notes

## 🚀 Parallel Agents & Auto-Recovery System

We're excited to announce AutoClaude v3.2.9, a major release that brings parallel agent processing by default and comprehensive robustness features to both the VS Code extension and terminal tool!

### 🎯 Key Highlights

1. **Parallel Agents Enabled by Default** - Experience faster, more intelligent code improvements with multiple specialized agents working in parallel
2. **Auto-Recovery System** - Never lose work due to stuck sessions again with our new health monitoring and recovery system
3. **Unified Experience** - Both VS Code extension and terminal tool now share the same powerful features

## 🤖 Parallel Agent System (Now Default!)

### What's New:
- **5 Built-in Specialized Agents** active by default:
  - 🔍 **Code Analyzer** - Deep code analysis and quality checks
  - 📝 **Documentation Writer** - Comprehensive documentation generation
  - 🧪 **Test Generator** - Intelligent test suite creation
  - 🔧 **Refactor Specialist** - Code optimization and clean-up
  - 🔒 **Security Auditor** - Vulnerability detection and fixes

### Auto-Generation Features:
- **Context-Aware Agent Creation** - Automatically spawns specialized agents based on your task
- **Language-Specific Experts** - Detects and activates agents for:
  - Rust 🦀
  - .NET/C# 
  - Java ☕
  - Go 
  - C/C++ 
  - And more!

### Smart Defaults:
- Agents start automatically when you open a workspace
- Complexity threshold reduced to 2 (from 3) for more intelligent assistance
- Auto-scaling based on workload

## 🛡️ Robustness & Recovery Features

### Health Monitoring:
- **Continuous Health Checks** - Every 30 seconds
- **Stuck Session Detection** - Identifies unresponsive Claude sessions
- **Performance Metrics** - Tracks success rates and response times

### Auto-Recovery System:
- **Automatic Retry** - Up to 3 attempts with exponential backoff
- **Context Preservation** - Maintains last 10 messages during recovery
- **Graceful Degradation** - Clear guidance when recovery isn't possible
- **Real-time Status** - See recovery progress in the UI

### Terminal Enhancements:
- **Enhanced `/health` Command** - Shows detailed health metrics and recovery status
- **Better Error Messages** - More helpful guidance when issues occur
- **Progress Indicators** - Visual feedback during recovery attempts

## 📦 Installation

### VS Code Extension:
1. Download `autoclaude-3.2.9.vsix` from the release
2. In VS Code: `Extensions` → `...` → `Install from VSIX...`
3. Select the downloaded file

### Terminal Tool:
```bash
npm install -g @r3e/autoclaude@3.2.9
```

## 🔧 Configuration Changes

All parallel agent features are now enabled by default. If you prefer the previous behavior, you can disable them in settings:

### VS Code Settings:
- `autoclaude.parallelAgents.enabled`: Set to `false` to disable
- `autoclaude.parallelAgents.autoStart`: Set to `false` to prevent auto-start
- `autoclaude.subAgents.enabled`: Set to `false` to disable sub-agents

### Terminal Config:
Run `autoclaude config set parallelAgents.enabled false` to disable

## 🎉 Benefits

1. **Faster Development** - Multiple agents work on different aspects simultaneously
2. **Better Code Quality** - Specialized agents ensure comprehensive improvements
3. **Reliability** - Auto-recovery ensures your work continues even if Claude has issues
4. **Zero Configuration** - Everything works out of the box

## 📊 Performance Impact

- Tasks complete up to 5x faster with parallel processing
- Automatic workload distribution across agents
- Intelligent agent selection based on task complexity
- Resource-efficient with built-in scaling

## 🐛 Bug Fixes

- Fixed stuck session detection
- Improved timeout handling
- Better error recovery mechanisms
- Enhanced message success tracking
- Resolved connection issues with Claude CLI

## 💡 Usage Tips

1. **Let Agents Work** - The system automatically detects complex tasks and assigns appropriate agents
2. **Monitor Health** - Use `/health` in terminal or check the status bar in VS Code
3. **Trust Recovery** - If a session gets stuck, the system will automatically recover
4. **Customize as Needed** - Fine-tune agent settings in configuration if desired

## 🙏 Acknowledgments

Thank you to all users who reported issues and provided feedback, especially regarding stuck sessions and the need for better parallel processing!

## 📚 Documentation

- [VS Code Extension Guide](https://github.com/r3e-network/AutoClaude)
- [Terminal Tool Documentation](https://www.npmjs.com/package/@r3e/autoclaude)
- [Configuration Reference](https://github.com/r3e-network/AutoClaude/wiki/Configuration)

---

**Note**: This release requires Claude Code CLI to be installed and authenticated. Both tools now work seamlessly with the same robust infrastructure.

Happy coding with AutoClaude v3.2.9! 🚀