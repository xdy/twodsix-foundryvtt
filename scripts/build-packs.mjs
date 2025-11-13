import { compilePack } from '@foundryvtt/foundryvtt-cli';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKS_SRC_DIR = path.join(__dirname, '..', 'packs-src');
const PACKS_OUTPUT_DIR = path.join(__dirname, '..', 'static', 'packs');

console.log('Starting pack compilation...');
console.log('Source directory:', PACKS_SRC_DIR);
console.log('Output directory:', PACKS_OUTPUT_DIR);

// Ensure source directory exists
if (!fs.existsSync(PACKS_SRC_DIR)) {
  console.error('❌ Source packs directory does not exist:', PACKS_SRC_DIR);
  console.error('   Run extract-packs.mjs first to create source files.');
  process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(PACKS_OUTPUT_DIR)) {
  console.log('Creating output packs directory...');
  fs.mkdirSync(PACKS_OUTPUT_DIR, { recursive: true });
}

// Get all pack source directories
const packDirs = fs.readdirSync(PACKS_SRC_DIR)
  .filter(dir => {
    const fullPath = path.join(PACKS_SRC_DIR, dir);
    return fs.statSync(fullPath).isDirectory() && !dir.startsWith('.');
  });

console.log(`Found ${packDirs.length} pack source directories:`, packDirs);

let successCount = 0;
let errorCount = 0;

for (const packDir of packDirs) {
  const sourcePath = path.join(PACKS_SRC_DIR, packDir);
  const outputPath = path.join(PACKS_OUTPUT_DIR, packDir);

  try {
    console.log(`\nCompiling pack: ${packDir}`);
    console.log(`  From: ${sourcePath}`);
    console.log(`  To: ${outputPath}`);

    // Remove existing output directory to ensure clean build
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { recursive: true, force: true });
    }

    // Validate filenames in the source directory
    const files = fs.readdirSync(sourcePath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const match = file.match(/^([a-zA-Z0-9]+)_(.+)_([a-zA-Z0-9]+)\.json$/);
      if (!match) {
        console.warn(`  ⚠️  File does not match naming convention: ${file}`);
        continue;
      }
      const [, type, safeName, id] = match;
      const filePath = path.join(sourcePath, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data._id !== id) {
          console.warn(`  ⚠️  ID mismatch in file: ${file} (filename: ${id}, _id: ${data._id})`);
        }
      } catch (e) {
        console.warn(`  ⚠️  Could not parse JSON in file: ${file}`);
      }
    }

    await compilePack(sourcePath, outputPath);
    console.log(`  ✅ Successfully compiled ${packDir}`);
    successCount++;
  } catch (error) {
    console.error(`  ❌ Failed to compile ${packDir}:`, error.message);
    errorCount++;
  }
}

console.log(`\n🎉 Pack compilation complete!`);
console.log(`✅ Successfully compiled: ${successCount} packs`);
if (errorCount > 0) {
  console.log(`❌ Failed to compile: ${errorCount} packs`);
  process.exit(1);
}
console.log(`📁 Binary pack files are now in: ${PACKS_OUTPUT_DIR}`);
console.log(`🚀 Ready for distribution!`);
