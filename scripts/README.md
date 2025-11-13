# Pack Management Scripts

This directory contains scripts for managing Foundry VTT pack files using the [@foundryvtt/foundryvtt-cli](https://github.com/foundryvtt/foundryvtt-cli) tool.

## Overview

These scripts enable a JSON-first workflow for pack management:

- **Source files**: JSON files in `packs-src/` (version controlled)
- **Binary files**: LevelDB files in `static/packs/` (generated during build, not version controlled)

## Scripts

### Individual Scripts

- `extract-packs.mjs` - Convert binary packs to JSON source files
- `build-packs.mjs` - Compile JSON source files to binary packs
- `packs.mjs` - Convenience wrapper for pack operations
- `transition-pack-management.mjs` - One-time script to migrate git tracking
- `verify-pack-workflow.mjs` - Test the complete pack management workflow

### NPM Scripts

```bash
# Extract binary packs to JSON source files
npm run packs:extract

# Build binary packs from JSON source files  
npm run packs:build

# Full extract + build cycle
npm run packs:rebuild

# One-time migration from binary to JSON tracking
npm run packs:transition

# Verify the complete workflow is working
npm run packs:verify
```

### Direct Usage

```bash
# Using the convenience script
node scripts/packs.mjs extract   # Extract to JSON
node scripts/packs.mjs build     # Build to binary
node scripts/packs.mjs rebuild   # Extract + build
node scripts/packs.mjs help      # Show help

# Using individual scripts
node scripts/extract-packs.mjs
node scripts/build-packs.mjs
```

## Workflow

### Initial Setup (Done Once)

1. ✅ Install Foundry CLI: `npm install -g @foundryvtt/foundryvtt-cli`
2. ✅ Extract existing packs: `npm run packs:extract`
3. ✅ Update `.gitignore` to exclude binary packs
4. ✅ Transition git tracking: `npm run packs:transition`
5. ⏳ Integrate with build process

### Git Migration

When transitioning an existing repository:

1. **Run transition script**: `npm run packs:transition`
2. **Review changes**: `git diff --cached`
3. **Commit the migration**: `git commit -m "feat: migrate to JSON-based pack management"`

The transition script will:
- Remove `static/packs/` from git tracking
- Add `packs-src/` to git tracking  
- Stage the updated `.gitignore`

> **Note**: If git is not available (missing Xcode Developer Tools), the script will show manual commands to run.

### Daily Development

1. **Edit pack data**: Modify JSON files in `packs-src/`
2. **Build for testing**: `npm run packs:build`
3. **Test in Foundry**: Start development server
4. **Commit changes**: Only commit `packs-src/` files, not `static/packs/`

### Updating Existing Packs

1. **Load in Foundry**: Import/update pack data through the UI
2. **Export**: Use Foundry's pack export or module tools
3. **Extract**: `npm run packs:extract` to get latest JSON
4. **Review changes**: Use git diff to see what changed
5. **Commit**: Commit the updated JSON files

## Benefits

- ✅ **Version Control**: Individual items tracked separately
- ✅ **Merge Conflicts**: Git can handle pack data merges
- ✅ **Readable Diffs**: See exactly what changed in pack data
- ✅ **Direct Editing**: Modify pack content without Foundry
- ✅ **Collaboration**: Multiple developers can work on packs
- ✅ **CI/CD Ready**: Automated builds generate distribution files

## File Structure

```
packs-src/                    # JSON source files (version controlled)
├── 2e-skills/
│   ├── Administration__Admin__ulwOE2PJICOYGHDf.json
│   ├── Advocate_sciGVkW1ymIZxgDi.json
│   └── ...
├── alpha-cephei-actors/
└── ...

static/packs/                 # Binary pack files (generated, ignored by git)
├── 2e-skills/
│   ├── 000004.log
│   ├── 000005.ldb
│   ├── CURRENT
│   └── ...
└── ...
```

## Notes

- The binary packs in `static/packs/` are automatically regenerated
- Only the JSON files in `packs-src/` should be committed to version control
- The build process ensures binary packs are always up to date with JSON source
- Use `npm run packs:rebuild` if you want to start fresh from JSON source
