import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);

export class DependencyResolutionAgent extends SubAgent {
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'dependency-resolution',
            name: 'Dependency Resolution Agent',
            description: 'Manages dependencies, imports, and package installations automatically',
            category: 'automation',
            enabled: true,
            icon: '📦',
            capabilities: [
                {
                    id: 'resolve-missing-imports',
                    name: 'Resolve Missing Imports',
                    description: 'Automatically fix import statements and add missing dependencies',
                    action: 'fix'
                },
                {
                    id: 'install-packages',
                    name: 'Install Required Packages',
                    description: 'Detect and install missing npm/pip/cargo packages',
                    action: 'fix'
                },
                {
                    id: 'update-dependencies',
                    name: 'Update Dependencies',
                    description: 'Keep dependencies up to date and secure',
                    action: 'optimize'
                },
                {
                    id: 'analyze-security',
                    name: 'Analyze Security Vulnerabilities',
                    description: 'Check for known security issues in dependencies',
                    action: 'secure'
                },
                {
                    id: 'optimize-imports',
                    name: 'Optimize Import Structure',
                    description: 'Clean up unused imports and organize import statements',
                    action: 'optimize'
                }
            ],
            checkScript: '.autoclaude/scripts/dependency-check.sh',
            systemPrompt: `You are a Dependency Resolution specialist sub-agent. Your role is to:
1. Analyze import statements and detect missing dependencies
2. Automatically install required packages (npm, pip, cargo, etc.)
3. Fix import paths and resolve module resolution issues
4. Update outdated dependencies to latest compatible versions
5. Identify and fix security vulnerabilities in dependencies
6. Optimize import statements and remove unused imports
7. Ensure proper dependency versions for compatibility
8. Handle peer dependencies and version conflicts
9. Set up proper module resolution paths
10. Manage dev vs production dependencies correctly

You help Claude focus on business logic by handling all dependency management automatically.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        analysis.push('📦 Dependency Analysis:');
        analysis.push('');
        
        // Check for different package managers
        const packageInfo = await this.analyzePackageSystem();
        analysis.push(`Package Manager: ${packageInfo.manager}`);
        
        if (packageInfo.manager !== 'none') {
            // Check for missing dependencies
            const missingDeps = await this.findMissingDependencies();
            if (missingDeps.length > 0) {
                analysis.push('');
                analysis.push('❌ Missing Dependencies:');
                missingDeps.forEach(dep => {
                    analysis.push(`- ${dep.name} (used in ${dep.files.join(', ')})`);
                });
            }
            
            // Check for outdated dependencies
            const outdatedDeps = await this.findOutdatedDependencies();
            if (outdatedDeps.length > 0) {
                analysis.push('');
                analysis.push('⚠️ Outdated Dependencies:');
                outdatedDeps.forEach(dep => {
                    analysis.push(`- ${dep.name}: ${dep.current} → ${dep.latest}`);
                });
            }
            
            // Check for security vulnerabilities
            const vulns = await this.checkSecurityVulnerabilities();
            if (vulns.length > 0) {
                analysis.push('');
                analysis.push('🚨 Security Vulnerabilities:');
                vulns.forEach(vuln => {
                    analysis.push(`- ${vuln.package}: ${vuln.severity} (${vuln.title})`);
                });
            }
        }
        
        analysis.push('');
        analysis.push('🔧 Recommended Actions:');
        analysis.push('1. Install all missing dependencies');
        analysis.push('2. Update outdated packages to latest compatible versions');
        analysis.push('3. Fix any security vulnerabilities');
        analysis.push('4. Clean up unused imports');
        analysis.push('5. Organize import statements consistently');
        
        return analysis.join('\n');
    }
    
    private async analyzePackageSystem(): Promise<{ manager: string; configFile?: string }> {
        if (fs.existsSync(path.join(this.workspacePath, 'package.json'))) {
            // Check if yarn.lock or package-lock.json exists
            if (fs.existsSync(path.join(this.workspacePath, 'yarn.lock'))) {
                return { manager: 'yarn', configFile: 'package.json' };
            } else {
                return { manager: 'npm', configFile: 'package.json' };
            }
        }
        
        if (fs.existsSync(path.join(this.workspacePath, 'requirements.txt'))) {
            return { manager: 'pip', configFile: 'requirements.txt' };
        }
        
        if (fs.existsSync(path.join(this.workspacePath, 'Cargo.toml'))) {
            return { manager: 'cargo', configFile: 'Cargo.toml' };
        }
        
        if (fs.existsSync(path.join(this.workspacePath, 'go.mod'))) {
            return { manager: 'go', configFile: 'go.mod' };
        }
        
        return { manager: 'none' };
    }
    
    private async findMissingDependencies(): Promise<Array<{ name: string; files: string[] }>> {
        const missing: Array<{ name: string; files: string[] }> = [];
        
        try {
            // Find all TypeScript/JavaScript files and analyze imports
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" | grep -v node_modules | head -50', {
                cwd: this.workspacePath
            });
            
            const files = stdout.trim().split('\n').filter(f => f);
            const packageJson = path.join(this.workspacePath, 'package.json');
            
            if (fs.existsSync(packageJson)) {
                const pkg = JSON.parse(await readFileAsync(packageJson, 'utf8'));
                const allDeps = { 
                    ...pkg.dependencies, 
                    ...pkg.devDependencies, 
                    ...pkg.peerDependencies 
                };
                
                for (const file of files) {
                    try {
                        const content = await readFileAsync(path.join(this.workspacePath, file), 'utf8');
                        const imports = this.extractImports(content);
                        
                        for (const imp of imports) {
                            // Check if it's a package import (not relative)
                            if (!imp.startsWith('.') && !imp.startsWith('/')) {
                                const packageName = this.getPackageName(imp);
                                if (!allDeps[packageName] && !this.isBuiltinModule(packageName)) {
                                    const existing = missing.find(m => m.name === packageName);
                                    if (existing) {
                                        existing.files.push(file);
                                    } else {
                                        missing.push({ name: packageName, files: [file] });
                                    }
                                }
                            }
                        }
                    } catch {
                        // Skip files that can't be read
                    }
                }
            }
        } catch {
            // Skip if find command fails
        }
        
        return missing;
    }
    
    private extractImports(content: string): string[] {
        const imports: string[] = [];
        
        // Match ES6 imports
        const es6Imports = content.matchAll(/import.*?from\s+['"`]([^'"`]+)['"`]/g);
        for (const match of es6Imports) {
            imports.push(match[1]);
        }
        
        // Match require statements
        const requireImports = content.matchAll(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g);
        for (const match of requireImports) {
            imports.push(match[1]);
        }
        
        return imports;
    }
    
    private getPackageName(importPath: string): string {
        // Handle scoped packages like @types/node
        if (importPath.startsWith('@')) {
            const parts = importPath.split('/');
            return parts.slice(0, 2).join('/');
        }
        
        // Handle regular packages
        return importPath.split('/')[0];
    }
    
    private isBuiltinModule(moduleName: string): boolean {
        const builtins = [
            'fs', 'path', 'os', 'util', 'crypto', 'http', 'https', 'url', 'querystring',
            'events', 'stream', 'buffer', 'child_process', 'cluster', 'dgram', 'dns',
            'net', 'readline', 'repl', 'tls', 'tty', 'vm', 'zlib', 'assert', 'constants',
            'module', 'process', 'sys', 'timers'
        ];
        return builtins.includes(moduleName);
    }
    
    private async findOutdatedDependencies(): Promise<Array<{ name: string; current: string; latest: string }>> {
        try {
            const { stdout } = await execAsync('npm outdated --json', {
                cwd: this.workspacePath
            });
            
            if (stdout.trim()) {
                const outdated = JSON.parse(stdout);
                return Object.entries(outdated).map(([name, info]: [string, any]) => ({
                    name,
                    current: info.current,
                    latest: info.latest
                }));
            }
        } catch {
            // npm outdated returns non-zero exit code when packages are outdated
        }
        
        return [];
    }
    
    private async checkSecurityVulnerabilities(): Promise<Array<{ package: string; severity: string; title: string }>> {
        try {
            const { stdout } = await execAsync('npm audit --json', {
                cwd: this.workspacePath
            });
            
            if (stdout.trim()) {
                const audit = JSON.parse(stdout);
                const vulns: Array<{ package: string; severity: string; title: string }> = [];
                
                if (audit.advisories) {
                    Object.values(audit.advisories).forEach((advisory: any) => {
                        vulns.push({
                            package: advisory.module_name,
                            severity: advisory.severity,
                            title: advisory.title
                        });
                    });
                }
                
                return vulns;
            }
        } catch {
            // Ignore audit errors
        }
        
        return [];
    }
}