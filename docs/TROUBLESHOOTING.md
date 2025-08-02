# Claude Autopilot Troubleshooting Guide

This guide helps you diagnose and resolve common issues with Claude Autopilot.

## Quick Diagnostic Checklist

Before diving into specific issues, run through this checklist:

- [ ] **Claude CLI installed**: Run `claude --version` in terminal
- [ ] **VS Code version**: Ensure VS Code 1.74.0 or later
- [ ] **Extension active**: Check VS Code Extensions panel
- [ ] **Workspace open**: Claude Autopilot requires an open workspace
- [ ] **Internet connection**: Required for Claude API access

## Common Issues and Solutions

### 1. "Claude CLI not found" Error

**Symptoms:**
- Error message: "Claude CLI is not installed or not found in PATH"
- Extension shows dependency check failed

**Solutions:**

1. **Install Claude CLI**
   ```bash
   # Follow installation instructions at:
   # https://www.anthropic.com/claude-code
   ```

2. **Verify Installation**
   ```bash
   claude --version
   ```

3. **PATH Issues**
   - **Windows**: Add Claude installation folder to PATH environment variable
   - **macOS/Linux**: Ensure Claude is in `/usr/local/bin` or similar PATH directory
   - **Restart VS Code** after PATH changes

4. **Alternative: Use Terminal Version**
   ```bash
   npm install -g claude-autopilot
   claude-autopilot
   ```

### 2. Extension Not Starting

**Symptoms:**
- No Claude Autopilot panel appears
- Commands not available in Command Palette

**Solutions:**

1. **Check Extension Status**
   - Open VS Code Extensions panel (Ctrl+Shift+X)
   - Find "Claude Autopilot" and ensure it's enabled
   - Look for any error messages

2. **Reload Window**
   - Press Ctrl+Shift+P → "Developer: Reload Window"

3. **Check VS Code Version**
   - Requires VS Code 1.74.0 or later
   - Update VS Code if needed

4. **Reset Extension**
   - Disable Claude Autopilot extension
   - Restart VS Code
   - Re-enable extension

### 3. Claude Session Won't Start

**Symptoms:**
- "Failed to start Claude session" error
- Claude process exits immediately

**Solutions:**

1. **Check Claude Authentication**
   ```bash
   claude auth status
   claude auth login  # If not authenticated
   ```

2. **Verify Claude CLI Works**
   ```bash
   claude --help
   claude # Start interactive session manually
   ```

3. **Check Permissions**
   - Extension uses `--dangerously-skip-permissions` flag
   - Ensure this is acceptable for your environment
   - Disable in settings if needed: `autoclaude.session.skipPermissions: false`

4. **Firewall/Proxy Issues**
   - Ensure Claude can access the internet
   - Check corporate firewall settings
   - Configure proxy if needed

### 4. Messages Not Processing

**Symptoms:**
- Messages stay in "pending" status
- Queue processing appears stuck

**Solutions:**

1. **Check Claude Session Health**
   - Look for Claude session errors in the terminal output
   - Try stopping and restarting the session

2. **Queue Size Limits**
   - Check if queue is at maximum size
   - Remove or process some messages
   - Increase `autoclaude.queue.maxSize` in settings

3. **Message Size Issues**
   - Very large messages may timeout
   - Break large messages into smaller parts
   - Adjust `autoclaude.queue.maxMessageSize` if needed

4. **Rate Limiting**
   - Claude may hit API rate limits
   - Extension should auto-resume when limits reset
   - Check Claude usage in your account

### 5. Performance Issues

**Symptoms:**
- VS Code becomes slow or unresponsive
- High CPU/memory usage

**Solutions:**

1. **Reduce Queue Size**
   ```json
   {
     "autoclaude.queue.maxSize": 100,
     "autoclaude.queue.retentionHours": 12
   }
   ```

2. **Disable Debug Mode**
   ```json
   {
     "autoclaude.developmentMode": false
   }
   ```

3. **Enable Queue Cleanup**
   ```json
   {
     "autoclaude.queue.autoMaintenance": true
   }
   ```

4. **Limit Message Size**
   ```json
   {
     "autoclaude.queue.maxMessageSize": 10000,
     "autoclaude.queue.maxOutputSize": 50000
   }
   ```

### 6. Script Runner Issues

**Symptoms:**
- Quality check scripts failing
- "Script not found" errors

**Solutions:**

1. **Check Script Dependencies**
   - Ensure required tools are installed (npm, python, etc.)
   - Run scripts manually to test

2. **Script Permissions**
   ```bash
   chmod +x .autoclaude/scripts/*.sh
   ```

3. **Path Issues**
   - Scripts run from workspace root
   - Use absolute paths or ensure tools are in PATH

4. **Windows Script Issues**
   - Use `.bat` or `.cmd` files on Windows
   - Ensure PowerShell execution policy allows scripts

### 7. Configuration Problems

**Symptoms:**
- Settings not taking effect
- Validation errors on startup

**Solutions:**

1. **Reset Configuration**
   - Use Command Palette: "Claude: Reset Configuration to Defaults"
   - Or manually reset in VS Code settings

2. **Check Setting Format**
   ```json
   {
     "autoclaude.session.scheduledStartTime": "09:30",
     "autoclaude.queue.maxSize": 1000
   }
   ```

3. **Workspace vs User Settings**
   - Some settings may be overridden by workspace configuration
   - Check both levels in VS Code settings

### 8. Remote Development Issues

**Symptoms:**
- Extension doesn't work in SSH/WSL/Containers

**Solutions:**

1. **Install on Remote Host**
   ```bash
   # On the remote machine
   npm install -g claude-autopilot
   claude-autopilot
   ```

2. **Forward Ports** (if needed)
   - Configure port forwarding in VS Code
   - Ensure Claude can access remote APIs

3. **Check Remote PATH**
   - Ensure Claude CLI is available on remote machine
   - Update remote PATH if needed

## Advanced Diagnostics

### Enable Debug Logging

1. **Enable Development Mode**
   ```json
   {
     "autoclaude.developmentMode": true
   }
   ```

2. **Check Log Files**
   - Location: `.autoclaude/logs/claude-autopilot-YYYY-MM-DD.log`
   - Contains detailed execution logs

3. **Export Logs**
   - Use Command Palette: "Claude: Export Debug Logs"
   - Share with support for assistance

### Check System Resources

1. **Memory Usage**
   ```bash
   # Check VS Code memory usage
   ps aux | grep "code"
   ```

2. **Disk Space**
   - Ensure adequate disk space for logs and queue data
   - Clean up old log files if needed

3. **Network Connectivity**
   ```bash
   # Test Claude API connectivity
   curl -I https://api.anthropic.com
   ```

### Configuration Validation

Run configuration validation:
```
Command Palette → "Claude: Validate Configuration"
```

This will show any configuration issues and suggest fixes.

## Getting Additional Help

### Before Reporting Issues

1. **Check Error Console**
   - Press F12 → Console tab
   - Look for error messages

2. **Try Safe Mode**
   - Disable other extensions temporarily
   - Test if issue persists

3. **Update Everything**
   - Update VS Code
   - Update Claude CLI
   - Update Claude Autopilot extension

### Reporting Bugs

When reporting issues, please include:

1. **System Information**
   - OS version
   - VS Code version
   - Claude CLI version
   - Extension version

2. **Error Details**
   - Complete error message
   - Steps to reproduce
   - Expected vs actual behavior

3. **Configuration**
   - Relevant settings (anonymize sensitive data)
   - Workspace setup

4. **Logs**
   - Export debug logs
   - Include relevant portions

### Support Channels

- **GitHub Issues**: [https://github.com/claude-code/claude-autopilot/issues](https://github.com/claude-code/claude-autopilot/issues)
- **Discussions**: [https://github.com/claude-code/claude-autopilot/discussions](https://github.com/claude-code/claude-autopilot/discussions)

## Preventive Maintenance

### Regular Cleanup

1. **Clear Old Logs**
   ```bash
   find .autoclaude/logs -name "*.log" -mtime +7 -delete
   ```

2. **Reset Queue Periodically**
   - Clear completed messages
   - Archive important message history

3. **Update Dependencies**
   - Keep Claude CLI updated
   - Update VS Code regularly
   - Update extension when new versions are available

### Performance Optimization

1. **Optimize Settings**
   ```json
   {
     "autoclaude.queue.retentionHours": 24,
     "autoclaude.history.maxRuns": 10,
     "autoclaude.sleepPrevention.enabled": false
   }
   ```

2. **Monitor Resource Usage**
   - Check memory usage periodically
   - Restart VS Code if performance degrades

3. **Use Efficient Workflows**
   - Batch similar messages
   - Use templates for common requests
   - Leverage script automation for repetitive tasks

---

*This troubleshooting guide is regularly updated. For the latest version, check the [GitHub repository](https://github.com/claude-code/claude-autopilot).*