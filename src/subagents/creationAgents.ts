import { BaseProductionAgent } from './BaseProductionAgent';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { debugLog } from '../utils/logging';

const execAsync = promisify(exec);

/**
 * Project Initializer Agent - Creates new projects from specifications
 */
export class ProjectInitializerAgent extends BaseProductionAgent {
    name = 'Project Initializer';
    description = 'Creates new projects with proper structure and configuration';
    capabilities = [
        'Parse project requirements',
        'Create directory structure',
        'Initialize git repository',
        'Setup package managers',
        'Configure build tools'
    ];

    async executeSimple(spec?: string): Promise<{ success: boolean; message: string }> {
        try {
            // Parse project specification
            const projectSpec = this.parseSpecification(spec || '');
            
            // Create project structure
            await this.createProjectStructure(projectSpec);
            
            // Initialize version control
            await this.initializeGit(projectSpec);
            
            // Setup package manager
            await this.setupPackageManager(projectSpec);
            
            // Create initial configuration files
            await this.createConfigFiles(projectSpec);

            return {
                success: true,
                message: `Project "${projectSpec.name}" initialized successfully at ${projectSpec.path}`
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Project initialization failed: ${error.message}`
            };
        }
    }

    private parseSpecification(spec: string): any {
        // Default project specification
        const defaultSpec = {
            name: 'new-project',
            type: 'node',
            framework: 'none',
            features: [] as string[],
            path: this.workspaceRoot
        };

        // Parse specification from text
        const lines = spec.split('\n');
        const projectSpec = { ...defaultSpec };

        for (const line of lines) {
            const [key, value] = line.split(':').map(s => s.trim());
            
            switch (key.toLowerCase()) {
                case 'name':
                    projectSpec.name = value;
                    break;
                case 'type':
                    projectSpec.type = value;
                    break;
                case 'framework':
                    projectSpec.framework = value;
                    break;
                case 'features':
                    projectSpec.features = value.split(',').map(s => s.trim());
                    break;
            }
        }

        projectSpec.path = path.join(this.workspaceRoot, projectSpec.name);
        
        return projectSpec;
    }

    private async createProjectStructure(spec: any): Promise<void> {
        const dirs = [
            'src',
            'tests',
            'docs',
            'config',
            '.github/workflows'
        ];

        // Create project root
        if (!fs.existsSync(spec.path)) {
            fs.mkdirSync(spec.path, { recursive: true });
        }

        // Create standard directories
        for (const dir of dirs) {
            const fullPath = path.join(spec.path, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        }

        // Create framework-specific structure
        if (spec.framework === 'react') {
            await this.createReactStructure(spec);
        } else if (spec.framework === 'express') {
            await this.createExpressStructure(spec);
        } else if (spec.framework === 'vue') {
            await this.createVueStructure(spec);
        }

        // Create initial files
        await this.createInitialFiles(spec);
    }

    private async createReactStructure(spec: any): Promise<void> {
        const dirs = [
            'src/components',
            'src/pages',
            'src/hooks',
            'src/utils',
            'src/styles',
            'public'
        ];

        for (const dir of dirs) {
            const fullPath = path.join(spec.path, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        }

        // Create App.tsx
        const appContent = `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to ${spec.name}</h1>
        <p>Edit src/App.tsx and save to reload.</p>
      </header>
    </div>
  );
}

export default App;
`;
        fs.writeFileSync(path.join(spec.path, 'src/App.tsx'), appContent);

        // Create index.tsx
        const indexContent = `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
        fs.writeFileSync(path.join(spec.path, 'src/index.tsx'), indexContent);
    }

    private async createExpressStructure(spec: any): Promise<void> {
        const dirs = [
            'src/routes',
            'src/controllers',
            'src/models',
            'src/middleware',
            'src/utils',
            'src/services'
        ];

        for (const dir of dirs) {
            const fullPath = path.join(spec.path, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        }

        // Create app.ts
        const appContent = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ${spec.name} API' });
});

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

export default app;
`;
        fs.writeFileSync(path.join(spec.path, 'src/app.ts'), appContent);
    }

    private async createVueStructure(spec: any): Promise<void> {
        const dirs = [
            'src/components',
            'src/views',
            'src/router',
            'src/store',
            'src/assets',
            'src/utils'
        ];

        for (const dir of dirs) {
            const fullPath = path.join(spec.path, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        }
    }

    private async createInitialFiles(spec: any): Promise<void> {
        // Create README
        const readme = `# ${spec.name}

## Description
${spec.description || 'Project description goes here'}

## Installation
\`\`\`bash
npm install
\`\`\`

## Usage
\`\`\`bash
npm start
\`\`\`

## Development
\`\`\`bash
npm run dev
\`\`\`

## Testing
\`\`\`bash
npm test
\`\`\`
`;
        fs.writeFileSync(path.join(spec.path, 'README.md'), readme);

        // Create .gitignore
        const gitignore = `node_modules/
dist/
build/
.env
.env.local
.DS_Store
*.log
coverage/
.vscode/
.idea/
`;
        fs.writeFileSync(path.join(spec.path, '.gitignore'), gitignore);

        // Create .env.example
        const envExample = `NODE_ENV=development
PORT=3000
DATABASE_URL=
API_KEY=
`;
        fs.writeFileSync(path.join(spec.path, '.env.example'), envExample);
    }

    private async initializeGit(spec: any): Promise<void> {
        try {
            await execAsync('git init', { cwd: spec.path });
            await execAsync('git add .', { cwd: spec.path });
            await execAsync('git commit -m "Initial commit"', { cwd: spec.path });
            debugLog('Git repository initialized');
        } catch (error) {
            debugLog('Failed to initialize git repository');
        }
    }

    private async setupPackageManager(spec: any): Promise<void> {
        if (spec.type === 'node') {
            // Create package.json
            const packageJson = {
                name: spec.name,
                version: '0.1.0',
                description: spec.description || '',
                main: 'dist/index.js',
                scripts: {
                    start: 'node dist/index.js',
                    dev: 'nodemon src/index.ts',
                    build: 'tsc',
                    test: 'jest',
                    lint: 'eslint src --ext .ts,.tsx',
                    'lint:fix': 'eslint src --ext .ts,.tsx --fix'
                },
                keywords: [],
                author: '',
                license: 'MIT',
                devDependencies: {} as Record<string, string>,
                dependencies: {} as Record<string, string>
            };

            // Add framework-specific dependencies
            if (spec.framework === 'react') {
                packageJson.dependencies['react'] = '^18.2.0';
                packageJson.dependencies['react-dom'] = '^18.2.0';
                packageJson.devDependencies['@types/react'] = '^18.2.0';
                packageJson.devDependencies['@types/react-dom'] = '^18.2.0';
            } else if (spec.framework === 'express') {
                packageJson.dependencies['express'] = '^4.18.0';
                packageJson.dependencies['cors'] = '^2.8.5';
                packageJson.dependencies['helmet'] = '^7.0.0';
                packageJson.devDependencies['@types/express'] = '^4.17.17';
            }

            // Common dev dependencies
            packageJson.devDependencies['typescript'] = '^5.0.0';
            packageJson.devDependencies['@types/node'] = '^18.0.0';
            packageJson.devDependencies['jest'] = '^29.0.0';
            packageJson.devDependencies['@types/jest'] = '^29.0.0';
            packageJson.devDependencies['eslint'] = '^8.0.0';
            packageJson.devDependencies['prettier'] = '^2.8.0';

            fs.writeFileSync(
                path.join(spec.path, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );
        }
    }

    private async createConfigFiles(spec: any): Promise<void> {
        // TypeScript configuration
        const tsConfig = {
            compilerOptions: {
                target: 'ES2020',
                module: 'commonjs',
                lib: ['ES2020'],
                outDir: './dist',
                rootDir: './src',
                strict: true,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true,
                resolveJsonModule: true,
                declaration: true,
                declarationMap: true,
                sourceMap: true,
                removeComments: true
            },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist', 'tests']
        };

        fs.writeFileSync(
            path.join(spec.path, 'tsconfig.json'),
            JSON.stringify(tsConfig, null, 2)
        );

        // ESLint configuration
        const eslintConfig = {
            parser: '@typescript-eslint/parser',
            extends: [
                'eslint:recommended',
                'plugin:@typescript-eslint/recommended'
            ],
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: 'module'
            },
            rules: {
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/no-explicit-any': 'warn'
            }
        };

        fs.writeFileSync(
            path.join(spec.path, '.eslintrc.json'),
            JSON.stringify(eslintConfig, null, 2)
        );

        // Prettier configuration
        const prettierConfig = {
            semi: true,
            trailingComma: 'all',
            singleQuote: true,
            printWidth: 100,
            tabWidth: 2
        };

        fs.writeFileSync(
            path.join(spec.path, '.prettierrc'),
            JSON.stringify(prettierConfig, null, 2)
        );

        // Jest configuration
        const jestConfig = {
            preset: 'ts-jest',
            testEnvironment: 'node',
            roots: ['<rootDir>/src', '<rootDir>/tests'],
            testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
            transform: {
                '^.+\\.ts$': 'ts-jest'
            }
        };

        fs.writeFileSync(
            path.join(spec.path, 'jest.config.js'),
            `module.exports = ${JSON.stringify(jestConfig, null, 2)}`
        );
    }
}

/**
 * Website Builder Agent - Creates complete websites
 */
export class WebsiteBuilderAgent extends BaseProductionAgent {
    name = 'Website Builder';
    description = 'Creates beautiful, responsive websites';
    capabilities = [
        'Design responsive layouts',
        'Create reusable components',
        'Implement animations',
        'Optimize performance',
        'Setup deployment'
    ];

    async executeSimple(spec?: string): Promise<{ success: boolean; message: string }> {
        try {
            const websiteSpec = this.parseWebsiteSpec(spec || '');
            
            // Create website structure
            await this.createWebsiteStructure(websiteSpec);
            
            // Generate pages
            await this.generatePages(websiteSpec);
            
            // Create components
            await this.createComponents(websiteSpec);
            
            // Add styling
            await this.addStyling(websiteSpec);
            
            // Setup build process
            await this.setupBuildProcess(websiteSpec);

            return {
                success: true,
                message: `Website "${websiteSpec.name}" created successfully!`
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Website creation failed: ${error.message}`
            };
        }
    }

    private parseWebsiteSpec(spec: string): any {
        return {
            name: 'my-website',
            type: 'landing',
            pages: ['home', 'about', 'services', 'contact'],
            features: ['responsive', 'animations', 'forms'],
            style: 'modern',
            colorScheme: {
                primary: '#007bff',
                secondary: '#6c757d',
                success: '#28a745',
                danger: '#dc3545'
            }
        };
    }

    private async createWebsiteStructure(spec: any): Promise<void> {
        const dirs = [
            'src',
            'src/pages',
            'src/components',
            'src/styles',
            'src/assets',
            'src/assets/images',
            'src/assets/fonts',
            'src/scripts',
            'public'
        ];

        for (const dir of dirs) {
            const fullPath = path.join(this.workspaceRoot, spec.name, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
            }
        }
    }

    private async generatePages(spec: any): Promise<void> {
        // Create index.html
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${spec.name}</title>
    <link rel="stylesheet" href="styles/main.css">
</head>
<body>
    <nav class="navbar">
        <div class="container">
            <a href="#" class="logo">${spec.name}</a>
            <ul class="nav-links">
                ${spec.pages.map((page: string) => 
                    `<li><a href="#${page}">${page.charAt(0).toUpperCase() + page.slice(1)}</a></li>`
                ).join('\n                ')}
            </ul>
        </div>
    </nav>

    <main>
        <section id="hero" class="hero">
            <div class="container">
                <h1>Welcome to ${spec.name}</h1>
                <p>Your journey starts here</p>
                <a href="#contact" class="btn btn-primary">Get Started</a>
            </div>
        </section>

        ${spec.pages.map((page: string) => `
        <section id="${page}" class="section">
            <div class="container">
                <h2>${page.charAt(0).toUpperCase() + page.slice(1)}</h2>
                <p>Content for ${page} section</p>
            </div>
        </section>`).join('\n')}
    </main>

    <footer class="footer">
        <div class="container">
            <p>&copy; 2024 ${spec.name}. All rights reserved.</p>
        </div>
    </footer>

    <script src="scripts/main.js"></script>
</body>
</html>`;

        fs.writeFileSync(
            path.join(this.workspaceRoot, spec.name, 'index.html'),
            indexHtml
        );
    }

    private async createComponents(spec: any): Promise<void> {
        // Create reusable component templates
        const buttonComponent = `// Button Component
class Button {
    constructor(text, type = 'primary', onClick) {
        this.text = text;
        this.type = type;
        this.onClick = onClick;
    }

    render() {
        const button = document.createElement('button');
        button.className = \`btn btn-\${this.type}\`;
        button.textContent = this.text;
        button.addEventListener('click', this.onClick);
        return button;
    }
}

export default Button;
`;

        fs.writeFileSync(
            path.join(this.workspaceRoot, spec.name, 'src/components/Button.js'),
            buttonComponent
        );

        // Create card component
        const cardComponent = `// Card Component
class Card {
    constructor(title, content, image) {
        this.title = title;
        this.content = content;
        this.image = image;
    }

    render() {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = \`
            \${this.image ? \`<img src="\${this.image}" alt="\${this.title}" class="card-image">\` : ''}
            <div class="card-body">
                <h3 class="card-title">\${this.title}</h3>
                <p class="card-content">\${this.content}</p>
            </div>
        \`;
        return card;
    }
}

export default Card;
`;

        fs.writeFileSync(
            path.join(this.workspaceRoot, spec.name, 'src/components/Card.js'),
            cardComponent
        );
    }

    private async addStyling(spec: any): Promise<void> {
        // Create main.css
        const mainCss = `:root {
    --primary-color: ${spec.colorScheme.primary};
    --secondary-color: ${spec.colorScheme.secondary};
    --success-color: ${spec.colorScheme.success};
    --danger-color: ${spec.colorScheme.danger};
    --text-color: #333;
    --bg-color: #fff;
    --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: var(--font-family);
    color: var(--text-color);
    background-color: var(--bg-color);
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
}

/* Navigation */
.navbar {
    background-color: var(--bg-color);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    z-index: 1000;
}

.navbar .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 20px;
}

.logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--primary-color);
    text-decoration: none;
}

.nav-links {
    display: flex;
    list-style: none;
    gap: 2rem;
}

.nav-links a {
    color: var(--text-color);
    text-decoration: none;
    transition: color 0.3s;
}

.nav-links a:hover {
    color: var(--primary-color);
}

/* Hero Section */
.hero {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    padding: 8rem 0;
    text-align: center;
}

.hero h1 {
    font-size: 3rem;
    margin-bottom: 1rem;
}

.hero p {
    font-size: 1.25rem;
    margin-bottom: 2rem;
}

/* Buttons */
.btn {
    display: inline-block;
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.3s;
}

.btn-primary {
    background-color: var(--primary-color);
    color: white;
}

.btn-primary:hover {
    background-color: darken(var(--primary-color), 10%);
    transform: translateY(-2px);
}

/* Sections */
.section {
    padding: 4rem 0;
}

.section h2 {
    font-size: 2.5rem;
    margin-bottom: 2rem;
    text-align: center;
}

/* Cards */
.card {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    overflow: hidden;
    transition: transform 0.3s, box-shadow 0.3s;
}

.card:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.card-image {
    width: 100%;
    height: 200px;
    object-fit: cover;
}

.card-body {
    padding: 1.5rem;
}

.card-title {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
}

/* Footer */
.footer {
    background-color: var(--text-color);
    color: white;
    text-align: center;
    padding: 2rem 0;
    margin-top: 4rem;
}

/* Responsive */
@media (max-width: 768px) {
    .nav-links {
        flex-direction: column;
        gap: 1rem;
    }
    
    .hero h1 {
        font-size: 2rem;
    }
    
    .section h2 {
        font-size: 1.75rem;
    }
}
`;

        fs.writeFileSync(
            path.join(this.workspaceRoot, spec.name, 'src/styles/main.css'),
            mainCss
        );

        // Create main.js
        const mainJs = `// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
        }
    });
}, observerOptions);

// Observe all sections
document.querySelectorAll('.section').forEach(section => {
    observer.observe(section);
});

// Add fade-in animation styles
const style = document.createElement('style');
style.textContent = \`
    .section {
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.6s, transform 0.6s;
    }
    
    .section.fade-in {
        opacity: 1;
        transform: translateY(0);
    }
\`;
document.head.appendChild(style);
`;

        fs.writeFileSync(
            path.join(this.workspaceRoot, spec.name, 'src/scripts/main.js'),
            mainJs
        );
    }

    private async setupBuildProcess(spec: any): Promise<void> {
        // Create simple build script
        const buildScript = `{
  "name": "${spec.name}",
  "version": "1.0.0",
  "description": "A beautiful website",
  "scripts": {
    "dev": "live-server --port=3000",
    "build": "npm run build:css && npm run build:js && npm run build:html",
    "build:css": "postcss src/styles/main.css -o public/styles/main.css",
    "build:js": "esbuild src/scripts/main.js --bundle --minify --outfile=public/scripts/main.js",
    "build:html": "html-minifier index.html -o public/index.html --collapse-whitespace"
  },
  "devDependencies": {
    "live-server": "^1.2.2",
    "postcss": "^8.4.31",
    "postcss-cli": "^10.1.0",
    "autoprefixer": "^10.4.16",
    "cssnano": "^6.0.1",
    "esbuild": "^0.19.5",
    "html-minifier": "^4.0.0"
  }
}`;

        fs.writeFileSync(
            path.join(this.workspaceRoot, spec.name, 'package.json'),
            buildScript
        );

        // Create postcss config
        const postcssConfig = `module.exports = {
  plugins: [
    require('autoprefixer'),
    require('cssnano')({
      preset: 'default',
    })
  ]
}`;

        fs.writeFileSync(
            path.join(this.workspaceRoot, spec.name, 'postcss.config.js'),
            postcssConfig
        );
    }
}

/**
 * Requirement Analyzer Agent
 */
export class RequirementAnalyzerAgent extends BaseProductionAgent {
    name = 'Requirement Analyzer';
    description = 'Analyzes project requirements and creates detailed specifications';
    capabilities = [
        'Parse natural language requirements',
        'Identify technical requirements',
        'Create project specifications',
        'Suggest technology stack'
    ];

    async executeSimple(requirements?: string): Promise<{ success: boolean; message: string }> {
        try {
            const analysis = this.analyzeRequirements(requirements || '');
            const specification = this.createSpecification(analysis);
            
            // Save specification
            const specPath = path.join(this.workspaceRoot, '.autopilot', 'project-specification.md');
            fs.writeFileSync(specPath, specification);

            return {
                success: true,
                message: `Project specification created at ${specPath}`
            };
        } catch (error: any) {
            return {
                success: false,
                message: `Requirement analysis failed: ${error.message}`
            };
        }
    }

    private analyzeRequirements(requirements: string): any {
        const analysis = {
            projectType: 'web',
            features: [] as string[],
            technologies: [] as string[],
            constraints: [] as string[],
            userStories: [] as string[]
        };

        const lines = requirements.toLowerCase().split('\n');
        
        for (const line of lines) {
            // Detect project type
            if (line.includes('website') || line.includes('web app')) {
                analysis.projectType = 'web';
            } else if (line.includes('mobile') || line.includes('app')) {
                analysis.projectType = 'mobile';
            } else if (line.includes('api') || line.includes('backend')) {
                analysis.projectType = 'api';
            }

            // Detect features
            if (line.includes('authentication') || line.includes('login')) {
                analysis.features.push('authentication');
            }
            if (line.includes('payment') || line.includes('stripe')) {
                analysis.features.push('payment-processing');
            }
            if (line.includes('real-time') || line.includes('websocket')) {
                analysis.features.push('real-time-updates');
            }
            if (line.includes('database') || line.includes('data')) {
                analysis.features.push('database');
            }

            // Detect technologies
            if (line.includes('react')) analysis.technologies.push('React');
            if (line.includes('vue')) analysis.technologies.push('Vue');
            if (line.includes('angular')) analysis.technologies.push('Angular');
            if (line.includes('node')) analysis.technologies.push('Node.js');
            if (line.includes('python')) analysis.technologies.push('Python');
        }

        // Generate user stories
        if (analysis.features.includes('authentication')) {
            analysis.userStories.push('As a user, I want to create an account and log in securely');
        }
        if (analysis.features.includes('payment-processing')) {
            analysis.userStories.push('As a user, I want to make secure payments');
        }

        return analysis;
    }

    private createSpecification(analysis: any): string {
        return `# Project Specification

## Project Type
${analysis.projectType}

## Technical Requirements

### Features
${analysis.features.map((f: string) => `- ${f}`).join('\n')}

### Technology Stack
${analysis.technologies.length > 0 ? 
    analysis.technologies.map((t: string) => `- ${t}`).join('\n') :
    '- To be determined based on requirements'
}

## User Stories
${analysis.userStories.map((story: string) => `- ${story}`).join('\n')}

## Architecture Recommendations

### Frontend
- Framework: ${analysis.projectType === 'web' ? 'React/Vue/Angular' : 'React Native/Flutter'}
- State Management: Redux/MobX/Context API
- Styling: Tailwind CSS/Styled Components

### Backend
- Framework: Express.js/FastAPI/Django
- Database: PostgreSQL/MongoDB
- Authentication: JWT/OAuth2

### Infrastructure
- Hosting: AWS/Google Cloud/Vercel
- CI/CD: GitHub Actions
- Monitoring: Sentry/LogRocket

## Development Plan

### Phase 1: Setup (Week 1)
- Initialize project structure
- Setup development environment
- Configure build tools

### Phase 2: Core Features (Weeks 2-4)
- Implement authentication
- Create basic UI/UX
- Setup database

### Phase 3: Advanced Features (Weeks 5-6)
- Add payment processing
- Implement real-time features
- Optimize performance

### Phase 4: Testing & Deployment (Week 7)
- Write comprehensive tests
- Setup CI/CD pipeline
- Deploy to production

## Success Criteria
- All features implemented and tested
- 80%+ test coverage
- Performance metrics met
- Security audit passed
`;
    }
}

// Export all creation agents
export const creationAgents = {
    'project-initializer': ProjectInitializerAgent,
    'website-builder': WebsiteBuilderAgent,
    'requirement-analyzer': RequirementAnalyzerAgent
};