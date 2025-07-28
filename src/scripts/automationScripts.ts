/**
 * Additional automation scripts for Claude Autopilot
 * These are advanced scripts for enhanced automation
 */

export const TDD_AUTOMATION_SCRIPT = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function check() {
    const errors = [];
    const warnings = [];
    
    try {
        // Check for test coverage
        if (fs.existsSync('coverage/coverage-summary.json')) {
            const coverageData = fs.readFileSync('coverage/coverage-summary.json', 'utf8');
            const summary = JSON.parse(coverageData);
            const coverage = summary.total.lines.pct;
            
            if (coverage < 80) {
                errors.push(\`Test coverage (\${coverage}%) is below minimum (80%)\`);
            }
        } else {
            warnings.push('No test coverage data found - run tests with coverage first');
        }
        
        // Basic check for test files
        const hasTests = fs.existsSync('test') || fs.existsSync('tests') || 
                        fs.existsSync('__tests__') || fs.existsSync('src/__tests__');
        
        if (!hasTests) {
            errors.push('No test directory found');
        }
        
    } catch (error) {
        errors.push(\`TDD check failed: \${error.message}\`);
    }
    
    const result = {
        passed: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
    
    console.log(JSON.stringify(result, null, 2));
}

check().catch(error => {
    console.error(JSON.stringify({
        passed: false,
        errors: [\`TDD automation error: \${error.message}\`]
    }, null, 2));
    process.exit(1);
});`;

export const AI_CODE_REVIEW_SCRIPT = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function check() {
    const errors = [];
    const warnings = [];
    
    try {
        // Find code files
        const files = findCodeFiles(process.cwd());
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const relativePath = path.relative(process.cwd(), file);
            
            // Security checks
            if (/eval\\s*\\(/.test(content)) {
                errors.push(\`\${relativePath}: Dangerous use of eval()\`);
            }
            if (/password.*=.*["'][^"']+["']/i.test(content)) {
                errors.push(\`\${relativePath}: Hardcoded password detected\`);
            }
            
            // Performance checks
            if (/for\\s*\\([^)]*\\)\\s*{[^}]*for\\s*\\([^)]*\\)\\s*{/.test(content)) {
                warnings.push(\`\${relativePath}: Nested loops detected - potential O(n²) complexity\`);
            }
            
            // Best practices
            if (/console\\.(log|debug)/.test(content)) {
                warnings.push(\`\${relativePath}: Console statements found\`);
            }
        }
        
    } catch (error) {
        errors.push(\`AI code review failed: \${error.message}\`);
    }
    
    const result = {
        passed: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
    
    console.log(JSON.stringify(result, null, 2));
}

function findCodeFiles(dir) {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx'];
    const skipDirs = ['.git', 'node_modules', 'dist', 'build', 'coverage', '.autopilot'];
    
    function scan(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                if (!skipDirs.includes(item)) {
                    scan(fullPath);
                }
            } else if (stat.isFile()) {
                if (extensions.includes(path.extname(item))) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    scan(dir);
    return files;
}

check().catch(error => {
    console.error(JSON.stringify({
        passed: false,
        errors: [\`AI code review error: \${error.message}\`]
    }, null, 2));
    process.exit(1);
});`;

export const DOC_GENERATOR_SCRIPT = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function check() {
    const errors = [];
    const warnings = [];
    
    try {
        // Check README
        if (!fs.existsSync('README.md')) {
            errors.push('Missing README.md file');
        } else {
            const readme = fs.readFileSync('README.md', 'utf8');
            if (readme.length < 500) {
                warnings.push('README.md is too short (< 500 characters)');
            }
            if (!readme.includes('## Installation')) {
                warnings.push('README.md missing Installation section');
            }
            if (!readme.includes('## Usage')) {
                warnings.push('README.md missing Usage section');
            }
        }
        
        // Check for undocumented functions
        const files = findCodeFiles(process.cwd());
        let undocumentedCount = 0;
        
        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            const functions = content.match(/function\\s+\\w+|(?:const|let|var)\\s+\\w+\\s*=\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>/g) || [];
            
            for (const func of functions) {
                const funcName = func.match(/\\w+/)[0];
                // Check if function has JSDoc above it
                const funcIndex = content.indexOf(func);
                const before = content.substring(Math.max(0, funcIndex - 200), funcIndex);
                if (!/\\/\\*\\*[\\s\\S]*?\\*\\/\\s*$/.test(before)) {
                    undocumentedCount++;
                }
            }
        }
        
        if (undocumentedCount > 0) {
            warnings.push(\`Found \${undocumentedCount} undocumented functions\`);
        }
        
    } catch (error) {
        errors.push(\`Documentation check failed: \${error.message}\`);
    }
    
    const result = {
        passed: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
    
    console.log(JSON.stringify(result, null, 2));
}

function findCodeFiles(dir) {
    const files = [];
    const extensions = ['.js', '.ts', '.jsx', '.tsx'];
    const skipDirs = ['.git', 'node_modules', 'dist', 'build', 'coverage', '.autopilot'];
    
    function scan(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                if (!skipDirs.includes(item)) {
                    scan(fullPath);
                }
            } else if (stat.isFile()) {
                if (extensions.includes(path.extname(item))) {
                    files.push(fullPath);
                }
            }
        }
    }
    
    scan(dir);
    return files;
}

check().catch(error => {
    console.error(JSON.stringify({
        passed: false,
        errors: [\`Documentation generator error: \${error.message}\`]
    }, null, 2));
    process.exit(1);
});`;