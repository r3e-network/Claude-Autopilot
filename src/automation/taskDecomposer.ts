import * as vscode from 'vscode';
import { debugLog } from '../utils/logging';
import { TaskPersistenceManager, PersistedTask } from '../context/taskPersistence';
import { ContextProvider } from '../context/contextProvider';

export interface TaskTemplate {
    id: string;
    name: string;
    description: string;
    category: 'production' | 'testing' | 'documentation' | 'setup' | 'creation' | 'git' | 'cleanup';
    priority: 'low' | 'medium' | 'high' | 'critical';
    subtasks: SubTaskTemplate[];
    dependencies?: string[];
    estimatedDuration?: number; // minutes
    requiredTools?: string[];
}

export interface SubTaskTemplate {
    id: string;
    name: string;
    description: string;
    command?: string;
    validator?: string;
    subAgent?: string;
    order: number;
    parallel?: boolean;
    optional?: boolean;
}

export interface DecomposedTask {
    mainTask: PersistedTask;
    subtasks: PersistedTask[];
    workflow: TaskWorkflow;
}

export interface TaskWorkflow {
    steps: WorkflowStep[];
    parallelGroups: WorkflowStep[][];
    estimatedTotalTime: number;
}

export interface WorkflowStep {
    taskId: string;
    name: string;
    command?: string;
    subAgent?: string;
    dependencies: string[];
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

export class TaskDecomposer {
    private templates: Map<string, TaskTemplate> = new Map();
    
    constructor(
        private taskManager: TaskPersistenceManager,
        private contextProvider: ContextProvider
    ) {
        this.initializeTemplates();
    }

    private initializeTemplates(): void {
        // Production Ready Template
        this.templates.set('production-ready', {
            id: 'production-ready',
            name: 'Make Project Production Ready',
            description: 'Complete workflow to make the project production-ready',
            category: 'production',
            priority: 'critical',
            estimatedDuration: 120,
            subtasks: [
                {
                    id: 'analyze-project',
                    name: 'Analyze Project Structure',
                    description: 'Understand current project state and requirements',
                    subAgent: 'project-analyzer',
                    order: 1
                },
                {
                    id: 'fix-tests',
                    name: 'Fix All Unit Tests',
                    description: 'Ensure all unit tests pass',
                    command: 'npm test',
                    subAgent: 'test-fixer',
                    order: 2
                },
                {
                    id: 'add-tests',
                    name: 'Add Missing Unit Tests',
                    description: 'Achieve minimum 80% code coverage',
                    subAgent: 'test-creator',
                    order: 3
                },
                {
                    id: 'add-docs',
                    name: 'Add Comprehensive Documentation',
                    description: 'Create README, API docs, and inline documentation',
                    subAgent: 'doc-generator',
                    order: 4,
                    parallel: true
                },
                {
                    id: 'add-scripts',
                    name: 'Add Essential Scripts',
                    description: 'Add build, test, lint, and deployment scripts',
                    subAgent: 'script-creator',
                    order: 4,
                    parallel: true
                },
                {
                    id: 'add-docker',
                    name: 'Add Docker Configuration',
                    description: 'Create Dockerfile and docker-compose.yml',
                    subAgent: 'docker-creator',
                    order: 5
                },
                {
                    id: 'cleanup-code',
                    name: 'Clean and Organize Code',
                    description: 'Remove dead code, organize files, update dependencies',
                    subAgent: 'code-cleaner',
                    order: 6
                },
                {
                    id: 'security-audit',
                    name: 'Security Audit',
                    description: 'Check for vulnerabilities and security issues',
                    subAgent: 'security-auditor',
                    order: 7
                },
                {
                    id: 'performance-optimize',
                    name: 'Performance Optimization',
                    description: 'Optimize build size and runtime performance',
                    subAgent: 'performance-optimizer',
                    order: 8
                },
                {
                    id: 'final-validation',
                    name: 'Final Production Validation',
                    description: 'Validate all production requirements are met',
                    subAgent: 'production-validator',
                    order: 9
                }
            ]
        });

        // Create New Project Template
        this.templates.set('create-project', {
            id: 'create-project',
            name: 'Create New Project from Specification',
            description: 'Create a complete new project based on requirements',
            category: 'creation',
            priority: 'high',
            estimatedDuration: 60,
            subtasks: [
                {
                    id: 'parse-requirements',
                    name: 'Parse Project Requirements',
                    description: 'Analyze specifications and create project plan',
                    subAgent: 'requirement-analyzer',
                    order: 1
                },
                {
                    id: 'setup-structure',
                    name: 'Setup Project Structure',
                    description: 'Create directories and initial configuration',
                    subAgent: 'project-initializer',
                    order: 2
                },
                {
                    id: 'install-dependencies',
                    name: 'Install Dependencies',
                    description: 'Install required packages and tools',
                    subAgent: 'dependency-installer',
                    order: 3
                },
                {
                    id: 'generate-code',
                    name: 'Generate Initial Code',
                    description: 'Create boilerplate and initial implementation',
                    subAgent: 'code-generator',
                    order: 4
                },
                {
                    id: 'setup-tooling',
                    name: 'Setup Development Tooling',
                    description: 'Configure linting, formatting, and build tools',
                    subAgent: 'tooling-configurator',
                    order: 5
                },
                {
                    id: 'create-tests',
                    name: 'Create Initial Tests',
                    description: 'Setup test framework and initial test cases',
                    subAgent: 'test-creator',
                    order: 6
                },
                {
                    id: 'create-docs',
                    name: 'Create Initial Documentation',
                    description: 'Generate README and basic documentation',
                    subAgent: 'doc-generator',
                    order: 7
                }
            ]
        });

        // Git Workflow Template
        this.templates.set('git-pr-workflow', {
            id: 'git-pr-workflow',
            name: 'Create or Update Pull Request',
            description: 'Complete Git workflow for creating/updating PRs',
            category: 'git',
            priority: 'high',
            estimatedDuration: 15,
            subtasks: [
                {
                    id: 'check-status',
                    name: 'Check Git Status',
                    description: 'Analyze current git state and changes',
                    command: 'git status',
                    order: 1
                },
                {
                    id: 'run-tests',
                    name: 'Run Tests Before Commit',
                    description: 'Ensure all tests pass',
                    command: 'npm test',
                    order: 2
                },
                {
                    id: 'lint-code',
                    name: 'Lint and Format Code',
                    description: 'Ensure code meets style guidelines',
                    command: 'npm run lint:fix',
                    order: 3
                },
                {
                    id: 'stage-changes',
                    name: 'Stage Changes',
                    description: 'Stage all relevant changes',
                    command: 'git add -A',
                    order: 4
                },
                {
                    id: 'create-commit',
                    name: 'Create Meaningful Commit',
                    description: 'Create commit with descriptive message',
                    subAgent: 'commit-creator',
                    order: 5
                },
                {
                    id: 'push-branch',
                    name: 'Push to Remote',
                    description: 'Push changes to remote branch',
                    command: 'git push',
                    order: 6
                },
                {
                    id: 'create-pr',
                    name: 'Create/Update Pull Request',
                    description: 'Create PR with description and context',
                    subAgent: 'pr-creator',
                    order: 7
                }
            ]
        });

        // Website Creation Template
        this.templates.set('create-website', {
            id: 'create-website',
            name: 'Create Beautiful Website',
            description: 'Create a well-designed, complete website',
            category: 'creation',
            priority: 'high',
            estimatedDuration: 90,
            subtasks: [
                {
                    id: 'design-planning',
                    name: 'Design Planning',
                    description: 'Plan website structure, design, and UX',
                    subAgent: 'design-planner',
                    order: 1
                },
                {
                    id: 'setup-framework',
                    name: 'Setup Web Framework',
                    description: 'Initialize chosen framework (React/Vue/etc)',
                    subAgent: 'framework-initializer',
                    order: 2
                },
                {
                    id: 'create-components',
                    name: 'Create UI Components',
                    description: 'Build reusable UI components',
                    subAgent: 'component-creator',
                    order: 3
                },
                {
                    id: 'implement-pages',
                    name: 'Implement All Pages',
                    description: 'Create all website pages with content',
                    subAgent: 'page-builder',
                    order: 4
                },
                {
                    id: 'add-styling',
                    name: 'Add Beautiful Styling',
                    description: 'Implement responsive design and animations',
                    subAgent: 'style-creator',
                    order: 5
                },
                {
                    id: 'add-functionality',
                    name: 'Add Interactive Features',
                    description: 'Implement forms, navigation, and interactions',
                    subAgent: 'interaction-developer',
                    order: 6
                },
                {
                    id: 'optimize-performance',
                    name: 'Optimize Website Performance',
                    description: 'Optimize images, bundle size, and loading',
                    subAgent: 'web-optimizer',
                    order: 7
                },
                {
                    id: 'test-responsive',
                    name: 'Test Responsive Design',
                    description: 'Ensure website works on all devices',
                    subAgent: 'responsive-tester',
                    order: 8
                },
                {
                    id: 'deploy-website',
                    name: 'Deploy Website',
                    description: 'Deploy to hosting platform',
                    subAgent: 'deployment-manager',
                    order: 9
                }
            ]
        });

        // Add more templates...
        this.addTestingTemplates();
        this.addDocumentationTemplates();
        this.addCleanupTemplates();
    }

    private addTestingTemplates(): void {
        this.templates.set('comprehensive-testing', {
            id: 'comprehensive-testing',
            name: 'Add Comprehensive Testing',
            description: 'Add unit, integration, and e2e tests',
            category: 'testing',
            priority: 'high',
            estimatedDuration: 60,
            subtasks: [
                {
                    id: 'analyze-coverage',
                    name: 'Analyze Current Test Coverage',
                    description: 'Identify areas lacking tests',
                    command: 'npm run test:coverage',
                    order: 1
                },
                {
                    id: 'create-unit-tests',
                    name: 'Create Unit Tests',
                    description: 'Add unit tests for all functions/methods',
                    subAgent: 'unit-test-creator',
                    order: 2
                },
                {
                    id: 'create-integration-tests',
                    name: 'Create Integration Tests',
                    description: 'Add tests for component interactions',
                    subAgent: 'integration-test-creator',
                    order: 3
                },
                {
                    id: 'create-e2e-tests',
                    name: 'Create E2E Tests',
                    description: 'Add end-to-end user flow tests',
                    subAgent: 'e2e-test-creator',
                    order: 4
                },
                {
                    id: 'setup-ci-tests',
                    name: 'Setup CI Test Pipeline',
                    description: 'Configure automated testing in CI/CD',
                    subAgent: 'ci-configurator',
                    order: 5
                }
            ]
        });
    }

    private addDocumentationTemplates(): void {
        this.templates.set('complete-documentation', {
            id: 'complete-documentation',
            name: 'Create Complete Documentation',
            description: 'Add all necessary documentation',
            category: 'documentation',
            priority: 'medium',
            estimatedDuration: 45,
            subtasks: [
                {
                    id: 'create-readme',
                    name: 'Create/Update README',
                    description: 'Comprehensive project overview and setup guide',
                    subAgent: 'readme-creator',
                    order: 1
                },
                {
                    id: 'create-api-docs',
                    name: 'Generate API Documentation',
                    description: 'Document all public APIs',
                    subAgent: 'api-doc-generator',
                    order: 2
                },
                {
                    id: 'create-guides',
                    name: 'Create User Guides',
                    description: 'Step-by-step guides for common tasks',
                    subAgent: 'guide-creator',
                    order: 3
                },
                {
                    id: 'add-code-comments',
                    name: 'Add Code Comments',
                    description: 'Add JSDoc/TSDoc comments to all public APIs',
                    subAgent: 'comment-adder',
                    order: 4
                },
                {
                    id: 'create-architecture-docs',
                    name: 'Document Architecture',
                    description: 'Create architecture diagrams and explanations',
                    subAgent: 'architecture-documenter',
                    order: 5
                }
            ]
        });
    }

    private addCleanupTemplates(): void {
        this.templates.set('code-cleanup', {
            id: 'code-cleanup',
            name: 'Clean and Organize Codebase',
            description: 'Remove dead code and organize project',
            category: 'cleanup',
            priority: 'medium',
            estimatedDuration: 30,
            subtasks: [
                {
                    id: 'find-dead-code',
                    name: 'Find Dead Code',
                    description: 'Identify unused code and dependencies',
                    subAgent: 'dead-code-finder',
                    order: 1
                },
                {
                    id: 'remove-unused',
                    name: 'Remove Unused Code',
                    description: 'Safely remove dead code',
                    subAgent: 'code-remover',
                    order: 2
                },
                {
                    id: 'organize-files',
                    name: 'Organize File Structure',
                    description: 'Reorganize files for better structure',
                    subAgent: 'file-organizer',
                    order: 3
                },
                {
                    id: 'update-imports',
                    name: 'Update Import Paths',
                    description: 'Fix all import paths after reorganization',
                    subAgent: 'import-fixer',
                    order: 4
                },
                {
                    id: 'format-code',
                    name: 'Format All Code',
                    description: 'Apply consistent formatting',
                    command: 'npm run format',
                    order: 5
                }
            ]
        });
    }

    /**
     * Decompose a high-level command into executable subtasks
     */
    async decomposeCommand(command: string): Promise<DecomposedTask | null> {
        debugLog(`Decomposing command: ${command}`);
        
        // Detect command intent and find matching template
        const template = this.detectTemplate(command);
        if (!template) {
            debugLog('No matching template found for command');
            return null;
        }

        // Create main task
        const mainTask = this.taskManager.createTask(
            template.name,
            `${template.description}\n\nOriginal command: ${command}`,
            template.priority
        );

        // Create subtasks
        const subtasks: PersistedTask[] = [];
        const workflow: TaskWorkflow = {
            steps: [],
            parallelGroups: [],
            estimatedTotalTime: template.estimatedDuration || 0
        };

        // Group subtasks by order for parallel execution
        const tasksByOrder = new Map<number, SubTaskTemplate[]>();
        for (const subtaskTemplate of template.subtasks) {
            const order = subtaskTemplate.order;
            if (!tasksByOrder.has(order)) {
                tasksByOrder.set(order, []);
            }
            tasksByOrder.get(order)!.push(subtaskTemplate);
        }

        // Create tasks and workflow steps
        for (const [order, templates] of Array.from(tasksByOrder.entries()).sort((a, b) => a[0] - b[0])) {
            const parallelGroup: WorkflowStep[] = [];
            
            for (const subtaskTemplate of templates) {
                const subtask = this.taskManager.createTask(
                    subtaskTemplate.name,
                    subtaskTemplate.description,
                    'medium'
                );
                
                // Link to main task
                this.taskManager.linkTasks(mainTask.id, subtask.id);
                subtasks.push(subtask);

                const step: WorkflowStep = {
                    taskId: subtask.id,
                    name: subtaskTemplate.name,
                    command: subtaskTemplate.command,
                    subAgent: subtaskTemplate.subAgent,
                    dependencies: order > 1 ? 
                        tasksByOrder.get(order - 1)!.map(t => t.id) : [],
                    status: 'pending'
                };

                workflow.steps.push(step);
                parallelGroup.push(step);
            }

            workflow.parallelGroups.push(parallelGroup);
        }

        // Generate context for this workflow
        const context = await this.contextProvider.generateFullContext({
            includeProjectOverview: true,
            includeUnfinishedTasks: true,
            includeRecentChanges: true
        });

        // Add workflow context to main task
        this.taskManager.addTaskContext(mainTask.id, {
            outputs: [`Workflow created with ${subtasks.length} subtasks`],
            files: ['.autopilot/CLAUDE_CONTEXT.md']
        });

        return {
            mainTask,
            subtasks,
            workflow
        };
    }

    /**
     * Detect which template matches the command
     */
    private detectTemplate(command: string): TaskTemplate | null {
        const lowerCommand = command.toLowerCase();
        
        // Direct template matching
        const templateMatchers: { keywords: string[], templateId: string }[] = [
            {
                keywords: ['production ready', 'production-ready', 'make production', 'productionize'],
                templateId: 'production-ready'
            },
            {
                keywords: ['create project', 'new project', 'initialize project', 'setup project'],
                templateId: 'create-project'
            },
            {
                keywords: ['create pr', 'pull request', 'commit and push', 'git workflow'],
                templateId: 'git-pr-workflow'
            },
            {
                keywords: ['create website', 'build website', 'new website', 'web application'],
                templateId: 'create-website'
            },
            {
                keywords: ['add tests', 'create tests', 'unit tests', 'test coverage'],
                templateId: 'comprehensive-testing'
            },
            {
                keywords: ['add documentation', 'create docs', 'document', 'readme'],
                templateId: 'complete-documentation'
            },
            {
                keywords: ['clean code', 'cleanup', 'organize', 'refactor', 'remove dead code'],
                templateId: 'code-cleanup'
            }
        ];

        for (const matcher of templateMatchers) {
            if (matcher.keywords.some(keyword => lowerCommand.includes(keyword))) {
                return this.templates.get(matcher.templateId) || null;
            }
        }

        // If no exact match, try to build a custom workflow
        return this.buildCustomTemplate(command);
    }

    /**
     * Build a custom template based on command analysis
     */
    private buildCustomTemplate(command: string): TaskTemplate | null {
        const lowerCommand = command.toLowerCase();
        const subtasks: SubTaskTemplate[] = [];
        let order = 1;

        // Analyze command for specific tasks
        if (lowerCommand.includes('test')) {
            subtasks.push({
                id: 'run-tests',
                name: 'Run Tests',
                description: 'Execute test suite',
                command: 'npm test',
                order: order++
            });
        }

        if (lowerCommand.includes('lint')) {
            subtasks.push({
                id: 'lint-code',
                name: 'Lint Code',
                description: 'Run linting checks',
                command: 'npm run lint',
                order: order++
            });
        }

        if (lowerCommand.includes('build')) {
            subtasks.push({
                id: 'build-project',
                name: 'Build Project',
                description: 'Run build process',
                command: 'npm run build',
                order: order++
            });
        }

        if (lowerCommand.includes('deploy')) {
            subtasks.push({
                id: 'deploy-project',
                name: 'Deploy Project',
                description: 'Deploy to production',
                subAgent: 'deployment-manager',
                order: order++
            });
        }

        if (subtasks.length === 0) {
            return null;
        }

        return {
            id: 'custom-workflow',
            name: 'Custom Workflow',
            description: command,
            category: 'production',
            priority: 'medium',
            subtasks
        };
    }

    /**
     * Get incomplete subtasks for a main task
     */
    getIncompleteSubtasks(mainTaskId: string): PersistedTask[] {
        const mainTask = this.taskManager.getTask(mainTaskId);
        if (!mainTask || !mainTask.subtasks) {
            return [];
        }

        return mainTask.subtasks
            .map(id => this.taskManager.getTask(id))
            .filter(task => task && (task.status === 'pending' || task.status === 'in_progress'))
            .filter((task): task is PersistedTask => task !== null);
    }

    /**
     * Get next task to execute based on dependencies
     */
    getNextExecutableTask(workflow: TaskWorkflow): WorkflowStep | null {
        for (const step of workflow.steps) {
            if (step.status !== 'pending') continue;

            // Check if all dependencies are completed
            const dependenciesComplete = step.dependencies.every(depId => {
                const depStep = workflow.steps.find(s => s.taskId === depId);
                return depStep && depStep.status === 'completed';
            });

            if (dependenciesComplete) {
                return step;
            }
        }

        return null;
    }

    /**
     * Update workflow step status
     */
    updateStepStatus(workflow: TaskWorkflow, taskId: string, status: WorkflowStep['status']): void {
        const step = workflow.steps.find(s => s.taskId === taskId);
        if (step) {
            step.status = status;
        }
    }

    /**
     * Generate execution plan for Claude
     */
    generateExecutionPlan(decomposedTask: DecomposedTask): string {
        const { mainTask, subtasks, workflow } = decomposedTask;
        
        const plan = [`# Execution Plan: ${mainTask.title}

## Overview
${mainTask.description}

## Workflow Steps (${workflow.steps.length} total)
Estimated time: ${workflow.estimatedTotalTime} minutes

`];

        // Group by parallel execution
        let stepNumber = 1;
        for (const group of workflow.parallelGroups) {
            if (group.length === 1) {
                const step = group[0];
                plan.push(`### Step ${stepNumber}: ${step.name}`);
                if (step.command) {
                    plan.push(`Command: \`${step.command}\``);
                }
                if (step.subAgent) {
                    plan.push(`Sub-agent: ${step.subAgent}`);
                }
                plan.push('');
            } else {
                plan.push(`### Step ${stepNumber}: Parallel Tasks`);
                for (const step of group) {
                    plan.push(`- **${step.name}**`);
                    if (step.command) {
                        plan.push(`  - Command: \`${step.command}\``);
                    }
                    if (step.subAgent) {
                        plan.push(`  - Sub-agent: ${step.subAgent}`);
                    }
                }
                plan.push('');
            }
            stepNumber++;
        }

        plan.push(`## Execution Strategy
1. Tasks will be executed in order, with parallel tasks running simultaneously
2. Each task will be validated before proceeding to the next
3. If a task fails, the workflow will attempt recovery before continuing
4. Progress will be tracked and can be resumed if interrupted

## Next Action
Start with the first pending task and work through the workflow systematically.
`);

        return plan.join('\n');
    }
}