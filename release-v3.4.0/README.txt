Claude Autopilot Release v3.4.0 - Corrected
==========================================

This release includes:

1. Terminal Package (v3.4.0) - Major Security & Reliability Release
   - File: r3e-autoclaude-3.4.0.tgz
   - Install: npm install -g r3e-autoclaude-3.4.0.tgz
   
2. VS Code Extension (v3.4.0) - Fixed directory structure
   - File: autoclaude-3.4.0.vsix
   - Install: code --install-extension autoclaude-3.4.0.vsix

IMPORTANT FIX:
- Now correctly creates .autoclaude folders instead of .autopilot
- Users will only see .autoclaude directory structure
- Consistent naming throughout the entire codebase

What's New in v3.4.0:

Terminal:
- Enhanced Security: Command injection prevention, path traversal protection
- Professional Error Handling: Comprehensive error hierarchy with recovery
- Performance Monitoring: Real-time CPU/memory tracking with leak detection
- Configuration Validation: JSON Schema validation with AJV
- Production Ready: TypeScript strict mode, comprehensive logging
- Enhanced Documentation: Complete user guide and troubleshooting

VS Code Extension:
- Enhanced Security Integration: Better integration with secure terminal features
- Professional Error Handling: Improved error reporting and recovery
- Performance Monitoring Support: Enhanced monitoring capabilities
- Production Ready Features: Aligned with terminal production readiness
- FIXED: Directory structure now uses .autoclaude consistently

See RELEASE_NOTES_3.4.0.md for full details.