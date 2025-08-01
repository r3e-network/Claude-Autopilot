import Ajv from 'ajv';
import { InvalidConfigError } from '../errors';

/**
 * Configuration schema definition
 */
const configSchema = {
    type: 'object',
    required: ['paths', 'session', 'queue', 'parallelAgents', 'logging'],
    properties: {
        paths: {
            type: 'object',
            required: ['dataDir', 'logsDir', 'queueDir', 'agentsDir'],
            properties: {
                dataDir: { type: 'string', minLength: 1 },
                logsDir: { type: 'string', minLength: 1 },
                queueDir: { type: 'string', minLength: 1 },
                agentsDir: { type: 'string', minLength: 1 }
            }
        },
        session: {
            type: 'object',
            required: ['skipPermissions', 'autoStart', 'timeout', 'keepAliveInterval'],
            properties: {
                skipPermissions: { type: 'boolean' },
                autoStart: { type: 'boolean' },
                timeout: { type: 'number', minimum: 60000, maximum: 3600000 },
                keepAliveInterval: { type: 'number', minimum: 10000, maximum: 300000 },
                maxRetries: { type: 'number', minimum: 0, maximum: 10 },
                retryDelay: { type: 'number', minimum: 1000, maximum: 60000 }
            }
        },
        queue: {
            type: 'object',
            required: ['maxSize', 'maxRetries', 'retryDelay', 'persistInterval'],
            properties: {
                maxSize: { type: 'number', minimum: 10, maximum: 10000 },
                maxRetries: { type: 'number', minimum: 0, maximum: 10 },
                retryDelay: { type: 'number', minimum: 1000, maximum: 60000 },
                persistInterval: { type: 'number', minimum: 5000, maximum: 300000 },
                maxMessageSize: { type: 'number', minimum: 100, maximum: 1000000 },
                cleanupInterval: { type: 'number', minimum: 60000, maximum: 86400000 }
            }
        },
        parallelAgents: {
            type: 'object',
            required: ['enabled', 'defaultAgents', 'maxAgents'],
            properties: {
                enabled: { type: 'boolean' },
                defaultAgents: { type: 'number', minimum: 1, maximum: 10 },
                maxAgents: { type: 'number', minimum: 1, maximum: 20 },
                autoRestart: { type: 'boolean' },
                healthCheckInterval: { type: 'number', minimum: 5000, maximum: 300000 },
                builtInAgents: {
                    type: 'object',
                    properties: {
                        enabled: { type: 'boolean' },
                        types: {
                            type: 'array',
                            items: { type: 'string' }
                        }
                    }
                },
                contextGeneration: {
                    type: 'object',
                    properties: {
                        enabled: { type: 'boolean' },
                        minComplexity: { type: 'number', minimum: 1, maximum: 10 },
                        maxGeneratedAgents: { type: 'number', minimum: 1, maximum: 20 }
                    }
                }
            }
        },
        logging: {
            type: 'object',
            required: ['level', 'maxFiles', 'maxSize'],
            properties: {
                level: { 
                    type: 'string', 
                    enum: ['error', 'warn', 'info', 'debug', 'verbose'] 
                },
                maxFiles: { type: 'number', minimum: 1, maximum: 100 },
                maxSize: { type: 'string', pattern: '^\\d+[kmg]?$' },
                format: { 
                    type: 'string', 
                    enum: ['json', 'simple', 'combined'] 
                },
                console: { type: 'boolean' },
                file: { type: 'boolean' }
            }
        },
        performance: {
            type: 'object',
            properties: {
                monitoring: { type: 'boolean' },
                monitoringInterval: { type: 'number', minimum: 1000, maximum: 60000 },
                maxMemoryMB: { type: 'number', minimum: 100, maximum: 8192 },
                maxCpuPercent: { type: 'number', minimum: 10, maximum: 100 },
                gcInterval: { type: 'number', minimum: 60000, maximum: 3600000 }
            }
        },
        security: {
            type: 'object',
            properties: {
                enableSandbox: { type: 'boolean' },
                allowedCommands: {
                    type: 'array',
                    items: { type: 'string' }
                },
                maxCommandLength: { type: 'number', minimum: 10, maximum: 10000 },
                enableAudit: { type: 'boolean' }
            }
        }
    }
};

/**
 * Configuration validator class
 */
export class ConfigValidator {
    private ajv: Ajv;
    private validate: any;

    constructor() {
        this.ajv = new Ajv({ allErrors: true, useDefaults: true });
        this.validate = this.ajv.compile(configSchema);
    }

    /**
     * Validate configuration object
     */
    validateConfig(config: any): void {
        const valid = this.validate(config);
        
        if (!valid) {
            const errors = this.validate.errors.map((err: any) => {
                return `${err.instancePath} ${err.message}`;
            }).join(', ');
            
            throw new InvalidConfigError(
                `Configuration validation failed: ${errors}`,
                { errors: this.validate.errors }
            );
        }

        // Additional custom validations
        this.validateCustomRules(config);
    }

    /**
     * Custom validation rules
     */
    private validateCustomRules(config: any): void {
        // Ensure maxAgents >= defaultAgents
        if (config.parallelAgents.maxAgents < config.parallelAgents.defaultAgents) {
            throw new InvalidConfigError(
                'parallelAgents.maxAgents must be >= parallelAgents.defaultAgents'
            );
        }

        // Ensure paths don't contain dangerous characters
        const pathKeys = Object.keys(config.paths);
        for (const key of pathKeys) {
            const path = config.paths[key];
            if (path.includes('..') || path.includes('~')) {
                throw new InvalidConfigError(
                    `Path ${key} contains dangerous characters: ${path}`
                );
            }
        }

        // Validate log file size format
        if (config.logging.maxSize && !/^\d+[kmg]?$/i.test(config.logging.maxSize)) {
            throw new InvalidConfigError(
                'logging.maxSize must be in format: 10, 10k, 10m, or 10g'
            );
        }
    }

    /**
     * Get default configuration
     */
    static getDefaultConfig(): any {
        return {
            paths: {
                dataDir: './data',
                logsDir: './logs',
                queueDir: './data/queue',
                agentsDir: './data/agents'
            },
            session: {
                skipPermissions: true,
                autoStart: true,
                timeout: 600000, // 10 minutes
                keepAliveInterval: 30000, // 30 seconds
                maxRetries: 3,
                retryDelay: 5000
            },
            queue: {
                maxSize: 1000,
                maxRetries: 3,
                retryDelay: 5000,
                persistInterval: 30000,
                maxMessageSize: 50000,
                cleanupInterval: 3600000 // 1 hour
            },
            parallelAgents: {
                enabled: false,
                defaultAgents: 2,
                maxAgents: 5,
                autoRestart: true,
                healthCheckInterval: 30000,
                builtInAgents: {
                    enabled: true,
                    types: ['code-analyzer', 'test-generator']
                },
                contextGeneration: {
                    enabled: true,
                    minComplexity: 3,
                    maxGeneratedAgents: 5
                }
            },
            logging: {
                level: 'info',
                maxFiles: 5,
                maxSize: '10m',
                format: 'json',
                console: true,
                file: true
            },
            performance: {
                monitoring: true,
                monitoringInterval: 10000,
                maxMemoryMB: 500,
                maxCpuPercent: 80,
                gcInterval: 300000 // 5 minutes
            },
            security: {
                enableSandbox: true,
                allowedCommands: [
                    'tmux', 'pkill', 'pgrep', 'ps', 'df', 'which', 
                    'python', 'python3', 'node', 'npm'
                ],
                maxCommandLength: 1000,
                enableAudit: true
            }
        };
    }

    /**
     * Merge user config with defaults
     */
    static mergeWithDefaults(userConfig: any): any {
        const defaultConfig = ConfigValidator.getDefaultConfig();
        return this.deepMerge(defaultConfig, userConfig);
    }

    /**
     * Deep merge objects
     */
    private static deepMerge(target: any, source: any): any {
        const output = { ...target };
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }
        
        return output;
    }

    /**
     * Check if value is an object
     */
    private static isObject(item: any): boolean {
        return item && typeof item === 'object' && !Array.isArray(item);
    }
}