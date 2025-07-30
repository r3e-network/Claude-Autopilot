# AutoClaude Release Process

This document outlines the process for creating new releases of AutoClaude.

## Automated Release Process

### Using the Release Script (Recommended)

For easy releases, use the automated release script:

```bash
./scripts/release.sh 2.4.1
```

This script will:
1. ✅ Verify you're on the main branch with clean working directory
2. ✅ Update package.json version
3. ✅ Run production tests
4. ✅ Compile TypeScript and package the extension
5. ✅ Commit version changes
6. ✅ Create and push git tag
7. ✅ Upload VSIX file to GitHub release

### Manual Release Process

If you prefer to release manually:

1. **Prepare the release**:
   ```bash
   # Ensure you're on main branch
   git checkout main
   git pull origin main
   
   # Update version in package.json
   npm version 2.4.1 --no-git-tag-version
   ```

2. **Run quality checks**:
   ```bash
   npm run test:production
   npm run compile
   npm run package
   ```

3. **Commit and tag**:
   ```bash
   git add package.json package-lock.json
   git commit -m "chore: bump version to 2.4.1"
   git tag v2.4.1
   git push origin main
   git push origin v2.4.1
   ```

4. **Upload VSIX to release**:
   ```bash
   gh release upload v2.4.1 autoclaude-2.4.1.vsix --clobber
   ```

## GitHub Actions Workflow

The release workflow (`.github/workflows/release.yml`) automatically:

- ✅ Triggers on tag pushes (`v*`)
- ✅ Validates version consistency
- ✅ Builds and packages the extension
- ✅ Creates GitHub release with VSIX file
- ✅ Generates release notes

## Version Numbering

AutoClaude follows semantic versioning (SemVer):

- **Major** (X.0.0): Breaking changes or major new features
- **Minor** (X.Y.0): New features, backwards compatible
- **Patch** (X.Y.Z): Bug fixes, backwards compatible

## Pre-Release Checklist

Before creating a release:

- [ ] All tests passing in CI/CD
- [ ] Documentation updated
- [ ] CHANGELOG.md updated with new version
- [ ] Version numbers consistent across files
- [ ] No TODO comments or placeholder code
- [ ] Extension packages successfully locally

## Post-Release Tasks

After successful release:

1. **Verify release assets**: Check that VSIX file is attached
2. **Test installation**: Download and install the extension
3. **Update documentation**: Ensure README reflects new version
4. **Announce release**: Update relevant channels/communities

## Troubleshooting

### VSIX File Not Uploaded

If the VSIX file is missing from a release:

```bash
# Build the extension
npm run package

# Upload manually
gh release upload v2.4.1 autoclaude-2.4.1.vsix --clobber
```

### Release Workflow Failed

Check the GitHub Actions logs:

```bash
gh run list --workflow=release.yml
gh run view <run-id> --log
```

Common issues:
- Version mismatch between tag and package.json
- Build/compilation errors
- Missing dependencies

### Tag Already Exists

If you need to recreate a tag:

```bash
# Delete local and remote tag
git tag -d v2.4.1
git push origin :refs/tags/v2.4.1

# Recreate tag
git tag v2.4.1
git push origin v2.4.1
```

## Security

- Never commit secrets to the repository
- Release workflow uses `GITHUB_TOKEN` with minimal permissions
- All releases are publicly visible

## Contact

For questions about the release process, please open an issue in the repository.