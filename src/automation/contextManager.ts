import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { debugLog } from '../utils/logging';

interface FileRelation {
    file: string;
    score: number;
    reason: string;
}

interface ImportInfo {
    file: string;
    imports: string[];
    exports: string[];
}

export class ContextManager {
    private fileRelations: Map<string, Set<string>> = new Map();
    private recentFiles: string[] = [];
    private importGraph: Map<string, ImportInfo> = new Map();
    private readonly MAX_RECENT_FILES = 10;
    private readonly MAX_CONTEXT_FILES = 5;
    
    constructor(private workspacePath: string) {}
    
    /**
     * Get relevant files for the current context
     */
    async getRelevantFiles(currentFile: string, message: string): Promise<string[]> {
        debugLog(`Getting relevant files for: ${currentFile}`);
        const relevantFiles = new Set<string>();
        
        // Always include current file
        if (currentFile && fs.existsSync(currentFile)) {
            relevantFiles.add(currentFile);
        }
        
        // 1. Get files based on imports/exports
        const importRelated = await this.getImportRelatedFiles(currentFile);
        importRelated.forEach(file => relevantFiles.add(file));
        
        // 2. Get recently modified files
        const recentlyModified = this.getRecentlyModifiedFiles();
        recentlyModified.forEach(file => relevantFiles.add(file));
        
        // 3. Get files mentioned in the message
        const mentionedFiles = await this.getFilesFromMessage(message);
        mentionedFiles.forEach(file => relevantFiles.add(file));
        
        // 4. Get test files for implementation files (and vice versa)
        const testFiles = await this.getRelatedTestFiles(currentFile);
        testFiles.forEach(file => relevantFiles.add(file));
        
        // 5. Get files with similar names (same module)
        const similarFiles = await this.getSimilarFiles(currentFile);
        similarFiles.forEach(file => relevantFiles.add(file));
        
        // Score and limit files
        const scoredFiles = await this.scoreFiles(Array.from(relevantFiles), currentFile, message);
        return scoredFiles.slice(0, this.MAX_CONTEXT_FILES);
    }
    
    /**
     * Track file modifications for better context
     */
    trackFileModification(file: string) {
        this.recentFiles = [file, ...this.recentFiles.filter(f => f !== file)].slice(0, this.MAX_RECENT_FILES);
        debugLog(`Tracked file modification: ${file}`);
    }
    
    /**
     * Track file relationships (files modified together)
     */
    trackFileRelation(file1: string, file2: string) {
        if (!this.fileRelations.has(file1)) {
            this.fileRelations.set(file1, new Set());
        }
        if (!this.fileRelations.has(file2)) {
            this.fileRelations.set(file2, new Set());
        }
        this.fileRelations.get(file1)!.add(file2);
        this.fileRelations.get(file2)!.add(file1);
    }
    
    /**
     * Get files related through imports/exports
     */
    private async getImportRelatedFiles(file: string): Promise<string[]> {
        const related: string[] = [];
        
        if (!fs.existsSync(file)) return related;
        
        try {
            const content = fs.readFileSync(file, 'utf8');
            
            // Extract imports (works for JS/TS, Python, Go, etc.)
            const importPatterns = [
                // JavaScript/TypeScript
                /import\s+.*?\s+from\s+['"](.+?)['"]/g,
                /require\s*\(['"](.+?)['"]\)/g,
                // Python
                /from\s+(\S+)\s+import/g,
                /import\s+(\S+)/g,
                // Go
                /import\s+[("]\s*(.+?)\s*[)"]/g,
                // Java
                /import\s+([\w.]+);/g,
                // C#
                /using\s+([\w.]+);/g
            ];
            
            for (const pattern of importPatterns) {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    const importPath = match[1];
                    const resolvedPath = this.resolveImportPath(file, importPath);
                    if (resolvedPath && fs.existsSync(resolvedPath)) {
                        related.push(resolvedPath);
                    }
                }
            }
        } catch (error) {
            debugLog(`Error analyzing imports for ${file}: ${error}`);
        }
        
        return related;
    }
    
    /**
     * Resolve import path to actual file path
     */
    private resolveImportPath(fromFile: string, importPath: string): string | null {
        const dir = path.dirname(fromFile);
        const ext = path.extname(fromFile);
        
        // Skip external modules
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            return null;
        }
        
        // Try different extensions
        const extensions = [ext, '.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.java', '.cs'];
        
        for (const extension of extensions) {
            const candidates = [
                path.resolve(dir, importPath + extension),
                path.resolve(dir, importPath, 'index' + extension),
                path.resolve(dir, importPath)
            ];
            
            for (const candidate of candidates) {
                if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                    return candidate;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Get recently modified files
     */
    private getRecentlyModifiedFiles(): string[] {
        return this.recentFiles.filter(file => fs.existsSync(file));
    }
    
    /**
     * Extract file paths mentioned in the message
     */
    private async getFilesFromMessage(message: string): Promise<string[]> {
        const files: string[] = [];
        
        // Common file path patterns
        const patterns = [
            /([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)/g,  // file.ext
            /(['"])([^'"]+\.[a-zA-Z]+)\1/g,      // "file.ext" or 'file.ext'
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(message)) !== null) {
                const filePath = match[2] || match[1];
                const fullPath = path.isAbsolute(filePath) 
                    ? filePath 
                    : path.join(this.workspacePath, filePath);
                    
                if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
                    files.push(fullPath);
                }
            }
        }
        
        return files;
    }
    
    /**
     * Get related test files
     */
    private async getRelatedTestFiles(file: string): Promise<string[]> {
        const related: string[] = [];
        const basename = path.basename(file, path.extname(file));
        const dir = path.dirname(file);
        
        // Common test file patterns
        const testPatterns = [
            `${basename}.test`,
            `${basename}.spec`,
            `${basename}_test`,
            `test_${basename}`,
            `${basename}Test`
        ];
        
        // Common test directories
        const testDirs = [
            dir,
            path.join(dir, '__tests__'),
            path.join(dir, 'test'),
            path.join(dir, 'tests'),
            path.join(dir, '../test'),
            path.join(dir, '../tests'),
            path.join(dir, '../__tests__')
        ];
        
        for (const testDir of testDirs) {
            if (!fs.existsSync(testDir)) continue;
            
            for (const pattern of testPatterns) {
                const files = await vscode.workspace.findFiles(
                    `${path.relative(this.workspacePath, testDir)}/${pattern}.*`,
                    null,
                    10
                );
                files.forEach(file => related.push(file.fsPath));
            }
        }
        
        return related;
    }
    
    /**
     * Get files with similar names (same module/component)
     */
    private async getSimilarFiles(file: string): Promise<string[]> {
        const basename = path.basename(file, path.extname(file));
        const dir = path.dirname(file);
        
        const similar: string[] = [];
        const patterns = [
            `${basename}.*`,           // Same name, different extension
            `${basename}.types.*`,     // Type definitions
            `${basename}.interface.*`, // Interfaces
            `${basename}.model.*`,     // Models
            `${basename}.service.*`,   // Services
            `${basename}.controller.*` // Controllers
        ];
        
        for (const pattern of patterns) {
            const files = await vscode.workspace.findFiles(
                `${path.relative(this.workspacePath, dir)}/${pattern}`,
                null,
                10
            );
            files.forEach(file => similar.push(file.fsPath));
        }
        
        return similar;
    }
    
    /**
     * Score files by relevance
     */
    private async scoreFiles(files: string[], currentFile: string, message: string): Promise<string[]> {
        const scored: FileRelation[] = [];
        
        for (const file of files) {
            let score = 0;
            let reasons: string[] = [];
            
            // Current file gets highest score
            if (file === currentFile) {
                score += 100;
                reasons.push('current file');
            }
            
            // Recently modified files
            const recentIndex = this.recentFiles.indexOf(file);
            if (recentIndex !== -1) {
                score += 50 - (recentIndex * 5);
                reasons.push('recently modified');
            }
            
            // Files mentioned in message
            if (message.includes(path.basename(file))) {
                score += 40;
                reasons.push('mentioned in message');
            }
            
            // Related through imports
            const imports = await this.getImportRelatedFiles(currentFile);
            if (imports.includes(file)) {
                score += 30;
                reasons.push('imported');
            }
            
            // Test files
            if (file.includes('test') || file.includes('spec')) {
                score += 20;
                reasons.push('test file');
            }
            
            // Previously modified together
            if (this.fileRelations.get(currentFile)?.has(file)) {
                score += 25;
                reasons.push('modified together');
            }
            
            scored.push({
                file,
                score,
                reason: reasons.join(', ')
            });
        }
        
        // Sort by score
        scored.sort((a, b) => b.score - a.score);
        
        debugLog('Scored files:');
        scored.slice(0, 10).forEach(({ file, score, reason }) => {
            debugLog(`  ${path.relative(this.workspacePath, file)}: ${score} (${reason})`);
        });
        
        return scored.map(s => s.file);
    }
    
    /**
     * Generate context prompt with relevant files
     */
    async generateContextPrompt(files: string[], message: string): Promise<string> {
        let prompt = '';
        
        // Add file contents
        for (const file of files) {
            if (!fs.existsSync(file)) continue;
            
            try {
                const content = fs.readFileSync(file, 'utf8');
                const relativePath = path.relative(this.workspacePath, file);
                prompt += `\n\n=== File: ${relativePath} ===\n${content}`;
            } catch (error) {
                debugLog(`Error reading file ${file}: ${error}`);
            }
        }
        
        // Add original message
        prompt += `\n\n=== Task ===\n${message}`;
        
        // Add context hints
        prompt += '\n\n=== Context ===\n';
        prompt += '- The files above are provided for context\n';
        prompt += '- Please consider their relationships and dependencies\n';
        prompt += '- Ensure any changes maintain compatibility\n';
        
        return prompt;
    }
}