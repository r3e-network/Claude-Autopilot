import { spawn, SpawnOptions } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { Logger } from './logger';

/**
 * Secure command execution utility to prevent command injection
 */
export class SecureExec {
    private static readonly ALLOWED_COMMANDS = new Set([
        'tmux', 'pkill', 'pgrep', 'ps', 'df', 'which', 'python', 'python3', 'node'
    ]);

    private static readonly FORBIDDEN_CHARS = /[;&|`$(){}[\]<>]/g;
    private static readonly PATH_TRAVERSAL_PATTERN = /\.\.[\/\\]/;

    constructor(private logger: Logger) {}

    /**
     * Validates a command is safe to execute
     */
    private validateCommand(command: string): void {
        if (!SecureExec.ALLOWED_COMMANDS.has(command)) {
            throw new Error(`Command '${command}' is not in the allowed list`);
        }
    }

    /**
     * Validates arguments don't contain dangerous characters
     */
    private validateArgs(args: string[]): void {
        for (const arg of args) {
            if (SecureExec.FORBIDDEN_CHARS.test(arg)) {
                throw new Error(`Argument contains forbidden characters: ${arg}`);
            }
            if (SecureExec.PATH_TRAVERSAL_PATTERN.test(arg)) {
                throw new Error(`Argument contains path traversal attempt: ${arg}`);
            }
        }
    }

    /**
     * Validates a file path is safe
     */
    public validatePath(filePath: string, allowedBasePaths: string[]): string {
        const normalizedPath = path.normalize(path.resolve(filePath));
        
        // Check for path traversal
        if (SecureExec.PATH_TRAVERSAL_PATTERN.test(filePath)) {
            throw new Error(`Path traversal detected in: ${filePath}`);
        }

        // Ensure path is within allowed directories
        const isAllowed = allowedBasePaths.some(basePath => {
            const normalizedBase = path.normalize(path.resolve(basePath));
            return normalizedPath.startsWith(normalizedBase);
        });

        if (!isAllowed) {
            throw new Error(`Path '${filePath}' is outside allowed directories`);
        }

        return normalizedPath;
    }

    /**
     * Safely escape a string for shell use (when absolutely necessary)
     */
    public escapeShellArg(arg: string): string {
        // Replace single quotes with '\'' and wrap in single quotes
        return `'${arg.replace(/'/g, "'\\''")}'`;
    }

    /**
     * Execute a command safely without shell interpretation
     */
    public async exec(command: string, args: string[] = [], options: SpawnOptions = {}): Promise<{ stdout: string; stderr: string }> {
        this.validateCommand(command);
        this.validateArgs(args);

        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                ...options,
                shell: false // Never use shell
            });

            let stdout = '';
            let stderr = '';

            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('error', (error) => {
                this.logger.error(`Command execution error: ${error.message}`, {
                    command,
                    args,
                    error
                });
                reject(error);
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    const error = new Error(`Command failed with exit code ${code}`);
                    this.logger.error('Command execution failed', {
                        command,
                        args,
                        code,
                        stderr
                    });
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    /**
     * Execute a command with timeout
     */
    public async execWithTimeout(
        command: string, 
        args: string[] = [], 
        timeoutMs: number = 30000,
        options: SpawnOptions = {}
    ): Promise<{ stdout: string; stderr: string }> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Command timeout')), timeoutMs);
        });

        try {
            return await Promise.race([
                this.exec(command, args, options),
                timeoutPromise
            ]);
        } catch (error) {
            if (error instanceof Error && error.message === 'Command timeout') {
                this.logger.error('Command timed out', { command, args, timeoutMs });
                // Try to kill the process
                try {
                    await this.exec('pkill', ['-f', command]);
                } catch (killError) {
                    // Ignore kill errors
                }
            }
            throw error;
        }
    }

    /**
     * Check if a command exists in the system
     */
    public async commandExists(command: string): Promise<boolean> {
        try {
            const { stdout } = await this.exec('which', [command]);
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }
}

/**
 * Global secure execution instance
 */
let secureExecInstance: SecureExec | null = null;

export function getSecureExec(logger: Logger): SecureExec {
    if (!secureExecInstance) {
        secureExecInstance = new SecureExec(logger);
    }
    return secureExecInstance;
}