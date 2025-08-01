# Claude Autopilot User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Basic Usage](#basic-usage)
3. [Terminal Mode](#terminal-mode)
4. [Commands Reference](#commands-reference)
5. [Configuration](#configuration)
6. [Parallel Agents](#parallel-agents)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Getting Started

### Installation

```bash
npm install -g @r3e/autoclaude
```

### First Run

```bash
# Start in terminal mode
autoclaude terminal

# Or send a single message
autoclaude send "Help me write a Python script"
```

### Authentication

Claude Autopilot uses the Claude Code CLI under the hood. Make sure you have Claude Code CLI authenticated:

```bash
claude login
```

## Basic Usage

### Terminal Mode

The interactive terminal mode provides the best experience:

```bash
autoclaude terminal
```

Once in terminal mode, you can:
- Type messages and press Enter to send them to Claude
- Use slash commands for system control
- Enable parallel agents for complex tasks
- Monitor system health and performance

### Single Message Mode

For quick tasks or scripting:

```bash
autoclaude send "Explain how async/await works in JavaScript"
```

### Batch Processing

Process multiple messages from a file:

```bash
autoclaude batch messages.txt --output results.txt
```

## Terminal Mode

Terminal mode is the primary interface for Claude Autopilot. It provides:

### Features
- **Interactive Chat**: Natural conversation with Claude
- **Command Auto-completion**: Type `/` and use arrow keys
- **Real-time Monitoring**: View Claude's output in real-time
- **Queue Management**: Process multiple tasks efficiently
- **Health Monitoring**: Automatic session recovery

### Keyboard Shortcuts
- `Enter`: Send message
- `Ctrl+C`: Exit terminal mode
- `↑/↓`: Navigate command suggestions
- `Tab`: Complete commands
- `Esc`: Cancel current input

## Commands Reference

### Terminal Commands

All commands in terminal mode start with `/`:

#### System Status
- `/status` - Show system status and active tasks
- `/health` - Display detailed health check
- `/agents` - View agent information
- `/queue` - Check message queue status
- `/config` - Show current configuration

#### Control Commands
- `/start` - Start processing queued messages
- `/stop` - Stop processing
- `/clear` - Clear the message queue
- `/test` - Test terminal functionality
- `/help` - Display help information

#### Agent Management
- `/enable-agents` - Enable parallel processing
- `/disable-agents` - Disable parallel processing
- `/generate-agents <context>` - Generate context-specific agents
- `/list-agents` - List all available agents

#### Monitoring
- `/log` - Show real-time Claude output (press Enter to stop)

### CLI Commands

```bash
# Terminal mode
autoclaude terminal [options]
  --skip-permissions    Skip permission prompts
  --auto-start         Auto-start processing
  --parallel <n>       Enable n parallel agents

# Send single message
autoclaude send <message> [options]
  --output <file>      Save response to file
  --timeout <ms>       Set response timeout

# Batch processing
autoclaude batch <file> [options]
  --output <file>      Save results to file
  --parallel <n>       Process with n agents

# Agent management
autoclaude agents [action]
  start <n>            Start n agents
  stop                 Stop all agents
  list                 List active agents
  restart              Restart agents

# Queue management
autoclaude queue [action]
  list                 List queued messages
  clear                Clear queue
  retry                Retry failed messages
  export <file>        Export queue to file

# Configuration
autoclaude config [action]
  show                 Show configuration
  set <key> <value>    Set config value
  reset                Reset to defaults
  validate             Validate config
```

## Configuration

### Configuration File

Configuration is stored in `~/.autoclaude/config.json`:

```json
{
  "session": {
    "skipPermissions": true,
    "autoStart": true,
    "timeout": 600000,
    "keepAliveInterval": 30000
  },
  "queue": {
    "maxSize": 1000,
    "maxRetries": 3,
    "retryDelay": 5000
  },
  "parallelAgents": {
    "enabled": false,
    "defaultAgents": 2,
    "maxAgents": 5
  },
  "logging": {
    "level": "info",
    "maxFiles": 5,
    "maxSize": "10m"
  }
}
```

### Key Settings

#### Session Settings
- `skipPermissions`: Auto-accept Claude permission prompts
- `autoStart`: Start processing immediately
- `timeout`: Maximum time for responses (ms)
- `keepAliveInterval`: Keep session active interval (ms)

#### Queue Settings
- `maxSize`: Maximum queue size
- `maxRetries`: Retry attempts for failed messages
- `retryDelay`: Delay between retries (ms)

#### Agent Settings
- `enabled`: Enable/disable parallel processing
- `defaultAgents`: Number of agents to start
- `maxAgents`: Maximum allowed agents

#### Logging Settings
- `level`: Log level (error/warn/info/debug)
- `maxFiles`: Maximum log files to keep
- `maxSize`: Maximum log file size

### Environment Variables

```bash
# Override config file location
export AUTOCLAUDE_CONFIG=/path/to/config.json

# Set log level
export AUTOCLAUDE_LOG_LEVEL=debug

# Set data directory
export AUTOCLAUDE_DATA_DIR=/path/to/data
```

## Parallel Agents

Parallel agents allow processing multiple tasks simultaneously:

### Enabling Agents

```bash
# In terminal mode
/enable-agents

# Or via CLI
autoclaude terminal --parallel 4
```

### Built-in Agent Types

1. **code-analyzer**: Analyzes code structure and quality
2. **documentation-writer**: Creates comprehensive docs
3. **test-generator**: Generates test suites
4. **refactor-specialist**: Optimizes code structure
5. **security-auditor**: Identifies vulnerabilities

### Context-Based Agents

Generate agents based on your task:

```bash
/generate-agents build a React component with TypeScript
```

This will create specialized agents for:
- React component development
- TypeScript type definitions
- Testing React components
- Performance optimization

## Troubleshooting

### Common Issues

#### Session Not Starting
```bash
# Check Claude CLI authentication
claude whoami

# Kill zombie processes
pkill -f claude

# Restart with verbose logging
AUTOCLAUDE_LOG_LEVEL=debug autoclaude terminal
```

#### High Memory Usage
```bash
# Check system status
/status

# Clear queue and restart
/clear
/stop
# Restart terminal
```

#### Session Timeouts
- Increase timeout in config: `session.timeout`
- Check network connectivity
- Enable auto-recovery in config

### Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| `Session not active` | Claude session crashed | Restart terminal mode |
| `Queue full` | Too many pending messages | Clear queue or increase `queue.maxSize` |
| `Command timeout` | Response took too long | Increase `session.timeout` |
| `Path traversal detected` | Security violation | Use absolute paths |

### Debug Mode

Enable debug logging for detailed information:

```bash
# Set environment variable
export AUTOCLAUDE_LOG_LEVEL=debug

# Or in config
{
  "logging": {
    "level": "debug"
  }
}
```

### Log Files

Logs are stored in `~/.autoclaude/logs/`:
- `autoclaude-YYYY-MM-DD.log`: Daily logs
- `error.log`: Error-only logs
- `metrics.log`: Performance metrics

## Best Practices

### 1. Task Organization
- Break complex tasks into smaller messages
- Use the queue for batch processing
- Enable agents for parallel work

### 2. Performance
- Monitor memory usage with `/status`
- Clear completed messages regularly
- Limit parallel agents based on system resources

### 3. Reliability
- Enable auto-recovery for long sessions
- Set appropriate timeouts
- Use batch mode for large workloads

### 4. Security
- Never include sensitive data in messages
- Use environment variables for secrets
- Review logs before sharing

### 5. Efficiency Tips

#### For Development Tasks
```bash
# Enable specialized agents
/enable-agents
/generate-agents typescript react project

# Process multiple files
autoclaude batch refactor-tasks.txt --parallel 4
```

#### For Documentation
```bash
# Use documentation specialist
/list-agents
# Send documentation requests
```

#### For Testing
```bash
# Generate comprehensive tests
/generate-agents unit testing jest typescript
```

## Advanced Usage

### Custom Scripts

Create automation scripts:

```javascript
// process-codebase.js
const { exec } = require('child_process');

const tasks = [
  "Analyze src/index.ts for improvements",
  "Generate tests for src/utils/",
  "Document the API endpoints"
];

tasks.forEach(task => {
  exec(`autoclaude send "${task}" --output results/${Date.now()}.txt`);
});
```

### Integration with CI/CD

```yaml
# .github/workflows/code-review.yml
name: AI Code Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install AutoClaude
        run: npm install -g @r3e/autoclaude
      - name: Run AI Review
        run: |
          autoclaude send "Review the changes in this PR" \
            --output review.md
      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const review = fs.readFileSync('review.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: review
            });
```

### Monitoring and Metrics

Access performance metrics:

```bash
# View current metrics
/status

# Export metrics
cat ~/.autoclaude/logs/metrics.log | jq '.'
```

## Support

### Getting Help
- GitHub Issues: [Report bugs or request features](https://github.com/anthropics/autoclaude)
- Documentation: Check `/help` in terminal mode
- Logs: Review `~/.autoclaude/logs/` for errors

### Contributing
We welcome contributions! See CONTRIBUTING.md for guidelines.

### License
MIT License - see LICENSE file for details.