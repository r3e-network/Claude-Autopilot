/**
 * Built-in shell scripts for Claude Autopilot
 * These scripts are embedded in the extension and copied to workspace .autoclaude folder
 */

import { ADVANCED_SHELL_SCRIPTS } from './advancedScripts';

export const SHELL_SCRIPTS = {
    // Advanced automation scripts
    ...ADVANCED_SHELL_SCRIPTS,
    'production-readiness.sh': `#!/bin/bash
# Production Readiness Check
# Checks for TODO, FIXME, placeholders, and incomplete implementations
# Auto-generated by AutoClaude

set -euo pipefail

# Initialize arrays for errors and warnings
declare -a errors=()
declare -a warnings=()

# Patterns that indicate incomplete or non-production code
patterns=(
    "TODO"
    "FIXME"
    "PLACEHOLDER"
    "XXX"
    "HACK"
    "temporary"
    "quick[[:space:]]+fix"
    "for[[:space:]]+now"
    "simplified"
    "\\.\\.\\..*$"
    "<<<|>>>"
    "not[[:space:]]+implemented"
    "throw[[:space:]]+new[[:space:]]+Error.*not[[:space:]]+implemented"
    "console\\.(log|debug|trace)"
    "debugger;"
)

# Pattern descriptions
pattern_descs=(
    "TODO comment found"
    "FIXME comment found"
    "Placeholder found"
    "XXX marker found"
    "HACK comment found"
    "Temporary code found"
    "Quick fix found"
    "'for now' comment found"
    "Simplified implementation found"
    "Ellipsis (...) found - possible incomplete code"
    "Merge conflict markers found"
    "Not implemented found"
    "Not implemented error found"
    "Debug console statement found"
    "Debugger statement found"
)

# File extensions to check
extensions="\\.(js|ts|jsx|tsx|go|cpp|cc|h|hpp|rs|cs|java|py|rb|php|swift|kt|scala|vue|svelte)$"

# Directories to skip
skip_dirs="^\\.|\\.git|node_modules|dist|build|out|target|bin|obj|\\.next|\\.nuxt|coverage|\\.nyc_output|vendor|\\.autoclaude"

# Function to check a single file
check_file() {
    local file="$1"
    local line_num=0
    
    while IFS= read -r line; do
        ((line_num++))
        for i in "\${!patterns[@]}"; do
            if echo "$line" | grep -qiE "\${patterns[$i]}"; then
                errors+=("$file:$line_num - \${pattern_descs[$i]}")
            fi
        done
    done < "$file"
    
    # Check for empty catch blocks
    if grep -qE 'catch[[:space:]]*\\([^)]*\\)[[:space:]]*{[[:space:]]*}' "$file"; then
        warnings+=("$file - Empty catch block found")
    fi
    
    # Check for any type in TypeScript files
    if [[ "$file" =~ \\.(ts|tsx)$ ]]; then
        local any_count=$(grep -o ':[[:space:]]*any\\b' "$file" 2>/dev/null | wc -l || echo 0)
        if [ "$any_count" -gt 0 ]; then
            warnings+=("$file - Found $any_count uses of 'any' type")
        fi
    fi
}

# Main scanning function
scan_directory() {
    # Use find to get all files, excluding directories
    while IFS= read -r file; do
        # Make path relative to current directory
        relative_path="\${file#./}"
        check_file "$relative_path"
    done < <(find . -type f -regex ".*$extensions" 2>/dev/null | grep -vE "/($(echo "$skip_dirs" | tr '|' '|'))/" || true)
}

# Start scanning
scan_directory

# Function to escape JSON strings
json_escape() {
    printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\t/\\\\t/g; s/\n/\\\\n/g; s/\r/\\\\r/g'
}

# Function to escape JSON strings
json_escape() {
    printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\t/\\\\t/g; s/\n/\\\\n/g; s/\r/\\\\r/g'
}

# Output results in JSON format
echo "{"
echo "  \\"passed\\": $([ \${#errors[@]} -eq 0 ] && echo "true" || echo "false"),"
echo "  \\"errors\\": ["
if [ \${#errors[@]} -gt 0 ]; then
    for i in "\${!errors[@]}"; do
        echo -n "    \\"$(json_escape "\${errors[$i]}")\\"" 
        if [ $i -lt $((\${#errors[@]} - 1)) ]; then
            echo ","
        else
            echo
        fi
    done
fi
echo "  ],"
echo "  \\"warnings\\": ["
if [ \${#warnings[@]} -gt 0 ]; then
    for i in "\${!warnings[@]}"; do
        echo -n "    \\"$(json_escape "\${warnings[$i]}")\\"" 
        if [ $i -lt $((\${#warnings[@]} - 1)) ]; then
            echo ","
        else
            echo
        fi
    done
fi
echo "  ],"
echo "  \\"fixInstructions\\": \\"Remove all TODO/FIXME comments, placeholders, debug statements, and implement all incomplete code sections before deployment.\\""
echo "}"
`,

    'build-check.sh': `#!/bin/bash
# Build Check
# Ensures the project can build successfully
# Auto-generated by AutoClaude

set -euo pipefail

# Initialize arrays
declare -a errors=()
declare -a build_commands=()

# Detect build system and set commands
if [ -f "package.json" ]; then
    # Node.js project
    if [ -f "package-lock.json" ] || [ -f "yarn.lock" ] || [ -f "pnpm-lock.yaml" ]; then
        if command -v npm &> /dev/null && [ -f "package-lock.json" ]; then
            build_commands+=("npm run build" "npm run compile")
        elif command -v yarn &> /dev/null && [ -f "yarn.lock" ]; then
            build_commands+=("yarn build" "yarn compile")
        elif command -v pnpm &> /dev/null && [ -f "pnpm-lock.yaml" ]; then
            build_commands+=("pnpm build" "pnpm compile")
        fi
    fi
elif [ -f "Cargo.toml" ]; then
    # Rust project
    build_commands+=("cargo build" "cargo check")
elif [ -f "go.mod" ]; then
    # Go project
    build_commands+=("go build ./...")
elif [ -f "pom.xml" ]; then
    # Maven project
    build_commands+=("mvn compile")
elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
    # Gradle project
    build_commands+=("gradle build")
elif [ -f "Makefile" ] || [ -f "makefile" ]; then
    # Make-based project
    build_commands+=("make" "make build")
elif [ -f "CMakeLists.txt" ]; then
    # CMake project
    build_commands+=("cmake . && make")
elif [ -f "requirements.txt" ] || [ -f "setup.py" ] || [ -f "pyproject.toml" ]; then
    # Python project - check syntax
    build_commands+=("python -m py_compile **/*.py")
fi

# Try to find build command in package.json scripts
if [ -f "package.json" ] && command -v jq &> /dev/null; then
    # Extract available build-related scripts
    scripts=$(jq -r '.scripts | keys[]' package.json 2>/dev/null | grep -E '^(build|compile|tsc)' || true)
    for script in $scripts; do
        if command -v npm &> /dev/null; then
            build_commands+=("npm run $script")
        fi
    done
fi

# Remove duplicates from build_commands
build_commands=($(printf "%s\\n" "\${build_commands[@]}" | sort -u))

# Function to run a build command
run_build_command() {
    local cmd="$1"
    local output
    local exit_code
    
    echo "Running: $cmd" >&2
    
    # Run command and capture output
    if output=$(eval "$cmd" 2>&1); then
        echo "✓ Build command succeeded: $cmd" >&2
        return 0
    else
        exit_code=$?
        echo "✗ Build command failed: $cmd (exit code: $exit_code)" >&2
        # Extract meaningful error lines
        echo "$output" | grep -E "(error|Error|ERROR|failed|Failed|FAILED)" | head -20 | while IFS= read -r line; do
            errors+=("$cmd: $line")
        done
        return 1
    fi
}

# Run build commands
build_succeeded=false
for cmd in "\${build_commands[@]}"; do
    if run_build_command "$cmd"; then
        build_succeeded=true
        break
    fi
done

# If no build commands were found or all failed
if [ \${#build_commands[@]} -eq 0 ]; then
    errors+=("No build system detected. Please ensure your project has a build configuration.")
elif [ "$build_succeeded" = false ]; then
    errors+=("All build commands failed. Project cannot be built successfully.")
fi

# Function to escape JSON strings
json_escape() {
    printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\t/\\\\t/g; s/\n/\\\\n/g; s/\r/\\\\r/g'
}

# Function to escape JSON strings
json_escape() {
    printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\t/\\\\t/g; s/\n/\\\\n/g; s/\r/\\\\r/g'
}

# Output results in JSON format
echo "{"
echo "  \\"passed\\": $([ \${#errors[@]} -eq 0 ] && echo "true" || echo "false"),"
echo "  \\"errors\\": ["
if [ \${#errors[@]} -gt 0 ]; then
    for i in "\${!errors[@]}"; do
        echo -n "    \\"$(json_escape "\${errors[$i]}")\\"" 
        if [ $i -lt $((\${#errors[@]} - 1)) ]; then
            echo ","
        else
            echo
        fi
    done
fi
echo "  ],"
echo "  \\"fixInstructions\\": \\"Fix all build errors. Ensure all dependencies are installed and the project compiles without errors.\\""
echo "}"
`,

    'test-check.sh': `#!/bin/bash
# Test Check
# Runs all tests and ensures they pass
# Auto-generated by AutoClaude

set -euo pipefail

# Initialize arrays
declare -a errors=()
declare -a test_commands=()

# Detect test framework and set commands
if [ -f "package.json" ]; then
    # Node.js project
    if command -v npm &> /dev/null; then
        # Check for test script in package.json
        if command -v jq &> /dev/null && jq -e '.scripts.test' package.json &> /dev/null; then
            test_commands+=("npm test")
        fi
    fi
    if command -v yarn &> /dev/null && [ -f "yarn.lock" ]; then
        test_commands+=("yarn test")
    fi
    if command -v pnpm &> /dev/null && [ -f "pnpm-lock.yaml" ]; then
        test_commands+=("pnpm test")
    fi
elif [ -f "Cargo.toml" ]; then
    # Rust project
    test_commands+=("cargo test")
elif [ -f "go.mod" ]; then
    # Go project
    test_commands+=("go test ./...")
elif [ -f "pom.xml" ]; then
    # Maven project
    test_commands+=("mvn test")
elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
    # Gradle project
    test_commands+=("gradle test")
elif [ -f "Makefile" ] || [ -f "makefile" ]; then
    # Check if test target exists
    if make -n test &> /dev/null; then
        test_commands+=("make test")
    fi
elif [ -f "pytest.ini" ] || [ -f "setup.cfg" ] || [ -f "tox.ini" ]; then
    # Python project with pytest
    if command -v pytest &> /dev/null; then
        test_commands+=("pytest")
    fi
elif [ -f "setup.py" ] || [ -f "pyproject.toml" ]; then
    # Python project
    if command -v python &> /dev/null; then
        test_commands+=("python -m pytest" "python -m unittest discover")
    fi
fi

# Remove duplicates
test_commands=($(printf "%s\\n" "\${test_commands[@]}" | sort -u))

# Function to run a test command
run_test_command() {
    local cmd="$1"
    local output
    local exit_code
    
    echo "Running: $cmd" >&2
    
    # Run command and capture output
    if output=$(eval "$cmd" 2>&1); then
        echo "✓ Tests passed: $cmd" >&2
        return 0
    else
        exit_code=$?
        echo "✗ Tests failed: $cmd (exit code: $exit_code)" >&2
        # Extract test failure information
        echo "$output" | grep -E "(FAIL|Failed|failed|Error|ERROR|✗|✖|●)" | head -20 | while IFS= read -r line; do
            errors+=("$line")
        done
        return 1
    fi
}

# Check if any test files exist
test_files_exist=false
for pattern in "*test*" "*spec*" "*Test*" "*Spec*" "tests/" "test/" "__tests__/"; do
    if compgen -G "$pattern" > /dev/null; then
        test_files_exist=true
        break
    fi
done

if [ "$test_files_exist" = false ]; then
    errors+=("No test files found. Please write tests for your code.")
elif [ \${#test_commands[@]} -eq 0 ]; then
    errors+=("No test runner detected. Please configure a test framework.")
else
    # Run test commands
    test_succeeded=false
    for cmd in "\${test_commands[@]}"; do
        if run_test_command "$cmd"; then
            test_succeeded=true
            break
        fi
    done
    
    if [ "$test_succeeded" = false ]; then
        errors+=("All test commands failed. Please fix failing tests.")
    fi
fi

# Function to escape JSON strings
json_escape() {
    printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\t/\\\\t/g; s/\n/\\\\n/g; s/\r/\\\\r/g'
}

# Output results in JSON format
echo "{"
echo "  \\"passed\\": $([ \${#errors[@]} -eq 0 ] && echo "true" || echo "false"),"
echo "  \\"errors\\": ["
if [ \${#errors[@]} -gt 0 ]; then
    for i in "\${!errors[@]}"; do
        echo -n "    \\"$(json_escape "\${errors[$i]}")\\"" 
        if [ $i -lt $((\${#errors[@]} - 1)) ]; then
            echo ","
        else
            echo
        fi
    done
fi
echo "  ],"
echo "  \\"fixInstructions\\": \\"Fix all failing tests. Ensure all test cases pass before deployment. If no tests exist, write comprehensive test coverage.\\""
echo "}"
`,

    'format-check.sh': `#!/bin/bash
# Format Check
# Ensures code is properly formatted
# Auto-generated by AutoClaude

set -euo pipefail

# Initialize arrays
declare -a errors=()
declare -a format_commands=()

# Detect formatters and linters
if [ -f "package.json" ]; then
    # Check for ESLint
    if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.yml" ] || [ -f ".eslintrc.yaml" ]; then
        if command -v npx &> /dev/null; then
            format_commands+=("npx eslint . --ext .js,.jsx,.ts,.tsx")
        fi
    fi
    
    # Check for Prettier
    if [ -f ".prettierrc" ] || [ -f ".prettierrc.js" ] || [ -f ".prettierrc.json" ] || [ -f "prettier.config.js" ]; then
        if command -v npx &> /dev/null; then
            format_commands+=("npx prettier --check .")
        fi
    fi
    
    # Check for package.json scripts
    if command -v jq &> /dev/null; then
        for script in "lint" "format:check" "prettier:check" "eslint"; do
            if jq -e ".scripts.\\"$script\\"" package.json &> /dev/null; then
                format_commands+=("npm run $script")
            fi
        done
    fi
elif [ -f "Cargo.toml" ]; then
    # Rust project
    if command -v cargo &> /dev/null; then
        format_commands+=("cargo fmt -- --check")
        if command -v cargo-clippy &> /dev/null; then
            format_commands+=("cargo clippy -- -D warnings")
        fi
    fi
elif [ -f "go.mod" ]; then
    # Go project
    if command -v gofmt &> /dev/null; then
        format_commands+=("gofmt -l .")
    fi
    if command -v golint &> /dev/null; then
        format_commands+=("golint ./...")
    fi
elif [ -f "pyproject.toml" ] || [ -f "setup.cfg" ] || [ -f ".flake8" ]; then
    # Python project
    if command -v black &> /dev/null; then
        format_commands+=("black --check .")
    fi
    if command -v flake8 &> /dev/null; then
        format_commands+=("flake8 .")
    fi
    if command -v pylint &> /dev/null; then
        format_commands+=("pylint **/*.py")
    fi
fi

# Remove duplicates
format_commands=($(printf "%s\\n" "\${format_commands[@]}" | sort -u))

# Function to run a format command
run_format_command() {
    local cmd="$1"
    local output
    local exit_code
    
    echo "Running: $cmd" >&2
    
    # Special handling for gofmt (it outputs files that need formatting)
    if [[ "$cmd" == "gofmt -l ." ]]; then
        output=$(eval "$cmd" 2>&1)
        if [ -n "$output" ]; then
            echo "✗ Files need formatting:" >&2
            echo "$output" | while IFS= read -r file; do
                errors+=("$file needs formatting")
            done
            return 1
        else
            echo "✓ All files properly formatted" >&2
            return 0
        fi
    fi
    
    # Run command and capture output
    if output=$(eval "$cmd" 2>&1); then
        echo "✓ Format check passed: $cmd" >&2
        return 0
    else
        exit_code=$?
        echo "✗ Format check failed: $cmd (exit code: $exit_code)" >&2
        # Extract format/lint errors
        echo "$output" | grep -E "(error|Error|warning|Warning)" | head -20 | while IFS= read -r line; do
            errors+=("$line")
        done
        return 1
    fi
}

# Check for common formatting issues in any text file
check_basic_formatting() {
    # Check for trailing whitespace
    local files_with_trailing_ws=$(find . -type f -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.cpp" -o -name "*.c" -o -name "*.h" 2>/dev/null | grep -v node_modules | xargs grep -l '[[:space:]]$' 2>/dev/null || true)
    
    if [ -n "$files_with_trailing_ws" ]; then
        echo "$files_with_trailing_ws" | while IFS= read -r file; do
            errors+=("$file has trailing whitespace")
        done
    fi
    
    # Check for tabs vs spaces consistency (basic check)
    local files_with_mixed_indent=$(find . -type f -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" 2>/dev/null | grep -v node_modules | xargs grep -l $'^\\t' | xargs grep -l '^ ' 2>/dev/null || true)
    
    if [ -n "$files_with_mixed_indent" ]; then
        echo "$files_with_mixed_indent" | while IFS= read -r file; do
            errors+=("$file has mixed tabs and spaces")
        done
    fi
}

# Run format checks
if [ \${#format_commands[@]} -eq 0 ]; then
    echo "No code formatter/linter detected. Running basic checks..." >&2
    check_basic_formatting
else
    format_succeeded=false
    for cmd in "\${format_commands[@]}"; do
        if run_format_command "$cmd"; then
            format_succeeded=true
        fi
    done
fi

# Function to escape JSON strings
json_escape() {
    printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\t/\\\\t/g; s/\n/\\\\n/g; s/\r/\\\\r/g'
}

# Output results in JSON format
echo "{"
echo "  \\"passed\\": $([ \${#errors[@]} -eq 0 ] && echo "true" || echo "false"),"
echo "  \\"errors\\": ["
if [ \${#errors[@]} -gt 0 ]; then
    for i in "\${!errors[@]}"; do
        echo -n "    \\"$(json_escape "\${errors[$i]}")\\"" 
        if [ $i -lt $((\${#errors[@]} - 1)) ]; then
            echo ","
        else
            echo
        fi
    done
fi
echo "  ],"
echo "  \\"fixInstructions\\": \\"Fix all formatting issues. Run your code formatter/linter and fix any violations. Remove trailing whitespace and ensure consistent indentation.\\""
echo "}"
`,

    'github-actions.sh': `#!/bin/bash
# GitHub Actions Check
# Validates GitHub Actions workflows
# Auto-generated by AutoClaude

set -euo pipefail

# Initialize arrays
declare -a errors=()
declare -a warnings=()

# Check if .github/workflows directory exists
if [ ! -d ".github/workflows" ]; then
    echo "{"
    echo "  \\"passed\\": true,"
    echo "  \\"errors\\": [],"
    echo "  \\"warnings\\": [\\"No GitHub Actions workflows found\\"]"
    echo "}"
    exit 0
fi

# Function to validate YAML syntax
validate_yaml() {
    local file="$1"
    
    # Basic YAML validation
    if ! command -v yq &> /dev/null && ! command -v python &> /dev/null; then
        warnings+=("Cannot validate YAML syntax - no YAML parser available")
        return
    fi
    
    # Try yq first
    if command -v yq &> /dev/null; then
        if ! yq eval '.' "$file" &> /dev/null; then
            errors+=("$file: Invalid YAML syntax")
        fi
    # Fall back to Python
    elif command -v python &> /dev/null; then
        if ! python -c "import yaml; yaml.safe_load(open('$file'))" &> /dev/null 2>&1; then
            errors+=("$file: Invalid YAML syntax")
        fi
    fi
}

# Function to check workflow file
check_workflow() {
    local file="$1"
    local filename=$(basename "$file")
    
    # Validate YAML syntax
    validate_yaml "$file"
    
    # Check for required fields
    if ! grep -q "^name:" "$file"; then
        warnings+=("$filename: Missing 'name' field")
    fi
    
    if ! grep -q "^on:" "$file"; then
        errors+=("$filename: Missing 'on' trigger")
    fi
    
    if ! grep -q "^jobs:" "$file"; then
        errors+=("$filename: Missing 'jobs' section")
    fi
    
    # Check for common issues
    if grep -q "ubuntu-16.04\\|ubuntu-18.04" "$file"; then
        warnings+=("$filename: Using deprecated Ubuntu version")
    fi
    
    if grep -q "actions/checkout@v1\\|actions/setup-node@v1" "$file"; then
        warnings+=("$filename: Using outdated action versions")
    fi
    
    if grep -q "\\\${{ secrets\\\\." "$file" && ! grep -q "\\\${{ secrets\\\\." "$file" | grep -q "if:"; then
        # Check if secrets are used without conditions
        warnings+=("$filename: Secrets used - ensure they are properly configured")
    fi
    
    # Check for hardcoded versions
    if grep -qE "node-version: ['\\\"]*[0-9]+\\.[0-9]+\\.[0-9]+['\\\"]*" "$file"; then
        warnings+=("$filename: Hardcoded Node.js version - consider using version ranges")
    fi
}

# Check all workflow files
for workflow in .github/workflows/*.yml .github/workflows/*.yaml; do
    if [ -f "$workflow" ]; then
        check_workflow "$workflow"
    fi
done

# Check for workflow dependencies
if [ -f ".github/dependabot.yml" ] || [ -f ".github/dependabot.yaml" ]; then
    echo "✓ Dependabot configuration found" >&2
else
    warnings+=("No Dependabot configuration - consider adding for automated dependency updates")
fi

# Function to escape JSON strings
json_escape() {
    printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g; s/\t/\\\\t/g; s/\n/\\\\n/g; s/\r/\\\\r/g'
}

# Output results in JSON format
echo "{"
echo "  \\"passed\\": $([ \${#errors[@]} -eq 0 ] && echo "true" || echo "false"),"
echo "  \\"errors\\": ["
if [ \${#errors[@]} -gt 0 ]; then
    for i in "\${!errors[@]}"; do
        echo -n "    \\"$(json_escape "\${errors[$i]}")\\"" 
        if [ $i -lt $((\${#errors[@]} - 1)) ]; then
            echo ","
        else
            echo
        fi
    done
fi
echo "  ],"
echo "  \\"warnings\\": ["
if [ \${#warnings[@]} -gt 0 ]; then
    for i in "\${!warnings[@]}"; do
        echo -n "    \\"$(json_escape "\${warnings[$i]}")\\"" 
        if [ $i -lt $((\${#warnings[@]} - 1)) ]; then
            echo ","
        else
            echo
        fi
    done
fi
echo "  ],"
echo "  \\"fixInstructions\\": \\"Fix all GitHub Actions syntax errors. Update deprecated runner versions and action versions. Ensure all required fields are present.\\""
echo "}"
`
};

export const SCRIPTS_README = `# AutoClaude Scripts

This directory contains quality check scripts that can be run automatically by AutoClaude.

## Built-in Scripts

### production-readiness.sh
Checks for TODO comments, FIXME markers, placeholders, and other indicators of incomplete code.

### build-check.sh
Ensures the project can build successfully using detected build tools.

### test-check.sh
Runs the project's test suite and ensures all tests pass.

### format-check.sh
Checks code formatting using detected linters and formatters.

### github-actions.sh
Validates GitHub Actions workflow files for syntax and common issues.

## Creating Custom Scripts

You can create your own shell scripts in this directory. They must:

1. Be executable (chmod +x your-script.sh)
2. Output JSON in the following format:

\`\`\`json
{
  "passed": true|false,
  "errors": ["error 1", "error 2"],
  "warnings": ["warning 1", "warning 2"],
  "fixInstructions": "Instructions for fixing the issues"
}
\`\`\`

## Script Requirements

- Must be shell scripts (bash)
- Must be executable
- Must output valid JSON
- Should exit with code 0 (success) regardless of check results
- The JSON "passed" field determines if the check passed

## Example Custom Script

\`\`\`bash
#!/bin/bash

# My custom check
errors=()

# Perform checks...
if [ some_condition ]; then
    errors+=("Found an issue")
fi

# Output JSON
echo "{"
echo "  \\"passed\\": $([ \${#errors[@]} -eq 0 ] && echo "true" || echo "false"),"
echo "  \\"errors\\": ["
if [ \${#errors[@]} -gt 0 ]; then
    printf '%s\\n' "\${errors[@]}" | jq -R . | jq -s .
fi
echo "  ],"
echo "  \\"fixInstructions\\": \\"Fix the issues found\\""
echo "}"
\`\`\`
`;

export const DEFAULT_CONFIG = {
    "scripts": [
        {
            "id": "production-readiness",
            "name": "Production Readiness Check",
            "description": "Checks for TODO, FIXME, placeholders, and incomplete implementations",
            "enabled": true,
            "predefined": true,
            "path": ".autoclaude/scripts/production-readiness.sh"
        },
        {
            "id": "build-check",
            "name": "Build Check",
            "description": "Ensures the project can build successfully",
            "enabled": true,
            "predefined": true,
            "path": ".autoclaude/scripts/build-check.sh"
        },
        {
            "id": "test-check",
            "name": "Test Check",
            "description": "Runs all tests and ensures they pass",
            "enabled": true,
            "predefined": true,
            "path": ".autoclaude/scripts/test-check.sh"
        },
        {
            "id": "format-check",
            "name": "Format Check",
            "description": "Ensures code is properly formatted",
            "enabled": true,
            "predefined": true,
            "path": ".autoclaude/scripts/format-check.sh"
        },
        {
            "id": "github-actions",
            "name": "GitHub Actions Check",
            "description": "Validates GitHub Actions workflows",
            "enabled": true,
            "predefined": true,
            "path": ".autoclaude/scripts/github-actions.sh"
        }
    ],
    "maxIterations": 5,
    "continueOnError": false
};