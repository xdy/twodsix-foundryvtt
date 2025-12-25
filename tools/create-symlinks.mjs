import * as fs from "fs";
import yaml from "js-yaml";
import path from "path";

console.log("Creating Foundry symlinks for IntelliSense...");

if (fs.existsSync("foundry-config.yaml")) {
  let fileRoot = "";
  try {
    const fc = await fs.promises.readFile("foundry-config.yaml", "utf-8");
    const foundryConfig = yaml.load(fc);

    if (!foundryConfig.installPath) {
      console.error("Error: installPath not specified in foundry-config.yaml");
      console.log("Please copy foundry-config.example.yaml to foundry-config.yaml and set your Foundry installation path.");
      process.exit(1);
    }

    // As of 13.338, the Node install is *not* nested but electron installs *are*
    const nested = fs.existsSync(path.join(foundryConfig.installPath, "resources", "app"));

    if (nested) {
      fileRoot = path.join(foundryConfig.installPath, "resources", "app");
      console.log(`Detected Electron install at: ${fileRoot}`);
    } else {
      fileRoot = foundryConfig.installPath;
      console.log(`Detected Node.js install at: ${fileRoot}`);
    }

    // Verify the install path exists
    if (!fs.existsSync(fileRoot)) {
      console.error(`Error: Foundry install path does not exist: ${fileRoot}`);
      console.log("Please verify the installPath in foundry-config.yaml is correct.");
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error reading foundry-config.yaml: ${err}`);
    process.exit(1);
  }

  try {
    await fs.promises.mkdir("foundry");
    console.log("Created foundry directory");
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }

  // Javascript files
  const corePaths = ["client", "common", "tsconfig.json"];
  for (const p of corePaths) {
    const sourcePath = path.join(fileRoot, p);
    const targetPath = path.join("foundry", p);

    try {
      // Remove existing symlink if it exists
      if (fs.existsSync(targetPath)) {
        await fs.promises.unlink(targetPath);
      }

      await fs.promises.symlink(sourcePath, targetPath);
      console.log(`✓ Symlinked: foundry/${p}`);
    } catch (e) {
      if (e.code === "EEXIST") {
        console.log(`  Already exists: foundry/${p}`);
      } else {
        console.error(`✗ Failed to symlink foundry/${p}: ${e.message}`);
      }
    }
  }

  // Language files
  try {
    const langSource = path.join(fileRoot, "public", "lang");
    const langTarget = path.join("foundry", "lang");

    // Remove existing symlink if it exists
    if (fs.existsSync(langTarget)) {
      await fs.promises.unlink(langTarget);
    }

    await fs.promises.symlink(langSource, langTarget);
    console.log("✓ Symlinked: foundry/lang");
  } catch (e) {
    if (e.code === "EEXIST") {
      console.log("  Already exists: foundry/lang");
    } else {
      console.error(`✗ Failed to symlink foundry/lang: ${e.message}`);
    }
  }

  console.log("\n✓ Symlinks created successfully!");
  console.log("You may need to restart VS Code to see IntelliSense improvements.");
} else {
  console.log("⚠ foundry-config.yaml not found.");
  console.log("Please copy foundry-config.example.yaml to foundry-config.yaml");
  console.log("and set your Foundry installation path.");
  console.log("Then run: pnpm run symlinks");
  console.log("\nSkipping symlink creation...");
}
