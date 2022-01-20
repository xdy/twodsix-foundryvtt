#!/usr/bin/env node

import fs from 'node:fs';
import process from 'node:process';

const migrationName = process.argv[2];
if (!migrationName) {
	console.log('You need to supply a name for the migration');
	process.exit(1);
}

const temporaryDate = new Date();
const date = (new Date(temporaryDate.toUTCString())).toISOString().replace(/[:_t]/gi, '-').split('.')[0];

const templateString = 'export async function migrate():Promise<void> {\n\n\treturn Promise.resolve();\n}';

fs.writeFileSync(`src/migrations/${date}-${migrationName}.ts`, templateString);
console.log(`Successfully created migration: src/migrations/${date}-${migrationName}.ts`);
