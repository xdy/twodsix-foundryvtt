import fs from 'fs';

const migrationName =  process.argv[2];
if (!migrationName) {
  console.log("You need to supply a name for the migration");
  process.exit(1);
}

const tmpDate = new Date();
const date = (new Date(tmpDate.toUTCString())).toISOString().replaceAll(/-|:|T/ig, "_").split(".")[0];

const templateString = "export async function migrate():Promise<void> {\n\n}";

fs.writeFileSync(`src/migrations/${date}_${migrationName}.ts`, templateString);
console.log(`Succesfully created migration: src/migrations/${date}-${migrationName}.ts`);
