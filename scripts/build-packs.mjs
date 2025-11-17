import { compilePack } from '@foundryvtt/foundryvtt-cli';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import process from 'process';
//import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKS_SRC_DIR = path.join(__dirname, '..', 'packs-src');
const PACKS_OUTPUT_DIR = path.join(__dirname, '..', 'static', 'packs');
//const WIKI_URL = 'https://github.com/xdy/twodsix-foundryvtt/wiki';

console.log('Starting pack compilation...');
console.log('Source directory:', PACKS_SRC_DIR);
console.log('Output directory:', PACKS_OUTPUT_DIR);

// Ensure source directory exists
if (!fs.existsSync(PACKS_SRC_DIR)) {
  console.error('❌ Source packs directory does not exist:', PACKS_SRC_DIR);
  console.error('   Run extract-packs.mjs first to create source files.');
  process.exit(1);
}

// Ensure output directory exists
if (!fs.existsSync(PACKS_OUTPUT_DIR)) {
  console.log('Creating output packs directory...');
  fs.mkdirSync(PACKS_OUTPUT_DIR, { recursive: true });
}

// Get all pack source directories
const packDirs = fs.readdirSync(PACKS_SRC_DIR)
  .filter(dir => {
    const fullPath = path.join(PACKS_SRC_DIR, dir);
    return fs.statSync(fullPath).isDirectory() && !dir.startsWith('.');
  });

console.log(`Found ${packDirs.length} pack source directories:`, packDirs);

let successCount = 0;
let errorCount = 0;

//NOTE THE COMMENTED OUT CODE BLOCK BELOW IS FOR AUTOMATIC GENERATION OF JounralEntry from Twodsix Wiki.  For some reason the building of the pack results in blank JournalEntry
function sanitizeContent(content) {
  // Replace problematic characters with their HTML entity equivalents
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchWikiPages() {
  try {
    console.log('Fetching wiki pages...');
    const response = await axios.get(`${WIKI_URL}/_toc`); // Fetch the table of contents
    const tocHtml = response.data;
    //console.log('Fetched TOC HTML:', tocHtml); // Debugging log

    // Extract links to individual wiki pages from the TOC, excluding '_history'
    const pageLinks = [...tocHtml.matchAll(/href="(\/xdy\/twodsix-foundryvtt\/wiki\/[^\"]+)/g)]
      .map(match => match[1])
      .filter(link => !link.includes('_history')); // Exclude '_history' page
    //console.log('Filtered page links:', pageLinks); // Debugging log

    const pages = [];
    for (const link of pageLinks) {
      const pageUrl = `https://github.com${link}.md`; // Fetch the raw Markdown file
      console.log(`Fetching raw Markdown: ${pageUrl}`);
      const pageResponse = await axios.get(pageUrl);
      ///console.log(`Fetched raw Markdown for ${pageUrl}:`, pageResponse.data); // Debugging log

      const rawMarkdown = pageResponse.data;
      const sanitizedHtml = sanitizeContent(rawMarkdown); // Convert Markdown to sanitized HTML
      const pageName = link.split('/').pop().replace(/-/g, ' '); // Generate a name from the URL

      pages.push({
        _id: "", // Ensure _id is a blank string for each page
        name: pageName,
        type: "text",
        title: {
          show: false,
          level: 1
        },
        text: {
          format: 2, // Markdown format
          content: sanitizedHtml, // Use sanitized HTML content
          markdown: rawMarkdown // Include raw Markdown content
        },
        system: {},
        image: {},
        video: {
          controls: true,
          volume: 0.5
        },
        src: null,
        sort: 0,
        ownership: {
          default: -1
        },
        category: null,
        _key: null,
        flags: {
          twodsix: {
            disableEnrichment: pageName === "Custom Journal Page Enhancers"
          }
        }
      });
    }

    //console.log('Final pages array:', pages); // Debugging log
    return pages;
  } catch (error) {
    console.error('❌ Failed to fetch wiki pages:', error.message);
    throw error;
  }
}

async function generateWikiJournal() {
  // Helper to generate a random 16-character alphanumeric string
  function randomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  try {
    const pages = await fetchWikiPages();
    // Assign _id to each page if missing or empty
    const pagesWithIds = pages.map(page => ({
      ...page,
      _id: (typeof page._id === 'string' && page._id.length === 16 && /^[A-Za-z0-9]+$/.test(page._id)) ? page._id : randomId()
    }));

    const sourceFolder = path.join(PACKS_SRC_DIR, 'wiki-journal');
    if (!fs.existsSync(sourceFolder)) {
      fs.mkdirSync(sourceFolder, { recursive: true });
    }

    // Write each page as a separate JournalEntry file
    for (const page of pagesWithIds) {
      const entry = {
        _id: randomId(),
        name: page.name,
        ownership: { default: 0 },
        folder: null,
        pages: [page],
        sort: 0
      };
      const safeName = page.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `JournalEntry_${safeName}_${entry._id}.json`;
      const filePath = path.join(sourceFolder, filename);
      fs.writeFileSync(filePath, JSON.stringify(entry, null, 2));
      console.log('✅ Wiki JournalEntry JSON created at:', filePath);
    }
  } catch (error) {
    console.error('❌ Failed to generate wiki journal entries:', error.message);
  }
}

/*async function buildWikiPackWithCLI() {
  try {
    console.log('Building wiki journal pack using Foundry VTT CLI...');

    const sourceFolder = path.join(PACKS_SRC_DIR, 'wiki-journal');
    const outputFolder = path.join(PACKS_OUTPUT_DIR, 'wiki-journal');

    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true });
    }

    //execSync(`npx @foundryvtt/foundryvtt-cli pack --input ${sourceFolder} --output ${outputFolder} --type JournalEntry --no-db`, {
    //   stdio: 'inherit'
    //});
   // await compilePack(sourceFolder, outputFolder, { recursive: true, log: true });

    console.log(`✅ Wiki journal metadata built successfully in: ${outputFolder}`);
  } catch (error) {
    console.error('❌ Failed to build wiki journal metadata using Foundry VTT CLI:', error.message);
    throw error;
  }
}

(async () => {
  console.log('Starting pack compilation...');

  // Generate the wiki journal entry
  await generateWikiJournal();

  // Build the wiki journal pack using the CLI
  //await buildWikiPackWithCLI();

  // Proceed with the existing pack compilation logic
  for (const packDir of packDirs) {
    const sourcePath = path.join(PACKS_SRC_DIR, packDir);
    const outputPath = path.join(PACKS_OUTPUT_DIR, packDir);

    try {
      console.log(`\nCompiling pack: ${packDir}`);
      console.log(`  From: ${sourcePath}`);
      console.log(`  To: ${outputPath}`);

      // Remove existing output directory to ensure clean build
      if (fs.existsSync(outputPath)) {
        fs.rmSync(outputPath, { recursive: true, force: true });
      }

      await compilePack(sourcePath, outputPath, { recursive: true, log: true });
      console.log(`  ✅ Successfully compiled ${packDir}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Failed to compile ${packDir}:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n🎉 Pack compilation complete!`);
  console.log(`✅ Successfully compiled: ${successCount} packs`);
  if (errorCount > 0) {
    console.log(`❌ Failed to compile: ${errorCount} packs`);
    process.exit(1);
  }
  console.log(`📁 Binary pack files are now in: ${PACKS_OUTPUT_DIR}`);
  console.log(`🚀 Ready for distribution!`);
})();*/
