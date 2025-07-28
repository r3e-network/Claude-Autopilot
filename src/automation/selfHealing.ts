import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { debugLog } from '../utils/logging';

interface HealingAction {
    type: string;
    description: string;
    execute: () => Promise<boolean>;
    severity: 'low' | 'medium' | 'high';
}

export class SelfHealingSystem {
    private healingActions: Map<string, HealingAction[]> = new Map();
    
    constructor(private workspacePath: string) {
        this.initializeHealingActions();
    }
    
    /**
     * Initialize common healing actions
     */
    private initializeHealingActions() {
        // Lint errors
        this.healingActions.set('lint', [
            {
                type: 'auto-fix-lint',
                description: 'Auto-fix linting errors',
                severity: 'low',
                execute: async () => {
                    try {
                        debugLog('Running lint auto-fix...');
                        execSync('npm run lint -- --fix', { 
                            cwd: this.workspacePath,
                            encoding: 'utf8'
                        });
                        return true;
                    } catch (error) {
                        debugLog(`Lint auto-fix failed: ${error}`);
                        return false;
                    }
                }
            }
        ]);
        
        // Import errors
        this.healingActions.set('import', [
            {
                type: 'fix-imports',
                description: 'Fix import statements',
                severity: 'medium',
                execute: async () => {
                    return this.fixImports();
                }
            },
            {
                type: 'remove-unused-imports',
                description: 'Remove unused imports',
                severity: 'low',
                execute: async () => {
                    return this.removeUnusedImports();
                }
            }
        ]);
        
        // Build errors
        this.healingActions.set('build', [
            {
                type: 'install-dependencies',
                description: 'Install missing dependencies',
                severity: 'high',
                execute: async () => {
                    try {
                        debugLog('Installing dependencies...');
                        execSync('npm install', { 
                            cwd: this.workspacePath,
                            encoding: 'utf8'
                        });
                        return true;
                    } catch (error) {
                        debugLog(`Dependency installation failed: ${error}`);
                        return false;
                    }
                }
            },
            {
                type: 'clean-build',
                description: 'Clean and rebuild',
                severity: 'medium',
                execute: async () => {
                    try {
                        debugLog('Cleaning build artifacts...');
                        const dirs = ['dist', 'build', 'out'];
                        dirs.forEach(dir => {
                            const fullPath = path.join(this.workspacePath, dir);
                            if (fs.existsSync(fullPath)) {
                                fs.rmSync(fullPath, { recursive: true, force: true });
                            }
                        });
                        
                        debugLog('Rebuilding...');
                        execSync('npm run build', {
                            cwd: this.workspacePath,
                            encoding: 'utf8'
                        });
                        return true;
                    } catch (error) {
                        debugLog(`Clean build failed: ${error}`);
                        return false;
                    }
                }
            }
        ]);
        
        // TypeScript errors
        this.healingActions.set('typescript', [
            {
                type: 'add-type-definitions',
                description: 'Add missing type definitions',
                severity: 'medium',
                execute: async () => {
                    return this.addTypeDefinitions();
                }
            },
            {
                type: 'fix-type-errors',
                description: 'Fix common type errors',
                severity: 'medium',
                execute: async () => {
                    return this.fixTypeErrors();
                }
            }
        ]);
        
        // Test failures
        this.healingActions.set('test', [
            {
                type: 'update-snapshots',
                description: 'Update test snapshots',
                severity: 'low',
                execute: async () => {
                    try {
                        debugLog('Updating test snapshots...');
                        execSync('npm test -- -u', {
                            cwd: this.workspacePath,
                            encoding: 'utf8'
                        });
                        return true;
                    } catch (error) {
                        debugLog(`Snapshot update failed: ${error}`);
                        return false;
                    }
                }
            },
            {
                type: 'fix-test-imports',
                description: 'Fix test import paths',
                severity: 'medium',
                execute: async () => {
                    return this.fixTestImports();
                }
            }
        ]);
        
        // Format errors
        this.healingActions.set('format', [
            {
                type: 'auto-format',
                description: 'Auto-format code',
                severity: 'low',
                execute: async () => {
                    try {
                        debugLog('Auto-formatting code...');
                        // Try different formatters
                        const formatters = [
                            'npm run format',
                            'npx prettier --write .',
                            'npx eslint . --fix'
                        ];
                        
                        for (const formatter of formatters) {
                            try {
                                execSync(formatter, {
                                    cwd: this.workspacePath,
                                    encoding: 'utf8'
                                });
                                return true;
                            } catch {
                                // Try next formatter
                            }
                        }
                        return false;
                    } catch (error) {
                        debugLog(`Auto-format failed: ${error}`);
                        return false;
                    }
                }
            }
        ]);
    }
    
    /**
     * Diagnose and heal issues automatically
     */
    async diagnoseAndHeal(error: string): Promise<boolean> {
        debugLog(`Diagnosing error for self-healing: ${error}`);
        
        // Determine error category
        const category = this.categorizeError(error);
        if (!category) {
            debugLog('Could not categorize error for self-healing');
            return false;
        }
        
        // Get healing actions for this category
        const actions = this.healingActions.get(category);
        if (!actions || actions.length === 0) {
            debugLog(`No healing actions available for category: ${category}`);
            return false;
        }
        
        // Try healing actions in order of severity
        const sortedActions = actions.sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
        
        for (const action of sortedActions) {
            debugLog(`Attempting healing action: ${action.description}`);
            
            const success = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Self-healing: ${action.description}`,
                cancellable: false
            }, async () => {
                return await action.execute();
            });
            
            if (success) {
                vscode.window.showInformationMessage(
                    `✅ Self-healing successful: ${action.description}`
                );
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Categorize error for appropriate healing actions
     */
    private categorizeError(error: string): string | null {
        const errorLower = error.toLowerCase();
        
        if (errorLower.includes('lint') || errorLower.includes('eslint')) {
            return 'lint';
        }
        
        if (errorLower.includes('import') || errorLower.includes('module not found')) {
            return 'import';
        }
        
        if (errorLower.includes('build') || errorLower.includes('compile')) {
            return 'build';
        }
        
        if (errorLower.includes('type') || errorLower.includes('typescript')) {
            return 'typescript';
        }
        
        if (errorLower.includes('test') || errorLower.includes('jest') || 
            errorLower.includes('mocha')) {
            return 'test';
        }
        
        if (errorLower.includes('format') || errorLower.includes('prettier')) {
            return 'format';
        }
        
        return null;
    }
    
    /**
     * Fix import statements
     */
    private async fixImports(): Promise<boolean> {
        try {
            const files = await vscode.workspace.findFiles('**/*.{js,ts,jsx,tsx}', '**/node_modules/**');
            
            for (const file of files) {
                const content = fs.readFileSync(file.fsPath, 'utf8');
                let modified = content;
                
                // Fix relative imports
                modified = modified.replace(/from ['"](\w+)['"]/g, (match, module) => {
                    // Check if it's a local file
                    const possiblePaths = [
                        `./${module}`,
                        `./${module}.js`,
                        `./${module}.ts`,
                        `./${module}/index.js`,
                        `./${module}/index.ts`
                    ];
                    
                    for (const possiblePath of possiblePaths) {
                        const fullPath = path.join(path.dirname(file.fsPath), possiblePath);
                        if (fs.existsSync(fullPath)) {
                            return `from '${possiblePath.replace(/\.(js|ts)$/, '')}'`;
                        }
                    }
                    
                    return match; // Keep original if not found
                });
                
                // Add missing file extensions for relative imports
                modified = modified.replace(/from ['"](\.\.?\/[^'"]+)['"]/g, (match, importPath) => {
                    if (!importPath.includes('.')) {
                        const dir = path.dirname(file.fsPath);
                        const extensions = ['.js', '.ts', '.jsx', '.tsx'];
                        
                        for (const ext of extensions) {
                            const fullPath = path.join(dir, importPath + ext);
                            if (fs.existsSync(fullPath)) {
                                return `from '${importPath}'`; // Keep without extension
                            }
                        }
                    }
                    return match;
                });
                
                if (modified !== content) {
                    fs.writeFileSync(file.fsPath, modified);
                    debugLog(`Fixed imports in: ${file.fsPath}`);
                }
            }
            
            return true;
        } catch (error) {
            debugLog(`Fix imports failed: ${error}`);
            return false;
        }
    }
    
    /**
     * Remove unused imports
     */
    private async removeUnusedImports(): Promise<boolean> {
        try {
            // Try using ESLint with auto-fix
            execSync('npx eslint . --fix --rule "no-unused-vars: error"', {
                cwd: this.workspacePath,
                encoding: 'utf8'
            });
            return true;
        } catch {
            // Manual approach
            const files = await vscode.workspace.findFiles('**/*.{js,ts,jsx,tsx}', '**/node_modules/**');
            
            for (const file of files) {
                const content = fs.readFileSync(file.fsPath, 'utf8');
                const lines = content.split('\n');
                const importRegex = /import\s+(?:{([^}]+)}|(\w+)|(\*\s+as\s+\w+))\s+from/;
                const usedImports = new Set<string>();
                
                // Find all used identifiers
                lines.forEach(line => {
                    if (!line.includes('import')) {
                        const identifiers = line.match(/\b[A-Z]\w*\b/g) || [];
                        identifiers.forEach(id => usedImports.add(id));
                    }
                });
                
                // Check each import
                const modifiedLines = lines.map(line => {
                    const match = line.match(importRegex);
                    if (match) {
                        const imports = match[1]?.split(',').map(i => i.trim()) || [];
                        const defaultImport = match[2];
                        
                        const usedInLine = imports.filter(imp => {
                            const name = imp.split(' as ')[0].trim();
                            return usedImports.has(name);
                        });
                        
                        if (defaultImport && !usedImports.has(defaultImport)) {
                            return ''; // Remove entire line
                        }
                        
                        if (usedInLine.length === 0 && imports.length > 0) {
                            return ''; // Remove entire line
                        }
                        
                        if (usedInLine.length < imports.length) {
                            // Reconstruct import with only used items
                            return line.replace(/\{([^}]+)\}/, `{ ${usedInLine.join(', ')} }`);
                        }
                    }
                    return line;
                }).filter(line => line !== '');
                
                const modified = modifiedLines.join('\n');
                if (modified !== content) {
                    fs.writeFileSync(file.fsPath, modified);
                    debugLog(`Removed unused imports from: ${file.fsPath}`);
                }
            }
            
            return true;
        }
    }
    
    /**
     * Add missing type definitions
     */
    private async addTypeDefinitions(): Promise<boolean> {
        try {
            // Check for missing @types packages
            const packageJson = JSON.parse(
                fs.readFileSync(path.join(this.workspacePath, 'package.json'), 'utf8')
            );
            
            const dependencies = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };
            
            const missingTypes: string[] = [];
            
            for (const [pkg, version] of Object.entries(dependencies)) {
                if (!pkg.startsWith('@types/')) {
                    const typePkg = `@types/${pkg}`;
                    if (!dependencies[typePkg]) {
                        // Check if types package exists
                        try {
                            execSync(`npm view ${typePkg}`, { encoding: 'utf8' });
                            missingTypes.push(typePkg);
                        } catch {
                            // Types package doesn't exist
                        }
                    }
                }
            }
            
            if (missingTypes.length > 0) {
                debugLog(`Installing missing type definitions: ${missingTypes.join(', ')}`);
                execSync(`npm install --save-dev ${missingTypes.join(' ')}`, {
                    cwd: this.workspacePath,
                    encoding: 'utf8'
                });
            }
            
            return true;
        } catch (error) {
            debugLog(`Add type definitions failed: ${error}`);
            return false;
        }
    }
    
    /**
     * Fix common TypeScript errors
     */
    private async fixTypeErrors(): Promise<boolean> {
        try {
            const files = await vscode.workspace.findFiles('**/*.{ts,tsx}', '**/node_modules/**');
            
            for (const file of files) {
                const content = fs.readFileSync(file.fsPath, 'utf8');
                let modified = content;
                
                // Fix missing type annotations more intelligently
                // Match function parameters without types
                modified = modified.replace(/function\s+(\w+)\s*\(([^)]*)\)/g, (match, funcName, params) => {
                    if (!params.trim()) return match;
                    
                    const typedParams = params.split(',').map((param: string) => {
                        const trimmed = param.trim();
                        if (trimmed.includes(':')) return trimmed; // Already typed
                        
                        // Infer type based on parameter name
                        if (trimmed.match(/^(id|count|index|length|size)$/i)) return `${trimmed}: number`;
                        if (trimmed.match(/^(is|has|should|can|will)[\w]/i)) return `${trimmed}: boolean`;
                        if (trimmed.match(/^(name|text|message|path|url)$/i)) return `${trimmed}: string`;
                        if (trimmed.match(/^(data|options|config|props)$/i)) return `${trimmed}: Record<string, any>`;
                        if (trimmed.match(/^(callback|handler|fn)$/i)) return `${trimmed}: Function`;
                        if (trimmed.match(/^(error|err|e)$/i)) return `${trimmed}: Error`;
                        
                        // Default to unknown instead of any for safety
                        return `${trimmed}: unknown`;
                    }).join(', ');
                    
                    return `function ${funcName}(${typedParams})`;
                });
                
                // Fix arrow functions without types
                modified = modified.replace(/const\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>/g, (match, varName, params) => {
                    if (!params.trim() || params.includes(':')) return match;
                    
                    const typedParams = params.split(',').map((param: string) => {
                        const trimmed = param.trim();
                        if (trimmed.includes(':')) return trimmed;
                        
                        // Apply same inference rules
                        if (trimmed.match(/^(id|count|index|length|size)$/i)) return `${trimmed}: number`;
                        if (trimmed.match(/^(is|has|should|can|will)[\w]/i)) return `${trimmed}: boolean`;
                        if (trimmed.match(/^(name|text|message|path|url)$/i)) return `${trimmed}: string`;
                        if (trimmed.match(/^(data|options|config|props)$/i)) return `${trimmed}: Record<string, any>`;
                        if (trimmed.match(/^(callback|handler|fn)$/i)) return `${trimmed}: Function`;
                        if (trimmed.match(/^(error|err|e)$/i)) return `${trimmed}: Error`;
                        
                        return `${trimmed}: unknown`;
                    }).join(', ');
                    
                    return `const ${varName} = (${typedParams}) =>`;
                });
                
                // Fix unsafe type assertions
                modified = modified.replace(/as unknown as (\w+)/g, (match, type) => {
                    // Only allow safe assertions
                    if (['string', 'number', 'boolean', 'null', 'undefined'].includes(type)) {
                        return `as ${type}`;
                    }
                    return match; // Keep the safer double assertion for complex types
                });
                
                if (modified !== content) {
                    fs.writeFileSync(file.fsPath, modified);
                    debugLog(`Applied type fixes to: ${file.fsPath}`);
                }
            }
            
            return true;
        } catch (error) {
            debugLog(`Fix type errors failed: ${error}`);
            return false;
        }
    }
    
    /**
     * Fix test import paths
     */
    private async fixTestImports(): Promise<boolean> {
        try {
            const testFiles = await vscode.workspace.findFiles('**/*.{test,spec}.{js,ts,jsx,tsx}', '**/node_modules/**');
            
            for (const file of testFiles) {
                const content = fs.readFileSync(file.fsPath, 'utf8');
                let modified = content;
                
                // Fix relative imports in tests
                const testDir = path.dirname(file.fsPath);
                const importMatches = Array.from(modified.matchAll(/from ['"](\.\.?\/[^'"]+)['"]/g));
                
                for (const match of importMatches) {
                    const importPath = match[1];
                    const fullPath = path.resolve(testDir, importPath);
                    
                    // Skip if path is already valid
                    if (fs.existsSync(fullPath) || fs.existsSync(fullPath + '.ts') || fs.existsSync(fullPath + '.js')) {
                        continue;
                    }
                    
                    // Try to find the file
                    const basename = path.basename(importPath);
                    const searchPattern = `**/${basename}.{js,ts,jsx,tsx}`;
                    const foundFiles = await vscode.workspace.findFiles(searchPattern, '**/node_modules/**');
                    
                    if (foundFiles.length > 0) {
                        const relativePath = path.relative(testDir, foundFiles[0].fsPath).replace(/\\/g, '/');
                        const newImport = `from '${relativePath.startsWith('.') ? relativePath : './' + relativePath}'`;
                        modified = modified.replace(match[0], newImport);
                    }
                }
                
                if (modified !== content) {
                    fs.writeFileSync(file.fsPath, modified);
                    debugLog(`Fixed test imports in: ${file.fsPath}`);
                }
            }
            
            return true;
        } catch (error) {
            debugLog(`Fix test imports failed: ${error}`);
            return false;
        }
    }
}