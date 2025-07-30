import winston from 'winston';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export class Logger {
    private winston: winston.Logger;
    private level: LogLevel = 'info';

    constructor(logFile?: string) {
        const transports: winston.transport[] = [
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.timestamp({ format: 'HH:mm:ss' }),
                    winston.format.printf(({ timestamp, level, message, ...meta }) => {
                        const coloredLevel = this.colorizeLevel(level);
                        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                        return `${chalk.gray(timestamp)} ${coloredLevel} ${message}${metaStr}`;
                    })
                )
            })
        ];

        if (logFile) {
            const logDir = path.dirname(logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            transports.push(
                new winston.transports.File({
                    filename: logFile,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    )
                })
            );
        }

        this.winston = winston.createLogger({
            level: this.level,
            transports
        });
    }

    setLevel(level: LogLevel): void {
        this.level = level;
        this.winston.level = level;
    }

    error(message: string, ...args: any[]): void {
        this.winston.error(message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.winston.warn(message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.winston.info(message, ...args);
    }

    debug(message: string, ...args: any[]): void {
        this.winston.debug(message, ...args);
    }

    log(level: LogLevel, message: string, ...args: any[]): void {
        this.winston.log(level, message, ...args);
    }

    private colorizeLevel(level: string): string {
        const colors: { [key: string]: (text: string) => string } = {
            error: chalk.red,
            warn: chalk.yellow,
            info: chalk.blue,
            debug: chalk.gray
        };

        const colorFn = colors[level] || chalk.white;
        return colorFn(level.toUpperCase().padEnd(5));
    }
}