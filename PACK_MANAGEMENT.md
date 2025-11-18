# Pack Management Workflow

This project uses a JSON-first approach for pack management, providing better version control and collaboration capabilities.

## Overview

- **JSON Source Files**: Individual JSON files in `packs-src/` directory (tracked in git)
- **Binary Distribution**: Compiled binary packs in `static/packs/` directory (ignored by git)
- **Automated Building**: Integrated with gulp build process and pnpm scripts

## Directory Structure

```
packs-src/                     # JSON source files (version controlled)
├── 2e-skills/                 # Individual pack directories
│   ├── Item1_id123.json      # Individual item/entity files
│   └── Item2_id456.json
└── cepheus-deluxe-items/
    ├── Weapon1_id789.json
    └── Armor1_id012.json

static/packs/                  # Binary distribution files (auto-generated)
├── 2e-skills/                 # Binary LevelDB packs
└── cepheus-deluxe-items/
```

## Available Commands

### PNPM Scripts
```bash
# Extract binary packs to JSON source files
pnpm run packs:extract

# Build JSON source files to binary packs
pnpm run packs:build

# Clean rebuild (extract + build)
pnpm run packs:rebuild

# Git transition helper (used once during setup)
pnpm run packs:transition
```

### Gulp Integration
```bash
# Full build including pack building
pnpm run build

# Build only packs
npx gulp buildPacks

# Watch mode (rebuilds packs on JSON changes)
pnpm run watch
```

### Direct Script Usage
```bash
# Run scripts directly with more options
node scripts/packs.mjs build
node scripts/packs.mjs extract
node scripts/packs.mjs help
```

## Development Workflow

### Making Changes to Packs

1. **Edit JSON source files** in `packs-src/`
2. **Test changes**: 
   ```bash
   pnpm run packs:build  # Build binary packs
   pnpm run build        # Full project build
   ```
3. **Commit changes**: Only commit the JSON source files
   ```bash
   git add packs-src/
   git commit -m "feat: add new weapons to cepheus-deluxe-items"
   ```

### Watch Mode for Development

Start watch mode to automatically rebuild packs when JSON files change:
```bash
pnpm run watch
```

This will watch for changes in `packs-src/**/*.json` and automatically rebuild the affected packs.

### Adding New Packs

1. **Create new directory** in `packs-src/`
2. **Add JSON files** for your entities
3. **Build and test**:
   ```bash
   pnpm run packs:build
   ```
4. **Commit the source files**

### Extracting from Binary Packs

If you need to extract existing binary packs to JSON:
```bash
pnpm run packs:extract
```

This will create individual JSON files for each entity in the appropriate `packs-src/` directories.

## Benefits of This Approach

### ✅ **Better Version Control**
- Individual file tracking instead of binary blobs
- Readable diffs showing exactly what changed
- Easy to see additions, deletions, and modifications

### ✅ **Improved Collaboration**
- Merge conflicts are easier to resolve
- Multiple developers can work on different entities simultaneously
- Clear history of who changed what

### ✅ **Automated Workflow**
- Integrated with existing build process
- Watch mode for instant feedback
- CI/CD friendly

### ✅ **Data Integrity**
- Round-trip extraction/building maintains data integrity
- Validation during build process
- Easy to backup and restore

## File Naming Convention

JSON source files are named using the format:
```
{ItemType}__{EntityName}__{EntityId}.json
```

Example: `weapon__Plasma_Rifle__kzwxCbA8CXifoeRG.json`

## Troubleshooting

### Build Failures
If pack building fails:
1. Check the console output for specific errors
2. Verify JSON files are valid using a JSON validator
3. Ensure all required fields are present

### Missing Packs
If packs are missing after build:
1. Verify source files exist in `packs-src/`
2. Check that directory names match expected pack names
3. Run `pnpm run packs:rebuild` for a clean rebuild

### Git Issues
If you have conflicts with pack files:
1. Only track JSON source files in `packs-src/`
2. Binary packs in `static/packs/` should be ignored
3. Run `pnpm run packs:build` after resolving conflicts

## Migration Notes

This project migrated from binary pack tracking to JSON-first workflow:
- All existing packs were extracted to 1,972 individual JSON files
- Git history was preserved using automated transition scripts
- Binary packs are now built during the build process
- `.gitignore` was updated to reflect the new workflow

