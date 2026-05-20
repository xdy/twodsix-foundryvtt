#!/usr/bin/env node
/**
 * Transition script for moving from binary pack tracking to JSON source tracking
 * This script helps clean up the git repository after implementing the new pack workflow
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKS_DIR = path.join(__dirname, '..', '..', 'static', 'packs');
const PACKS_SRC_DIR = path.join(__dirname, '..', '..', 'packs-src');

function runGitCommand(command, description) {
  try {
    console.log(`🔄 ${description}...`);
    const output = execSync(command, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..', '..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });
    if (output.trim()) {
      console.log(`   ${output.trim()}`);
    }
    return true;
  } catch {
    // Git command failed, probably not a git repository or command not available
    console.log(`   ⚠️  Skipping git operation`);
    return false;
  }
}

function checkGitAvailable() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    console.log('⚠️  Git is not available. Skipping git operations.');
    console.log('   Git may not be installed or available on your PATH.');
    return false;
  }
}

function main() {
  console.log('🚀 Pack Management Transition Script');
  console.log('   This script helps transition from binary pack tracking to JSON source tracking\n');

  // Check if directories exist
  if (!fs.existsSync(PACKS_SRC_DIR)) {
    console.error('❌ packs-src directory not found!');
    console.error('   Please run "pnpm run packs:extract" first to create JSON source files.');
    process.exit(1);
  }

  if (!fs.existsSync(PACKS_DIR)) {
    console.log('ℹ️  static/packs directory not found - this is normal if packs haven\'t been built yet.');
  }

  const gitAvailable = checkGitAvailable();

  if (gitAvailable) {
    console.log('📋 Git Repository Cleanup:');

    // Remove binary packs from git tracking
    const success1 = runGitCommand(
      'git rm -r --cached static/packs/ 2>/dev/null || true',
      'Removing binary packs from git tracking'
    );

    // Add JSON source files to git tracking
    const success2 = runGitCommand(
      'git add packs-src/',
      'Adding JSON source files to git tracking'
    );

    // Add updated .gitignore
    const success3 = runGitCommand(
      'git add .gitignore',
      'Adding updated .gitignore'
    );

    // Show what would be committed
    runGitCommand(
      'git status --porcelain',
      'Showing staged changes'
    );

    if (success1 || success2 || success3) {
      console.log('\n✅ Git repository updated!');
      console.log('   📁 Binary packs (static/packs/) are now ignored');
      console.log('   📄 JSON source files (packs-src/) are now tracked');
      console.log('   ⚙️  Updated .gitignore is staged');
      console.log('\n💡 Next steps:');
      console.log('   1. Review the changes: git diff --cached');
      console.log('   2. Commit the changes: git commit -m "feat: migrate to JSON-based pack management"');
      console.log('   3. Build packs when needed: pnpm run packs:build');
    }
  } else {
    console.log('📋 Manual Steps (Git not available):');
    console.log('   When git is available, run these commands:');
    console.log('   1. git rm -r --cached static/packs/');
    console.log('   2. git add packs-src/ .gitignore');
    console.log('   3. git commit -m "feat: migrate to JSON-based pack management"');
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ JSON Source: ${PACKS_SRC_DIR} (${fs.readdirSync(PACKS_SRC_DIR).length} packs)`);

  if (fs.existsSync(PACKS_DIR)) {
    const binaryPackCount = fs.readdirSync(PACKS_DIR).filter(f => !f.startsWith('.')).length;
    console.log(`   🚫 Binary Packs: ${PACKS_DIR} (${binaryPackCount} packs) - now ignored`);
  }

  console.log('\n🎉 Pack management transition complete!');
  console.log('   Your project now uses JSON source files for version control.');
}

main();
