#!/bin/bash

# Production Readiness Check for Claude Autopilot
# This script performs comprehensive checks to ensure the application is production-ready

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}       Claude Autopilot Production Readiness Check              ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}\n"

# Function to run a check
run_check() {
    local check_name="$1"
    local check_command="$2"
    local is_critical="${3:-true}"
    
    echo -n "Checking $check_name... "
    
    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((CHECKS_PASSED++))
        return 0
    else
        if [ "$is_critical" = "true" ]; then
            echo -e "${RED}✗ FAILED${NC}"
            ((CHECKS_FAILED++))
            return 1
        else
            echo -e "${YELLOW}⚠ WARNING${NC}"
            ((WARNINGS++))
            return 0
        fi
    fi
}

# Function to check file permissions
check_file_permissions() {
    local file="$1"
    local expected_perms="$2"
    local actual_perms=$(stat -c "%a" "$file" 2>/dev/null || echo "000")
    [ "$actual_perms" = "$expected_perms" ]
}

echo -e "${YELLOW}1. Build and Compilation Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "TypeScript compilation" "npm run build"
run_check "No TypeScript errors" "npx tsc --noEmit"
run_check "Dependencies installed" "[ -d node_modules ]"
run_check "Package lock file exists" "[ -f package-lock.json ]"

echo -e "\n${YELLOW}2. Security Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "No vulnerable dependencies" "npm audit --audit-level=moderate" false
run_check "SecureExec utility exists" "[ -f src/utils/secureExec.ts ]"
run_check "Error handling system exists" "[ -f src/errors/index.ts ]"
run_check "Type guards implemented" "[ -f src/utils/typeGuards.ts ]"
run_check "Python wrapper has safe permissions" "check_file_permissions src/claude_pty_wrapper.py 644" false

echo -e "\n${YELLOW}3. Configuration Checks${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "Config validator exists" "[ -f src/core/configValidator.ts ]"
run_check "Default config is valid" "node -e \"require('./dist/core/configValidator').ConfigValidator.getDefaultConfig()\""
run_check "Environment variables documented" "grep -q 'AUTOCLAUDE_CONFIG' docs/USER_GUIDE.md"

echo -e "\n${YELLOW}4. Logging and Monitoring${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "Logger implementation exists" "[ -f src/utils/logger.ts ]"
run_check "Performance monitor exists" "[ -f src/utils/performanceMonitor.ts ]"
run_check "Health monitor exists" "[ -f src/core/healthMonitor.ts ]"
run_check "Session recovery exists" "[ -f src/core/sessionRecovery.ts ]"

echo -e "\n${YELLOW}5. Error Handling and Recovery${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "Error hierarchy implemented" "grep -q 'AutoClaudeError' src/errors/index.ts"
run_check "Session recovery implemented" "grep -q 'SessionRecoveryManager' src/core/sessionRecovery.ts"
run_check "Graceful shutdown handling" "grep -q 'shutdown' src/core/terminalMode.ts"
run_check "Process cleanup on exit" "grep -q 'process.on.*exit' src/index.ts"

echo -e "\n${YELLOW}6. Testing${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "Test files exist" "find src -name '*.test.ts' | grep -q ."
run_check "Jest configuration exists" "[ -f jest.config.js ]"
run_check "Type guards tests exist" "[ -f src/utils/__tests__/typeGuards.test.ts ]"
run_check "Error system tests exist" "[ -f src/errors/__tests__/errors.test.ts ]"
run_check "Tests pass" "npm test" false

echo -e "\n${YELLOW}7. Documentation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "User guide exists" "[ -f docs/USER_GUIDE.md ]"
run_check "README exists" "[ -f README.md ]"
run_check "License file exists" "[ -f LICENSE ]"
run_check "Package.json has all required fields" "node -e \"const p=require('./package.json'); if(!p.name || !p.version || !p.license) throw new Error()\""

echo -e "\n${YELLOW}8. Resource Management${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "Memory limits configured" "grep -q 'MAX_BUFFER_SIZE' src/core/session.ts"
run_check "Resource cleanup implemented" "grep -q 'performMemoryCleanup' src/core/session.ts"
run_check "Rate limiting implemented" "grep -q 'checkRateLimit' src/core/terminalMode.ts"
run_check "Timeout handling exists" "grep -q 'SESSION_TIMEOUT' src/core/session.ts"

echo -e "\n${YELLOW}9. Production Features${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "Structured logging" "grep -q 'winston' package.json"
run_check "Health checks implemented" "grep -q 'performHealthChecks' src/core/terminalMode.ts"
run_check "Metrics collection" "grep -q 'logMetrics' src/utils/logger.ts"
run_check "Queue persistence" "grep -q 'save.*queue' src/queue/messageQueue.ts"

echo -e "\n${YELLOW}10. Deployment Readiness${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
run_check "Package name is scoped" "grep -q '@r3e/autoclaude' package.json"
run_check "Version follows semver" "node -e \"const s=require('semver'); const p=require('./package.json'); if(!s.valid(p.version)) throw new Error()\""
run_check "Main entry point exists" "[ -f src/index.ts ]"
run_check "Bin entry configured" "grep -q '\"bin\"' package.json"
run_check "Post-install script exists" "[ -f scripts/postinstall.js ]"

echo -e "\n${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                        Summary                                 ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
echo -e "Checks Passed:  ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks Failed:  ${RED}$CHECKS_FAILED${NC}"
echo -e "Warnings:       ${YELLOW}$WARNINGS${NC}"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ Production Readiness: PASSED${NC}"
    echo -e "The application is ready for production deployment!"
    exit 0
else
    echo -e "\n${RED}❌ Production Readiness: FAILED${NC}"
    echo -e "Please address the failed checks before deploying to production."
    exit 1
fi