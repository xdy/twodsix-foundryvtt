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
cp foundryconfig.example.json foundryconfig.json
```

Edit `foundryconfig.json` and set the `installPath` to your local Foundry VTT installation:

**macOS (Electron app):**
```json
"installPath": "/Applications/FoundryVTT.app/Contents/Resources/app"
```

**macOS (Node.js install):**
```json
"installPath": "/Users/YourUsername/Applications/FoundryVTT"
```

**Windows (Node.js install):**
```json
"installPath": "C:\\Program Files\\Foundry Virtual Tabletop\\Version 13"
```

**Windows (Electron install):**
```json
"installPath": "C:\\bin\\Foundry14\\App"
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

### 4. Restart Your IDE

After creating the symlinks, restart VS Code or IntelliJ IDEA to enable the improved IntelliSense.

**IntelliJ IDEA Note:**
IntelliJ IDEA natively supports `jsconfig.json` and will automatically recognize the path aliases and symlinked files. Ensure that the `foundry/` directory is not marked as "Excluded" in your Project Structure (it should be visible in the Project view).

## What This Provides

- **Full type hints** for Foundry's `foundry.applications.api.*` classes
- **IntelliSense support** for global classes like `Hooks`, `game`, `canvas`, `ui`
- **Type imports** using `@client/*` and `@common/*` path aliases
- **Autocomplete** for Foundry API methods and properties

## Example Usage

### Using Foundry Namespaced APIs

```js
// Full IntelliSense support
await foundry.applications.api.DialogV2.prompt({
  window: { title: "Example Dialog" },
  content: "<p>Hello World</p>"
});
```

### Using Global Classes

```js
// Hooks class with full type support
Hooks.on("init", () => {
  console.log("System initialized");
});

// fromUuid with proper typing
const actor = await fromUuid("Actor.abc123");
```

### Importing Types

```js
/** @import {FormSelectOption} from "@client/applications/forms/fields.mjs" */

function createSelect(options) {
  // Full IntelliSense for FormSelectOption properties via JSDoc @import
}
```

## Files Added/Modified

- `foundryconfig.example.json` - Example configuration file
- `tools/create-symlinks.mjs` - Script to create symlinks
- `jsconfig.json` - JS project config with path mappings and includes
- `package.json` - Added `symlinks` and `postinstall` scripts
- `.vscode/settings.json` - Excludes `foundry/` from file explorer
- `eslint.config.cjs` - Ignores `foundry/**/*` files
- `.gitignore` - Added `foundryconfig.json`

## Troubleshooting

**IntelliSense not working:**
1. Make sure you've created `foundryconfig.json` with the correct path
2. Run `pnpm run symlinks` to verify symlinks are created
3. Restart VS Code or IntelliJ IDEA
4. Check that the `foundry/` directory exists in your project root

**Symlink errors on Windows:**
- You may need to enable Developer Mode in Windows Settings to create symlinks without admin rights
- Alternatively, run your terminal as Administrator

**Path not found errors:**
- Verify your `installPath` in `foundryconfig.json` is correct
- Check if you're using an Electron or Node.js install (paths differ)
- Ensure Foundry VTT is installed at the specified location
