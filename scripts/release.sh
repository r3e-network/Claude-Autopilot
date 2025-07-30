#!/bin/bash

# AutoClaude Release Helper Script
# This script automates the release process for AutoClaude

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if version is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <version>"
    print_error "Example: $0 2.4.1"
    exit 1
fi

VERSION="$1"
TAG="v$VERSION"

print_status "Starting release process for version $VERSION"

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    print_error "You must be on the main branch to create a release"
    exit 1
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    print_error "Working directory is not clean. Please commit or stash changes."
    exit 1
fi

# Update package.json version
print_status "Updating package.json version to $VERSION"
npm version "$VERSION" --no-git-tag-version

# Run production tests
print_status "Running production tests..."
npm run test:production

# Compile and build
print_status "Compiling TypeScript..."
npm run compile

# Package extension
print_status "Packaging extension..."
npm run package

# Get the generated VSIX filename
VSIX_FILE="autoclaude-${VERSION}.vsix"
if [ ! -f "$VSIX_FILE" ]; then
    print_error "VSIX file not found: $VSIX_FILE"
    exit 1
fi

# Commit version change
print_status "Committing version update..."
git add package.json package-lock.json
git commit -m "chore: bump version to $VERSION

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Create and push tag
print_status "Creating and pushing tag $TAG..."
git tag "$TAG"
git push origin main
git push origin "$TAG"

# Wait for GitHub Actions to complete
print_status "Waiting for GitHub Actions to complete..."
sleep 10

# Check if release already exists, if not the workflow will create it
if gh release view "$TAG" >/dev/null 2>&1; then
    print_status "Release $TAG already exists, uploading VSIX..."
    gh release upload "$TAG" "$VSIX_FILE" --clobber
else
    print_status "Release will be created by GitHub Actions workflow"
fi

print_status "✅ Release process completed!"
print_status "Release URL: https://github.com/r3e-network/AutoClaude/releases/tag/$TAG"
print_status "Download URL: https://github.com/r3e-network/AutoClaude/releases/download/$TAG/$VSIX_FILE"