import updateNotifier from 'update-notifier';
import chalk from 'chalk';

const pkg = {
    name: 'claude-autopilot',
    version: '3.0.0'
};

export async function checkForUpdates(): Promise<void> {
    const notifier = updateNotifier({
        pkg,
        updateCheckInterval: 1000 * 60 * 60 * 24 // 24 hours
    });

    if (notifier.update) {
        const message = [
            '',
            chalk.yellow('╭─────────────────────────────────────────────────────╮'),
            chalk.yellow('│                                                     │'),
            chalk.yellow('│') + chalk.cyan('   Update available ') + chalk.gray(notifier.update.current) + ' → ' + chalk.green(notifier.update.latest) + chalk.yellow('              │'),
            chalk.yellow('│') + chalk.white('   Run ') + chalk.cyan('npm install -g claude-autopilot') + chalk.white(' to update') + chalk.yellow('   │'),
            chalk.yellow('│                                                     │'),
            chalk.yellow('╰─────────────────────────────────────────────────────╯'),
            ''
        ].join('\n');

        console.log(message);
    }
}