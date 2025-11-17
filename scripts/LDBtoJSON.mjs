import { extractPack } from "@foundryvtt/foundryvtt-cli";
import { promises as fs } from "fs";
import path from "path";

const PACKAGE_ID = process.cwd();
const yaml = false;
const expandAdventures = true;
const folders = true;

const packs = await fs.readdir("./static/packs");
for (const pack of packs) {
  if (pack.startsWith(".")) continue;
  console.log("Unpacking " + pack);
  await extractPack(
    `${PACKAGE_ID}/static/packs/${pack}`,
    `${PACKAGE_ID}/sample_data/packs/${pack}`,
    {
      yaml,
      transformName,
      expandAdventures,
      folders,
      log: true,
      clean: true
    }
  );
}
/**
 * Prefaces the document with its type
 * @param {object} doc - The document data
 */
function transformName(doc, context) {
  const safeFileName = doc.name.replace(/[^a-zA-Z0-9А-я]/g, "_");

  const prefix = ["Actor", "Item"].includes(context.documentType) ? doc.type : context.documentType;

  let name = `${doc.name ? `${prefix}_${safeFileName}_${doc._id}` : doc._id}.${yaml ? "yml" : "json"}`;
  if ( context.folder ) name = path.join(context.folder, name);
  return name;
}
