# GitHub Release Instructions for v3.4.0

Follow these steps to create the GitHub release:

## 1. Push Changes and Tag

```bash
# Push the commits
git push origin main

# Push the tag
git push origin v3.4.0
```

## 2. Create GitHub Release

### Option A: Using GitHub CLI (Recommended)

```bash
gh release create v3.4.0 \
  --title "v3.4.0 - Major Security & Reliability Release" \
  --notes-file RELEASE_NOTES_3.4.0.md \
  --latest
```

### Option B: Using GitHub Web Interface

1. Go to https://github.com/r3e-network/AutoClaude/releases/new
2. Select tag: `v3.4.0`
3. Release title: `v3.4.0 - Major Security & Reliability Release`
4. Copy content from `RELEASE_NOTES_3.4.0.md` into the description
5. Check "Set as the latest release"
6. Click "Publish release"

## 3. Publish to npm

```bash
# Make sure you're in the terminal directory
cd terminal

# Publish to npm
npm publish

# Or if you need to login first
npm login
npm publish
```

## 4. Verify Release

1. Check GitHub release page: https://github.com/r3e-network/AutoClaude/releases
2. Verify npm package: https://www.npmjs.com/package/@r3e/autoclaude
3. Test installation:
   ```bash
   npm install -g @r3e/autoclaude@3.4.0
   autoclaude --version
   ```

## 5. Post-Release Tasks

1. Update the main branch protection rules if needed
2. Close related issues and PRs
3. Announce the release in relevant channels
4. Monitor for any immediate issues

## Release Checklist

- [x] Version bumped to 3.4.0
- [x] CHANGELOG.md updated
- [x] README.md updated with new features
- [x] All tests passing
- [x] Production build successful
- [x] Release notes created
- [x] Git tag created
- [ ] Changes pushed to GitHub
- [ ] GitHub release created
- [ ] Package published to npm
- [ ] Installation verified

## Rollback Instructions (if needed)

```bash
# Delete the tag locally
git tag -d v3.4.0

# Delete the tag on remote
git push origin :refs/tags/v3.4.0

# Unpublish from npm (within 72 hours)
npm unpublish @r3e/autoclaude@3.4.0
```