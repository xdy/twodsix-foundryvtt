// Start Foundry dev server using paths from foundryconfig.json
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';

const config = fs.readJSONSync('foundryconfig.json');

if (!config.installPath) {
  console.error('Missing installPath in foundryconfig.json');
  process.exit(1);
}

if (!config.dataPath) {
  console.error('Missing dataPath in foundryconfig.json');
  process.exit(1);
}

const mainJs = path.resolve(config.installPath, 'resources/app/main.js');
const dataDir = path.resolve(config.dataPath);
const userDataPath = path.dirname(dataDir);  // Foundry --dataPath expects parent of Data/

if (!fs.existsSync(mainJs)) {
  console.error(`Foundry main.js not found at: ${mainJs}`);
  console.error(`Check installPath in foundryconfig.json: ${config.installPath}`);
  process.exit(1);
}

if (!fs.existsSync(dataDir)) {
  console.error(`User data directory not found at: ${dataDir}`);
  console.error(`Check dataPath in foundryconfig.json: ${config.dataPath}`);
  process.exit(1);
}

console.log(`Starting Foundry server...`);
console.log(`  Foundry:      ${mainJs}`);
console.log(`  User data:    ${userDataPath}`);
console.log(`  Data dir:     ${dataDir}`);

const proc = spawn('node', [mainJs, `--dataPath=${userDataPath}`], {
  stdio: 'inherit',
  env: { ...process.env },
});

proc.on('error', (err) => {
  console.error('Failed to start Foundry:', err.message);
  process.exit(1);
});

proc.on('exit', (code) => {
  process.exit(code || 0);
});

process.on('SIGINT', () => proc.kill('SIGINT'));
process.on('SIGTERM', () => proc.kill('SIGTERM'));
