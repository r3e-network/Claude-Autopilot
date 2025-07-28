# Changelog

All notable changes to the AutoClaude extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-01-28

### 🎯 @Script Mentions Feature

This release introduces a powerful new way to attach quality checks to specific messages using @mentions.

### Added

- **@Script Mentions**: Type `@` in the message input to see a dropdown of available scripts
  - Auto-completion with arrow key navigation
  - Visual script categories (🔍 Basic checks, 🤖 Automation features)
  - Real-time filtering as you type
  - Keyboard shortcuts: Enter/Tab to select, Escape to cancel

- **Script Attachment UI**: 
  - Attached scripts shown as removable tags below message input
  - Clear visual indicators with script icons and names
  - Easy removal with × button on each tag

- **Queue Script Badges**: 
  - Messages display blue badges for attached scripts
  - Hover tooltips show script descriptions
  - Visual distinction in queue for messages with scripts

- **Automatic Script Execution**:
  - Scripts run automatically after message completion
  - Sequential execution with detailed logging
  - Results shown in VS Code notifications
  - Non-blocking: script failures don't interrupt message flow

### Improved

- **Message Processing**: Enhanced to support script execution after completion
- **UI/UX**: Professional dropdown interface with smooth animations
- **Error Handling**: Robust error handling for script execution
- **TypeScript Types**: Extended MessageItem type to support attachedScripts

### Technical

- **Frontend**: New script mention system with dropdown and tag management
- **Backend**: Updated message queue and processing logic
- **Integration**: Seamless integration with existing script runner
- **Performance**: Efficient script execution without blocking main flow

## [2.0.0] - 2025-01-28

### 🎯 Major Rebrand

This release introduces a complete rebrand from "Claude Autopilot" to "AutoClaude" with improved branding and naming conventions.

### Changed

- **Project Name**: Renamed from "Claude Autopilot" to "AutoClaude"
- **Extension ID**: Changed from `claude-autopilot` to `autoclaude`
- **Commands**: Updated all command IDs to use `autoclaude` prefix
- **Configuration**: Renamed all settings from `claudeAutopilot` to `autoclaude`
- **Folder Structure**: Changed workspace folder from `.autopilot` to `.autoclaude`
- **UI Labels**: Updated all user-facing text to use "AutoClaude" branding

### Technical

- **Version**: Bumped to 2.0.0 to reflect major branding change
- **Backward Compatibility**: Users will need to reconfigure settings due to configuration key changes
- **Migration**: Existing `.autopilot` folders will be automatically renamed to `.autoclaude`

## [1.1.0] - 2025-01-28

### 🤖 Major Automation Features

This release introduces comprehensive automation capabilities for intelligent development assistance.

### Added

- **Smart Context Manager**: Automatically includes relevant files based on imports, modifications, and relationships
- **Test-Driven Development Automation**: Ensures test coverage and identifies missing tests
- **Error Recovery System**: Pattern-based error detection with automatic recovery strategies
- **AI Code Review**: Security, performance, and style analysis with best practices validation
- **Documentation Generator**: Checks for missing documentation and generates suggestions
- **Self-Healing System**: Automatically fixes common issues like linting errors and import problems
- **Automation Manager**: Coordinates all automation features with comprehensive validation

### Improved

- **Enhanced UI**: Professional interface with automation badges and responsive design
- **Mobile-Friendly**: Responsive layout that works on all screen sizes
- **Visual Hierarchy**: Clear distinction between basic checks and automation features
- **Production-Ready Code**: All automation features are fully implemented with proper error handling

### Technical

- **Type Safety**: Intelligent type inference instead of generic any types
- **Configurable Timeouts**: All delays and limits are properly configurable
- **Comprehensive Testing**: All automation features thoroughly tested
- **Full Integration**: Seamless integration with existing extension functionality

## [1.0.2] - 2025-01-28

### 🔧 Script System Improvements

This release completely revamps the script system for better reliability and workspace isolation.

### Changed

-   **Script Deployment**: Built-in scripts are now embedded in the extension and deployed to each workspace
-   **Workspace Isolation**: Scripts run exclusively from the workspace `.autopilot` folder
-   **No Extension Dependencies**: Removed fallback to extension directory - everything runs from workspace

### Added

-   **Embedded Scripts**: All 5 built-in scripts are embedded as TypeScript constants
-   **Automatic Deployment**: Scripts are automatically written to `.autopilot/scripts/` on startup
-   **Complete Scripts**: Each script is self-contained with comprehensive error handling

### Improved

-   **Reliability**: Scripts are always available and consistent across installations
-   **Portability**: Workspace `.autopilot` folders are completely self-contained
-   **Customization**: Users can modify scripts in their workspace without affecting the extension
-   **Visibility**: Scripts are visible in the project for easy inspection and modification

### Technical Details

-   Scripts are stored in `src/scripts/builtinScripts.ts`
-   Scripts are written with executable permissions (755)
-   Includes README.md and default config.json in `.autopilot` folder
-   Removed 200+ lines of unused script generation code

## [1.0.1] - 2025-01-28

### 📚 Documentation & Publisher Update

This release updates the extension publisher and significantly improves documentation for the Script Runner and Loop features.

### Changed

-   **Publisher Update**: Changed publisher from `benbasha` to `r3e`
-   **Extension ID**: Now published as `r3e.claude-autopilot` on VS Code Marketplace
-   **Repository URLs**: Updated all references to `r3e-network` organization

### Added

-   **Comprehensive Script Runner Documentation**
    -   Detailed explanation of all 5 built-in scripts
    -   Step-by-step usage instructions
    -   Configuration examples with JSON format
    -   Custom script creation guidelines
    
-   **Loop Features Documentation**
    -   Script Fix Loop (global quality checks) explanation
    -   Message Loop (individual task refinement) guide
    -   Real-world workflow examples
    -   Configuration tips and pro tips

### Improved

-   **README Structure**: Better organization with clear sections for Script Runner and Loop features
-   **Examples**: Added practical examples for both loop types
-   **Visual Indicators**: Used emojis to make documentation more scannable

## [1.0.0] - 2025-01-28

### 🎉 First Stable Release

Claude Autopilot is now production-ready! This release marks the first stable version with all core features fully implemented and tested.

### ✨ Key Features

-   **24/7 Automated Processing**: Queue tasks and let Claude work while you sleep
-   **Script Runner & Quality Checks**: Ensure code quality with automated validation
-   **Message Loop**: Run individual messages with quality checks until they pass
-   **Auto-Resume**: Automatically handles Claude usage limits
-   **Rich UI**: Intuitive webview interface with real-time updates
-   **Cross-Platform**: Full support for Windows, macOS, and Linux
-   **GitHub Actions**: Automated release workflow for easy distribution
-   **Drag-and-Drop**: Reorder scripts with visual interface
-   **Custom Scripts**: Extensible validation system

### 🔧 Infrastructure

-   **Automated Releases**: GitHub Actions workflow for building and releasing
-   **VSIX Packaging**: Direct download and installation from GitHub releases
-   **Comprehensive Documentation**: Complete README with use cases and examples
-   **Author Attribution**: Credits both original and current maintainers

## [0.0.3] - 2025-01-28

### ✨ Added

-   **Message Loop Feature**: Run individual messages in a loop with script checks
-   **Loop Button**: Added 🔄 button to each pending message for loop execution
-   **Smart Message Processing**: Automatically moves message to front of queue and starts processing
-   **Integrated Quality Checks**: Messages are processed, then checked, then fixed if needed
-   **Configurable Iterations**: Uses the same max iterations setting as global script loop

### 🔧 Improved

-   **Better Workflow**: Individual messages can now be refined until they pass all quality checks
-   **User Confirmation**: Shows enabled scripts and max iterations before starting loop
-   **Error Handling**: Comprehensive error messages and timeout handling

## [0.0.2] - 2025-01-28

### ✨ Added

-   **Script Runner System**: Automated quality checks with predefined scripts for production readiness, build, test, format, and GitHub Actions validation
-   **Fix Loop Functionality**: Automatically requests fixes for identified issues and re-runs checks until all pass or max iterations reached
-   **Drag-and-Drop Script Ordering**: Reorder script execution with visual drag-and-drop interface
-   **Custom Script Support**: Add custom validation scripts to `.autopilot/scripts/` folder
-   **Multi-Language Detection**: Automatic support for JavaScript, TypeScript, Go, C++, Rust, C#, and Java
-   **Integrated Script UI**: Scripts always visible above message input with checkboxes and order numbers
-   **Configurable Max Iterations**: Set maximum fix loop iterations (default: 5)

### 🔧 Improved

-   **Simplified Interface**: Removed separate configuration step - scripts are always visible
-   **Better Visual Feedback**: Order numbers and drag indicators for script management
-   **Automatic Folder Creation**: `.autopilot` folder structure created automatically when needed

## [0.1.1] - 2025-01-15

### ✨ Added

-   **Message ID System**: Each queue message now has a unique identifier for better tracking and management
-   **History Visibility Controls**: New configuration option to show/hide history section in the UI
-   **Scheduled Session Start**: Added ability to schedule Claude Autopilot to start at specific times (HH:MM format)
-   **Enhanced UI Controls**: Replaced checkbox with sleek iOS-style toggle for skip permissions setting
-   **Complete Config Implementation**: Full configuration system with validation and real-time updates
-   **ID Generator Utility**: New utility service for generating unique message identifiers
-   **Security Service**: Enhanced security validation and XSS protection controls
-   **Scheduler Service**: New service for handling timed operations and session scheduling

### 🔧 Fixed

-   **Queue Persistence**: Resolved issues with pending queue not persisting across sessions
-   **Auto-start Issues**: Fixed problems with automatic session startup functionality
-   **History Saving**: Fixed bug where processing history was not being saved properly
-   **Multiline Message Handling**: Improved handling of multiline messages and Enter key submission
-   **Configuration References**: Updated README and documentation to use correct `claudeAutopilot.*` configuration keys

## [0.1.0] - 2025-07-15

### 🎉 Major Rebrand

-   **Extension Renamed**: Complete rebrand from "ClaudeLoop" to "Claude Autopilot"
-   **New Package Name**: Changed from `claude-loop` to `claude-autopilot`
-   **Updated Commands**: All commands now use `claude-autopilot.*` prefix
-   **New Repository**: Moved to `https://github.com/benbasha/Claude-Autopilot`

### ✨ Added

-   **Collaboration Guide**: Added comprehensive `COLLABORATION.md` with contribution guidelines
-   **Updated Configuration**: All settings now use `claudeAutopilot.*` namespace
-   **Consistent Branding**: Updated all UI text, documentation, and user-facing messages

### 🔧 Changed

-   **Breaking Change**: Configuration keys changed from `claudeLoop.*` to `claudeAutopilot.*`
-   **Command IDs**: Updated from `claude-loop.*` to `claude-autopilot.*`
-   **Repository URLs**: All links now point to new GitHub repository

### 📚 Documentation

-   **README**: Updated with new branding and repository links
-   **Architecture**: Updated CLAUDE.md with new command references
-   **Deployment**: Updated deployment guide with new package information

## [0.0.4] - 2025-07-14

### ✨ Added

-   **Cross-platform keyboard shortcuts**: Added Cmd+Enter (Mac) and Ctrl+Enter (Windows/Linux) support for adding messages to queue
-   **Visual keyboard hints**: Added helpful text showing available keyboard shortcuts in the interface
-   **Improved input layout**: Enhanced styling and layout of the message input section

### 🔧 Fixed

-   Better cross-platform compatibility for keyboard shortcuts
-   Improved user experience with visual feedback for available shortcuts

## [0.0.3] - 2025-07-13

### 🔧 Fixed

-   Fixed webview loading error in packaged extension
-   Improved extension reliability and stability

## [0.0.2] - 2025-07-13

### ✨ Added

-   **Beautiful icon**: Added professional icon representing automation while sleeping
-   **Visual branding**: Enhanced extension appearance in VS Code marketplace

### 🔧 Fixed

-   Updated icon and branding elements
-   Improved extension presentation

## [0.0.1] - 2025-07-13

### 🎉 Initial Alpha Release - Claude Code Task Management

This initial alpha release provides automated task management for Claude Code with intelligent queue processing and auto-resume functionality.

### ✨ Added

#### 🏗️ **Modular Architecture**

-   Complete refactor from monolithic (1900+ lines) to modular design (20+ focused modules)
-   Organized codebase with clear separation of concerns
-   Improved maintainability and extensibility

#### 🔧 **Robust Dependency Management**

-   Comprehensive Claude Code installation detection
-   Cross-platform Python detection with version validation (3.8+)
-   PTY wrapper file validation and error recovery
-   Platform-specific installation instructions
-   Automatic retry mechanisms with helpful error messages

#### ⚙️ **Advanced Configuration System**

-   Extensive configuration options with built-in validation
-   Real-time configuration change detection
-   Helpful error messages for invalid settings
-   Configuration reset functionality
-   Development mode with debugging features

#### 🛡️ **Comprehensive Error Handling**

-   Try-catch blocks throughout critical code paths
-   Proper error recovery with state cleanup
-   User-friendly error messages with suggested solutions
-   Automatic retry mechanisms with exponential backoff
-   Process management error recovery

#### 🔄 **Production-Ready Features**

-   Development mode features properly gated for production
-   Timer cleanup in extension deactivation
-   Process cleanup and resource management
-   Configuration validation on startup
-   Health monitoring and process recovery

### 🚀 **Enhanced Features**

#### 📋 **Queue Management**

-   Message size validation and truncation
-   Queue operations: add, remove, duplicate, edit, reorder
-   Automatic queue maintenance and cleanup
-   Memory usage monitoring and reporting
-   Queue history with filtering and search

#### 🖥️ **Cross-Platform Compatibility**

-   Windows, macOS, and Linux support
-   Platform-specific Python detection
-   Cross-platform sleep prevention methods
-   Platform-appropriate error messages and solutions

#### 📊 **User Interface Improvements**

-   Enhanced webview with better error handling
-   Real-time status updates and progress tracking
-   Configuration validation status display
-   Memory usage statistics (development mode)
-   Improved visual feedback and notifications

### 🔒 **Security & Privacy**

-   Input validation and XSS prevention
-   Content Security Policy implementation
-   No external data collection or transmission
-   Local-only processing and storage
-   Secure dependency validation

### 🛠️ **Developer Experience**

-   Development mode with advanced debugging features
-   Configuration validation tools
-   Memory usage monitoring
-   Process health diagnostics
-   Debug logging and diagnostics

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

-   TypeScript strict mode compliance
-   Comprehensive type definitions
-   Modular imports and exports
-   Async/await patterns throughout
-   Promise-based error handling
-   Resource cleanup and memory management

### 🏃‍♂️ **Performance**

-   Reduced memory footprint
-   Faster startup times
-   Efficient queue processing
-   Optimized timer management
-   Better resource utilization

### 🧪 **Quality Assurance**

-   Comprehensive code review
-   Error handling validation
-   Cross-platform testing
-   Memory leak testing
-   Configuration validation testing

### 📦 **Packaging & Distribution**

-   Updated marketplace metadata
-   Comprehensive documentation
-   Installation guides for all platforms
-   Troubleshooting documentation
-   Development setup instructions

---

---

## Development Roadmap

### Future Enhancements (Planned)

-   📊 Usage analytics and telemetry (opt-in)
-   🧪 Comprehensive test suite
-   📱 Mobile-friendly webview
-   🔌 Plugin system for custom processors
-   📈 Performance monitoring and optimization
-   🌐 Multi-language support
-   🎨 Theme customization
-   📋 Template system for common tasks

### Community Requests

-   Integration with other AI CLI tools
-   Batch file processing
-   Export/import functionality
-   Advanced filtering and search
-   Collaboration features
-   Cloud synchronization (optional)

---

**Note**: Claude Autopilot is not affiliated with Anthropic or Claude AI. Claude Code is a product of Anthropic.
