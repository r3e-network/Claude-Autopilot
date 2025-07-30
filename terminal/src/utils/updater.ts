import updateNotifier from 'update-notifier';
import chalk from 'chalk';

const pkg = {
    name: '@r3e/autoclaude',
    version: '3.1.5'
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
            chalk.yellow('│') + chalk.white('   Run ') + chalk.cyan('npm install -g @r3e/autoclaude') + chalk.white(' to update') + chalk.yellow('   │'),
            chalk.yellow('│                                                     │'),
            chalk.yellow('╰─────────────────────────────────────────────────────╯'),
            ''
        ].join('\n');

        console.log(message);
    }
}