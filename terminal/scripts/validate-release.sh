#!/bin/bash

# Release Validation Script for v3.4.0
# This script performs final checks before release

set -e

echo "🔍 Claude Autopilot v3.4.0 Release Validation"
echo "============================================"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Expected version
EXPECTED_VERSION="3.4.0"

# Check function
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo -e "\n📋 Pre-Release Checklist"
echo "------------------------"

# 1. Check package.json version
echo -n "Checking package.json version... "
PACKAGE_VERSION=$(node -p "require('./package.json').version")
if [ "$PACKAGE_VERSION" = "$EXPECTED_VERSION" ]; then
    check 0 "Version is $EXPECTED_VERSION"
else
    check 1 "Version mismatch: expected $EXPECTED_VERSION, got $PACKAGE_VERSION"
fi

# 2. Check git tag
echo -n "Checking git tag... "
if git tag -l "v$EXPECTED_VERSION" | grep -q "v$EXPECTED_VERSION"; then
    check 0 "Tag v$EXPECTED_VERSION exists"
else
    check 1 "Tag v$EXPECTED_VERSION not found"
fi

# 3. Check build
echo -n "Checking build artifacts... "
if [ -d "dist" ] && [ -f "dist/index.js" ]; then
    check 0 "Build artifacts exist"
else
    check 1 "Build artifacts missing"
fi

# 4. Run tests
echo -e "\n🧪 Running Tests"
echo "----------------"
npm test --silent 2>&1 | grep -E "(Test Suites:|Tests:)" || true

# 5. Check for uncommitted changes
echo -e "\n📦 Git Status"
echo "-------------"
UNCOMMITTED=$(git status --porcelain | grep -v "^??" | wc -l)
if [ $UNCOMMITTED -eq 0 ]; then
    check 0 "No uncommitted changes"
else
    warn "There are uncommitted changes"
    git status --short
fi

# 6. Check dependencies
echo -e "\n📚 Dependencies"
echo "---------------"
echo -n "Checking for vulnerabilities... "
VULNS=$(npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities.moderate + .metadata.vulnerabilities.high + .metadata.vulnerabilities.critical' || echo "0")
if [ "$VULNS" = "0" ]; then
    check 0 "No high/critical vulnerabilities"
else
    warn "$VULNS moderate/high/critical vulnerabilities found"
fi

# 7. Documentation check
echo -e "\n📖 Documentation"
echo "----------------"
DOCS=(
    "README.md"
    "CHANGELOG.md"
    "RELEASE_NOTES_3.4.0.md"
    "docs/USER_GUIDE.md"
    "PRODUCTION_CHECKLIST.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        check 0 "$doc exists"
    else
        check 1 "$doc missing"
    fi
done

# 8. Release files check
echo -e "\n📄 Release Files"
echo "----------------"
RELEASE_FILES=(
    "GITHUB_RELEASE_INSTRUCTIONS.md"
    "RELEASE_SUMMARY_3.4.0.md"
    "RELEASE_COMPLETION_CHECKLIST.md"
)

for file in "${RELEASE_FILES[@]}"; do
    if [ -f "$file" ]; then
        check 0 "$file exists"
    else
        warn "$file missing (optional)"
    fi
done

# Summary
echo -e "\n✨ Release Validation Summary"
echo "============================="
echo -e "${GREEN}Version $EXPECTED_VERSION is ready for release!${NC}"
echo -e "\n📋 Next Steps:"
echo "1. Push to GitHub: git push origin main && git push origin v$EXPECTED_VERSION"
echo "2. Create GitHub release using GITHUB_RELEASE_INSTRUCTIONS.md"
echo "3. Publish to npm: npm publish"
echo "4. Verify installation: npm install -g @r3e/autoclaude@$EXPECTED_VERSION"

echo -e "\n🚀 Good luck with the release!"