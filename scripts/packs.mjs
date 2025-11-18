#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const command = process.argv[2];

function runScript(scriptName, description) {
  console.log(`\n🚀 ${description}...`);
  const scriptPath = path.join(__dirname, scriptName);

  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], { stdio: 'inherit' });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${description} completed successfully!`);
        resolve();
      } else {
        console.error(`\n❌ ${description} failed with exit code ${code}`);
        reject(new Error(`Script failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error(`\n❌ Failed to run ${description}:`, error.message);
      reject(error);
    });
  });
}

function showHelp() {
  console.log(`
📦 Foundry Pack Management Tool

Usage: node scripts/packs.mjs <command>

Commands:
  extract   Extract binary packs to JSON source files (packs-src/)
  build     Compile JSON source files to binary packs (static/packs/)
  rebuild   Extract then build (useful for cleaning up)
  help      Show this help message

Examples:
  node scripts/packs.mjs extract  # Convert binary packs to JSON
  node scripts/packs.mjs build    # Convert JSON to binary packs
  node scripts/packs.mjs rebuild  # Full extract + build cycle

Note: Binary packs should be excluded from version control.
      Only the JSON source files (packs-src/) should be committed.
`);
}

async function main() {
  try {
    switch (command) {
      case 'extract':
        await runScript('extract-packs.mjs', 'Extracting packs to JSON source');
        break;

      case 'build':
        await runScript('build-packs.mjs', 'Building binary packs from JSON source');
        break;

      case 'rebuild':
        await runScript('extract-packs.mjs', 'Extracting packs to JSON source');
        await runScript('build-packs.mjs', 'Building binary packs from JSON source');
        console.log('\n🎉 Full rebuild cycle completed!');
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        if (!command) {
          console.error('❌ No command specified.');
        } else {
          console.error(`❌ Unknown command: ${command}`);
        }
        console.log('Run "node scripts/packs.mjs help" for usage information.');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Operation failed:', error.message);
    process.exit(1);
  }
}

main();
