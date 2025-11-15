#!/usr/bin/env node
/**
 * Scan packs-src for duplicate _id or _key values within each pack directory.
 * Usage: node scripts/find-duplicate-pack-keys.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKS_SRC_DIR = path.join(__dirname, '..', 'packs-src');

function scanPackDir(packDir) {
  const idMap = new Map();
  const keyMap = new Map();
  const files = fs.readdirSync(packDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const filePath = path.join(packDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data._id) {
        if (!idMap.has(data._id)) idMap.set(data._id, []);
        idMap.get(data._id).push(file);
      }
      if (data._key) {
        if (!keyMap.has(data._key)) keyMap.set(data._key, []);
        keyMap.get(data._key).push(file);
      }
    } catch (e) {
      console.error(`Error reading ${filePath}:`, e.message);
    }
  }
  return { idMap, keyMap };
}

function main() {
  let foundDuplicates = false;
  const packs = fs.readdirSync(PACKS_SRC_DIR).filter(f => fs.statSync(path.join(PACKS_SRC_DIR, f)).isDirectory());
  for (const pack of packs) {
    const packDir = path.join(PACKS_SRC_DIR, pack);
    const { idMap, keyMap } = scanPackDir(packDir);
    const dupIds = Array.from(idMap.entries()).filter(([_, files]) => files.length > 1);
    const dupKeys = Array.from(keyMap.entries()).filter(([_, files]) => files.length > 1);
    if (dupIds.length || dupKeys.length) {
      foundDuplicates = true;
      console.log(`\n❌ Duplicates found in pack: ${pack}`);
      for (const [id, files] of dupIds) {
        console.log(`  Duplicate _id: ${id} in files: ${files.join(', ')}`);
      }
      for (const [key, files] of dupKeys) {
        console.log(`  Duplicate _key: ${key} in files: ${files.join(', ')}`);
      }
    }
  }
  if (!foundDuplicates) {
    console.log('✅ No duplicate _id or _key values found in any pack.');
  }
}

main();
