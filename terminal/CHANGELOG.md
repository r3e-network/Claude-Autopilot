# Changelog

All notable changes to AutoClaude will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.9] - 2025-07-31

### Enhanced Robustness & Auto-Recovery System
- **Comprehensive health monitoring** with periodic health checks
- **Automatic session recovery** when Claude becomes unresponsive
- **Session context preservation** during recovery attempts
- **Real-time health status** in /health command

### Added
- `HealthMonitor` class for detecting stuck or unhealthy sessions
- `SessionRecoveryManager` for automatic recovery with retry logic
- Health check integration showing session uptime and success rates
- Recovery status indicators in terminal UI
- Context buffer preservation across session restarts
- Configurable recovery options (max retries, delays, auto-recovery)

### Improved
- Better error detection and reporting throughout the system
- Enhanced `/health` command with recovery status information
- More resilient message handling with automatic retries
- Progress indicators for recovery attempts
- User-friendly recovery messages and guidance

### Technical Details
- Health checks run every 30 seconds to detect unresponsive sessions
- Automatic recovery attempts up to 3 times with exponential backoff
- Session context preserved in rolling buffer (last 10 interactions)
- Recovery events emitted for monitoring and logging
- Graceful degradation when recovery fails

## [3.2.8] - 2025-07-31

### Major Fix: Python PTY Wrapper Implementation
- **Ported VS Code extension's Python PTY wrapper** to terminal tool
- Now uses the same proven approach as the VS Code extension
- Handles Claude Code CLI's rich terminal UI properly
- Fixes all connection timeout issues

### Added
- Python PTY wrapper script that properly handles terminal emulation
- Automatic Python detection (supports Python 3.8+)
- Better handling of Claude's interactive terminal interface
- Debug logging from PTY wrapper for troubleshooting

### Technical Details
- Terminal now spawns Python wrapper instead of Claude directly
- Wrapper creates proper pseudo-terminal (PTY) for Claude
- Handles ANSI escape codes and rich UI elements correctly
- Same implementation as VS Code extension for consistency

## [3.2.7] - 2025-07-31

### Fixed
- Fixed Claude Code CLI connection timeout issues
- Improved response detection for Claude Code CLI output format
- Added better debugging with raw output logging
- Enhanced response completion detection with more Claude Code patterns
- Fixed message echo detection to start collecting responses immediately

### Improved
- Added support for Claude Code specific prompts and response patterns
- Better handling of various Claude response endings (checkmarks, success indicators)
- More robust timeout handling with proper cleanup

## [3.2.6] - 2025-07-31

### Aligned with VS Code Extension
- Version sync with VS Code extension v3.2.6
- All the performance improvements from the VS Code extension apply to shared components
- Improved dependency management and security updates
- Better Node.js 18+ compatibility

### Inherited Improvements
- Enhanced build system optimizations
- Zero security vulnerabilities in shared dependencies
- Production-ready optimizations

## [3.2.5] - 2025-07-31

### Fixed
- Fixed configuration error "Cannot read properties of undefined (reading 'minComplexity')"
- Added safety checks for contextGeneration config that might be missing
- Made configuration validation more robust with proper null checks

## [3.2.4] - 2025-07-31

### Added
- Real-time waiting indicator showing elapsed time while Claude processes requests
- Progress callback support in session.sendMessage() method
- Visual feedback showing "Waiting for Claude... Xs" or "Xm Ys" format

### Improved
- Increased timeout from 1 minute to 5 minutes for longer Claude responses
- Better user experience with clear visual indication of processing time
- Cleaner terminal output with proper line clearing after responses

## [3.2.3] - 2025-07-31

### Fixed
- Fixed Claude session timeout issues:
  - Improved response completion detection with more Claude Code CLI patterns
  - Added inactivity-based timeout (5 seconds) for better response handling
  - Increased main timeout from 30s to 60s for longer responses
  - Added support for detecting responses ending with '?' or '.'
  - Enhanced message collection to handle Claude Code CLI output format

### Improved
- More robust session handling for various Claude response patterns
- Better timeout management for complex queries
- Enhanced error recovery for session communication

## [3.2.2] - 2025-07-30

### Added
- Production-ready features for enterprise deployment
- Comprehensive rate limiting (30 requests/minute by default)
- Resource monitoring with automatic high memory warnings
- Health check command (`/health`) showing system metrics:
  - Memory usage statistics
  - Queue status and counts
  - Session health verification
  - Agent system status
  - Disk space monitoring
  - Performance metrics with average response times
- Enhanced production logging with Winston:
  - Separate error, combined, and metrics log files
  - Log rotation with size limits
  - Performance tracking and metrics logging
  - Security event logging with sensitive data redaction
  - Session-based logging with unique IDs
- Graceful shutdown handling with proper cleanup:
  - Resource monitoring stop
  - Agent termination
  - Queue state preservation
  - Session cleanup
  - Logger metrics export
- Input validation and sanitization:
  - Maximum input length limits
  - Dangerous command detection and blocking
  - XSS/injection prevention

### Improved
- Error handling with proper recovery mechanisms
- Memory efficiency and resource management
- System stability for long-running operations
- Performance tracking with average response times
- Security posture with input sanitization

### Fixed
- TypeScript compilation errors with duplicate format properties
- Logger error method parameter count issue
- Missing queue method reference (getQueuedCount → getPendingMessages)

## [3.1.5] - 2025-07-30

### Fixed
- Fixed Ctrl+Enter key binding for sending messages in terminal UI
- Added multiple fallback key bindings (Ctrl+M, Enter) for message input
- Added debug logging to help troubleshoot input issues
- Improved focus handling for message input widget
- Added global key handler fallback when widget-level handlers don't work

### Improved
- Enhanced message input reliability and responsiveness
- Better user feedback for input interactions

## [3.1.4] - 2025-07-30

### Fixed
- Fixed npm package to include compiled JavaScript files (dist directory)
- Updated package.json files array to include necessary build artifacts
- Fixed prepublishOnly script to build before publishing

## [3.1.3] - 2025-07-30

### Changed
- **BREAKING**: Rebranded from "Claude Autopilot" to "AutoClaude" throughout codebase
- Updated package name to `@r3e/autoclaude` for npm registry
- Updated configuration directory from `.claude-autopilot` to `.autoclaude`
- Updated all UI labels, banners, and terminal titles to reflect AutoClaude branding
- Updated CLI class name from `ClaudeAutopilotCLI` to `AutoClaudeCLI`

### Fixed
- Fixed TypeScript compilation errors with blessed library types
- Fixed UI rendering issues with blessed widgets by replacing grid layout with direct widgets
- Fixed configuration schema validation errors in Conf library
- Fixed application crashes when tmux is not installed (parallel agents now properly disabled)
- Fixed "Cannot read properties of undefined (reading 'length')" error in UI components

### Improved
- Enhanced UI stability with simplified blessed widget implementation
- Better error handling for missing dependencies
- More robust configuration system
- Improved logging and status messages

## [3.1.2] - Previous Release
- Initial working version with various fixes and improvements

## [3.1.1] - Previous Release
- Bug fixes and stability improvements

## [3.1.0] - Previous Release
- Major feature additions and improvements