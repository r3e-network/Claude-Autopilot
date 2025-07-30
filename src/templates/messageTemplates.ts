import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { debugLog } from '../utils/logging';

export interface MessageTemplate {
    id: string;
    name: string;
    description?: string;
    content: string;
    attachedScripts?: string[];
    category?: string;
    variables?: string[];
    createdAt: string;
    updatedAt: string;
}

export class MessageTemplateManager {
    private templates: Map<string, MessageTemplate> = new Map();
    private templatesFile: string;

    constructor(context: vscode.ExtensionContext) {
        this.templatesFile = path.join(context.globalStorageUri.fsPath, 'message-templates.json');
        this.loadTemplates();
    }

    async loadTemplates(): Promise<void> {
        try {
            const data = await fs.readFile(this.templatesFile, 'utf-8');
            const templates = JSON.parse(data) as MessageTemplate[];
            this.templates.clear();
            templates.forEach(template => {
                this.templates.set(template.id, template);
            });
        } catch (error) {
            // File doesn't exist yet, initialize with default templates
            await this.initializeDefaultTemplates();
        }
    }

    async saveTemplates(): Promise<void> {
        try {
            const templates = Array.from(this.templates.values());
            const dir = path.dirname(this.templatesFile);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(this.templatesFile, JSON.stringify(templates, null, 2));
        } catch (error) {
            debugLog(`Failed to save templates: ${error}`);
        }
    }

    async initializeDefaultTemplates(): Promise<void> {
        const defaults: MessageTemplate[] = [
            {
                id: 'production-ready',
                name: 'Make Production Ready',
                description: 'Comprehensive production readiness check and fixes',
                content: 'Please make this project production ready by:\n1. Running all tests and fixing failures\n2. Adding missing documentation\n3. Implementing proper error handling\n4. Adding logging where appropriate\n5. Optimizing performance bottlenecks\n6. Ensuring security best practices\n7. Adding Docker configuration if missing',
                category: 'Quality',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'add-tests',
                name: 'Add Comprehensive Tests',
                description: 'Add unit and integration tests',
                content: 'Please add comprehensive tests for {{fileName || "this module"}}:\n1. Unit tests for all functions\n2. Integration tests for API endpoints\n3. Edge case testing\n4. Error scenario testing\n5. Achieve at least 80% code coverage',
                variables: ['fileName'],
                category: 'Testing',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'refactor-code',
                name: 'Refactor Code',
                description: 'Clean up and refactor code',
                content: 'Please refactor {{fileName || "this code"}} to:\n1. Follow SOLID principles\n2. Remove code duplication\n3. Improve naming conventions\n4. Extract reusable functions\n5. Add appropriate comments\n6. Optimize algorithms where possible',
                variables: ['fileName'],
                category: 'Refactoring',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'fix-security',
                name: 'Security Audit & Fix',
                description: 'Perform security audit and fix issues',
                content: 'Please perform a security audit and fix any issues:\n1. Check for SQL injection vulnerabilities\n2. Validate all user inputs\n3. Implement proper authentication/authorization\n4. Check for XSS vulnerabilities\n5. Review dependency vulnerabilities\n6. Implement rate limiting where needed\n7. Add security headers',
                category: 'Security',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'add-feature',
                name: 'Add New Feature',
                description: 'Implement a new feature',
                content: 'Please implement {{featureName}} with the following requirements:\n1. {{requirement1}}\n2. {{requirement2}}\n3. Add appropriate tests\n4. Update documentation\n5. Ensure backward compatibility',
                variables: ['featureName', 'requirement1', 'requirement2'],
                category: 'Development',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'optimize-performance',
                name: 'Optimize Performance',
                description: 'Analyze and optimize performance',
                content: 'Please analyze and optimize performance:\n1. Profile the application to find bottlenecks\n2. Optimize database queries\n3. Implement caching where appropriate\n4. Reduce bundle size\n5. Optimize algorithms\n6. Add performance monitoring\n7. Document performance improvements',
                category: 'Performance',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        defaults.forEach(template => {
            this.templates.set(template.id, template);
        });
        await this.saveTemplates();
    }

    getAllTemplates(): MessageTemplate[] {
        return Array.from(this.templates.values());
    }

    getTemplatesByCategory(category: string): MessageTemplate[] {
        return this.getAllTemplates().filter(t => t.category === category);
    }

    getTemplate(id: string): MessageTemplate | undefined {
        return this.templates.get(id);
    }

    async addTemplate(template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<MessageTemplate> {
        const newTemplate: MessageTemplate = {
            ...template,
            id: `custom-${Date.now()}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.templates.set(newTemplate.id, newTemplate);
        await this.saveTemplates();
        return newTemplate;
    }

    async updateTemplate(id: string, updates: Partial<MessageTemplate>): Promise<void> {
        const template = this.templates.get(id);
        if (template) {
            const updated = {
                ...template,
                ...updates,
                id: template.id, // Prevent ID change
                updatedAt: new Date().toISOString()
            };
            this.templates.set(id, updated);
            await this.saveTemplates();
        }
    }

    async deleteTemplate(id: string): Promise<void> {
        this.templates.delete(id);
        await this.saveTemplates();
    }

    processTemplate(template: MessageTemplate, variables: Record<string, string>): string {
        let content = template.content;
        
        // Replace variables in format {{varName || defaultValue}}
        content = content.replace(/\{\{(\w+)(?:\s*\|\|\s*"([^"]+)")?\}\}/g, (match, varName, defaultValue) => {
            return variables[varName] || defaultValue || match;
        });
        
        return content;
    }

    getCategories(): string[] {
        const categories = new Set<string>();
        this.getAllTemplates().forEach(t => {
            if (t.category) categories.add(t.category);
        });
        return Array.from(categories).sort();
    }
}

export async function showTemplateQuickPick(templateManager: MessageTemplateManager): Promise<string | undefined> {
    const templates = templateManager.getAllTemplates();
    const categories = templateManager.getCategories();
    
    // Create quick pick items
    const items: vscode.QuickPickItem[] = [];
    
    // Add templates by category
    categories.forEach(category => {
        items.push({
            label: category,
            kind: vscode.QuickPickItemKind.Separator
        });
        
        const categoryTemplates = templates.filter(t => t.category === category);
        categoryTemplates.forEach(template => {
            items.push({
                label: `$(file-text) ${template.name}`,
                description: template.description,
                detail: template.content.substring(0, 100) + '...'
            });
        });
    });
    
    // Add uncategorized templates
    const uncategorized = templates.filter(t => !t.category);
    if (uncategorized.length > 0) {
        items.push({
            label: 'Other',
            kind: vscode.QuickPickItemKind.Separator
        });
        
        uncategorized.forEach(template => {
            items.push({
                label: `$(file-text) ${template.name}`,
                description: template.description,
                detail: template.content.substring(0, 100) + '...'
            });
        });
    }
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a message template',
        matchOnDescription: true,
        matchOnDetail: true
    });
    
    if (selected && selected.label.startsWith('$(file-text)')) {
        const templateName = selected.label.replace('$(file-text) ', '');
        const template = templates.find(t => t.name === templateName);
        
        if (template) {
            // Check if template has variables
            if (template.variables && template.variables.length > 0) {
                const variables: Record<string, string> = {};
                
                // Prompt for each variable
                for (const varName of template.variables) {
                    const value = await vscode.window.showInputBox({
                        prompt: `Enter value for ${varName}`,
                        placeHolder: `Value for {{${varName}}}`
                    });
                    
                    if (value !== undefined) {
                        variables[varName] = value;
                    }
                }
                
                return templateManager.processTemplate(template, variables);
            } else {
                return template.content;
            }
        }
    }
    
    return undefined;
}