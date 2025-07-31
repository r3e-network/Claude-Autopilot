# Changelog

All notable changes to AutoClaude will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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