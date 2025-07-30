import Conf from 'conf';
import path from 'path';
import os from 'os';
import fs from 'fs';

export interface ConfigSchema {
    session: {
        skipPermissions: boolean;
        autoStart: boolean;
        scheduledStartTime: string;
    };
    queue: {
        maxSize: number;
        maxMessageSize: number;
        retentionHours: number;
    };
    parallelAgents: {
        enabled: boolean;
        maxAgents: number;
        defaultAgents: number;
        staggerDelay: number;
        contextThreshold: number;
        autoRestart: boolean;
    };
    ui: {
        theme: 'dark' | 'light';
        autoScroll: boolean;
        showTimestamps: boolean;
    };
    logging: {
        level: 'error' | 'warn' | 'info' | 'debug';
        file: string | null;
    };
    paths: {
        dataDir: string;
        logsDir: string;
        scriptsDir: string;
    };
}

const defaultConfig: ConfigSchema = {
    session: {
        skipPermissions: true,
        autoStart: true,
        scheduledStartTime: ''
    },
    queue: {
        maxSize: 1000,
        maxMessageSize: 50000,
        retentionHours: 24
    },
    parallelAgents: {
        enabled: true,
        maxAgents: 50,
        defaultAgents: 3,
        staggerDelay: 10,
        contextThreshold: 20,
        autoRestart: true
    },
    ui: {
        theme: 'dark',
        autoScroll: true,
        showTimestamps: true
    },
    logging: {
        level: 'info',
        file: null
    },
    paths: {
        dataDir: path.join(os.homedir(), '.autoclaude', 'data'),
        logsDir: path.join(os.homedir(), '.autoclaude', 'logs'),
        scriptsDir: path.join(os.homedir(), '.autoclaude', 'scripts')
    }
};

export class Config {
    private store: Conf<ConfigSchema>;
    private customConfigPath?: string;

    constructor(configPath?: string) {
        this.customConfigPath = configPath;
        
        const configDir = path.join(os.homedir(), '.autoclaude');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        this.store = new Conf<ConfigSchema>({
            projectName: 'autoclaude',
            cwd: configDir,
            defaults: defaultConfig,
            schema: {
                    session: {
                        type: 'object',
                        properties: {
                            skipPermissions: { type: 'boolean' },
                            autoStart: { type: 'boolean' },
                            scheduledStartTime: { type: 'string' }
                        }
                    },
                    queue: {
                        type: 'object',
                        properties: {
                            maxSize: { type: 'number', minimum: 10, maximum: 10000 },
                            maxMessageSize: { type: 'number', minimum: 1000, maximum: 1000000 },
                            retentionHours: { type: 'number', minimum: 1, maximum: 168 }
                        }
                    },
                    parallelAgents: {
                        type: 'object',
                        properties: {
                            enabled: { type: 'boolean' },
                            maxAgents: { type: 'number', minimum: 1, maximum: 100 },
                            defaultAgents: { type: 'number', minimum: 1, maximum: 50 },
                            staggerDelay: { type: 'number', minimum: 1, maximum: 60 },
                            contextThreshold: { type: 'number', minimum: 10, maximum: 50 },
                            autoRestart: { type: 'boolean' }
                        }
                    },
                    ui: {
                        type: 'object',
                        properties: {
                            theme: { type: 'string', enum: ['dark', 'light'] },
                            autoScroll: { type: 'boolean' },
                            showTimestamps: { type: 'boolean' }
                        }
                    },
                    logging: {
                        type: 'object',
                        properties: {
                            level: { type: 'string', enum: ['error', 'warn', 'info', 'debug'] },
                            file: { type: ['string', 'null'] }
                        }
                    },
                    paths: {
                        type: 'object',
                        properties: {
                            dataDir: { type: 'string' },
                            logsDir: { type: 'string' },
                            scriptsDir: { type: 'string' }
                        }
                    }
            }
        });

        // Load custom config if provided
        if (configPath && fs.existsSync(configPath)) {
            this.loadFromFile(configPath);
        }

        // Ensure directories exist
        this.ensureDirectories();
    }

    get<K extends keyof ConfigSchema>(key: K): ConfigSchema[K];
    get<K extends keyof ConfigSchema, P extends keyof ConfigSchema[K]>(
        key: K,
        prop: P
    ): ConfigSchema[K][P];
    get(key: string, prop?: string): any {
        if (prop) {
            return this.store.get(`${key}.${prop}`);
        }
        return this.store.get(key as keyof ConfigSchema);
    }

    set<K extends keyof ConfigSchema>(key: K, value: ConfigSchema[K]): void;
    set<K extends keyof ConfigSchema, P extends keyof ConfigSchema[K]>(
        key: K,
        prop: P,
        value: ConfigSchema[K][P]
    ): void;
    set(key: string, propOrValue: any, value?: any): void {
        if (value !== undefined) {
            this.store.set(`${key}.${propOrValue}`, value);
        } else {
            this.store.set(key as keyof ConfigSchema, propOrValue);
        }
    }

    getAll(): ConfigSchema {
        return this.store.store;
    }

    reset(): void {
        this.store.clear();
        this.store.set(defaultConfig);
    }

    getConfigPath(): string {
        return this.store.path;
    }

    loadFromFile(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const config = JSON.parse(content);
            
            // Merge with existing config
            Object.entries(config).forEach(([key, value]) => {
                if (key in defaultConfig) {
                    this.store.set(key as any, value as any);
                }
            });
        } catch (error) {
            throw new Error(`Failed to load config from ${filePath}: ${error}`);
        }
    }

    saveToFile(filePath: string): void {
        try {
            const config = this.getAll();
            fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
        } catch (error) {
            throw new Error(`Failed to save config to ${filePath}: ${error}`);
        }
    }

    private ensureDirectories(): void {
        const paths = this.get('paths');
        Object.values(paths).forEach(dirPath => {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        });
    }
}