import { Config } from '../src/core/config';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('Config', () => {
    let config: Config;
    const testConfigDir = path.join(os.tmpdir(), 'claude-autopilot-test');

    beforeEach(() => {
        // Clean up test directory
        if (fs.existsSync(testConfigDir)) {
            fs.rmSync(testConfigDir, { recursive: true });
        }
        
        // Mock home directory
        jest.spyOn(os, 'homedir').mockReturnValue(testConfigDir);
        
        config = new Config();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should create config directory if it does not exist', () => {
        const configDir = path.join(testConfigDir, '.autoclaude');
        expect(fs.existsSync(configDir)).toBe(true);
    });

    test('should have default values', () => {
        expect(config.get('session', 'skipPermissions')).toBe(true);
        expect(config.get('queue', 'maxSize')).toBe(1000);
        expect(config.get('parallelAgents', 'maxAgents')).toBe(50);
    });

    test('should set and get values', () => {
        config.set('session', 'autoStart', true);
        expect(config.get('session', 'autoStart')).toBe(true);
    });

    test('should reset to defaults', () => {
        config.set('queue', 'maxSize', 500);
        expect(config.get('queue', 'maxSize')).toBe(500);
        
        config.reset();
        expect(config.get('queue', 'maxSize')).toBe(1000);
    });

    test('should save and load from file', () => {
        const testFile = path.join(testConfigDir, 'test-config.json');
        
        config.set('ui', 'theme', 'light');
        config.saveToFile(testFile);
        
        expect(fs.existsSync(testFile)).toBe(true);
        
        const newConfig = new Config();
        newConfig.loadFromFile(testFile);
        
        expect(newConfig.get('ui', 'theme')).toBe('light');
    });
});