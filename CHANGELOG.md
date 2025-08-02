# Changelog

All notable changes to the Claude Autopilot extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.0] - 2025-08-02

### 🚀 Enterprise-Grade Reliability & Professional UX

#### ✨ Added
- **Enterprise Error Management** - Comprehensive error handling with history tracking
- **Fault Tolerance System** - Circuit breakers, retries, and graceful degradation
- **Input Validation & Security** - Complete validation with XSS and path traversal protection
- **Professional Logging** - Multi-level logging with file output and export
- **Service Health Monitoring** - Real-time health tracking and dashboard
- **5 New Commands** - Error history, service health, log export, config validation, reset defaults
- **Troubleshooting Guide** - Comprehensive documentation for issue resolution

#### 🔧 Improvements
- Enhanced configuration management with validation
- Improved error messages with actionable suggestions
- Better queue operation validation and error handling
- Professional TypeScript architecture
- Comprehensive unit test coverage

#### 🗑️ Removed
- All blockchain and crypto-related functionality
- MultiVM components and references
- R3E Network branding
- Unnecessary dependencies (ethers, express, cors, axios)

#### 💔 Breaking Changes
- Package name changed from `autoclaude` to `claude-autopilot`
- Removed blockchain-related APIs

## [3.4.0] - 2025-08-01

### 🎉 Major Security & Reliability Release

This release aligns with the terminal v3.4.0 major security and reliability improvements.

### ✨ Added
- **Enhanced Security Integration** - Better integration with secure terminal features
- **Professional Error Handling** - Improved error reporting and recovery
- **Performance Monitoring Support** - Enhanced monitoring capabilities
- **Production Ready Features** - Aligned with terminal production readiness

### 🔧 Improvements
- Updated to work seamlessly with terminal v3.4.0 security features
- Enhanced error handling and user feedback
- Better integration with new configuration validation
- Improved session management coordination

### 🐛 Bug Fixes  
- Fixed compatibility issues with enhanced terminal security
- Resolved session coordination edge cases
- Improved error message clarity

## [3.2.10] - 2025-07-31

### 🌐 SSH Remote Detection & Guidance

Added intelligent detection and guidance for SSH remote development environments.

### ✨ Added
- **Remote Environment Detection** - Automatically detects SSH, WSL, containers, and Codespaces
- **Smart Warnings** - Shows appropriate guidance when extension won't work properly
- **New Command**: `Claude: Check Remote Environment` - Diagnose remote compatibility
- **Detailed Instructions** - Context-aware solutions for each remote environment type

### 🔧 Improvements
- **Better User Experience** - Clear explanations instead of cryptic errors
- **Multiple Solutions** - Offers terminal tool, local setup, and other alternatives
- **Proactive Detection** - Warns users before attempting to start Claude session

### 📚 Documentation
- Added comprehensive SSH remote troubleshooting guide
- Created detailed solutions document with all available options
- Enhanced error messages with actionable guidance

### 🐛 Bug Prevention
- Prevents confusing failures in remote environments
- Guides users to working solutions immediately
- Reduces support requests for remote issues

## [3.2.9] - 2025-07-31

### 🚀 Parallel Agents & Auto-Recovery System

This release enables parallel agents by default and adds comprehensive robustness features for both VS Code extension and terminal tool.

### ✨ Major Features
- **Parallel Agents Enabled by Default**: Both VS Code extension and terminal now run with parallel agents active
- **Auto-Recovery System**: Automatic session recovery when Claude becomes unresponsive
- **Health Monitoring**: Continuous health checks detect stuck sessions
- **Context Preservation**: Maintains conversation context during recovery

### 🤖 Parallel Agent Enhancements
- **Auto-Start**: Agents now start automatically when workspace opens
- **Built-in Agents**: 5 specialized agents enabled by default:
  - Code Analyzer
  - Documentation Writer
  - Test Generator
  - Refactor Specialist
  - Security Auditor
- **Context-Aware Generation**: Automatically generates agents based on task complexity
- **Language-Specific Agents**: Support for Rust, .NET, Java, Go, C/C++ specialists
- **Reduced Complexity Threshold**: Lowered from 3 to 2 for VS Code to trigger agents more often

### 🛡️ Robustness Features
- **Health Monitor**: Checks session health every 30 seconds
- **Session Recovery Manager**: Automatic retry with exponential backoff
- **Context Buffer**: Preserves last 10 messages for recovery
- **Progress Indicators**: Real-time recovery status in UI
- **Graceful Degradation**: Clear guidance when recovery fails

### 🔧 Configuration Updates
- `autoclaude.subAgents.enabled`: Now defaults to `true`
- `autoclaude.parallelAgents.enabled`: Now defaults to `true`
- `autoclaude.parallelAgents.autoStart`: Now defaults to `true`
- `autoclaude.parallelAgents.autoGenerate`: Now defaults to `true`
- `autoclaude.parallelAgents.builtInAgents.enabled`: Now defaults to `true`
- `autoclaude.parallelAgents.contextGeneration.enabled`: Now defaults to `true`
- `autoclaude.parallelAgents.contextGeneration.minComplexity`: Reduced to `2`

### 📊 Terminal Tool Updates
- Version synchronized with VS Code extension (3.2.9)
- Same robustness features as VS Code extension
- Enhanced `/health` command with recovery metrics
- Improved error messages and user guidance

### 🐛 Bug Fixes
- Fixed stuck session detection
- Improved timeout handling
- Better error recovery mechanisms
- Enhanced message success tracking

## [3.2.6] - 2025-07-31

### 🚀 Performance & Security Improvements

This release focuses on production readiness with major performance optimizations and security enhancements.

### ✨ Added
- **esbuild Bundling**: Implemented fast, optimized bundling system
  - Reduced package size from 45.18MB to 679.54KB (98.5% reduction!)
  - Faster extension loading and improved performance
  - Production minification for smaller footprint

### 🔒 Security
- **Updated Dependencies**: Migrated from deprecated `vsce` to `@vscode/vsce`
- **Zero Vulnerabilities**: All security issues resolved
- **Sensitive File Protection**: Enhanced .vscodeignore to exclude SSL keys and production configs

### 🔧 Improvements
- **Build System**: 
  - New esbuild-based compilation for faster builds
  - Separate development and production build modes
  - Automatic file copying for Python wrapper and webview assets
- **Package Optimization**:
  - Comprehensive .vscodeignore configuration
  - Excluded unnecessary files (terminal, configs, Docker files)
  - Removed development artifacts from production package
- **Node.js Compatibility**: Added engine requirement for Node.js >=18.0.0

### 📦 Technical Changes
- Replaced TypeScript compilation with esbuild bundling
- Added npx wrapper for cross-platform vsce execution
- Improved build scripts with production-specific optimizations
- Enhanced package scripts for better developer experience

### 🐛 Bug Fixes
- Fixed package security warnings
- Resolved bundling issues with webview resources
- Corrected file path handling in build process

## [3.1.2] - 2025-07-30

### 🐛 Bug Fixes
- Fixed VS Code web compatibility by removing inline onclick handlers
- Updated Content Security Policy for web environment
- Added proper event listeners for all buttons and controls
- Fixed webview panel not showing content in VS Code web

## [3.1.1] - 2025-07-30

### 🔧 Improvements
- Updated publisher ID to R3ENetwork for VS Code marketplace
- Updated repository URLs from Claude-Autopilot to AutoClaude

## [3.1.0] - 2025-07-30

### ✨ New Features

#### Import/Export System
- **Export Queue**: Save your message queue to JSON for backup or sharing
- **Import Queue**: Load previously exported queues with merge options
- **Export Settings**: Backup all extension settings to a file
- **Flexible Import**: Choose to append, merge, or replace when importing

#### Message Templates
- **Pre-built Templates**: 6 professional templates for common tasks
  - Make Production Ready
  - Add Comprehensive Tests
  - Refactor Code
  - Security Audit & Fix
  - Add New Feature
  - Optimize Performance
- **Variable Support**: Templates support dynamic variables with prompts
- **Categories**: Templates organized by category (Quality, Testing, Security, etc.)
- **Custom Templates**: Create and save your own templates

#### Queue Statistics Dashboard
- **Real-time Metrics**: Live dashboard showing queue performance
- **Visual Charts**: Time distribution and status pie charts
- **Performance Tracking**: Success rate, average processing time
- **Error Analysis**: Breakdown of error types and patterns
- **Peak Usage**: Identify busiest hours for optimization

#### Keyboard Shortcuts
- `Ctrl/Cmd + Shift + M`: Add new message
- `Ctrl/Cmd + Shift + S`: Start processing
- `Ctrl/Cmd + Shift + X`: Stop processing
- `Ctrl/Cmd + Shift + T`: Use template
- `Ctrl/Cmd + Shift + D`: Show statistics

### 🔧 Improvements
- Better error recovery and messaging
- Enhanced queue persistence
- Improved memory management
- More intuitive UI interactions
- **Scroll to Bottom Button**: Added dedicated button to instantly jump to the latest Claude output
- **Keyboard Shortcut**: Press `Ctrl/Cmd + End` when Claude output is focused to scroll to bottom

### 📚 Documentation
- Added template usage guide
- Import/export documentation
- Statistics interpretation guide

## [3.0.1] - 2025-07-30

### 🐛 Bug Fixes

- **Fixed VS Code Server/Web Compatibility**: Extension now works properly in browser-based VS Code environments
- **Fixed Empty Webview Issue**: Resolved blank panel in VS Code Server, github.dev, and vscode.dev
- **Improved Resource Loading**: Updated to use proper webview URI handling for web environments
- **Enhanced CSP**: Content Security Policy now properly configured for web contexts

## [3.0.0] - 2025-07-30

### 🚀 Major Release: Terminal Version & Enhanced VS Code Extension

#### New Terminal Application
- **Standalone Terminal Program**: Complete terminal-based Claude automation tool
- **Beautiful TUI**: Built with blessed for intuitive terminal interface
- **Cross-Platform**: Works on any Linux/macOS terminal, including SSH sessions
- **Server Ready**: Perfect for headless server environments

#### Terminal Features
- 🖥️ **Interactive Mode**: Full-featured terminal UI with multiple panes
- 📋 **Batch Processing**: Process multiple messages from files
- 🎯 **Single Command Mode**: Run one-off commands and exit
- 🔧 **Configuration Management**: Extensive CLI-based configuration
- 📊 **Real-time Monitoring**: Live status updates and progress tracking

#### VS Code Extension Enhancements
- **Auto-Scroll Improvements**: Claude output always scrolls to bottom by default
- **Scroll Lock Toggle**: New button to control auto-scrolling behavior
- **Persistent Preferences**: Scroll settings saved per workspace
- **Smooth Animations**: Better scrolling performance

#### Parallel Agent System (Both Terminal & VS Code)
- **50+ Parallel Agents**: Run massive parallel Claude instances
- **Automatic Orchestration**: One-click fully automatic operation
- **Work Detection**: Automatically finds and fixes issues in codebase
- **Smart Distribution**: Intelligent task allocation without conflicts
- **Auto-Scaling**: Dynamically adjusts agent count based on workload
- **Coordination Protocol**: Advanced multi-agent collaboration
- **34 Tech Stacks**: Pre-configured support for major technologies

#### Automation Features
- **Auto-Start**: Agents start automatically when work detected
- **Auto-Scale**: Agent count adjusts based on queue size
- **Auto-Complete**: Shuts down when all work finished
- **Auto-Restart**: Failed agents restart automatically
- **Auto-Recovery**: Handles crashes and network issues

### Installation

#### VS Code Extension
```bash
# Install from VS Code Marketplace
# Search for "AutoClaude" or use:
code --install-extension r3e.autoclaude
```

#### Terminal Version
```bash
# Global installation
npm install -g claude-autopilot

# Run with
claude-autopilot
# or short alias
cap
```

### Breaking Changes
- Minimum Node.js version is now 16.0.0
- Configuration format has been updated
- Some VS Code settings have been renamed

### Bug Fixes
- Fixed memory leaks in long-running sessions
- Improved error handling for network failures
- Better cleanup of temporary files
- Fixed race conditions in parallel processing

## [2.4.0] - 2025-07-30

### 🚀 Intelligent Task Automation System

This release introduces a groundbreaking automation system that enables AutoClaude to understand, decompose, and execute complex development tasks automatically.

### ✨ New Features

#### 🧠 **Intelligent Task Automation**
- **TaskDecomposer**: Automatically breaks down complex commands into manageable subtasks
  - Workflow templates for common tasks (production-ready, testing, documentation)
  - Smart dependency detection between subtasks
  - Time estimation for each workflow step
- **Automatic Task Resumption**: Continues interrupted work seamlessly
  - Monitors task health and progress
  - Generates recovery plans for failed tasks
  - Smart error analysis with targeted fixes

#### 📚 **Advanced Project Context System**
- **ProjectIndexer**: Comprehensive file indexing with symbol extraction
  - Analyzes project structure and dependencies
  - Detects code patterns and complexity
  - Provides project statistics and insights
- **Cross-Session Task Persistence**: Never lose work progress
  - Tasks persist across VSCode sessions
  - Automatic context restoration
  - Task history and audit trail
- **Automatic Context Generation**: Better project understanding
  - Generates comprehensive project summaries
  - Tracks file relationships and dependencies
  - Provides relevant context to improve accuracy

#### 🤖 **Specialized Sub-Agents**

**Production Agents:**
- **TestFixerAgent**: Analyzes and fixes failing unit tests
- **TestCreatorAgent**: Creates unit tests for untested code  
- **DocGeneratorAgent**: Creates comprehensive documentation (README, API, Architecture)
- **DockerCreatorAgent**: Generates Docker configuration with best practices
- **CodeCleanerAgent**: Cleans and organizes codebase

**Creation Agents:**
- **ProjectInitializerAgent**: Creates new projects from specifications
- **WebsiteBuilderAgent**: Creates beautiful, responsive websites
- **RequirementAnalyzerAgent**: Analyzes requirements and creates specifications

**Git Agents:**
- **CommitCreatorAgent**: Creates meaningful commit messages
- **PRCreatorAgent**: Automates pull request creation

#### 🛡️ **Task Monitoring and Recovery**
- **Real-time Health Monitoring**: Tracks task progress and health
- **Automatic Error Recovery**: Detects and recovers from common errors
- **Recovery Script Generation**: Creates scripts to fix failed tasks
- **Task Progress Tracking**: Visual progress indicators with ETA

### 🎨 Enhanced Architecture

#### 🏗️ **Command Orchestration**
- High-level command interpretation (e.g., "make project production ready")
- Automatic workflow selection based on command
- Parallel task execution for efficiency
- Smart task prioritization

#### 🔧 **Improved Error Handling**
- Pattern-based error detection
- Multiple recovery strategies per error type
- Automatic retry with exponential backoff
- User-friendly error messages with solutions

### 📈 Performance Improvements
- Parallel execution of independent tasks
- Efficient file indexing with caching
- Optimized context generation
- Reduced memory footprint

### 🐛 Bug Fixes
- Fixed TypeScript compilation errors in automation system
- Resolved sub-agent interface compatibility issues
- Improved error handling in task execution
- Enhanced stability of task monitoring

## [2.3.1] - 2025-01-29

### 🐛 Bug Fixes

#### Improved Live Output Scrolling
- **Smooth Scrolling**: Replaced abrupt scrolling with smooth 300ms animation
- **Smart Auto-Scroll**: Only auto-scrolls when user is already near the bottom
- **Scroll Position Preservation**: Maintains user scroll position when reading previous output
- **Cross-Browser Compatibility**: Added fallback for browsers without smooth scroll support
- **Performance Optimization**: Uses passive event listeners and debounced scroll detection

### 🔧 Technical Improvements
- Enhanced scroll state management with proper initialization and reset
- Fixed output jumping issues during rapid content updates
- Added 30px threshold for "near bottom" detection
- Implemented custom ease-out cubic animation for natural feel

## [2.3.0] - 2025-01-29

### 🎉 Major User Experience Overhaul

This release represents a complete transformation of AutoClaude with a focus on user-friendliness, intelligent automation, and seamless task completion.

### ✨ New Features

#### 🧙 Workflow Wizard
- **Pre-built Automation Workflows**: Ready-to-use workflows for common development tasks
  - ⚡ Quick Quality Check (2-3 minutes, Beginner)
  - 🔍 Comprehensive Code Analysis (5-10 minutes, Intermediate) 
  - 🔧 Auto-Fix Common Issues (3-8 minutes, Intermediate)
  - 🚀 Deployment Preparation (10-15 minutes, Advanced)
  - ✨ New Feature Development Setup (5-10 minutes, Intermediate)
- **Smart Workflow Suggestions**: Automatically recommends the best workflow based on project health
- **Progress Tracking**: Visual progress indicators with step-by-step execution

#### ⚡ Quick Start System
- **Interactive Setup Guide**: Step-by-step onboarding for new users
- **Contextual Help Cards**: Categorized options for getting started, common tasks, and advanced features
- **Project Health Check**: Intelligent analysis of current project state with recommendations
- **Quick Demo**: 2-minute guided tour of key features

#### ✨ Auto-Complete Current Task
- **Intelligent Task Detection**: Automatically analyzes current context and suggests completions
- **High-Confidence Automation**: Executes safe, automated fixes without user intervention
- **Smart Suggestions**: Presents manual tasks with confidence ratings and time estimates
- **Context-Aware Analysis**: Considers active files, recent changes, and user intent

#### 🤖 Advanced AI Analysis Agents
- **Context Awareness Agent**: Deep understanding of project structure and dependencies
- **Task Planning Agent**: Creates detailed implementation plans for complex features
- **Dependency Resolution Agent**: Automatic dependency management and conflict resolution
- **Code Understanding Agent**: Provides comprehensive code analysis and insights
- **Integration Testing Agent**: Automated test generation and validation
- **Performance Optimization Agent**: Identifies and suggests performance improvements
- **Security Audit Agent**: Comprehensive security vulnerability scanning

#### 🛡️ Smart Error Recovery System
- **Intelligent Error Detection**: Recognizes common error patterns and provides specific solutions
- **Automated Recovery Strategies**: Multiple recovery approaches with priority-based execution
- **User-Friendly Guidance**: Clear explanations and actionable recovery steps
- **Learning System**: Improves recovery success rates over time

### 🎨 User Interface Enhancements

#### 💫 Friendly Command Interface
- **Emoji-Rich Commands**: All commands now feature descriptive emojis and friendly titles
  - 🚀 Start AutoClaude Assistant
  - ⚡ Quick Start Guide  
  - 💬 Ask Claude Something...
  - 🔍 Run Quality Checks
  - 🔄 Auto-Fix Issues (Loop Mode)
  - 🤖 Run AI Analysis Agents
  - ✨ Auto-Complete Current Task
  - 🧙 Workflow Wizard

#### 🎯 Enhanced Context Menus
- **Explorer Integration**: Right-click folders to run quality checks or auto-complete tasks
- **Editor Integration**: Right-click selected code to ask Claude specific questions
- **Contextual Actions**: Smart suggestions based on current file type and content

#### 📢 Improved Notifications
- **Clear Progress Indicators**: Visual feedback for long-running operations
- **Actionable Messages**: Notifications include relevant next steps and options
- **Error Guidance**: Helpful error messages with recovery suggestions

### 🏗️ Architecture Improvements

#### 🔧 Modular Automation System
- **TaskCompletionEngine**: Centralized intelligence for task analysis and completion
- **WorkflowOrchestrator**: Manages complex multi-step automation workflows
- **AutomationManager**: Coordinates all automation components
- **QuickStartManager**: Handles user onboarding and guidance

#### 🧪 Enhanced Testing Infrastructure
- **Comprehensive Test Suite**: Unit tests, integration tests, and end-to-end testing
- **Mock System**: Proper VSCode API mocking for reliable testing
- **Test Categories**: Organized test structure for different components

#### 📦 Improved Error Handling
- **ErrorRecoverySystem**: Intelligent error analysis and recovery
- **Pattern Matching**: Recognizes common error types and provides targeted solutions
- **Recovery Strategies**: Multiple approaches for different error categories
- **User Guidance**: Context-aware help and suggestions

### 📚 Documentation & Usability

#### 📖 Comprehensive User Guide
- **USER_GUIDE.md**: Complete documentation for all features
- **Step-by-Step Instructions**: Detailed guides for common workflows
- **Best Practices**: Recommendations for effective usage
- **Troubleshooting**: Solutions for common issues
- **Advanced Features**: Documentation for power users

#### 🎓 Interactive Help System
- **In-App Guidance**: Contextual help throughout the interface
- **Quick Start Wizard**: Interactive setup and feature discovery
- **Smart Suggestions**: Proactive assistance based on user context

### 🔧 Enhanced Configuration

#### ⚙️ New Settings
- **Sub-Agent System**: Enable/disable advanced AI analysis agents
- **Workflow Preferences**: Customize automation behavior
- **Error Recovery**: Configure recovery strategies and retry limits
- **User Interface**: Control notification styles and interaction preferences

### 🚀 Performance Optimizations

#### ⚡ Improved Responsiveness
- **Parallel Execution**: Multiple automation tasks run concurrently
- **Smart Caching**: Reduced redundant operations
- **Resource Management**: Better memory and CPU usage
- **Background Processing**: Non-blocking automation execution

### 🐛 Bug Fixes
- **Fixed TypeScript compilation issues** in test files
- **Resolved module export problems** for better compatibility
- **Improved error handling** throughout the extension
- **Enhanced stability** of automation workflows

### 🔄 Migration Notes
- **Automatic Configuration Migration**: Existing settings are preserved and enhanced
- **Backward Compatibility**: All existing features continue to work
- **New Default Settings**: Optimized defaults for better user experience

---

## [2.2.0] - 2025-01-29

### 🚀 Major Improvements

This release brings significant enhancements to AutoClaude's reliability, automation capabilities, and script execution system.

### Added
- **Automatic Task Resumption**: Claude now automatically detects and continues unfinished tasks
  - Analyzes output for TODOs, incomplete steps, and mid-task interruptions
  - Automatically generates continuation messages with context
  - Configurable via `autoclaude.session.autoResumeUnfinishedTasks` setting
  - Smart detection with confidence levels (high/medium/low)

- **Sequential Script Execution**: Scripts now run one after another, stopping on first failure
  - Output limiting: Max 10 errors per script, 500 chars per line
  - Clear feedback on which scripts passed/failed
  - Improved error messages with context

- **Shell Script Support**: All quality check scripts converted to shell scripts
  - Better cross-platform compatibility
  - No Node.js dependency for script execution
  - Direct access to system commands
  - Production-ready with proper JSON output

### Improved
- **Claude Output Handling**: Fixed issue where output wouldn't show after clearing queue
  - Auto-restart unhealthy Claude sessions
  - Clear output buffers when clearing queue
  - Health check before processing messages

- **Script Analysis Integration**: 
  - Scripts can now send results to Claude for analysis
  - Option to analyze code even when all checks pass
  - Continuous improvement loop capability

### Fixed
- **Queue Processing**: Resolved Claude session disconnection issues
- **Output Buffer**: Fixed memory leaks in output handling
- **Error Handling**: Improved error messages and recovery mechanisms
- **Dynamic Imports**: Fixed TypeScript compatibility issues with proper dynamic imports

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
