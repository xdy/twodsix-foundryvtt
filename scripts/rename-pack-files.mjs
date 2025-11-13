import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKS_SRC_DIR = path.join(__dirname, '..', 'packs-src');


function makeSafeName(str) {
  return str.replace(/[^a-zA-Z0-9А-я]/g, '_');
}

function extractType(doc) {
  // Prefer doc.type for Actor/Item, fallback to documentType if present
  if (doc.type) {
    return doc.type;
  }
  if (doc.documentType) {
    return doc.documentType;
  }
  return 'doc';
}

function getExpectedFilename(doc) {
  const type = extractType(doc);
  const safe = makeSafeName(doc.name || 'unnamed');
  return `${type}_${safe}_${doc._id}.json`;
}

let renamed = 0;
let skipped = 0;


for (const packDir of fs.readdirSync(PACKS_SRC_DIR)) {
  const packPath = path.join(PACKS_SRC_DIR, packDir);
  if (!fs.statSync(packPath).isDirectory()) {
    continue;
  }
  for (const file of fs.readdirSync(packPath)) {
    if (!file.endsWith('.json')) {
      continue;
    }
    const filePath = path.join(packPath, file);
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      console.warn(`⚠️  Could not parse JSON: ${filePath}`);
      skipped++;
      continue;
    }
    if (!doc._id || !doc.name) {
      console.warn(`⚠️  Missing _id or name in: ${filePath}`);
      skipped++;
      continue;
    }
    const expected = getExpectedFilename(doc);
    if (file !== expected) {
      const newPath = path.join(packPath, expected);
      if (fs.existsSync(newPath)) {
        console.warn(`⚠️  Target file already exists, skipping: ${newPath}`);
        skipped++;
        continue;
      }
      fs.renameSync(filePath, newPath);
      console.log(`Renamed: ${file} → ${expected}`);
      renamed++;
    }
  }
}

console.log(`\nBatch rename complete!`);
console.log(`Renamed: ${renamed}`);
console.log(`Skipped: ${skipped}`);
