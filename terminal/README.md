# AutoClaude Terminal 🚀

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
npm install -g @r3e/autoclaude
```

### Local Installation

```bash
git clone https://github.com/r3e-network/AutoClaude.git
cd AutoClaude/terminal
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
autoclaude
# or use the short alias
cap
```

### Process Single Message

```bash
autoclaude run "Explain quantum computing"
```

### Batch Processing

```bash
autoclaude batch messages.txt --parallel 5
```

### Start Parallel Agents

```bash
autoclaude agents --start 10
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
autoclaude start -m "Help me refactor this code" -a

# Run with output to file
autoclaude run "Generate a README" -o README.md

# Batch processing with 10 agents
autoclaude batch tasks.txt -p 10

# Start agent farm
autoclaude agents -s 20

# Run quality checks in loop mode
autoclaude check -l -m 5
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

Configuration file: `~/.autoclaude/config.json`

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
autoclaude config -l

# Set a value
autoclaude config -s session.autoStart=true

# Open in editor
autoclaude config -e
```

## Parallel Agents

The parallel agents feature uses tmux to manage multiple Claude instances:

```bash
# Start 20 agents
autoclaude agents -s 20

# Monitor agents
autoclaude agents -m

# List running agents
autoclaude agents -l

# Stop all agents
autoclaude agents -k
```

## Quality Checks

Run automated quality checks on your project:

```bash
# Single run
autoclaude check

# Loop until fixed (max 5 iterations)
autoclaude check -l -m 5

# Custom directory
autoclaude check -d /path/to/project
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
nohup autoclaude batch tasks.txt -p 20 &

# Use with screen
screen -S autoclaude
autoclaude start

# Use with systemd (create service file)
[Service]
ExecStart=/usr/local/bin/autoclaude start -a
Restart=always
```

## Advanced Usage

### Custom Scripts

Add custom check scripts to `~/.autoclaude/scripts/`:

```bash
#!/bin/bash
# ~/.autoclaude/scripts/05-security-check.sh
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
export AUTOCLAUDE_CONFIG=/custom/path/config.json

# Enable debug logging
export LOG_LEVEL=debug

# Set custom data directory
export AUTOCLAUDE_DATA=/custom/data
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
chmod +x ~/.autoclaude/scripts/*.sh
```

## Development

```bash
# Clone repository
git clone https://github.com/r3e-network/AutoClaude.git
cd AutoClaude/terminal

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

- Issues: https://github.com/r3e-network/AutoClaude/issues
- Discussions: https://github.com/r3e-network/AutoClaude/discussions

---

Made with ❤️ by the AutoClaude Team