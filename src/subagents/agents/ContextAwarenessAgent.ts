import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);
const readFileAsync = promisify(fs.readFile);

export class ContextAwarenessAgent extends SubAgent {
    private contextCache: Map<string, any> = new Map();
    
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'context-awareness',
            name: 'Context Awareness Agent',
            description: 'Understands project structure, dependencies, and relationships between files',
            category: 'analysis',
            enabled: true,
            icon: '🧠',
            capabilities: [
                {
                    id: 'analyze-structure',
                    name: 'Analyze Project Structure',
                    description: 'Map out entire project architecture and file relationships',
                    action: 'analyze'
                },
                {
                    id: 'find-dependencies',
                    name: 'Find Dependencies',
                    description: 'Identify all dependencies and imports for a given file or feature',
                    action: 'analyze'
                },
                {
                    id: 'suggest-related-files',
                    name: 'Suggest Related Files',
                    description: 'Find files that should be modified together',
                    action: 'suggest'
                },
                {
                    id: 'generate-context',
                    name: 'Generate Task Context',
                    description: 'Create comprehensive context for Claude to understand the task',
                    action: 'generate'
                }
            ],
            checkScript: '.autoclaude/scripts/context-check.sh',
            systemPrompt: `You are a Context Awareness specialist sub-agent. Your role is to:
1. Understand the entire project structure and architecture
2. Map relationships between files, modules, and components
3. Track dependencies and import chains
4. Identify which files are related to specific features
5. Detect patterns and conventions used in the codebase
6. Find all files that need to be modified for a given change
7. Provide comprehensive context for other agents and Claude
8. Understand the technology stack and frameworks used
9. Identify entry points, configuration files, and key modules
10. Map data flow and component interactions

Your analysis helps Claude understand the full scope of changes needed and prevents incomplete implementations.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        // Analyze project structure
        const projectInfo = await this.analyzeProjectStructure();
        
        analysis.push('📊 Project Context Analysis:');
        analysis.push('');
        analysis.push(`Project Type: ${projectInfo.type}`);
        analysis.push(`Main Language: ${projectInfo.language}`);
        analysis.push(`Framework: ${projectInfo.framework || 'None detected'}`);
        analysis.push(`Total Files: ${projectInfo.fileCount}`);
        analysis.push('');
        
        if (context.userMessage) {
            // Analyze what files might be affected by the user's request
            const affectedFiles = await this.findAffectedFiles(context.userMessage);
            if (affectedFiles.length > 0) {
                analysis.push('📁 Potentially Affected Files:');
                affectedFiles.forEach(file => {
                    analysis.push(`- ${file}`);
                });
                analysis.push('');
            }
        }
        
        analysis.push('💡 Context Recommendations:');
        analysis.push('1. Review all related files before making changes');
        analysis.push('2. Check for similar patterns in the codebase');
        analysis.push('3. Ensure changes are consistent with project conventions');
        analysis.push('4. Update all dependent files when making breaking changes');
        
        return analysis.join('\n');
    }
    
    private async analyzeProjectStructure(): Promise<any> {
        // Cache the analysis for performance
        if (this.contextCache.has('projectStructure')) {
            return this.contextCache.get('projectStructure');
        }
        
        const info: any = {
            type: 'unknown',
            language: 'unknown',
            framework: null,
            fileCount: 0,
            keyFiles: []
        };
        
        try {
            // Check for package.json (Node.js)
            if (fs.existsSync(path.join(this.workspacePath, 'package.json'))) {
                const packageJson = JSON.parse(await readFileAsync(path.join(this.workspacePath, 'package.json'), 'utf8'));
                info.type = 'nodejs';
                info.language = 'javascript/typescript';
                
                // Detect framework
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (deps.react) info.framework = 'React';
                else if (deps.vue) info.framework = 'Vue';
                else if (deps.angular) info.framework = 'Angular';
                else if (deps.express) info.framework = 'Express';
                else if (deps.next) info.framework = 'Next.js';
                
                info.keyFiles.push('package.json');
            }
            
            // Check for go.mod (Go)
            if (fs.existsSync(path.join(this.workspacePath, 'go.mod'))) {
                info.type = 'go';
                info.language = 'go';
                info.keyFiles.push('go.mod');
            }
            
            // Check for Cargo.toml (Rust)
            if (fs.existsSync(path.join(this.workspacePath, 'Cargo.toml'))) {
                info.type = 'rust';
                info.language = 'rust';
                info.keyFiles.push('Cargo.toml');
            }
            
            // Count files
            const { stdout } = await execAsync('find . -type f -name "*.ts" -o -name "*.js" -o -name "*.py" -o -name "*.go" -o -name "*.rs" | wc -l', {
                cwd: this.workspacePath
            });
            info.fileCount = parseInt(stdout.trim());
            
            this.contextCache.set('projectStructure', info);
            return info;
        } catch (error) {
            return info;
        }
    }
    
    private async findAffectedFiles(userMessage: string): Promise<string[]> {
        const affectedFiles: string[] = [];
        
        // Extract potential file names or features from the message
        const filePatterns = [
            /(?:file|module|component|class|function)\s+(?:named\s+)?['"`]?(\w+)['"`]?/gi,
            /(\w+\.\w+)/g, // Direct file names
            /(?:in|from|at)\s+['"`]?([./\w]+\.\w+)['"`]?/gi
        ];
        
        for (const pattern of filePatterns) {
            const matches = userMessage.matchAll(pattern);
            for (const match of matches) {
                if (match[1]) {
                    // Search for the file
                    try {
                        const { stdout } = await execAsync(`find . -name "*${match[1]}*" -type f | head -10`, {
                            cwd: this.workspacePath
                        });
                        const files = stdout.trim().split('\n').filter(f => f);
                        affectedFiles.push(...files);
                    } catch {
                        // Ignore errors
                    }
                }
            }
        }
        
        return [...new Set(affectedFiles)]; // Remove duplicates
    }
}