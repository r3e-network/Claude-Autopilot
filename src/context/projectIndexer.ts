import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { debugLog } from '../utils/logging';
import * as crypto from 'crypto';

export interface FileInfo {
    path: string;
    relativePath: string;
    size: number;
    lastModified: Date;
    hash: string;
    language?: string;
    symbols?: SymbolInfo[];
}

export interface SymbolInfo {
    name: string;
    kind: vscode.SymbolKind;
    range: vscode.Range;
    children?: SymbolInfo[];
}

export interface ProjectIndex {
    version: string;
    createdAt: Date;
    lastUpdated: Date;
    workspaceRoot: string;
    files: Map<string, FileInfo>;
    dependencies: DependencyInfo;
    structure: ProjectStructure;
    codebaseStats: CodebaseStats;
}

export interface DependencyInfo {
    npm?: any;
    pip?: any;
    maven?: any;
    gradle?: any;
    cargo?: any;
    go?: any;
}

export interface ProjectStructure {
    type: 'monorepo' | 'single' | 'multi-package';
    mainLanguages: string[];
    frameworks: string[];
    testFrameworks: string[];
    buildTools: string[];
    configFiles: string[];
}

export interface CodebaseStats {
    totalFiles: number;
    totalLines: number;
    filesByLanguage: Map<string, number>;
    avgFileSize: number;
    largestFiles: FileInfo[];
}

export class ProjectIndexer {
    private static instance: ProjectIndexer;
    private index: ProjectIndex | null = null;
    private fileWatcher: vscode.FileSystemWatcher | null = null;
    private indexingInProgress = false;
    private readonly cacheDir: string;
    private readonly indexFile: string;

    private constructor(private workspaceRoot: string) {
        this.cacheDir = path.join(workspaceRoot, '.autoclaude', 'cache');
        this.indexFile = path.join(this.cacheDir, 'project-index.json');
        this.ensureCacheDir();
    }

    static getInstance(workspaceRoot: string): ProjectIndexer {
        if (!ProjectIndexer.instance || ProjectIndexer.instance.workspaceRoot !== workspaceRoot) {
            ProjectIndexer.instance = new ProjectIndexer(workspaceRoot);
        }
        return ProjectIndexer.instance;
    }

    private ensureCacheDir(): void {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    async initialize(): Promise<void> {
        debugLog('Initializing project indexer...');
        
        // Try to load existing index
        if (await this.loadIndex()) {
            debugLog('Loaded existing project index');
            // Start incremental update
            this.startIncrementalIndexing();
        } else {
            // Full index
            await this.fullIndex();
        }

        // Setup file watcher
        this.setupFileWatcher();
    }

    private async loadIndex(): Promise<boolean> {
        try {
            if (fs.existsSync(this.indexFile)) {
                const data = fs.readFileSync(this.indexFile, 'utf8');
                const parsed = JSON.parse(data);
                
                // Convert Maps back from JSON
                parsed.files = new Map(parsed.files);
                parsed.codebaseStats.filesByLanguage = new Map(parsed.codebaseStats.filesByLanguage);
                
                this.index = parsed;
                return true;
            }
        } catch (error) {
            debugLog(`Failed to load index: ${error}`);
        }
        return false;
    }

    private async saveIndex(): Promise<void> {
        if (!this.index) return;

        try {
            const toSave = {
                ...this.index,
                files: Array.from(this.index.files.entries()),
                codebaseStats: {
                    ...this.index.codebaseStats,
                    filesByLanguage: Array.from(this.index.codebaseStats.filesByLanguage.entries())
                }
            };

            fs.writeFileSync(this.indexFile, JSON.stringify(toSave, null, 2));
            debugLog('Project index saved');
        } catch (error) {
            debugLog(`Failed to save index: ${error}`);
        }
    }

    async fullIndex(): Promise<ProjectIndex> {
        if (this.indexingInProgress) {
            debugLog('Indexing already in progress');
            return this.index!;
        }

        this.indexingInProgress = true;
        debugLog('Starting full project indexing...');

        try {
            const startTime = Date.now();

            this.index = {
                version: '1.0.0',
                createdAt: new Date(),
                lastUpdated: new Date(),
                workspaceRoot: this.workspaceRoot,
                files: new Map(),
                dependencies: await this.analyzeDependencies(),
                structure: await this.analyzeProjectStructure(),
                codebaseStats: {
                    totalFiles: 0,
                    totalLines: 0,
                    filesByLanguage: new Map(),
                    avgFileSize: 0,
                    largestFiles: []
                }
            };

            // Index all files
            await this.indexDirectory(this.workspaceRoot);

            // Calculate statistics
            this.calculateStats();

            // Save index
            await this.saveIndex();

            const duration = Date.now() - startTime;
            debugLog(`Project indexing completed in ${duration}ms`);

            return this.index;
        } finally {
            this.indexingInProgress = false;
        }
    }

    private async indexDirectory(dirPath: string, baseDir: string = this.workspaceRoot): Promise<void> {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(baseDir, fullPath);

            // Skip common ignore patterns
            if (this.shouldIgnore(relativePath)) {
                continue;
            }

            if (entry.isDirectory()) {
                await this.indexDirectory(fullPath, baseDir);
            } else if (entry.isFile()) {
                await this.indexSingleFile(fullPath, relativePath);
            }
        }
    }

    private async indexSingleFile(filePath: string, relativePath: string): Promise<void> {
        try {
            const stats = fs.statSync(filePath);
            const content = fs.readFileSync(filePath);
            const hash = crypto.createHash('md5').update(content).digest('hex');

            const fileInfo: FileInfo = {
                path: filePath,
                relativePath,
                size: stats.size,
                lastModified: stats.mtime,
                hash,
                language: this.detectLanguage(filePath)
            };

            // Try to get symbols for code files
            if (this.isCodeFile(filePath)) {
                try {
                    const uri = vscode.Uri.file(filePath);
                    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                        'vscode.executeDocumentSymbolProvider',
                        uri
                    );
                    if (symbols) {
                        fileInfo.symbols = this.convertSymbols(symbols);
                    }
                } catch (error) {
                    // Symbol extraction failed, continue without symbols
                }
            }

            this.index!.files.set(relativePath, fileInfo);
        } catch (error) {
            debugLog(`Failed to index file ${filePath}: ${error}`);
        }
    }

    private convertSymbols(symbols: vscode.DocumentSymbol[]): SymbolInfo[] {
        return symbols.map(symbol => ({
            name: symbol.name,
            kind: symbol.kind,
            range: symbol.range,
            children: symbol.children ? this.convertSymbols(symbol.children) : undefined
        }));
    }

    private shouldIgnore(relativePath: string): boolean {
        const ignorePatterns = [
            'node_modules',
            '.git',
            '.vscode',
            'dist',
            'build',
            'out',
            '.autoclaude/cache',
            '*.log',
            '.DS_Store',
            'thumbs.db',
            '__pycache__',
            '.pytest_cache',
            '.mypy_cache',
            'target',
            '.idea',
            '.gradle',
            '.mvn',
            'vendor'
        ];

        return ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace('*', '.*'));
                return regex.test(relativePath);
            }
            return relativePath.includes(pattern);
        });
    }

    private detectLanguage(filePath: string): string | undefined {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap: { [key: string]: string } = {
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.py': 'python',
            '.java': 'java',
            '.cpp': 'cpp',
            '.c': 'c',
            '.cs': 'csharp',
            '.go': 'go',
            '.rs': 'rust',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.r': 'r',
            '.m': 'objective-c',
            '.dart': 'dart',
            '.lua': 'lua',
            '.pl': 'perl',
            '.sh': 'shellscript',
            '.json': 'json',
            '.xml': 'xml',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.md': 'markdown',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.less': 'less',
            '.sql': 'sql'
        };

        return languageMap[ext];
    }

    private isCodeFile(filePath: string): boolean {
        const codeExtensions = [
            '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', 
            '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r', '.m',
            '.dart', '.lua', '.pl', '.sh', '.sql'
        ];
        const ext = path.extname(filePath).toLowerCase();
        return codeExtensions.includes(ext);
    }

    private async analyzeDependencies(): Promise<DependencyInfo> {
        const deps: DependencyInfo = {};

        // NPM/Node.js
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                deps.npm = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            } catch (error) {
                debugLog(`Failed to parse package.json: ${error}`);
            }
        }

        // Python
        const requirementsPath = path.join(this.workspaceRoot, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            try {
                deps.pip = fs.readFileSync(requirementsPath, 'utf8').split('\n').filter(line => line.trim());
            } catch (error) {
                debugLog(`Failed to parse requirements.txt: ${error}`);
            }
        }

        // Add more dependency analyzers as needed

        return deps;
    }

    private async analyzeProjectStructure(): Promise<ProjectStructure> {
        const structure: ProjectStructure = {
            type: 'single',
            mainLanguages: [],
            frameworks: [],
            testFrameworks: [],
            buildTools: [],
            configFiles: []
        };

        // Detect project type
        if (fs.existsSync(path.join(this.workspaceRoot, 'lerna.json')) ||
            fs.existsSync(path.join(this.workspaceRoot, 'rush.json'))) {
            structure.type = 'monorepo';
        }

        // Detect frameworks and tools
        const files = fs.readdirSync(this.workspaceRoot);
        
        // Config files
        const configPatterns = [
            'package.json', 'tsconfig.json', '.eslintrc', '.prettierrc',
            'webpack.config.js', 'vite.config.js', 'rollup.config.js',
            'jest.config.js', 'karma.conf.js', '.babelrc',
            'requirements.txt', 'setup.py', 'pyproject.toml',
            'pom.xml', 'build.gradle', 'Cargo.toml', 'go.mod'
        ];

        structure.configFiles = files.filter(file => 
            configPatterns.some(pattern => file.includes(pattern))
        );

        // Detect frameworks based on dependencies
        if (this.index?.dependencies.npm) {
            const deps = {
                ...this.index.dependencies.npm.dependencies,
                ...this.index.dependencies.npm.devDependencies
            };

            // Web frameworks
            if (deps['react']) structure.frameworks.push('React');
            if (deps['vue']) structure.frameworks.push('Vue');
            if (deps['@angular/core']) structure.frameworks.push('Angular');
            if (deps['svelte']) structure.frameworks.push('Svelte');
            if (deps['express']) structure.frameworks.push('Express');
            if (deps['fastify']) structure.frameworks.push('Fastify');
            if (deps['next']) structure.frameworks.push('Next.js');
            if (deps['nuxt']) structure.frameworks.push('Nuxt');

            // Test frameworks
            if (deps['jest']) structure.testFrameworks.push('Jest');
            if (deps['mocha']) structure.testFrameworks.push('Mocha');
            if (deps['vitest']) structure.testFrameworks.push('Vitest');
            if (deps['@testing-library/react']) structure.testFrameworks.push('React Testing Library');

            // Build tools
            if (deps['webpack']) structure.buildTools.push('Webpack');
            if (deps['vite']) structure.buildTools.push('Vite');
            if (deps['rollup']) structure.buildTools.push('Rollup');
            if (deps['esbuild']) structure.buildTools.push('ESBuild');
        }

        return structure;
    }

    private calculateStats(): void {
        if (!this.index) return;

        const stats = this.index.codebaseStats;
        stats.totalFiles = this.index.files.size;
        stats.totalLines = 0;
        
        const fileSizes: number[] = [];
        const filesBySize: FileInfo[] = [];

        for (const fileInfo of this.index.files.values()) {
            fileSizes.push(fileInfo.size);
            filesBySize.push(fileInfo);

            // Count by language
            if (fileInfo.language) {
                const count = stats.filesByLanguage.get(fileInfo.language) || 0;
                stats.filesByLanguage.set(fileInfo.language, count + 1);
            }

            // Estimate lines (rough approximation)
            if (this.isCodeFile(fileInfo.path)) {
                stats.totalLines += Math.floor(fileInfo.size / 30); // Rough estimate
            }
        }

        // Calculate average file size
        if (fileSizes.length > 0) {
            stats.avgFileSize = fileSizes.reduce((a, b) => a + b, 0) / fileSizes.length;
        }

        // Find largest files
        filesBySize.sort((a, b) => b.size - a.size);
        stats.largestFiles = filesBySize.slice(0, 10);
    }

    private setupFileWatcher(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }

        this.fileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(this.workspaceRoot, '**/*'),
            false, // Create
            false, // Change
            false  // Delete
        );

        this.fileWatcher.onDidCreate(uri => this.handleFileChange(uri, 'create'));
        this.fileWatcher.onDidChange(uri => this.handleFileChange(uri, 'change'));
        this.fileWatcher.onDidDelete(uri => this.handleFileChange(uri, 'delete'));
    }

    private async handleFileChange(uri: vscode.Uri, changeType: 'create' | 'change' | 'delete'): Promise<void> {
        const relativePath = path.relative(this.workspaceRoot, uri.fsPath);
        
        if (this.shouldIgnore(relativePath)) {
            return;
        }

        debugLog(`File ${changeType}: ${relativePath}`);

        if (!this.index) return;

        switch (changeType) {
            case 'create':
            case 'change':
                await this.indexSingleFile(uri.fsPath, relativePath);
                break;
            case 'delete':
                this.index.files.delete(relativePath);
                break;
        }

        this.index.lastUpdated = new Date();
        this.calculateStats();
        
        // Debounce saves
        this.scheduleSave();
    }

    private saveTimeout: NodeJS.Timeout | null = null;
    private scheduleSave(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.saveIndex();
        }, 5000); // Save after 5 seconds of no changes
    }

    private startIncrementalIndexing(): void {
        // Check for files that have changed since last index
        if (!this.index) return;

        debugLog('Starting incremental indexing...');
        
        for (const [relativePath, fileInfo] of this.index.files) {
            try {
                const fullPath = path.join(this.workspaceRoot, relativePath);
                if (fs.existsSync(fullPath)) {
                    const stats = fs.statSync(fullPath);
                    if (stats.mtime > new Date(fileInfo.lastModified)) {
                        // File has been modified, re-index
                        this.indexSingleFile(fullPath, relativePath);
                    }
                } else {
                    // File no longer exists
                    this.index.files.delete(relativePath);
                }
            } catch (error) {
                debugLog(`Error during incremental indexing: ${error}`);
            }
        }
    }

    getProjectContext(): string {
        if (!this.index) {
            return 'Project index not available';
        }

        const context = [`# Project Context

## Workspace
- **Root**: ${this.index.workspaceRoot}
- **Type**: ${this.index.structure.type}
- **Last Updated**: ${this.index.lastUpdated.toISOString()}

## Statistics
- **Total Files**: ${this.index.codebaseStats.totalFiles}
- **Estimated Lines**: ${this.index.codebaseStats.totalLines}
- **Average File Size**: ${Math.round(this.index.codebaseStats.avgFileSize)} bytes

## Languages
${Array.from(this.index.codebaseStats.filesByLanguage.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `- **${lang}**: ${count} files`)
    .join('\n')}

## Project Structure
- **Main Languages**: ${this.index.structure.mainLanguages.join(', ') || 'Not detected'}
- **Frameworks**: ${this.index.structure.frameworks.join(', ') || 'None detected'}
- **Test Frameworks**: ${this.index.structure.testFrameworks.join(', ') || 'None detected'}
- **Build Tools**: ${this.index.structure.buildTools.join(', ') || 'None detected'}

## Configuration Files
${this.index.structure.configFiles.map(file => `- ${file}`).join('\n')}
`];

        // Add dependency information
        if (this.index.dependencies.npm) {
            context.push(`
## NPM Dependencies
### Production
${Object.keys(this.index.dependencies.npm.dependencies || {}).slice(0, 20).join(', ')}

### Development
${Object.keys(this.index.dependencies.npm.devDependencies || {}).slice(0, 20).join(', ')}
`);
        }

        // Add largest files
        context.push(`
## Largest Files
${this.index.codebaseStats.largestFiles.slice(0, 10).map(file => 
    `- ${file.relativePath} (${Math.round(file.size / 1024)}KB)`
).join('\n')}
`);

        return context.join('\n');
    }

    async getFileContext(filePath: string): Promise<string | null> {
        if (!this.index) return null;

        const relativePath = path.relative(this.workspaceRoot, filePath);
        const fileInfo = this.index.files.get(relativePath);

        if (!fileInfo) return null;

        const context = [`# File Context: ${relativePath}

- **Size**: ${fileInfo.size} bytes
- **Language**: ${fileInfo.language || 'Unknown'}
- **Last Modified**: ${new Date(fileInfo.lastModified).toISOString()}
- **Hash**: ${fileInfo.hash}
`];

        if (fileInfo.symbols && fileInfo.symbols.length > 0) {
            context.push('\n## Symbols');
            context.push(this.formatSymbols(fileInfo.symbols));
        }

        return context.join('\n');
    }

    private formatSymbols(symbols: SymbolInfo[], indent: number = 0): string {
        return symbols.map(symbol => {
            const prefix = '  '.repeat(indent) + '- ';
            const kindName = vscode.SymbolKind[symbol.kind];
            let result = `${prefix}**${symbol.name}** (${kindName})`;
            
            if (symbol.children && symbol.children.length > 0) {
                result += '\n' + this.formatSymbols(symbol.children, indent + 1);
            }
            
            return result;
        }).join('\n');
    }

    async searchSymbols(query: string): Promise<SymbolInfo[]> {
        if (!this.index) return [];

        const results: SymbolInfo[] = [];
        const queryLower = query.toLowerCase();

        for (const fileInfo of this.index.files.values()) {
            if (fileInfo.symbols) {
                const matchingSymbols = this.searchSymbolsRecursive(fileInfo.symbols, queryLower);
                results.push(...matchingSymbols);
            }
        }

        return results;
    }

    private searchSymbolsRecursive(symbols: SymbolInfo[], query: string): SymbolInfo[] {
        const results: SymbolInfo[] = [];

        for (const symbol of symbols) {
            if (symbol.name.toLowerCase().includes(query)) {
                results.push(symbol);
            }

            if (symbol.children) {
                results.push(...this.searchSymbolsRecursive(symbol.children, query));
            }
        }

        return results;
    }

    dispose(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveIndex();
    }
}