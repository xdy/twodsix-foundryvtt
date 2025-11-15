import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PACK_SRC = './packs-src/wiki-journal/wiki-journal.json';
const TEMP_DIR = './temp-wiki-journal';
const PACK_OUTPUT = './static/packs/wiki-journal';

async function testWikiJournalBuild() {
  try {
    console.log('Starting test for wiki-journal pack build...');

    // Read the wiki-journal JSON file
    const packData = JSON.parse(fs.readFileSync(PACK_SRC, 'utf-8'));
    console.log('Loaded wiki-journal JSON:', packData);

    // Validate that packData is an object
    if (typeof packData !== 'object' || Array.isArray(packData)) {
      throw new Error('wiki-journal.json must contain a single object at the top level.');
    }

    // Validate the structure of the journal entry
    if (!packData.pages || !Array.isArray(packData.pages)) {
      throw new Error(`Journal entry ${packData.name} is missing a valid 'pages' array.`);
    }

    for (const page of packData.pages) {
      if (!page.text || typeof page.text !== 'object' || !page.text.content || !page.text.markdown) {
        throw new Error(`Page ${page.name} in journal entry ${packData.name} has an invalid 'text' structure. It must include both 'content' and 'markdown' fields.`);
      }
    }

    // Ensure the temporary directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Write the journal entry to a temporary file
    const entryFilePath = path.join(TEMP_DIR, `${packData.name.replace(/\s+/g, '_')}.json`);
    fs.writeFileSync(entryFilePath, JSON.stringify(packData, null, 2));
    console.log(`Unpacked journal entry: ${packData.name} -> ${entryFilePath}`);

    console.log('Building wiki journal pack using Foundry VTT CLI...');

    // Build the pack using Foundry VTT CLI
    if (!fs.existsSync(PACK_OUTPUT)) {
      fs.mkdirSync(PACK_OUTPUT, { recursive: true });
    }

    execSync(`npx @foundryvtt/foundryvtt-cli pack --input ${TEMP_DIR} --output ${PACK_OUTPUT} --type JournalEntry --no-db`, {
      stdio: 'inherit'
    });

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

    if (!packFolderContents.length) {
      throw new Error(`Pack folder is empty: ${PACK_FOLDER}`);
    }

    console.log('Unbuilding the pack back to JSON for validation...');

    const UNPACKED_DIR = './unpacked-wiki-journal';
    if (!fs.existsSync(UNPACKED_DIR)) {
      fs.mkdirSync(UNPACKED_DIR, { recursive: true });
    }

    execSync(`npx @foundryvtt/foundryvtt-cli unpack --input ${PACK_FOLDER} --output ${UNPACKED_DIR} --type JournalEntry`, {
      stdio: 'inherit'
    });

    console.log(`✅ Wiki journal pack unpacked successfully to: ${UNPACKED_DIR}`);

    console.log('Test completed. Check the unpacked-wiki-journal directory for validation.');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWikiJournalBuild();
