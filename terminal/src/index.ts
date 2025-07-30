#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { ClaudeAutopilotCLI } from './core/cli';
import { Config } from './core/config';
import { Logger } from './utils/logger';
import { checkForUpdates } from './utils/updater';

const logger = new Logger();
const config = new Config();

// ASCII Art Banner
function showBanner(): void {
    console.log(
        chalk.cyan(
            figlet.textSync('Claude Autopilot', {
                font: 'ANSI Shadow',
                horizontalLayout: 'default',
                verticalLayout: 'default'
            })
        )
    );
    console.log(chalk.gray('   Terminal-based Claude AI Automation Tool v3.0.0\n'));
}

// Check for updates
async function checkUpdates(): Promise<void> {
    try {
        await checkForUpdates();
    } catch (error) {
        logger.debug('Update check failed:', error);
    }
}

// Main CLI setup
const program = new Command();

program
    .name('claude-autopilot')
    .description('Powerful terminal-based Claude AI automation tool')
    .version('3.0.0')
    .option('-q, --quiet', 'Suppress banner and non-essential output')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-c, --config <path>', 'Use custom config file')
    .hook('preAction', async (thisCommand) => {
        const opts = thisCommand.opts();
        
        if (!opts.quiet) {
            showBanner();
        }
        
        if (opts.verbose) {
            logger.setLevel('debug');
        }
        
        if (opts.config) {
            config.loadFromFile(opts.config);
        }
        
        await checkUpdates();
    });

// Start interactive mode (default)
program
    .command('start', { isDefault: true })
    .description('Start Claude Autopilot in interactive mode')
    .option('-m, --message <text>', 'Add initial message to queue')
    .option('-s, --skip-permissions', 'Skip Claude permission prompts')
    .option('-a, --auto-start', 'Automatically start processing queue')
    .action(async (options) => {
        const cli = new ClaudeAutopilotCLI(config, logger);
        await cli.start(options);
    });

// Run with a single message
program
    .command('run <message>')
    .description('Run Claude with a single message and exit')
    .option('-s, --skip-permissions', 'Skip Claude permission prompts')
    .option('-o, --output <file>', 'Save output to file')
    .action(async (message, options) => {
        const cli = new ClaudeAutopilotCLI(config, logger);
        await cli.runSingle(message, options);
    });

// Batch processing from file
program
    .command('batch <file>')
    .description('Process messages from a file')
    .option('-s, --skip-permissions', 'Skip Claude permission prompts')
    .option('-p, --parallel <count>', 'Number of parallel agents', '1')
    .action(async (file, options) => {
        const cli = new ClaudeAutopilotCLI(config, logger);
        await cli.runBatch(file, options);
    });

// Parallel agents management
program
    .command('agents')
    .description('Manage parallel Claude agents')
    .option('-s, --start <count>', 'Start N parallel agents')
    .option('-l, --list', 'List running agents')
    .option('-k, --stop', 'Stop all agents')
    .option('-m, --monitor', 'Open agent monitor dashboard')
    .action(async (options) => {
        const cli = new ClaudeAutopilotCLI(config, logger);
        await cli.manageAgents(options);
    });

// Queue management
program
    .command('queue')
    .description('Manage message queue')
    .option('-l, --list', 'List messages in queue')
    .option('-a, --add <message>', 'Add message to queue')
    .option('-c, --clear', 'Clear all messages')
    .option('-r, --remove <id>', 'Remove message by ID')
    .action(async (options) => {
        const cli = new ClaudeAutopilotCLI(config, logger);
        await cli.manageQueue(options);
    });

// Configuration management
program
    .command('config')
    .description('Manage configuration')
    .option('-l, --list', 'List all settings')
    .option('-s, --set <key=value>', 'Set configuration value')
    .option('-g, --get <key>', 'Get configuration value')
    .option('-r, --reset', 'Reset to defaults')
    .option('-e, --edit', 'Open config in editor')
    .action(async (options) => {
        const cli = new ClaudeAutopilotCLI(config, logger);
        await cli.manageConfig(options);
    });

// Script runner
program
    .command('check')
    .description('Run quality checks on your project')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .option('-l, --loop', 'Run in loop mode until all issues fixed')
    .option('-m, --max-iterations <n>', 'Maximum loop iterations', '5')
    .action(async (options) => {
        const cli = new ClaudeAutopilotCLI(config, logger);
        await cli.runChecks(options);
    });

// Error handling
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Parse arguments
program.parse(process.argv);