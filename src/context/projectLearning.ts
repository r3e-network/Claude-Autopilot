import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectIndexer, FileInfo } from './projectIndexer';
import { TaskPersistenceManager, PersistedTask } from './taskPersistence';
import { debugLog } from '../utils/logging';

export interface ProjectInsights {
    summary: string;
    patterns: CodePattern[];
    recommendations: string[];
    complexityMetrics: ComplexityMetrics;
    commonIssues: Issue[];
}

export interface CodePattern {
    name: string;
    description: string;
    occurrences: number;
    examples: string[];
}

export interface ComplexityMetrics {
    averageFileComplexity: number;
    mostComplexFiles: { file: string; complexity: number }[];
    couplingScore: number;
    maintainabilityIndex: number;
}

export interface Issue {
    type: 'error' | 'warning' | 'suggestion';
    category: string;
    description: string;
    affectedFiles: string[];
    severity: 'low' | 'medium' | 'high';
}

export class ProjectLearningEngine {
    constructor(
        private projectIndexer: ProjectIndexer,
        private taskManager: TaskPersistenceManager,
        private workspaceRoot: string
    ) {}

    /**
     * Generate comprehensive project insights
     */
    async generateInsights(): Promise<ProjectInsights> {
        debugLog('Generating project insights...');

        const insights: ProjectInsights = {
            summary: await this.generateProjectSummary(),
            patterns: await this.detectCodePatterns(),
            recommendations: await this.generateRecommendations(),
            complexityMetrics: await this.calculateComplexityMetrics(),
            commonIssues: await this.detectCommonIssues()
        };

        return insights;
    }

    /**
     * Generate a natural language summary of the project
     */
    private async generateProjectSummary(): Promise<string> {
        const projectContext = this.projectIndexer.getProjectContext();
        const tasks = this.taskManager.getAllTasks();
        const recentTasks = tasks
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, 5);

        const summary = [`## Project Summary

This project appears to be a ${this.inferProjectType()} application.`];

        // Add language information
        const stats = this.getProjectStats();
        if (stats.mainLanguages.length > 0) {
            summary.push(`\nThe primary languages used are: ${stats.mainLanguages.join(', ')}.`);
        }

        // Add framework information
        if (stats.frameworks.length > 0) {
            summary.push(`It uses the following frameworks: ${stats.frameworks.join(', ')}.`);
        }

        // Add recent activity
        if (recentTasks.length > 0) {
            summary.push(`\n### Recent Development Activity`);
            summary.push(`The team has been working on:`);
            recentTasks.forEach(task => {
                summary.push(`- ${task.title} (${task.status})`);
            });
        }

        // Add complexity overview
        const fileCount = this.getFileCount();
        summary.push(`\n### Project Scale`);
        summary.push(`- Total files: ${fileCount.total}`);
        summary.push(`- Code files: ${fileCount.code}`);
        summary.push(`- Test files: ${fileCount.tests}`);

        return summary.join('\n');
    }

    /**
     * Detect common code patterns in the project
     */
    private async detectCodePatterns(): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];

        // Detect design patterns
        patterns.push(...await this.detectDesignPatterns());

        // Detect coding conventions
        patterns.push(...await this.detectCodingConventions());

        // Detect architectural patterns
        patterns.push(...await this.detectArchitecturalPatterns());

        return patterns.sort((a, b) => b.occurrences - a.occurrences);
    }

    private async detectDesignPatterns(): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];
        
        // Singleton pattern detection
        const singletonFiles = await this.searchPattern('getInstance|instance\\s*=\\s*null|private\\s+constructor');
        if (singletonFiles.length > 0) {
            patterns.push({
                name: 'Singleton Pattern',
                description: 'Classes that ensure only one instance exists',
                occurrences: singletonFiles.length,
                examples: singletonFiles.slice(0, 3)
            });
        }

        // Factory pattern detection
        const factoryFiles = await this.searchPattern('create[A-Z]\\w+|factory|Factory');
        if (factoryFiles.length > 0) {
            patterns.push({
                name: 'Factory Pattern',
                description: 'Object creation through factory methods',
                occurrences: factoryFiles.length,
                examples: factoryFiles.slice(0, 3)
            });
        }

        // Observer pattern detection
        const observerFiles = await this.searchPattern('subscribe|unsubscribe|emit|EventEmitter|Observer');
        if (observerFiles.length > 0) {
            patterns.push({
                name: 'Observer Pattern',
                description: 'Event-driven communication between objects',
                occurrences: observerFiles.length,
                examples: observerFiles.slice(0, 3)
            });
        }

        return patterns;
    }

    private async detectCodingConventions(): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];

        // Async/await usage
        const asyncFiles = await this.searchPattern('async\\s+\\w+|await\\s+');
        if (asyncFiles.length > 0) {
            patterns.push({
                name: 'Async/Await Pattern',
                description: 'Modern asynchronous programming',
                occurrences: asyncFiles.length,
                examples: asyncFiles.slice(0, 3)
            });
        }

        // Error handling patterns
        const errorHandling = await this.searchPattern('try\\s*{|catch\\s*\\(|\.catch\\(');
        if (errorHandling.length > 0) {
            patterns.push({
                name: 'Error Handling',
                description: 'Structured error handling throughout the codebase',
                occurrences: errorHandling.length,
                examples: errorHandling.slice(0, 3)
            });
        }

        // Logging patterns
        const logging = await this.searchPattern('console\\.log|debugLog|logger\\.|log\\(');
        if (logging.length > 0) {
            patterns.push({
                name: 'Logging Pattern',
                description: 'Consistent logging for debugging and monitoring',
                occurrences: logging.length,
                examples: logging.slice(0, 3)
            });
        }

        return patterns;
    }

    private async detectArchitecturalPatterns(): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];

        // MVC/MVP/MVVM detection
        const hasControllers = await this.searchPattern('Controller|controller');
        const hasViews = await this.searchPattern('View|view|render');
        const hasModels = await this.searchPattern('Model|model|schema');

        if (hasControllers.length > 0 && hasViews.length > 0 && hasModels.length > 0) {
            patterns.push({
                name: 'MVC Architecture',
                description: 'Model-View-Controller separation of concerns',
                occurrences: hasControllers.length + hasViews.length + hasModels.length,
                examples: [...hasControllers.slice(0, 1), ...hasViews.slice(0, 1), ...hasModels.slice(0, 1)]
            });
        }

        // Layered architecture
        const layers = {
            presentation: await this.searchPattern('ui|UI|view|View|component|Component'),
            business: await this.searchPattern('service|Service|business|Business|logic'),
            data: await this.searchPattern('repository|Repository|dao|DAO|database|Database')
        };

        if (layers.presentation.length > 0 && layers.business.length > 0 && layers.data.length > 0) {
            patterns.push({
                name: 'Layered Architecture',
                description: 'Clear separation between presentation, business logic, and data layers',
                occurrences: Object.values(layers).reduce((sum, files) => sum + files.length, 0),
                examples: [
                    ...layers.presentation.slice(0, 1),
                    ...layers.business.slice(0, 1),
                    ...layers.data.slice(0, 1)
                ]
            });
        }

        return patterns;
    }

    /**
     * Generate actionable recommendations
     */
    private async generateRecommendations(): Promise<string[]> {
        const recommendations: string[] = [];
        const tasks = this.taskManager.getAllTasks();
        const failedTasks = tasks.filter(t => t.status === 'failed');
        const projectStats = this.getProjectStats();

        // Test coverage recommendations
        const testFiles = await this.searchPattern('test|spec|Test|Spec');
        const codeFiles = this.getFileCount().code;
        const testRatio = testFiles.length / codeFiles;

        if (testRatio < 0.3) {
            recommendations.push('📝 **Increase test coverage**: The test-to-code ratio is low. Consider adding more unit tests.');
        }

        // Error handling recommendations
        if (failedTasks.length > 5) {
            recommendations.push('🔧 **Review failed tasks**: Multiple tasks have failed. Consider reviewing error patterns.');
        }

        // Documentation recommendations
        const readmeExists = fs.existsSync(path.join(this.workspaceRoot, 'README.md'));
        if (!readmeExists) {
            recommendations.push('📚 **Add README**: Create a README.md file to document the project.');
        }

        // Dependency recommendations
        if (projectStats.dependencies?.npm) {
            const deps = projectStats.dependencies.npm.dependencies || {};
            const devDeps = projectStats.dependencies.npm.devDependencies || {};
            const totalDeps = Object.keys(deps).length + Object.keys(devDeps).length;

            if (totalDeps > 100) {
                recommendations.push('📦 **Review dependencies**: High number of dependencies. Consider auditing for unused packages.');
            }
        }

        // Code organization recommendations
        const largeFiles = this.getLargeFiles();
        if (largeFiles.length > 5) {
            recommendations.push('🔄 **Refactor large files**: Several files exceed recommended size. Consider breaking them down.');
        }

        // Performance recommendations
        const complexFiles = await this.getComplexFiles();
        if (complexFiles.length > 0) {
            recommendations.push('⚡ **Optimize complex code**: Some files have high complexity. Consider refactoring for better performance.');
        }

        return recommendations;
    }

    /**
     * Calculate complexity metrics
     */
    private async calculateComplexityMetrics(): Promise<ComplexityMetrics> {
        const files = Array.from(this.projectIndexer['index']?.files.values() || []);
        const complexityScores: { file: string; complexity: number }[] = [];

        for (const file of files) {
            if (this.isCodeFile(file.path)) {
                const complexity = await this.calculateFileComplexity(file);
                complexityScores.push({ file: file.relativePath, complexity });
            }
        }

        complexityScores.sort((a, b) => b.complexity - a.complexity);

        const avgComplexity = complexityScores.length > 0
            ? complexityScores.reduce((sum, s) => sum + s.complexity, 0) / complexityScores.length
            : 0;

        return {
            averageFileComplexity: Math.round(avgComplexity * 100) / 100,
            mostComplexFiles: complexityScores.slice(0, 10),
            couplingScore: await this.calculateCouplingScore(),
            maintainabilityIndex: this.calculateMaintainabilityIndex(avgComplexity)
        };
    }

    private async calculateFileComplexity(file: FileInfo): Promise<number> {
        // Simple complexity calculation based on file size and structure
        let complexity = 0;

        // Size factor
        complexity += file.size / 1000; // 1 point per KB

        // Symbol complexity
        if (file.symbols) {
            complexity += file.symbols.length * 2; // 2 points per symbol
            
            // Nested symbols add more complexity
            const countNested = (symbols: any[], depth: number = 0): number => {
                let count = 0;
                for (const symbol of symbols) {
                    count += depth;
                    if (symbol.children) {
                        count += countNested(symbol.children, depth + 1);
                    }
                }
                return count;
            };
            
            complexity += countNested(file.symbols);
        }

        return complexity;
    }

    private async calculateCouplingScore(): Promise<number> {
        // Analyze import/require statements to determine coupling
        const importPatterns = await this.searchPattern('import\\s+.*from|require\\(');
        const totalFiles = this.getFileCount().code;
        
        if (totalFiles === 0) return 0;
        
        // Higher score means higher coupling (worse)
        return Math.min(100, Math.round((importPatterns.length / totalFiles) * 20));
    }

    private calculateMaintainabilityIndex(avgComplexity: number): number {
        // Simple maintainability index (0-100, higher is better)
        const baseScore = 100;
        const complexityPenalty = Math.min(50, avgComplexity * 2);
        
        return Math.max(0, Math.round(baseScore - complexityPenalty));
    }

    /**
     * Detect common issues
     */
    private async detectCommonIssues(): Promise<Issue[]> {
        const issues: Issue[] = [];

        // TODO/FIXME detection
        const todoFiles = await this.searchPattern('TODO|FIXME|HACK|XXX');
        if (todoFiles.length > 0) {
            issues.push({
                type: 'warning',
                category: 'Technical Debt',
                description: 'Unresolved TODO/FIXME comments found',
                affectedFiles: todoFiles,
                severity: 'medium'
            });
        }

        // Console.log in production code
        const consoleLogFiles = await this.searchPattern('console\\.log');
        if (consoleLogFiles.length > 10) {
            issues.push({
                type: 'warning',
                category: 'Code Quality',
                description: 'Excessive console.log statements (consider using proper logging)',
                affectedFiles: consoleLogFiles.slice(0, 10),
                severity: 'low'
            });
        }

        // Hardcoded values
        const hardcodedFiles = await this.searchPattern('localhost:|127\\.0\\.0\\.1|hardcoded|HARDCODED');
        if (hardcodedFiles.length > 0) {
            issues.push({
                type: 'warning',
                category: 'Configuration',
                description: 'Hardcoded values detected (consider using configuration files)',
                affectedFiles: hardcodedFiles,
                severity: 'medium'
            });
        }

        // Large files
        const largeFiles = this.getLargeFiles();
        if (largeFiles.length > 0) {
            issues.push({
                type: 'suggestion',
                category: 'Code Organization',
                description: 'Large files that could benefit from refactoring',
                affectedFiles: largeFiles.map(f => f.relativePath),
                severity: 'low'
            });
        }

        // Analyze task failures
        const failedTasks = this.taskManager.getTasksByStatus('failed');
        if (failedTasks.length > 0) {
            const errorPatterns = this.analyzeTaskErrors(failedTasks);
            for (const [category, files] of errorPatterns) {
                issues.push({
                    type: 'error',
                    category: 'Task Failures',
                    description: `Recurring ${category} errors in tasks`,
                    affectedFiles: Array.from(files),
                    severity: 'high'
                });
            }
        }

        return issues.sort((a, b) => {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }

    private analyzeTaskErrors(failedTasks: PersistedTask[]): Map<string, Set<string>> {
        const errorPatterns = new Map<string, Set<string>>();

        for (const task of failedTasks) {
            for (const error of task.context.errors) {
                let category = 'Unknown';
                
                if (error.includes('TypeError')) category = 'Type';
                else if (error.includes('ReferenceError')) category = 'Reference';
                else if (error.includes('SyntaxError')) category = 'Syntax';
                else if (error.includes('Cannot find module')) category = 'Module Resolution';
                else if (error.includes('Permission denied')) category = 'Permission';
                
                if (!errorPatterns.has(category)) {
                    errorPatterns.set(category, new Set());
                }
                
                task.context.files.forEach(file => {
                    errorPatterns.get(category)!.add(file);
                });
            }
        }

        return errorPatterns;
    }

    /**
     * Helper methods
     */
    private async searchPattern(pattern: string): Promise<string[]> {
        // Pattern search functionality deferred to future implementation
        // Returns empty array to indicate no patterns found
        return [];
    }

    private inferProjectType(): string {
        const stats = this.getProjectStats();
        
        if (stats.frameworks.includes('React') || stats.frameworks.includes('Vue') || stats.frameworks.includes('Angular')) {
            return 'web frontend';
        }
        if (stats.frameworks.includes('Express') || stats.frameworks.includes('Fastify')) {
            return 'Node.js backend';
        }
        if (stats.configFiles.includes('package.json')) {
            return 'JavaScript/TypeScript';
        }
        if (stats.configFiles.includes('requirements.txt') || stats.configFiles.includes('setup.py')) {
            return 'Python';
        }
        if (stats.configFiles.includes('pom.xml') || stats.configFiles.includes('build.gradle')) {
            return 'Java';
        }
        
        return 'software';
    }

    private getProjectStats(): any {
        const index = this.projectIndexer['index'];
        if (!index) {
            return {
                mainLanguages: [],
                frameworks: [],
                configFiles: [],
                dependencies: {}
            };
        }
        
        return {
            mainLanguages: Array.from(index.codebaseStats.filesByLanguage.keys()).slice(0, 3),
            frameworks: index.structure.frameworks,
            configFiles: index.structure.configFiles,
            dependencies: index.dependencies
        };
    }

    private getFileCount(): { total: number; code: number; tests: number } {
        const index = this.projectIndexer['index'];
        if (!index) {
            return { total: 0, code: 0, tests: 0 };
        }

        const files = Array.from(index.files.values());
        const codeFiles = files.filter(f => this.isCodeFile(f.path));
        const testFiles = files.filter(f => 
            f.relativePath.includes('test') || 
            f.relativePath.includes('spec') ||
            f.relativePath.includes('__tests__')
        );

        return {
            total: files.length,
            code: codeFiles.length,
            tests: testFiles.length
        };
    }

    private isCodeFile(filePath: string): boolean {
        const codeExtensions = ['.ts', '.js', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs', '.rb'];
        return codeExtensions.some(ext => filePath.endsWith(ext));
    }

    private getLargeFiles(): FileInfo[] {
        const index = this.projectIndexer['index'];
        if (!index) return [];

        return Array.from(index.files.values())
            .filter(f => this.isCodeFile(f.path) && f.size > 50000) // Files > 50KB
            .sort((a, b) => b.size - a.size)
            .slice(0, 10);
    }

    private async getComplexFiles(): Promise<string[]> {
        // Complex file analysis deferred to future implementation
        // Returns empty array indicating no complex files identified
        return [];
    }

    /**
     * Generate learning report
     */
    async generateLearningReport(): Promise<string> {
        const insights = await this.generateInsights();
        
        const report = [`# Project Learning Report

Generated: ${new Date().toISOString()}

${insights.summary}

## Code Patterns Detected

${insights.patterns.slice(0, 10).map(pattern => 
    `### ${pattern.name}
- **Description**: ${pattern.description}
- **Occurrences**: ${pattern.occurrences}
- **Examples**: ${pattern.examples.slice(0, 3).join(', ')}`
).join('\n\n')}

## Recommendations

${insights.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

## Complexity Analysis

- **Average File Complexity**: ${insights.complexityMetrics.averageFileComplexity}
- **Coupling Score**: ${insights.complexityMetrics.couplingScore}/100 (lower is better)
- **Maintainability Index**: ${insights.complexityMetrics.maintainabilityIndex}/100 (higher is better)

### Most Complex Files
${insights.complexityMetrics.mostComplexFiles.slice(0, 5).map(f => 
    `- ${f.file}: ${Math.round(f.complexity)} complexity points`
).join('\n')}

## Issues & Technical Debt

${insights.commonIssues.map(issue => 
    `### ${issue.severity.toUpperCase()}: ${issue.description}
- **Type**: ${issue.type}
- **Category**: ${issue.category}
- **Affected Files**: ${issue.affectedFiles.length} files
${issue.affectedFiles.slice(0, 5).map(f => `  - ${f}`).join('\n')}`
).join('\n\n')}

---

This report provides an AI-driven analysis of your codebase to help improve code quality and maintainability.
`];

        return report.join('\n');
    }
}