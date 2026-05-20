import { extractPack } from '@foundryvtt/foundryvtt-cli';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKS_DIR = path.join(__dirname, '..', '..', 'static', 'packs');
const PACKS_SRC_DIR = path.join(__dirname, '..', '..', 'packs-src');

console.log('Starting pack extraction...');
console.log('Source packs directory:', PACKS_DIR);
console.log('Output directory:', PACKS_SRC_DIR);

// Ensure source directory exists
if (!fs.existsSync(PACKS_SRC_DIR)) {
  console.log('Creating packs-src directory...');
  fs.mkdirSync(PACKS_SRC_DIR, { recursive: true });
}

// Get all pack directories (ignore .DS_Store and other files)
const packDirs = fs.readdirSync(PACKS_DIR)
  .filter(dir => {
    const fullPath = path.join(PACKS_DIR, dir);
    return fs.statSync(fullPath).isDirectory() && !dir.startsWith('.');
  });

console.log(`Found ${packDirs.length} pack directories:`, packDirs);


// Better file naming: prefix with type and safe name
function transformName(doc, context) {
  const safeFileName = doc.name.replace(/[^a-zA-Z0-9А-я]/g, "_");
  const prefix = ["Actor", "Item"].includes(context.documentType) ? doc.type : context.documentType;
  return `${prefix}_${safeFileName}_${doc._id}.json`;
}

let successCount = 0;
let errorCount = 0;

for (const packDir of packDirs) {
  const packPath = path.join(PACKS_DIR, packDir);
  const outputPath = path.join(PACKS_SRC_DIR, packDir);

  try {
    console.log(`\nExtracting pack: ${packDir}`);
    console.log(`  From: ${packPath}`);
    console.log(`  To: ${outputPath}`);

    // Clean output directory before extraction
    if (fs.existsSync(outputPath)) {
      for (const file of fs.readdirSync(outputPath)) {
        fs.unlinkSync(path.join(outputPath, file));
      }
    } else {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    await extractPack(packPath, outputPath, {
      transformName,
      folders: true,
      omitVolatile: true,
      jsonOptions: { space: 2 }
    });
    console.log(`  ✅ Successfully extracted ${packDir}`);
    successCount++;
  } catch (error) {
    console.error(`  ❌ Failed to extract ${packDir}:`, error.message);
    errorCount++;
  }
}

console.log(`\n🎉 Pack extraction complete!`);
console.log(`✅ Successfully extracted: ${successCount} packs`);
if (errorCount > 0) {
  console.log(`❌ Failed to extract: ${errorCount} packs`);
}
console.log(`📁 JSON source files are now in: ${PACKS_SRC_DIR}`);
