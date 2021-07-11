import {getGame} from './utils/utils';


const migrations = {};

// this is a way of importing att of the files in the migrations folder and assign them to a property of an object.
// require.context("../migrations", false, /\.ts$/).keys().forEach((fileName => {
//   const newFileName = fileName.substring(2);
//   import("../migrations/" + newFileName).then((migration) => {
//     migrations[newFileName.split("-")[0]] = migration;
//   });
// }));


export default async function migrateWorld(version:string):Promise<void> {
  console.log('MIGRATIONS ARE BROKEN due to switch to rollup.');
  console.log('TODO Look into https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars to fix this.');
  await Promise.all(Object.keys(migrations).sort().map(async migrationName => {
    if (migrationName > version) {
      console.log('Migrating', migrationName);
      await migrations[migrationName].migrate();
      console.log('Done migrating', migrationName);
      await getGame().settings.set('twodsix', 'systemMigrationVersion', migrationName);
    }
  }));
  console.log('Done with all migrations');
}

