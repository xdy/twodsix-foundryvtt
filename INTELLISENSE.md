# Improved IntelliSense for Foundry VTT Development

This repository has been configured to provide enhanced IntelliSense support for Foundry VTT development by symlinking Foundry's core files.

## Setup

### 1. Install Dependencies

First, install the required dependencies:

```bash
pnpm install
```

### 2. Configure Your Foundry Path

Copy the example configuration file:

```bash
cp foundry-config.example.yaml foundry-config.yaml
```

Edit `foundry-config.yaml` and set the `installPath` to your local Foundry VTT installation:

**macOS (Electron app):**
```yaml
installPath: "/Applications/FoundryVTT.app/Contents/Resources/app"
```

**macOS (Node.js install):**
```yaml
installPath: "/Users/YourUsername/Applications/FoundryVTT"
```

**Windows (Node.js install):**
```yaml
installPath: "C:\\Program Files\\Foundry Virtual Tabletop\\Version 13"
```

**Windows (Electron install):**
```yaml
installPath: "C:\\Users\\YourUsername\\AppData\\Local\\FoundryVTT"
```

### 3. Create Symlinks

Run the symlinks script to create the necessary symlinks:

```bash
pnpm run symlinks
```

This will create a `foundry/` directory in your project root with symlinks to:
- `foundry/client/` - Foundry's client-side code
- `foundry/common/` - Foundry's common utilities
- `foundry/lang/` - Foundry's language files
- `foundry/tsconfig.json` - Foundry's TypeScript configuration

### 4. Restart VS Code

After creating the symlinks, restart VS Code to enable the improved IntelliSense.

## What This Provides

- **Full type hints** for Foundry's `foundry.applications.api.*` classes
- **IntelliSense support** for global classes like `Hooks`, `game`, `canvas`, `ui`
- **Type imports** using `@client/*` and `@common/*` path aliases
- **Autocomplete** for Foundry API methods and properties

## Example Usage

### Using Foundry Namespaced APIs

```typescript
// Full IntelliSense support
await foundry.applications.api.DialogV2.prompt({
  window: { title: "Example Dialog" },
  content: "<p>Hello World</p>"
});
```

### Using Global Classes

```typescript
// Hooks class with full type support
Hooks.on("init", () => {
  console.log("System initialized");
});

// fromUuid with proper typing
const actor = await fromUuid("Actor.abc123");
```

### Importing Types

```typescript
/** @import {FormSelectOption} from "@client/applications/forms/fields.mjs" */

function createSelect(options: FormSelectOption[]) {
  // Full IntelliSense for FormSelectOption properties
}
```

## Files Added/Modified

- `foundry-config.example.yaml` - Example configuration file
- `tools/create-symlinks.mjs` - Script to create symlinks
- `src/types/foundry-globals.d.ts` - Global type declarations
- `tsconfig.json` - Updated with path mappings and includes
- `package.json` - Added `symlinks` and `postinstall` scripts
- `.vscode/settings.json` - Excludes `foundry/` from file explorer
- `eslint.config.cjs` - Ignores `foundry/**/*` files
- `.gitignore` - Added `foundry-config.yaml`

## Troubleshooting

**IntelliSense not working:**
1. Make sure you've created `foundry-config.yaml` with the correct path
2. Run `pnpm run symlinks` to verify symlinks are created
3. Restart VS Code
4. Check that the `foundry/` directory exists in your project root

**Symlink errors on Windows:**
- You may need to enable Developer Mode in Windows Settings to create symlinks without admin rights
- Alternatively, run your terminal as Administrator

**Path not found errors:**
- Verify your `installPath` in `foundry-config.yaml` is correct
- Check if you're using an Electron or Node.js install (paths differ)
- Ensure Foundry VTT is installed at the specified location
