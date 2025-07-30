# Changelog

All notable changes to AutoClaude will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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