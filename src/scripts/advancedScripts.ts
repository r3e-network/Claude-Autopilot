// Advanced shell scripts for the new sub-agents

export const ADVANCED_SHELL_SCRIPTS = {
    'context-check.sh': `#!/bin/bash
# Context Awareness Check
# Analyzes project structure and context

WORKSPACE_PATH="\${PWD}"
RESULT_FILE="/tmp/context_check_result.json"

# Initialize result
echo '{"passed": true, "errors": [], "warnings": []}' > "\$RESULT_FILE"

# Function to add error
add_error() {
    local error="\$1"
    python3 -c "
import json
with open('\$RESULT_FILE', 'r') as f:
    result = json.load(f)
result['passed'] = False
result['errors'].append('\$error')
with open('\$RESULT_FILE', 'w') as f:
    json.dump(result, f)
"
}

# Function to add warning
add_warning() {
    local warning="\$1"
    python3 -c "
import json
with open('\$RESULT_FILE', 'r') as f:
    result = json.load(f)
result['warnings'].append('\$warning')
with open('\$RESULT_FILE', 'w') as f:
    json.dump(result, f)
"
}

# Check for project configuration files
if [ ! -f "package.json" ] && [ ! -f "go.mod" ] && [ ! -f "Cargo.toml" ] && [ ! -f "requirements.txt" ]; then
    add_error "No project configuration file found (package.json, go.mod, Cargo.toml, or requirements.txt)"
fi

# Check for README
if [ ! -f "README.md" ] && [ ! -f "README.rst" ] && [ ! -f "README.txt" ]; then
    add_warning "No README file found"
fi

# Check for .gitignore
if [ ! -f ".gitignore" ]; then
    add_warning "No .gitignore file found"
fi

# Output result
cat "\$RESULT_FILE"
`,

    'dependency-check.sh': `#!/bin/bash
# Dependency Resolution Check
# Checks for missing dependencies and security issues

RESULT_FILE="/tmp/dependency_check_result.json"

# Initialize result
echo '{"passed": true, "errors": [], "warnings": []}' > "\$RESULT_FILE"

# Function to add error
add_error() {
    local error="\$1"
    python3 -c "
import json
with open('\$RESULT_FILE', 'r') as f:
    result = json.load(f)
result['passed'] = False
result['errors'].append('\$error')
with open('\$RESULT_FILE', 'w') as f:
    json.dump(result, f)
"
}

# Check for Node.js project
if [ -f "package.json" ]; then
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        add_error "node_modules directory not found - run npm install"
    fi
    
    # Check for package-lock.json
    if [ ! -f "package-lock.json" ] && [ ! -f "yarn.lock" ]; then
        add_error "No package-lock.json or yarn.lock found - dependencies may be inconsistent"
    fi
    
    # Check for security vulnerabilities (if npm is available)
    if command -v npm &> /dev/null; then
        if npm audit --json 2>/dev/null | grep -q '"vulnerabilities"'; then
            VULN_COUNT=\$(npm audit --json 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'metadata' in data and 'vulnerabilities' in data['metadata']:
        print(data['metadata']['vulnerabilities']['total'])
    else:
        print(0)
except:
    print(0)
")
            if [ "\$VULN_COUNT" -gt 0 ]; then
                add_error "Found \$VULN_COUNT security vulnerabilities in dependencies"
            fi
        fi
    fi
fi

# Check for Python project
if [ -f "requirements.txt" ]; then
    # Check for missing packages
    if command -v pip &> /dev/null; then
        pip check 2>/dev/null || add_error "Python dependency conflicts detected"
    fi
fi

# Check for Go project
if [ -f "go.mod" ]; then
    if command -v go &> /dev/null; then
        go mod verify 2>/dev/null || add_error "Go module verification failed"
    fi
fi

# Output result
cat "\$RESULT_FILE"
`,

    'code-understanding-check.sh': `#!/bin/bash
# Code Understanding Check
# Analyzes code quality and patterns

RESULT_FILE="/tmp/code_understanding_result.json"

# Initialize result
echo '{"passed": true, "errors": [], "warnings": []}' > "\$RESULT_FILE"

# Function to add error
add_error() {
    local error="\$1"
    python3 -c "
import json
with open('\$RESULT_FILE', 'r') as f:
    result = json.load(f)
result['passed'] = False
result['errors'].append('\$error')
with open('\$RESULT_FILE', 'w') as f:
    json.dump(result, f)
"
}

# Function to add warning
add_warning() {
    local warning="\$1"
    python3 -c "
import json
with open('\$RESULT_FILE', 'r') as f:
    result = json.load(f)
result['warnings'].append('\$warning')
with open('\$RESULT_FILE', 'w') as f:
    json.dump(result, f)
"
}

# Check for large functions (more than 50 lines)
LARGE_FUNCTIONS=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -n "function\\|=>" | wc -l)
if [ "\$LARGE_FUNCTIONS" -gt 100 ]; then
    add_warning "Project has many functions (\$LARGE_FUNCTIONS) - consider code organization"
fi

# Check for code duplication patterns
DUPLICATE_PATTERNS=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -c "console.log\\|throw new Error" | grep -v ":0" | wc -l)
if [ "\$DUPLICATE_PATTERNS" -gt 20 ]; then
    add_warning "Potential code duplication detected - consider refactoring common patterns"
fi

# Check for missing documentation
UNDOCUMENTED_FUNCTIONS=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -B1 "function\\|=>" | grep -v "/\\*\\*\\|//" | wc -l)
if [ "\$UNDOCUMENTED_FUNCTIONS" -gt 50 ]; then
    add_warning "Many functions lack documentation - consider adding JSDoc comments"
fi

# Output result
cat "\$RESULT_FILE"
`,

    'integration-testing-check.sh': `#!/bin/bash
# Integration Testing Check
# Validates test coverage and integration tests

RESULT_FILE="/tmp/integration_testing_result.json"

# Initialize result
echo '{"passed": true, "errors": [], "warnings": []}' > "\$RESULT_FILE"

# Function to add error
add_error() {
    local error="\$1"
    python3 -c "
import json
with open('\$RESULT_FILE', 'r') as f:
    result = json.load(f)
result['passed'] = False
result['errors'].append('\$error')
with open('\$RESULT_FILE', 'w') as f:
    json.dump(result, f)
"
}

# Check for test files
TEST_FILES=\$(find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules | wc -l)
if [ "\$TEST_FILES" -eq 0 ]; then
    add_error "No test files found - create unit and integration tests"
fi

# Check for test framework configuration
if [ -f "package.json" ]; then
    if ! grep -q "jest\\|mocha\\|vitest\\|cypress\\|playwright" package.json; then
        add_error "No test framework detected in package.json"
    fi
fi

# Check for API endpoints without tests
API_ENDPOINTS=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | grep -v test | xargs grep -c "app\\.\\(get\\|post\\|put\\|delete\\)" | grep -v ":0" | wc -l)
if [ "\$API_ENDPOINTS" -gt 0 ] && [ "\$TEST_FILES" -eq 0 ]; then
    add_error "API endpoints found but no integration tests detected"
fi

# Check for database operations without tests
DB_OPERATIONS=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | grep -v test | xargs grep -c "\\(save\\|find\\|update\\|delete\\|create\\)" | grep -v ":0" | wc -l)
if [ "\$DB_OPERATIONS" -gt 0 ] && [ "\$TEST_FILES" -eq 0 ]; then
    add_error "Database operations found but no integration tests detected"
fi

# Output result
cat "\$RESULT_FILE"
`,

    'performance-check.sh': `#!/bin/bash
# Performance Check
# Analyzes performance bottlenecks and optimization opportunities

RESULT_FILE="/tmp/performance_check_result.json"

# Initialize result
echo '{"passed": true, "errors": [], "warnings": []}' > "\$RESULT_FILE"

# Function to add error
add_error() {
    local error="\$1"
    python3 -c "
import json
with open('\$RESULT_FILE', 'r') as f:
    result = json.load(f)
result['passed'] = False
result['errors'].append('\$error')
with open('\$RESULT_FILE', 'w') as f:
    json.dump(result, f)
"
}

# Function to add warning
add_warning() {
    local warning="\$1"
    python3 -c "
import json
with open('\$RESULT_FILE', 'r') as f:
    result = json.load(f)
result['warnings'].append('\$warning')
with open('\$RESULT_FILE', 'w') as f:
    json.dump(result, f)
"
}

# Check for nested loops (O(n²) complexity)
NESTED_LOOPS=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -c "for.*{.*for\\|while.*{.*while" | grep -v ":0" | wc -l)
if [ "\$NESTED_LOOPS" -gt 5 ]; then
    add_warning "Multiple nested loops detected - may cause performance issues"
fi

# Check for synchronous file operations
SYNC_OPS=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -c "readFileSync\\|writeFileSync" | grep -v ":0" | wc -l)
if [ "\$SYNC_OPS" -gt 0 ]; then
    add_error "Synchronous file operations found - use async alternatives"
fi

# Check for large bundle dependencies
if [ -f "package.json" ]; then
    LARGE_DEPS=\$(grep -E "lodash|moment|react|vue|angular" package.json | wc -l)
    if [ "\$LARGE_DEPS" -gt 0 ]; then
        add_warning "Large dependencies detected - consider bundle size optimization"
    fi
fi

# Check for missing caching
CACHE_USAGE=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -c "cache\\|redis\\|memcache" | grep -v ":0" | wc -l)
if [ "\$CACHE_USAGE" -eq 0 ]; then
    add_warning "No caching implementation found - consider adding caching for performance"
fi

# Output result
cat "\$RESULT_FILE"
`,

    'security-audit-check.sh': `#!/bin/bash
# Security Audit Check
# Scans for security vulnerabilities and best practices

RESULT_FILE="/tmp/security_audit_result.json"

# Initialize result
echo '{"passed": true, "errors": [], "warnings": []}' > "\$RESULT_FILE"

# Function to add error
add_error() {
    local error="\$1"
    python3 -c "
import json
with open('\$RESULT_FILE', 'r') as f:
    result = json.load(f)
result['passed'] = False
result['errors'].append('\$error')
with open('\$RESULT_FILE', 'w') as f:
    json.dump(result, f)
"
}

# Check for hardcoded secrets
HARDCODED_SECRETS=\$(find . -name "*.ts" -o -name "*.js" -o -name "*.py" | grep -v node_modules | xargs grep -i "password\\s*=\\s*['\"]\\|api[_-]\\?key\\s*=\\s*['\"]\\|secret\\s*=\\s*['\"]" | wc -l)
if [ "\$HARDCODED_SECRETS" -gt 0 ]; then
    add_error "Hardcoded secrets detected - move to environment variables"
fi

# Check for SQL injection vulnerabilities
SQL_INJECTION=\$(find . -name "*.ts" -o -name "*.js" -o -name "*.py" | grep -v node_modules | xargs grep -c "query.*+\\|execute.*+" | grep -v ":0" | wc -l)
if [ "\$SQL_INJECTION" -gt 0 ]; then
    add_error "Potential SQL injection vulnerabilities - use parameterized queries"
fi

# Check for XSS vulnerabilities
XSS_VULNS=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -c "innerHTML.*+\\|document.write" | grep -v ":0" | wc -l)
if [ "\$XSS_VULNS" -gt 0 ]; then
    add_error "Potential XSS vulnerabilities - sanitize user input"
fi

# Check for insecure HTTP usage
HTTP_USAGE=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -c "http://" | grep -v ":0" | wc -l)
if [ "\$HTTP_USAGE" -gt 0 ]; then
    add_error "Insecure HTTP URLs found - use HTTPS"
fi

# Check for weak authentication
WEAK_AUTH=\$(find . -name "*.ts" -o -name "*.js" | grep -v node_modules | xargs grep -c "password.*===\\|token.*===" | grep -v ":0" | wc -l)
if [ "\$WEAK_AUTH" -gt 0 ]; then
    add_error "Weak authentication patterns detected"
fi

# Check for npm audit (if available)
if [ -f "package.json" ] && command -v npm &> /dev/null; then
    if npm audit --json 2>/dev/null | grep -q '"vulnerabilities"'; then
        VULN_COUNT=\$(npm audit --json 2>/dev/null | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'metadata' in data and 'vulnerabilities' in data['metadata']:
        print(data['metadata']['vulnerabilities']['total'])
    else:
        print(0)
except:
    print(0)
")
        if [ "\$VULN_COUNT" -gt 0 ]; then
            add_error "Found \$VULN_COUNT security vulnerabilities in dependencies"
        fi
    fi
fi

# Output result
cat "\$RESULT_FILE"
`
};