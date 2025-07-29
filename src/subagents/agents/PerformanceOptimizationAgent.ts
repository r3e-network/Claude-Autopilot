import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class PerformanceOptimizationAgent extends SubAgent {
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'performance-optimization',
            name: 'Performance Optimization Agent',
            description: 'Identifies and fixes performance bottlenecks automatically',
            category: 'optimization',
            enabled: true,
            icon: '🚀',
            capabilities: [
                {
                    id: 'analyze-performance',
                    name: 'Analyze Performance Bottlenecks',
                    description: 'Identify slow code paths and performance issues',
                    action: 'analyze'
                },
                {
                    id: 'optimize-algorithms',
                    name: 'Optimize Algorithms',
                    description: 'Improve algorithmic complexity and efficiency',
                    action: 'optimize'
                },
                {
                    id: 'memory-optimization',
                    name: 'Memory Optimization',
                    description: 'Reduce memory usage and prevent leaks',
                    action: 'optimize'
                },
                {
                    id: 'database-optimization',
                    name: 'Database Query Optimization',
                    description: 'Optimize database queries and indexing',
                    action: 'optimize'
                },
                {
                    id: 'bundle-optimization',
                    name: 'Bundle Size Optimization',
                    description: 'Reduce JavaScript bundle sizes and improve loading',
                    action: 'optimize'
                },
                {
                    id: 'caching-strategy',
                    name: 'Implement Caching Strategy',
                    description: 'Add intelligent caching to improve performance',
                    action: 'generate'
                }
            ],
            checkScript: '.autoclaude/scripts/performance-check.sh',
            systemPrompt: `You are a Performance Optimization specialist sub-agent. Your role is to:
1. Identify performance bottlenecks and slow code paths
2. Optimize algorithms for better time and space complexity
3. Reduce memory usage and prevent memory leaks
4. Optimize database queries and data access patterns
5. Implement effective caching strategies
6. Reduce bundle sizes and improve loading times
7. Optimize network requests and data transfer
8. Implement lazy loading and code splitting
9. Profile and benchmark performance improvements
10. Monitor and alert on performance regressions

You help Claude create high-performance applications that scale efficiently.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        analysis.push('🚀 Performance Analysis:');
        analysis.push('');
        
        // Analyze code complexity
        const complexity = await this.analyzeCodeComplexity();
        analysis.push(`Cyclomatic Complexity: ${complexity.average.toFixed(1)} (${complexity.level})`);
        analysis.push(`High Complexity Functions: ${complexity.highComplexityCount}`);
        analysis.push('');
        
        // Check for performance anti-patterns
        const antiPatterns = await this.findPerformanceAntiPatterns();
        if (antiPatterns.length > 0) {
            analysis.push('⚠️ Performance Anti-patterns Found:');
            antiPatterns.forEach(pattern => {
                analysis.push(`- ${pattern.type}: ${pattern.description} (${pattern.occurrences} occurrences)`);
            });
            analysis.push('');
        }
        
        // Analyze bundle size (for web projects)
        const bundleInfo = await this.analyzeBundleSize();
        if (bundleInfo.hasBundle) {
            analysis.push('📦 Bundle Analysis:');
            analysis.push(`Total Bundle Size: ${bundleInfo.totalSize}KB`);
            analysis.push(`Large Dependencies: ${bundleInfo.largeDependencies.join(', ')}`);
            analysis.push('');
        }
        
        // Check database queries
        const dbIssues = await this.findDatabaseIssues();
        if (dbIssues.length > 0) {
            analysis.push('🗄️ Database Performance Issues:');
            dbIssues.forEach(issue => {
                analysis.push(`- ${issue.type}: ${issue.description}`);
            });
            analysis.push('');
        }
        
        analysis.push('💡 Optimization Recommendations:');
        analysis.push('1. Refactor high-complexity functions into smaller pieces');
        analysis.push('2. Implement caching for expensive operations');
        analysis.push('3. Use lazy loading for large resources');
        analysis.push('4. Optimize database queries with proper indexing');
        analysis.push('5. Remove unused dependencies and code');
        analysis.push('6. Implement proper error handling to avoid retries');
        
        return analysis.join('\n');
    }
    
    private async analyzeCodeComplexity(): Promise<any> {
        const complexity = {
            average: 0,
            level: 'Unknown',
            highComplexityCount: 0
        };
        
        try {
            // Look for complex functions (many if statements, loops, etc.)
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" | grep -v node_modules | head -20', {
                cwd: this.workspacePath
            });
            
            const files = stdout.trim().split('\n').filter(f => f);
            let totalComplexity = 0;
            let functionCount = 0;
            
            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(this.workspacePath, file), 'utf8');
                    const functions = this.extractFunctions(content);
                    
                    for (const func of functions) {
                        const funcComplexity = this.calculateCyclomaticComplexity(func);
                        totalComplexity += funcComplexity;
                        functionCount++;
                        
                        if (funcComplexity > 10) {
                            complexity.highComplexityCount++;
                        }
                    }
                } catch {
                    // Skip files that can't be read
                }
            }
            
            if (functionCount > 0) {
                complexity.average = totalComplexity / functionCount;
                complexity.level = complexity.average > 10 ? 'High' : 
                                complexity.average > 5 ? 'Medium' : 'Low';
            }
            
        } catch (error) {
            // Use defaults on error
        }
        
        return complexity;
    }
    
    private extractFunctions(content: string): string[] {
        const functions: string[] = [];
        
        // Match function declarations
        const functionRegex = /function\s+\w+[^{]*{[^{}]*(?:{[^{}]*}[^{}]*)*}/g;
        const matches = content.match(functionRegex);
        
        if (matches) {
            functions.push(...matches);
        }
        
        // Match arrow functions
        const arrowFunctionRegex = /\w+\s*=\s*\([^)]*\)\s*=>\s*{[^{}]*(?:{[^{}]*}[^{}]*)*}/g;
        const arrowMatches = content.match(arrowFunctionRegex);
        
        if (arrowMatches) {
            functions.push(...arrowMatches);
        }
        
        return functions;
    }
    
    private calculateCyclomaticComplexity(functionCode: string): number {
        let complexity = 1; // Base complexity
        
        // Count decision points
        const decisionPoints = [
            /\bif\s*\(/g,
            /\belse\s+if\s*\(/g,
            /\bwhile\s*\(/g,
            /\bfor\s*\(/g,
            /\bswitch\s*\(/g,
            /\bcase\s+/g,
            /\bcatch\s*\(/g,
            /&&|\|\|/g,
            /\?\s*[^:]+:/g // Ternary operator
        ];
        
        for (const pattern of decisionPoints) {
            const matches = functionCode.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }
    
    private async findPerformanceAntiPatterns(): Promise<Array<{ type: string; description: string; occurrences: number }>> {
        const antiPatterns: Array<{ type: string; description: string; occurrences: number }> = [];
        
        try {
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" | grep -v node_modules | head -10', {
                cwd: this.workspacePath
            });
            
            const files = stdout.trim().split('\n').filter(f => f);
            
            const patterns = [
                {
                    type: 'Nested Loops',
                    regex: /for\s*\([^)]*\)\s*{[^{}]*for\s*\([^)]*\)/g,
                    description: 'Nested loops that may cause O(n²) complexity'
                },
                {
                    type: 'Synchronous File Operations',
                    regex: /fs\.readFileSync|fs\.writeFileSync/g,
                    description: 'Blocking file operations that can freeze the event loop'
                },
                {
                    type: 'Large Array Operations',
                    regex: /\.map\s*\([^)]*\)\.filter\s*\([^)]*\)/g,
                    description: 'Chained array operations that create intermediate arrays'
                },
                {
                    type: 'String Concatenation in Loops',
                    regex: /for\s*\([^)]*\)\s*{[^{}]*\+=.*string/g,
                    description: 'String concatenation in loops creates many intermediate strings'
                },
                {
                    type: 'Missing Async/Await',
                    regex: /\.then\s*\([^)]*\)\.then\s*\([^)]*\)/g,
                    description: 'Promise chains that could be simplified with async/await'
                }
            ];
            
            for (const pattern of patterns) {
                let totalOccurrences = 0;
                
                for (const file of files) {
                    try {
                        const content = fs.readFileSync(path.join(this.workspacePath, file), 'utf8');
                        const matches = content.match(pattern.regex);
                        if (matches) {
                            totalOccurrences += matches.length;
                        }
                    } catch {
                        // Skip files that can't be read
                    }
                }
                
                if (totalOccurrences > 0) {
                    antiPatterns.push({
                        type: pattern.type,
                        description: pattern.description,
                        occurrences: totalOccurrences
                    });
                }
            }
            
        } catch (error) {
            // Return empty array on error
        }
        
        return antiPatterns;
    }
    
    private async analyzeBundleSize(): Promise<any> {
        const bundleInfo = {
            hasBundle: false,
            totalSize: 0,
            largeDependencies: [] as string[]
        };
        
        try {
            // Check if it's a web project with bundling
            if (fs.existsSync(path.join(this.workspacePath, 'package.json'))) {
                const packageJson = JSON.parse(fs.readFileSync(path.join(this.workspacePath, 'package.json'), 'utf8'));
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                
                // Check for bundlers
                const hasBundler = deps.webpack || deps.rollup || deps.vite || deps.parcel || deps.esbuild;
                
                if (hasBundler) {
                    bundleInfo.hasBundle = true;
                    
                    // Try to analyze node_modules size as a proxy for bundle size
                    if (fs.existsSync(path.join(this.workspacePath, 'node_modules'))) {
                        const { stdout } = await execAsync('du -sh node_modules 2>/dev/null || echo "0K"', {
                            cwd: this.workspacePath
                        });
                        
                        const sizeMatch = stdout.match(/(\d+(?:\.\d+)?)[KMG]/);
                        if (sizeMatch) {
                            const size = parseFloat(sizeMatch[1]);
                            const unit = stdout.includes('M') ? 1024 : stdout.includes('G') ? 1024 * 1024 : 1;
                            bundleInfo.totalSize = Math.round(size * unit);
                        }
                    }
                    
                    // Find large dependencies
                    const largeDeps = ['react', 'vue', 'angular', 'lodash', 'moment', 'axios'];
                    bundleInfo.largeDependencies = largeDeps.filter(dep => deps[dep]);
                }
            }
        } catch (error) {
            // Return default values on error
        }
        
        return bundleInfo;
    }
    
    private async findDatabaseIssues(): Promise<Array<{ type: string; description: string }>> {
        const issues: Array<{ type: string; description: string }> = [];
        
        try {
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" -o -name "*.sql" | grep -v node_modules | head -20', {
                cwd: this.workspacePath
            });
            
            const files = stdout.trim().split('\n').filter(f => f);
            
            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(this.workspacePath, file), 'utf8');
                    
                    // Check for N+1 query patterns
                    if (content.match(/for\s*\([^)]*\)\s*{[^{}]*\.(find|query|select)/)) {
                        issues.push({
                            type: 'N+1 Query Problem',
                            description: 'Database queries inside loops can cause performance issues'
                        });
                    }
                    
                    // Check for missing WHERE clauses
                    if (content.match(/SELECT.*FROM.*(?!WHERE)/i)) {
                        issues.push({
                            type: 'Missing WHERE Clause',
                            description: 'SELECT queries without WHERE clauses may return too much data'
                        });
                    }
                    
                    // Check for SELECT *
                    if (content.match(/SELECT\s+\*/i)) {
                        issues.push({
                            type: 'SELECT * Usage',
                            description: 'Using SELECT * can return unnecessary data'
                        });
                    }
                    
                } catch {
                    // Skip files that can't be read
                }
            }
            
        } catch (error) {
            // Return empty array on error
        }
        
        return [...new Set(issues.map(i => JSON.stringify(i)))].map(i => JSON.parse(i)); // Remove duplicates
    }
}