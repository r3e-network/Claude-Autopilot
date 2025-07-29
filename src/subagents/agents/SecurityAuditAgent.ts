import { SubAgent } from '../SubAgent';
import { SubAgentConfig, SubAgentContext } from '../types';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export class SecurityAuditAgent extends SubAgent {
    constructor(workspacePath: string) {
        const config: SubAgentConfig = {
            id: 'security-audit',
            name: 'Security Audit Agent',
            description: 'Identifies and fixes security vulnerabilities automatically',
            category: 'security',
            enabled: true,
            icon: '🔒',
            capabilities: [
                {
                    id: 'vulnerability-scan',
                    name: 'Vulnerability Scanning',
                    description: 'Scan for known security vulnerabilities',
                    action: 'analyze'
                },
                {
                    id: 'code-injection-check',
                    name: 'Code Injection Detection',
                    description: 'Detect SQL injection, XSS, and other injection vulnerabilities',
                    action: 'analyze'
                },
                {
                    id: 'authentication-audit',
                    name: 'Authentication Security Audit',
                    description: 'Review authentication and authorization mechanisms',
                    action: 'analyze'
                },
                {
                    id: 'secrets-detection',
                    name: 'Secrets Detection',
                    description: 'Find hardcoded passwords, API keys, and sensitive data',
                    action: 'analyze'
                },
                {
                    id: 'fix-security-issues',
                    name: 'Fix Security Issues',
                    description: 'Automatically fix common security vulnerabilities',
                    action: 'fix'
                },
                {
                    id: 'security-hardening',
                    name: 'Security Hardening',
                    description: 'Implement security best practices and hardening measures',
                    action: 'secure'
                }
            ],
            checkScript: '.autoclaude/scripts/security-audit-check.sh',
            systemPrompt: `You are a Security Audit specialist sub-agent. Your role is to:
1. Scan for known security vulnerabilities in dependencies
2. Detect code injection vulnerabilities (SQL, XSS, CSRF, etc.)
3. Identify authentication and authorization flaws
4. Find hardcoded secrets, passwords, and API keys
5. Check for insecure cryptographic practices
6. Validate input sanitization and output encoding
7. Review error handling for information disclosure
8. Ensure secure communication protocols
9. Implement security headers and CORS properly
10. Apply security hardening measures

You help Claude build secure applications that protect against common vulnerabilities and attacks.`
        };
        
        super(config, workspacePath);
    }

    async analyzeResults(context: SubAgentContext): Promise<string> {
        const analysis: string[] = [];
        
        analysis.push('🔒 Security Audit Analysis:');
        analysis.push('');
        
        // Check for hardcoded secrets
        const secrets = await this.findHardcodedSecrets();
        if (secrets.length > 0) {
            analysis.push('🚨 Hardcoded Secrets Found:');
            secrets.forEach(secret => {
                analysis.push(`- ${secret.type}: ${secret.file}:${secret.line}`);
            });
            analysis.push('');
        }
        
        // Check for injection vulnerabilities
        const injectionVulns = await this.findInjectionVulnerabilities();
        if (injectionVulns.length > 0) {
            analysis.push('💉 Injection Vulnerabilities:');
            injectionVulns.forEach(vuln => {
                analysis.push(`- ${vuln.type}: ${vuln.description} (${vuln.file})`);
            });
            analysis.push('');
        }
        
        // Check authentication security
        const authIssues = await this.checkAuthenticationSecurity();
        if (authIssues.length > 0) {
            analysis.push('🔐 Authentication Issues:');
            authIssues.forEach(issue => {
                analysis.push(`- ${issue.type}: ${issue.description}`);
            });
            analysis.push('');
        }
        
        // Check for dependency vulnerabilities
        const depVulns = await this.checkDependencyVulnerabilities();
        if (depVulns.length > 0) {
            analysis.push('📦 Dependency Vulnerabilities:');
            depVulns.slice(0, 5).forEach(vuln => {
                analysis.push(`- ${vuln.package}: ${vuln.severity} (${vuln.title})`);
            });
            if (depVulns.length > 5) {
                analysis.push(`- ... and ${depVulns.length - 5} more vulnerabilities`);
            }
            analysis.push('');
        }
        
        analysis.push('🛡️ Security Recommendations:');
        analysis.push('1. Move all secrets to environment variables');
        analysis.push('2. Implement proper input validation and sanitization');
        analysis.push('3. Use parameterized queries to prevent SQL injection');
        analysis.push('4. Implement proper authentication and session management');
        analysis.push('5. Update vulnerable dependencies immediately');
        analysis.push('6. Add security headers (CORS, CSP, HSTS)');
        analysis.push('7. Implement rate limiting and request validation');
        
        return analysis.join('\n');
    }
    
    private async findHardcodedSecrets(): Promise<Array<{ type: string; file: string; line: number }>> {
        const secrets: Array<{ type: string; file: string; line: number }> = [];
        
        try {
            const secretPatterns = [
                {
                    type: 'API Key',
                    patterns: [
                        /api[_-]?key\s*[=:]\s*["'][^"']{20,}["']/gi,
                        /apikey\s*[=:]\s*["'][^"']{20,}["']/gi
                    ]
                },
                {
                    type: 'Password',
                    patterns: [
                        /password\s*[=:]\s*["'][^"']{8,}["']/gi,
                        /passwd\s*[=:]\s*["'][^"']{8,}["']/gi
                    ]
                },
                {
                    type: 'Secret Key',
                    patterns: [
                        /secret[_-]?key\s*[=:]\s*["'][^"']{20,}["']/gi,
                        /secretkey\s*[=:]\s*["'][^"']{20,}["']/gi
                    ]
                },
                {
                    type: 'JWT Secret',
                    patterns: [
                        /jwt[_-]?secret\s*[=:]\s*["'][^"']{20,}["']/gi
                    ]
                },
                {
                    type: 'Database URL',
                    patterns: [
                        /database[_-]?url\s*[=:]\s*["'][^"']*:[^"']*@[^"']+["']/gi,
                        /db[_-]?url\s*[=:]\s*["'][^"']*:[^"']*@[^"']+["']/gi
                    ]
                }
            ];
            
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" -o -name "*.py" | grep -v node_modules | head -20', {
                cwd: this.workspacePath
            });
            
            const files = stdout.trim().split('\n').filter(f => f);
            
            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(this.workspacePath, file), 'utf8');
                    const lines = content.split('\n');
                    
                    for (const secretType of secretPatterns) {
                        for (const pattern of secretType.patterns) {
                            for (let i = 0; i < lines.length; i++) {
                                if (pattern.test(lines[i])) {
                                    secrets.push({
                                        type: secretType.type,
                                        file: file,
                                        line: i + 1
                                    });
                                }
                            }
                        }
                    }
                } catch {
                    // Skip files that can't be read
                }
            }
            
        } catch (error) {
            // Return empty array on error
        }
        
        return secrets;
    }
    
    private async findInjectionVulnerabilities(): Promise<Array<{ type: string; description: string; file: string }>> {
        const vulnerabilities: Array<{ type: string; description: string; file: string }> = [];
        
        try {
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" -o -name "*.py" | grep -v node_modules | head -20', {
                cwd: this.workspacePath
            });
            
            const files = stdout.trim().split('\n').filter(f => f);
            
            const vulnPatterns = [
                {
                    type: 'SQL Injection',
                    patterns: [
                        /query\s*\(\s*["'].*\$\{.*\}.*["']/g,
                        /execute\s*\(\s*["'].*\+.*["']/g,
                        /SELECT.*FROM.*WHERE.*\+/gi
                    ],
                    description: 'Potential SQL injection vulnerability from string concatenation'
                },
                {
                    type: 'XSS Vulnerability',
                    patterns: [
                        /innerHTML\s*=\s*.*\+/g,
                        /document\.write\s*\(/g,
                        /\.html\s*\(\s*.*\+/g
                    ],
                    description: 'Potential XSS vulnerability from unsafe HTML insertion'
                },
                {
                    type: 'Command Injection',
                    patterns: [
                        /exec\s*\(\s*.*\+/g,
                        /system\s*\(\s*.*\+/g,
                        /shell_exec\s*\(\s*.*\+/g
                    ],
                    description: 'Potential command injection from unsafe command execution'
                },
                {
                    type: 'Path Traversal',
                    patterns: [
                        /readFile\s*\(\s*.*\+/g,
                        /writeFile\s*\(\s*.*\+/g,
                        /require\s*\(\s*.*\+/g
                    ],
                    description: 'Potential path traversal vulnerability'
                }
            ];
            
            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(this.workspacePath, file), 'utf8');
                    
                    for (const vulnType of vulnPatterns) {
                        for (const pattern of vulnType.patterns) {
                            if (pattern.test(content)) {
                                vulnerabilities.push({
                                    type: vulnType.type,
                                    description: vulnType.description,
                                    file: file
                                });
                                break; // Only report once per file per vulnerability type
                            }
                        }
                    }
                } catch {
                    // Skip files that can't be read
                }
            }
            
        } catch (error) {
            // Return empty array on error
        }
        
        return vulnerabilities;
    }
    
    private async checkAuthenticationSecurity(): Promise<Array<{ type: string; description: string }>> {
        const issues: Array<{ type: string; description: string }> = [];
        
        try {
            const { stdout } = await execAsync('find . -name "*.ts" -o -name "*.js" | grep -v node_modules | head -10', {
                cwd: this.workspacePath
            });
            
            const files = stdout.trim().split('\n').filter(f => f);
            let hasAuthentication = false;
            let hasPasswordHashing = false;
            let hasSessionManagement = false;
            let hasJWTValidation = false;
            
            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(this.workspacePath, file), 'utf8');
                    
                    // Check for authentication patterns
                    if (content.includes('passport') || content.includes('authenticate') || content.includes('login')) {
                        hasAuthentication = true;
                    }
                    
                    // Check for password hashing
                    if (content.includes('bcrypt') || content.includes('scrypt') || content.includes('argon2')) {
                        hasPasswordHashing = true;
                    }
                    
                    // Check for session management
                    if (content.includes('express-session') || content.includes('cookie-session')) {
                        hasSessionManagement = true;
                    }
                    
                    // Check for JWT validation
                    if (content.includes('jwt.verify') || content.includes('jsonwebtoken')) {
                        hasJWTValidation = true;
                    }
                    
                } catch {
                    // Skip files that can't be read
                }
            }
            
            // Analyze authentication security
            if (hasAuthentication) {
                if (!hasPasswordHashing) {
                    issues.push({
                        type: 'Weak Password Storage',
                        description: 'Passwords should be hashed using bcrypt, scrypt, or argon2'
                    });
                }
                
                if (!hasSessionManagement && !hasJWTValidation) {
                    issues.push({
                        type: 'Missing Session Management',
                        description: 'No session management or JWT validation found'
                    });
                }
            }
            
            // Check for common authentication vulnerabilities
            for (const file of files) {
                try {
                    const content = fs.readFileSync(path.join(this.workspacePath, file), 'utf8');
                    
                    // Check for weak JWT secrets
                    if (content.includes('jwt') && content.match(/secret.*=.*["'][^"']{1,10}["']/)) {
                        issues.push({
                            type: 'Weak JWT Secret',
                            description: 'JWT secret appears to be too short or weak'
                        });
                    }
                    
                    // Check for missing HTTPS enforcement
                    if (content.includes('http://') && !content.includes('https://')) {
                        issues.push({
                            type: 'Insecure HTTP Usage',
                            description: 'HTTP URLs found - should use HTTPS for security'
                        });
                    }
                    
                } catch {
                    // Skip files that can't be read
                }
            }
            
        } catch (error) {
            // Return empty array on error
        }
        
        return issues;
    }
    
    private async checkDependencyVulnerabilities(): Promise<Array<{ package: string; severity: string; title: string }>> {
        try {
            const { stdout } = await execAsync('npm audit --json 2>/dev/null || echo "{}"', {
                cwd: this.workspacePath
            });
            
            if (stdout.trim() && stdout !== '{}') {
                const audit = JSON.parse(stdout);
                const vulnerabilities: Array<{ package: string; severity: string; title: string }> = [];
                
                if (audit.advisories) {
                    Object.values(audit.advisories).forEach((advisory: any) => {
                        vulnerabilities.push({
                            package: advisory.module_name,
                            severity: advisory.severity.toUpperCase(),
                            title: advisory.title
                        });
                    });
                }
                
                return vulnerabilities;
            }
        } catch {
            // Ignore audit errors
        }
        
        return [];
    }
}