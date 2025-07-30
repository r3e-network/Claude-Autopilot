import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { debugLog } from '../utils/logging';

const fsAsync = fs.promises;

export interface SettingsBackup {
    timestamp: Date;
    filename: string;
    size: number;
    settings: any;
}

export class SettingsManager {
    private backupDir: string;
    private maxBackups: number = 10;
    private maxBackupSize: number = 200 * 1024 * 1024; // 200MB
    private settingsPath: string;
    private lockFile: string;
    private lockTimeout: number = 30000; // 30 seconds

    constructor(workspacePath: string) {
        this.backupDir = path.join(workspacePath, '.claude_agent_farm_backups');
        this.settingsPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', 'settings.json');
        this.lockFile = path.join(process.env.HOME || process.env.USERPROFILE || '', '.claude', '.agent_farm_launch.lock');
    }

    async initialize(): Promise<void> {
        // Create backup directory
        await fsAsync.mkdir(this.backupDir, { recursive: true });
        
        // Clean up stale locks
        await this.cleanupStaleLocks();
    }

    async backupSettings(fullBackup: boolean = false): Promise<string> {
        debugLog(`Creating ${fullBackup ? 'full' : 'regular'} settings backup`);
        
        try {
            // Read current settings
            const settings = await this.readSettings();
            
            // Create backup
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `settings_${timestamp}${fullBackup ? '_full' : ''}.json`;
            const backupPath = path.join(this.backupDir, backupName);
            
            await fsAsync.writeFile(backupPath, JSON.stringify(settings, null, 2));
            
            // Rotate backups if needed
            await this.rotateBackups();
            
            debugLog(`Settings backed up to ${backupName}`);
            return backupPath;
        } catch (error) {
            debugLog(`Failed to backup settings: ${error}`);
            throw error;
        }
    }

    async restoreSettings(backupPath?: string): Promise<void> {
        debugLog('Restoring settings from backup');
        
        try {
            let restorePath = backupPath;
            
            // If no path specified, use most recent backup
            if (!restorePath) {
                const backups = await this.listBackups();
                if (backups.length === 0) {
                    throw new Error('No backups available');
                }
                restorePath = backups[0].filename;
            }
            
            // Read backup
            const backupContent = await fsAsync.readFile(restorePath, 'utf-8');
            const settings = JSON.parse(backupContent);
            
            // Validate settings structure
            if (!this.validateSettings(settings)) {
                throw new Error('Invalid settings structure in backup');
            }
            
            // Write settings with proper permissions
            await this.writeSettings(settings);
            
            debugLog('Settings restored successfully');
        } catch (error) {
            debugLog(`Failed to restore settings: ${error}`);
            throw error;
        }
    }

    async acquireLock(): Promise<boolean> {
        try {
            // Check for existing lock
            try {
                const lockData = await fsAsync.readFile(this.lockFile, 'utf-8');
                const lock = JSON.parse(lockData);
                const lockAge = Date.now() - new Date(lock.timestamp).getTime();
                
                if (lockAge < this.lockTimeout) {
                    debugLog(`Lock held by process ${lock.pid}, age: ${lockAge}ms`);
                    return false;
                }
                
                // Stale lock, remove it
                debugLog('Removing stale lock');
                await fsAsync.unlink(this.lockFile);
            } catch {
                // No lock file exists
            }
            
            // Create new lock
            const lock = {
                pid: process.pid,
                timestamp: new Date().toISOString(),
                purpose: 'agent_launch'
            };
            
            await fsAsync.writeFile(this.lockFile, JSON.stringify(lock), { flag: 'wx' });
            return true;
        } catch (error) {
            debugLog(`Failed to acquire lock: ${error}`);
            return false;
        }
    }

    async releaseLock(): Promise<void> {
        try {
            await fsAsync.unlink(this.lockFile);
        } catch {
            // Lock file might not exist
        }
    }

    private async cleanupStaleLocks(): Promise<void> {
        try {
            const lockData = await fsAsync.readFile(this.lockFile, 'utf-8');
            const lock = JSON.parse(lockData);
            const lockAge = Date.now() - new Date(lock.timestamp).getTime();
            
            if (lockAge > this.lockTimeout) {
                debugLog(`Cleaning up stale lock (age: ${lockAge}ms)`);
                await fsAsync.unlink(this.lockFile);
            }
        } catch {
            // No lock file or invalid format
        }
    }

    private async readSettings(): Promise<any> {
        try {
            const content = await fsAsync.readFile(this.settingsPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            debugLog(`Failed to read settings: ${error}`);
            return {};
        }
    }

    private async writeSettings(settings: any): Promise<void> {
        const claudeDir = path.dirname(this.settingsPath);
        
        // Ensure directory exists with proper permissions
        await fsAsync.mkdir(claudeDir, { recursive: true, mode: 0o700 });
        
        // Write settings with atomic operation
        const tempPath = `${this.settingsPath}.tmp`;
        await fsAsync.writeFile(tempPath, JSON.stringify(settings, null, 2), { mode: 0o600 });
        await fsAsync.rename(tempPath, this.settingsPath);
        
        // Set proper permissions
        await fsAsync.chmod(this.settingsPath, 0o600);
        await fsAsync.chmod(claudeDir, 0o700);
    }

    private validateSettings(settings: any): boolean {
        // Basic validation - can be extended based on Claude's settings structure
        return typeof settings === 'object' && settings !== null;
    }

    private async rotateBackups(): Promise<void> {
        const backups = await this.listBackups();
        
        // Remove oldest backups if exceeding count limit
        while (backups.length > this.maxBackups) {
            const oldest = backups.pop();
            if (oldest) {
                await fsAsync.unlink(oldest.filename);
                debugLog(`Removed old backup: ${path.basename(oldest.filename)}`);
            }
        }
        
        // Check total size
        let totalSize = 0;
        for (const backup of backups) {
            totalSize += backup.size;
        }
        
        // Remove backups if exceeding size limit
        while (totalSize > this.maxBackupSize && backups.length > 1) {
            const oldest = backups.pop();
            if (oldest) {
                await fsAsync.unlink(oldest.filename);
                totalSize -= oldest.size;
                debugLog(`Removed backup to stay under size limit: ${path.basename(oldest.filename)}`);
            }
        }
        
        debugLog(`Backup storage: ${(totalSize / 1024 / 1024).toFixed(2)}MB used`);
    }

    private async listBackups(): Promise<SettingsBackup[]> {
        try {
            const files = await fsAsync.readdir(this.backupDir);
            const backups: SettingsBackup[] = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(this.backupDir, file);
                    const stat = await fsAsync.stat(filePath);
                    
                    backups.push({
                        timestamp: stat.mtime,
                        filename: filePath,
                        size: stat.size,
                        settings: null // Don't load content unless needed
                    });
                }
            }
            
            // Sort by timestamp, newest first
            backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            
            return backups;
        } catch (error) {
            debugLog(`Failed to list backups: ${error}`);
            return [];
        }
    }

    async detectCorruption(): Promise<boolean> {
        try {
            const settings = await this.readSettings();
            return !this.validateSettings(settings);
        } catch {
            return true; // Can't read = corrupted
        }
    }

    async autoRecover(): Promise<boolean> {
        if (await this.detectCorruption()) {
            debugLog('Settings corruption detected, attempting auto-recovery');
            
            try {
                await this.restoreSettings();
                return true;
            } catch (error) {
                debugLog(`Auto-recovery failed: ${error}`);
                return false;
            }
        }
        
        return false;
    }

    async getBackupStatus(): Promise<{
        backupCount: number;
        totalSize: number;
        oldestBackup: Date | null;
        newestBackup: Date | null;
    }> {
        const backups = await this.listBackups();
        let totalSize = 0;
        
        for (const backup of backups) {
            totalSize += backup.size;
        }
        
        return {
            backupCount: backups.length,
            totalSize,
            oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
            newestBackup: backups.length > 0 ? backups[0].timestamp : null
        };
    }
}