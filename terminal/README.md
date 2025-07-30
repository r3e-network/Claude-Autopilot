# Claude Autopilot Terminal 🚀

A powerful terminal-based Claude AI automation tool with parallel agents, intelligent task management, and a beautiful TUI interface.

## Features

- 🖥️ **Beautiful Terminal UI**: Built with blessed for an intuitive terminal experience
- 🤖 **Parallel Agents**: Run up to 50+ Claude agents simultaneously
- 📋 **Smart Queue Management**: Advanced message queue with persistence
- 🔄 **Auto-Processing**: Continuous processing with automatic retries
- 🎯 **Quality Checks**: Built-in code quality verification
- ⚡ **Performance**: Optimized for server environments
- 🔧 **Configurable**: Extensive configuration options
- 📊 **Real-time Monitoring**: Live agent status and performance metrics

## Installation

### Global Installation (Recommended)

```bash
npm install -g claude-autopilot
```

### Local Installation

```bash
git clone https://github.com/r3e-network/Claude-Autopilot.git
cd Claude-Autopilot/terminal
npm install
npm link
```

## Prerequisites

- Node.js 16+ 
- Claude CLI (install from https://claude.ai/cli)
- tmux (for parallel agents feature)
- Linux/macOS terminal

## Quick Start

### Interactive Mode (Default)

```bash
claude-autopilot
# or use the short alias
cap
```

### Process Single Message

```bash
claude-autopilot run "Explain quantum computing"
```

### Batch Processing

```bash
claude-autopilot batch messages.txt --parallel 5
```

### Start Parallel Agents

```bash
claude-autopilot agents --start 10
```

## Commands

### Main Commands

- `start` - Start interactive mode (default)
- `run <message>` - Run single message and exit
- `batch <file>` - Process messages from file
- `agents` - Manage parallel agents
- `queue` - Manage message queue
- `config` - Manage configuration
- `check` - Run quality checks

### Examples

```bash
# Start with initial message
claude-autopilot start -m "Help me refactor this code" -a

# Run with output to file
claude-autopilot run "Generate a README" -o README.md

# Batch processing with 10 agents
claude-autopilot batch tasks.txt -p 10

# Start agent farm
claude-autopilot agents -s 20

# Run quality checks in loop mode
claude-autopilot check -l -m 5
```

## Keyboard Shortcuts

### Global
- `Ctrl+S` - Start processing
- `Ctrl+X` - Stop processing
- `Ctrl+L` - Clear Claude output
- `Ctrl+A` - Toggle auto-scroll
- `Tab` - Navigate between widgets
- `Q` - Quit

### Message Input
- `Ctrl+Enter` - Send message
- `Escape` - Clear input

### Queue
- `D` - Delete selected message
- `C` - Clear all messages

## Configuration

Configuration file: `~/.claude-autopilot/config.json`

```json
{
  "session": {
    "skipPermissions": true,
    "autoStart": false
  },
  "queue": {
    "maxSize": 1000,
    "retentionHours": 24
  },
  "parallelAgents": {
    "enabled": true,
    "maxAgents": 50,
    "defaultAgents": 5
  },
  "ui": {
    "theme": "dark",
    "autoScroll": true
  }
}
```

### Edit Configuration

```bash
# View all settings
claude-autopilot config -l

# Set a value
claude-autopilot config -s session.autoStart=true

# Open in editor
claude-autopilot config -e
```

## Parallel Agents

The parallel agents feature uses tmux to manage multiple Claude instances:

```bash
# Start 20 agents
claude-autopilot agents -s 20

# Monitor agents
claude-autopilot agents -m

# List running agents
claude-autopilot agents -l

# Stop all agents
claude-autopilot agents -k
```

## Quality Checks

Run automated quality checks on your project:

```bash
# Single run
claude-autopilot check

# Loop until fixed (max 5 iterations)
claude-autopilot check -l -m 5

# Custom directory
claude-autopilot check -d /path/to/project
```

Default checks:
- Production readiness (TODOs, FIXMEs)
- Build verification
- Test execution
- Linting

## Server Usage

Perfect for headless server environments:

```bash
# Run in background with nohup
nohup claude-autopilot batch tasks.txt -p 20 &

# Use with screen
screen -S claude-autopilot
claude-autopilot start

# Use with systemd (create service file)
[Service]
ExecStart=/usr/local/bin/claude-autopilot start -a
Restart=always
```

## Advanced Usage

### Custom Scripts

Add custom check scripts to `~/.claude-autopilot/scripts/`:

```bash
#!/bin/bash
# ~/.claude-autopilot/scripts/05-security-check.sh
echo "Running security audit..."
npm audit || exit 1
```

### Batch File Format

```text
# tasks.txt
Refactor the authentication module
Add comprehensive tests for the API
Document the deployment process
Optimize database queries
```

### Environment Variables

```bash
# Set custom config location
export CLAUDE_AUTOPILOT_CONFIG=/custom/path/config.json

# Enable debug logging
export LOG_LEVEL=debug

# Set custom data directory
export CLAUDE_AUTOPILOT_DATA=/custom/data
```

## Troubleshooting

### Claude CLI not found
```bash
# Install Claude CLI first
curl -fsSL https://claude.ai/cli/install.sh | sh
```

### tmux not found
```bash
# Ubuntu/Debian
sudo apt-get install tmux

# macOS
brew install tmux

# RHEL/CentOS
sudo yum install tmux
```

### Permission issues
```bash
# Fix permissions
chmod +x ~/.claude-autopilot/scripts/*.sh
```

## Development

```bash
# Clone repository
git clone https://github.com/r3e-network/Claude-Autopilot.git
cd Claude-Autopilot/terminal

# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

- Issues: https://github.com/r3e-network/Claude-Autopilot/issues
- Discussions: https://github.com/r3e-network/Claude-Autopilot/discussions

---

Made with ❤️ by the AutoClaude Team