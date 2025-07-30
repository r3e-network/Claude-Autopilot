#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

console.log(chalk.cyan('\n🚀 Setting up Claude Autopilot...\n'));

// Create config directory
const configDir = path.join(os.homedir(), '.claude-autopilot');
const dirs = [
    configDir,
    path.join(configDir, 'data'),
    path.join(configDir, 'logs'),
    path.join(configDir, 'scripts'),
    path.join(configDir, 'templates')
];

dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(chalk.green('✓'), `Created ${dir}`);
    }
});

// Check for Claude CLI
try {
    require('child_process').execSync('which claude', { stdio: 'ignore' });
    console.log(chalk.green('✓'), 'Claude CLI found');
} catch (error) {
    console.log(chalk.yellow('⚠'), 'Claude CLI not found. Please install it from: https://claude.ai/cli');
}

// Check for tmux
try {
    require('child_process').execSync('which tmux', { stdio: 'ignore' });
    console.log(chalk.green('✓'), 'tmux found (required for parallel agents)');
} catch (error) {
    console.log(chalk.yellow('⚠'), 'tmux not found. Install it to use parallel agents feature');
}

// Create example config
const exampleConfig = {
    session: {
        skipPermissions: true,
        autoStart: false
    },
    ui: {
        theme: 'dark',
        autoScroll: true
    },
    parallelAgents: {
        enabled: false,
        maxAgents: 10
    }
};

const configFile = path.join(configDir, 'config.example.json');
if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify(exampleConfig, null, 2));
    console.log(chalk.green('✓'), 'Created example config file');
}

console.log(chalk.green('\n✅ Setup complete!'));
console.log(chalk.blue('\nQuick start:'));
console.log('  claude-autopilot         # Start interactive mode');
console.log('  claude-autopilot --help  # Show all commands');
console.log('  cap                      # Short alias\n');