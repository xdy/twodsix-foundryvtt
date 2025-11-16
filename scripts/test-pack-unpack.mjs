// scripts/test-pack-unpack.mjs
import { compilePack, extractPack } from '@foundryvtt/foundryvtt-cli';
import fs from 'fs';
import path from 'path';
import process from 'process';

const entriesDir = path.resolve('packs-src/wiki-journal/entries');
const packDir = path.resolve('static/packs/wiki-journal');
const unpackDir = path.resolve('unpacked-wiki-journal');

async function main() {
  // Clean output directories
  if (fs.existsSync(packDir)) {
    fs.rmSync(packDir, { recursive: true, force: true });
  }
  if (fs.existsSync(unpackDir)) {
    fs.rmSync(unpackDir, { recursive: true, force: true });
  }
  fs.mkdirSync(packDir, { recursive: true });
  fs.mkdirSync(unpackDir, { recursive: true });

  // Pack
  console.log('Packing entries...');
  await compilePack(entriesDir, packDir, {
    log: true,
    recursive: false // Only top-level files
  });
  console.log('Pack complete.');

  // Unpack
  console.log('Unpacking compendium...');
  await extractPack(packDir, unpackDir, {
    log: true
  });
  console.log('Unpack complete.');

  // List unpacked files
  const files = fs.readdirSync(unpackDir);
  console.log('Unpacked files:', files);
}

main().catch(e => {
  console.error('Error during pack/unpack:', e);
  process.exit(1);
});
