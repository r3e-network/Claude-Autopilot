#!/usr/bin/env node

/**
 * Production Readiness Check Script
 * Validates that the project meets production standards
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProductionReadinessChecker {
    constructor() {
        this.checks = [];
        this.warnings = [];
        this.errors = [];
        this.projectRoot = process.cwd();
    }

    // Color output helpers
    green(text) { return `\x1b[32m${text}\x1b[0m`; }
    yellow(text) { return `\x1b[33m${text}\x1b[0m`; }
    red(text) { return `\x1b[31m${text}\x1b[0m`; }
    blue(text) { return `\x1b[34m${text}\x1b[0m`; }

    // Check if file exists
    fileExists(filePath) {
        return fs.existsSync(path.join(this.projectRoot, filePath));
    }

    // Check if directory exists
    dirExists(dirPath) {
        return fs.existsSync(path.join(this.projectRoot, dirPath)) && 
               fs.statSync(path.join(this.projectRoot, dirPath)).isDirectory();
    }

    // Execute command and return output
    exec(command) {
        try {
            return execSync(command, { encoding: 'utf8', stdio: 'pipe' });
        } catch (error) {
            return null;
        }
    }

    // Add check result
    addCheck(name, passed, message) {
        this.checks.push({ name, passed, message });
        if (!passed) {
            this.errors.push(`${name}: ${message}`);
        }
    }

    // Add warning
    addWarning(message) {
        this.warnings.push(message);
    }

    // 1. Check Documentation
    checkDocumentation() {
        console.log(this.blue('\n📚 Checking Documentation...'));
        
        const requiredDocs = [
            { file: 'README.md', desc: 'Project README' },
            { file: 'LICENSE', desc: 'License file' },
            { file: 'CONTRIBUTING.md', desc: 'Contributing guidelines' },
            { file: 'CHANGELOG.md', desc: 'Change log' }
        ];

        requiredDocs.forEach(doc => {
            const exists = this.fileExists(doc.file) || this.fileExists(doc.file + '.txt');
            this.addCheck(
                doc.desc,
                exists,
                exists ? '✓ Found' : `✗ Missing ${doc.file}`
            );
        });

        // Check for API documentation
        const hasApiDocs = this.dirExists('docs') || this.dirExists('documentation');
        this.addCheck(
            'API Documentation',
            hasApiDocs,
            hasApiDocs ? '✓ Documentation directory found' : '✗ No docs directory'
        );
    }

    // 2. Check Security
    checkSecurity() {
        console.log(this.blue('\n🔒 Checking Security...'));

        // Check for security policy
        const hasSecurityPolicy = this.fileExists('SECURITY.md') || this.fileExists('.github/SECURITY.md');
        this.addCheck(
            'Security Policy',
            hasSecurityPolicy,
            hasSecurityPolicy ? '✓ Security policy found' : '✗ Missing SECURITY.md'
        );

        // Check for exposed secrets in common files
        const sensitivePatterns = [
            /api[_-]?key\s*=\s*["'][^"']+["']/i,
            /secret[_-]?key\s*=\s*["'][^"']+["']/i,
            /password\s*=\s*["'][^"']+["']/i,
            /private[_-]?key\s*=\s*["'][^"']+["']/i
        ];

        let hasExposedSecrets = false;
        const filesToCheck = ['.env', 'config.json', 'docker-compose.yml', 'docker-compose.yaml'];
        
        filesToCheck.forEach(file => {
            if (this.fileExists(file)) {
                const content = fs.readFileSync(path.join(this.projectRoot, file), 'utf8');
                sensitivePatterns.forEach(pattern => {
                    if (pattern.test(content)) {
                        hasExposedSecrets = true;
                        this.addWarning(`Potential exposed secret in ${file}`);
                    }
                });
            }
        });

        this.addCheck(
            'No Exposed Secrets',
            !hasExposedSecrets,
            hasExposedSecrets ? '✗ Found potential exposed secrets' : '✓ No exposed secrets detected'
        );

        // Check for .env.example
        const hasEnvExample = this.fileExists('.env.example') || this.fileExists('.env.sample');
        this.addCheck(
            'Environment Example',
            hasEnvExample,
            hasEnvExample ? '✓ .env.example found' : '✗ Missing .env.example'
        );
    }

    // 3. Check Testing
    checkTesting() {
        console.log(this.blue('\n🧪 Checking Testing...'));

        // Check for test directories
        const testDirs = ['tests', 'test', '__tests__', 'spec'];
        const hasTests = testDirs.some(dir => this.dirExists(dir));
        
        this.addCheck(
            'Test Directory',
            hasTests,
            hasTests ? '✓ Test directory found' : '✗ No test directory found'
        );

        // Check for test configuration
        const testConfigs = ['jest.config.js', 'mocha.opts', '.mocharc.json', 'karma.conf.js', 'vitest.config.js'];
        const hasTestConfig = testConfigs.some(config => this.fileExists(config));
        
        this.addCheck(
            'Test Configuration',
            hasTestConfig,
            hasTestConfig ? '✓ Test configuration found' : '✗ No test configuration found'
        );

        // Check package.json for test script
        if (this.fileExists('package.json')) {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
            const hasTestScript = packageJson.scripts && packageJson.scripts.test;
            
            this.addCheck(
                'Test Script',
                hasTestScript,
                hasTestScript ? '✓ Test script defined in package.json' : '✗ No test script in package.json'
            );
        }
    }

    // 4. Check CI/CD
    checkCICD() {
        console.log(this.blue('\n🚀 Checking CI/CD...'));

        // Check for CI configuration
        const ciConfigs = [
            '.github/workflows',
            '.gitlab-ci.yml',
            '.circleci/config.yml',
            'Jenkinsfile',
            '.travis.yml',
            'azure-pipelines.yml'
        ];

        const hasCI = ciConfigs.some(config => 
            this.fileExists(config) || this.dirExists(config)
        );

        this.addCheck(
            'CI Configuration',
            hasCI,
            hasCI ? '✓ CI configuration found' : '✗ No CI configuration found'
        );

        // Check for GitHub Actions workflows
        if (this.dirExists('.github/workflows')) {
            const workflows = fs.readdirSync(path.join(this.projectRoot, '.github/workflows'));
            const hasWorkflows = workflows.length > 0;
            
            this.addCheck(
                'GitHub Actions',
                hasWorkflows,
                hasWorkflows ? `✓ ${workflows.length} workflow(s) found` : '✗ No workflows defined'
            );
        }
    }

    // 5. Check Docker
    checkDocker() {
        console.log(this.blue('\n🐳 Checking Docker...'));

        const hasDockerfile = this.fileExists('Dockerfile');
        this.addCheck(
            'Dockerfile',
            hasDockerfile,
            hasDockerfile ? '✓ Dockerfile found' : '✗ Missing Dockerfile'
        );

        const hasDockerCompose = this.fileExists('docker-compose.yml') || this.fileExists('docker-compose.yaml');
        this.addCheck(
            'Docker Compose',
            hasDockerCompose,
            hasDockerCompose ? '✓ Docker Compose configuration found' : '✗ Missing docker-compose.yml'
        );

        const hasDockerignore = this.fileExists('.dockerignore');
        this.addCheck(
            'Docker Ignore',
            hasDockerignore,
            hasDockerignore ? '✓ .dockerignore found' : '✗ Missing .dockerignore'
        );
    }

    // 6. Check Error Handling & Logging
    checkErrorHandling() {
        console.log(this.blue('\n📊 Checking Error Handling & Logging...'));

        // Check for logging configuration
        const loggingFiles = ['logging.conf', 'log4j.properties', 'logback.xml', 'winston.config.js'];
        const hasLoggingConfig = loggingFiles.some(file => this.fileExists(file));
        
        if (!hasLoggingConfig) {
            this.addWarning('No logging configuration found - consider adding structured logging');
        }

        // Check for error monitoring integration (basic check)
        const errorMonitoring = ['sentry', 'rollbar', 'bugsnag', 'datadog'];
        let hasErrorMonitoring = false;

        if (this.fileExists('package.json')) {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            hasErrorMonitoring = errorMonitoring.some(tool => 
                Object.keys(deps).some(dep => dep.includes(tool))
            );
        }

        this.addCheck(
            'Error Monitoring',
            hasErrorMonitoring,
            hasErrorMonitoring ? '✓ Error monitoring integration found' : '⚠ Consider adding error monitoring'
        );
    }

    // 7. Check Performance & Scalability
    checkPerformance() {
        console.log(this.blue('\n⚡ Checking Performance & Scalability...'));

        // Check for performance testing
        const perfTools = ['artillery', 'k6', 'jmeter', 'gatling'];
        let hasPerfTesting = false;

        if (this.fileExists('package.json')) {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            hasPerfTesting = perfTools.some(tool => 
                Object.keys(deps).some(dep => dep.includes(tool))
            );
        }

        if (!hasPerfTesting) {
            this.addWarning('No performance testing tools found - consider adding load testing');
        }

        // Check for caching configuration
        const cacheIndicators = ['redis', 'memcached', 'cache'];
        let hasCaching = false;

        if (this.fileExists('package.json')) {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            hasCaching = cacheIndicators.some(indicator => 
                Object.keys(deps).some(dep => dep.includes(indicator))
            );
        }

        if (!hasCaching) {
            this.addWarning('No caching solution detected - consider implementing caching for performance');
        }
    }

    // 8. Check Code Quality
    checkCodeQuality() {
        console.log(this.blue('\n🔍 Checking Code Quality...'));

        // Check for linting configuration
        const lintConfigs = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.tslint.json', '.rubocop.yml', '.flake8'];
        const hasLinting = lintConfigs.some(config => this.fileExists(config));
        
        this.addCheck(
            'Linting Configuration',
            hasLinting,
            hasLinting ? '✓ Linting configuration found' : '✗ No linting configuration found'
        );

        // Check for code formatting
        const formatConfigs = ['.prettierrc', '.prettierrc.js', '.prettierrc.json', '.editorconfig'];
        const hasFormatting = formatConfigs.some(config => this.fileExists(config));
        
        this.addCheck(
            'Code Formatting',
            hasFormatting,
            hasFormatting ? '✓ Code formatting configuration found' : '✗ No formatting configuration found'
        );

        // Check for pre-commit hooks
        const hasPreCommit = this.fileExists('.pre-commit-config.yaml') || 
                            this.fileExists('.husky') || 
                            this.dirExists('.husky');
        
        if (!hasPreCommit) {
            this.addWarning('No pre-commit hooks found - consider adding automated code quality checks');
        }
    }

    // 9. Check Dependencies
    checkDependencies() {
        console.log(this.blue('\n📦 Checking Dependencies...'));

        if (this.fileExists('package.json')) {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
            
            // Check for dependency audit
            const auditResult = this.exec('npm audit --json');
            if (auditResult) {
                try {
                    const audit = JSON.parse(auditResult);
                    const hasVulnerabilities = audit.metadata && audit.metadata.vulnerabilities;
                    const critical = hasVulnerabilities ? audit.metadata.vulnerabilities.critical || 0 : 0;
                    const high = hasVulnerabilities ? audit.metadata.vulnerabilities.high || 0 : 0;
                    
                    this.addCheck(
                        'Security Vulnerabilities',
                        critical === 0 && high === 0,
                        critical > 0 || high > 0 
                            ? `✗ Found ${critical} critical and ${high} high vulnerabilities`
                            : '✓ No critical or high vulnerabilities'
                    );
                } catch (e) {
                    // Ignore parsing errors
                }
            }

            // Check for lock file
            const hasLockFile = this.fileExists('package-lock.json') || 
                               this.fileExists('yarn.lock') || 
                               this.fileExists('pnpm-lock.yaml');
            
            this.addCheck(
                'Dependency Lock File',
                hasLockFile,
                hasLockFile ? '✓ Lock file found' : '✗ Missing lock file'
            );
        }
    }

    // 10. Check Monitoring & Health Checks
    checkMonitoring() {
        console.log(this.blue('\n📡 Checking Monitoring & Health Checks...'));

        // Check for health check endpoints in common files
        const healthCheckPatterns = [/health/i, /healthz/i, /ready/i, /readiness/i, /liveness/i];
        let hasHealthChecks = false;

        // Check common API files
        const apiFiles = [
            'app.js', 'server.js', 'index.js', 'main.js',
            'src/app.js', 'src/server.js', 'src/index.js', 'src/main.js'
        ];

        apiFiles.forEach(file => {
            if (this.fileExists(file)) {
                const content = fs.readFileSync(path.join(this.projectRoot, file), 'utf8');
                if (healthCheckPatterns.some(pattern => pattern.test(content))) {
                    hasHealthChecks = true;
                }
            }
        });

        this.addCheck(
            'Health Check Endpoints',
            hasHealthChecks,
            hasHealthChecks ? '✓ Health check endpoints found' : '⚠ Consider adding health check endpoints'
        );

        // Check for monitoring configuration
        const monitoringIndicators = ['prometheus', 'grafana', 'datadog', 'newrelic', 'elastic-apm'];
        let hasMonitoring = false;

        if (this.fileExists('package.json')) {
            const packageJson = JSON.parse(fs.readFileSync(path.join(this.projectRoot, 'package.json'), 'utf8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            hasMonitoring = monitoringIndicators.some(tool => 
                Object.keys(deps).some(dep => dep.includes(tool))
            );
        }

        if (!hasMonitoring) {
            this.addWarning('No monitoring integration found - consider adding application monitoring');
        }
    }

    // Generate summary report
    generateReport() {
        console.log(this.blue('\n📋 PRODUCTION READINESS REPORT'));
        console.log('================================\n');

        const passed = this.checks.filter(c => c.passed).length;
        const failed = this.checks.filter(c => !c.passed).length;
        const total = this.checks.length;
        const score = Math.round((passed / total) * 100);

        // Summary
        console.log(this.blue('Summary:'));
        console.log(`Total Checks: ${total}`);
        console.log(`Passed: ${this.green(passed)}`);
        console.log(`Failed: ${this.red(failed)}`);
        console.log(`Score: ${score >= 80 ? this.green(score + '%') : score >= 60 ? this.yellow(score + '%') : this.red(score + '%')}\n`);

        // Failed checks
        if (failed > 0) {
            console.log(this.red('❌ Failed Checks:'));
            this.checks.filter(c => !c.passed).forEach(check => {
                console.log(`  - ${check.name}: ${check.message}`);
            });
            console.log('');
        }

        // Warnings
        if (this.warnings.length > 0) {
            console.log(this.yellow('⚠️  Warnings:'));
            this.warnings.forEach(warning => {
                console.log(`  - ${warning}`);
            });
            console.log('');
        }

        // Recommendations
        console.log(this.blue('📝 Recommendations:'));
        if (score < 60) {
            console.log('  - Critical: Address all failed checks before production deployment');
        } else if (score < 80) {
            console.log('  - Important: Address failed checks to improve production readiness');
        } else {
            console.log('  - Good: Project shows good production readiness');
        }

        if (this.warnings.length > 0) {
            console.log('  - Consider addressing warnings for better production stability');
        }

        // Production readiness verdict
        console.log('\n' + this.blue('🎯 Production Readiness:'));
        if (score >= 80 && failed === 0) {
            console.log(this.green('  ✓ READY FOR PRODUCTION'));
        } else if (score >= 60) {
            console.log(this.yellow('  ⚠ ALMOST READY - Address remaining issues'));
        } else {
            console.log(this.red('  ✗ NOT READY - Significant improvements needed'));
        }

        return score >= 60;
    }

    // Run all checks
    async run() {
        console.log(this.green('🚀 Running Production Readiness Checks...\n'));
        console.log(`Project: ${this.projectRoot}`);

        this.checkDocumentation();
        this.checkSecurity();
        this.checkTesting();
        this.checkCICD();
        this.checkDocker();
        this.checkErrorHandling();
        this.checkPerformance();
        this.checkCodeQuality();
        this.checkDependencies();
        this.checkMonitoring();

        const isReady = this.generateReport();
        process.exit(isReady ? 0 : 1);
    }
}

// Run the checker
const checker = new ProductionReadinessChecker();
checker.run().catch(error => {
    console.error('Error running production readiness check:', error);
    process.exit(1);
});