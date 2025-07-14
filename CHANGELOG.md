# Changelog

All notable changes to the ClaudeLoop extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.4] - 2025-01-14

### ✨ Added
- **Cross-platform keyboard shortcuts**: Added Cmd+Enter (Mac) and Ctrl+Enter (Windows/Linux) support for adding messages to queue
- **Visual keyboard hints**: Added helpful text showing available keyboard shortcuts in the interface
- **Improved input layout**: Enhanced styling and layout of the message input section

### 🔧 Fixed
- Better cross-platform compatibility for keyboard shortcuts
- Improved user experience with visual feedback for available shortcuts

## [0.0.1] - 2024-01-15

### 🎉 Initial Alpha Release - Claude Code Task Management

This initial alpha release provides automated task management for Claude Code with intelligent queue processing and auto-resume functionality.

### ✨ Added

#### 🏗️ **Modular Architecture**
- Complete refactor from monolithic (1900+ lines) to modular design (20+ focused modules)
- Organized codebase with clear separation of concerns
- Improved maintainability and extensibility


#### 🔧 **Robust Dependency Management**
- Comprehensive Claude Code installation detection
- Cross-platform Python detection with version validation (3.8+)
- PTY wrapper file validation and error recovery
- Platform-specific installation instructions
- Automatic retry mechanisms with helpful error messages

#### ⚙️ **Advanced Configuration System**
- Extensive configuration options with built-in validation
- Real-time configuration change detection
- Helpful error messages for invalid settings
- Configuration reset functionality
- Development mode with debugging features

#### 🛡️ **Comprehensive Error Handling**
- Try-catch blocks throughout critical code paths
- Proper error recovery with state cleanup
- User-friendly error messages with suggested solutions
- Automatic retry mechanisms with exponential backoff
- Process management error recovery

#### 🔄 **Production-Ready Features**
- Development mode features properly gated for production
- Timer cleanup in extension deactivation
- Process cleanup and resource management
- Configuration validation on startup
- Health monitoring and process recovery

### 🚀 **Enhanced Features**

#### 📋 **Queue Management**
- Message size validation and truncation
- Queue operations: add, remove, duplicate, edit, reorder
- Automatic queue maintenance and cleanup
- Memory usage monitoring and reporting
- Queue history with filtering and search

#### 🖥️ **Cross-Platform Compatibility**
- Windows, macOS, and Linux support
- Platform-specific Python detection
- Cross-platform sleep prevention methods
- Platform-appropriate error messages and solutions

#### 📊 **User Interface Improvements**
- Enhanced webview with better error handling
- Real-time status updates and progress tracking
- Configuration validation status display
- Memory usage statistics (development mode)
- Improved visual feedback and notifications

### 🔒 **Security & Privacy**
- Input validation and XSS prevention
- Content Security Policy implementation
- No external data collection or transmission
- Local-only processing and storage
- Secure dependency validation

### 🛠️ **Developer Experience**
- Development mode with advanced debugging features
- Configuration validation tools
- Memory usage monitoring
- Process health diagnostics
- Debug logging and diagnostics

### 📝 **Configuration Options**

All new configuration options with validation:

```json
{
  "claudeLoop.developmentMode": false,
  "claudeLoop.queue.maxSize": 1000,
  "claudeLoop.queue.maxMessageSize": 50000,
  "claudeLoop.queue.maxOutputSize": 100000,
  "claudeLoop.queue.retentionHours": 24,
  "claudeLoop.queue.autoMaintenance": true,
  "claudeLoop.session.autoStart": false,
  "claudeLoop.session.skipPermissions": true,
  "claudeLoop.session.healthCheckInterval": 30000,
  "claudeLoop.sleepPrevention.enabled": true,
  "claudeLoop.sleepPrevention.method": "auto",
  "claudeLoop.history.maxRuns": 20,
  "claudeLoop.history.autoSave": true,
  "claudeLoop.logging.enabled": false,
  "claudeLoop.logging.level": "info"
}
```

### 🔧 **Technical Improvements**
- TypeScript strict mode compliance
- Comprehensive type definitions
- Modular imports and exports
- Async/await patterns throughout
- Promise-based error handling
- Resource cleanup and memory management

### 🏃‍♂️ **Performance**
- Reduced memory footprint
- Faster startup times
- Efficient queue processing
- Optimized timer management
- Better resource utilization

### 🧪 **Quality Assurance**
- Comprehensive code review
- Error handling validation
- Cross-platform testing
- Memory leak testing
- Configuration validation testing

### 📦 **Packaging & Distribution**
- Updated marketplace metadata
- Comprehensive documentation
- Installation guides for all platforms
- Troubleshooting documentation
- Development setup instructions

---


---

## Development Roadmap

### Future Enhancements (Planned)
- 📊 Usage analytics and telemetry (opt-in)
- 🧪 Comprehensive test suite
- 📱 Mobile-friendly webview
- 🔌 Plugin system for custom processors
- 📈 Performance monitoring and optimization
- 🌐 Multi-language support
- 🎨 Theme customization
- 📋 Template system for common tasks

### Community Requests
- Integration with other AI CLI tools
- Batch file processing
- Export/import functionality
- Advanced filtering and search
- Collaboration features
- Cloud synchronization (optional)

---

**Note**: ClaudeLoop is not affiliated with Anthropic or Claude AI. Claude Code is a product of Anthropic.