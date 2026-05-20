#!/usr/bin/env node
import { execSync } from 'child_process';
/**
 * Verification script for the pack management workflow
 * This script tests the complete extract → build → verify cycle
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKS_DIR = path.join(__dirname, '..', '..', 'static', 'packs');
const PACKS_SRC_DIR = path.join(__dirname, '..', '..', 'packs-src');

function runCommand(command, description) {
  try {
    console.log(`🔄 ${description}...`);
    execSync(command, {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'inherit'
    });
    console.log(`✅ ${description} completed successfully\n`);
    return true;
  } catch {
    console.error(`❌ ${description} failed\n`);
    return false;
  }
}

function checkDirectory(dirPath, description) {
  if (!fs.existsSync(dirPath)) {
    console.log(`❌ ${description}: Directory not found at ${dirPath}`);
    return false;
  }

  const files = fs.readdirSync(dirPath).filter(f => !f.startsWith('.'));
  console.log(`✅ ${description}: ${files.length} items found`);
  return files.length > 0;
}

function main() {
  console.log('🧪 Pack Management Workflow Verification\n');

  // Step 1: Check initial state
  console.log('📋 Step 1: Checking initial state');
  const hasSource = checkDirectory(PACKS_SRC_DIR, 'JSON source files (packs-src)');
  checkDirectory(PACKS_DIR, 'Binary pack files (static/packs)');
  console.log();

  if (!hasSource) {
    console.log('⚠️  No JSON source files found. Run "pnpm run packs:extract" first.');
    return;
  }

  // Step 2: Test build process
  console.log('📋 Step 2: Testing pack build process');
  if (!runCommand('pnpm run packs:build', 'Building binary packs from JSON source')) {
    return;
  }

  // Step 3: Verify output
  console.log('📋 Step 3: Verifying build output');
  if (!checkDirectory(PACKS_DIR, 'Generated binary pack files')) {
    return;
  }
  console.log();

  // Step 4: Test rebuild process
  console.log('📋 Step 4: Testing full rebuild cycle');
  if (!runCommand('pnpm run packs:rebuild', 'Running extract + build cycle')) {
    return;
  }

  // Step 5: Final verification
  console.log('📋 Step 5: Final verification');
  const sourceCount = fs.readdirSync(PACKS_SRC_DIR).filter(f => !f.startsWith('.')).length;
  const binaryCount = fs.existsSync(PACKS_DIR) ? fs.readdirSync(PACKS_DIR).filter(f => !f.startsWith('.')).length : 0;

  console.log(`📊 Summary:`);
  console.log(`   JSON Source Packs: ${sourceCount}`);
  console.log(`   Binary Pack Files: ${binaryCount}`);

  if (sourceCount === binaryCount && sourceCount > 0) {
    console.log('\n🎉 Pack management workflow verified successfully!');
    console.log('   ✅ Extract process works');
    console.log('   ✅ Build process works');
    console.log('   ✅ Pack counts match');
    console.log('   ✅ Full workflow operational');
  } else {
    console.log('\n⚠️  Pack counts do not match - there may be an issue with the workflow.');
  }
}

main();
