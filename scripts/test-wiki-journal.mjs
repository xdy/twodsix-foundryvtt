import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';


// Directory containing split JournalEntry files
const SPLIT_SRC_DIR = './packs-src/wiki-journal/entries';
const TEMP_DIR = './temp-wiki-journal';
const PACK_OUTPUT = './static/packs/wiki-journal';

async function testWikiJournalBuild() {
  try {
    console.log('Starting test for wiki-journal pack build...');


    // Ensure the temporary directory exists and is empty
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    // Copy all split JournalEntry files into the temp directory
    const splitFiles = fs.readdirSync(SPLIT_SRC_DIR).filter(f => f.endsWith('.json'));
    if (splitFiles.length === 0) {
      throw new Error('No split JournalEntry files found in ' + SPLIT_SRC_DIR);
    }
    for (const file of splitFiles) {
      const srcPath = path.join(SPLIT_SRC_DIR, file);
      const destPath = path.join(TEMP_DIR, file);
      fs.copyFileSync(srcPath, destPath);
      console.log(`Copied: ${srcPath} -> ${destPath}`);
    }

    console.log('Building wiki journal pack using Foundry VTT CLI...');

    // Build the pack using Foundry VTT CLI
    if (!fs.existsSync(PACK_OUTPUT)) {
      fs.mkdirSync(PACK_OUTPUT, { recursive: true });
    }

    // Debugging: Log the contents of the temp-wiki-journal directory
    const tempDirContents = fs.readdirSync(TEMP_DIR);
    console.log('Contents of temp-wiki-journal directory:', tempDirContents);

    // Debugging: Capture and log the output of the pack command
    const packCommand = `npx @foundryvtt/foundryvtt-cli pack --input ${TEMP_DIR} --output ${PACK_OUTPUT} --type JournalEntry`;
    console.log(`Executing pack command: ${packCommand}`);
    try {
      const packOutput = execSync(packCommand, { stdio: 'pipe' }).toString();
      console.log('Pack Command Output:', packOutput);
    } catch (error) {
      console.error('Pack Command Error:', error.message);
      throw error;
    }

    console.log(`✅ Wiki journal pack built successfully at: ${PACK_OUTPUT}`);

    const PACK_FOLDER = PACK_OUTPUT;

    // Verify the pack folder exists
    if (!fs.existsSync(PACK_FOLDER) || !fs.readdirSync(PACK_FOLDER).length) {
      throw new Error(`Pack folder not found or is empty: ${PACK_FOLDER}`);
    }

    console.log(`✅ Verified pack folder exists and is populated: ${PACK_FOLDER}`);

    // Debugging: List contents of the pack folder
    const packFolderContents = fs.readdirSync(PACK_FOLDER);
    console.log('Pack folder contents:', packFolderContents);

    // Debugging: Log the contents of the static/packs/wiki-journal directory after packing
    const packDirContents = fs.readdirSync(PACK_OUTPUT);
    console.log('Contents of static/packs/wiki-journal directory:', packDirContents);

    // Ensure UNPACKED_DIR is declared before use
    const UNPACKED_DIR = './unpacked-wiki-journal';

    // Debugging: Capture and log the output of the unpack command
    const unpackCommand = `npx @foundryvtt/foundryvtt-cli unpack --input ${PACK_OUTPUT} --output ${UNPACKED_DIR} --type JournalEntry`;
    console.log(`Executing unpack command: ${unpackCommand}`);
    try {
      const unpackOutput = execSync(unpackCommand, { stdio: 'pipe' }).toString();
      console.log('Unpack Command Output:', unpackOutput);
    } catch (error) {
      console.error('Unpack Command Error:', error.message);
      throw error;
    }

    console.log('Unbuilding the pack back to JSON for validation...');

    if (!fs.existsSync(UNPACKED_DIR)) {
      fs.mkdirSync(UNPACKED_DIR, { recursive: true });
    }

    console.log(`✅ Wiki journal pack unpacked successfully to: ${UNPACKED_DIR}`);

    // Debugging: Log the contents of the unpacked-wiki-journal directory after unpacking
    const unpackedDirContents = fs.existsSync(UNPACKED_DIR) ? fs.readdirSync(UNPACKED_DIR) : [];
    console.log('Contents of unpacked-wiki-journal directory:', unpackedDirContents);

    console.log('Test completed. Check the unpacked-wiki-journal directory for validation.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWikiJournalBuild();
