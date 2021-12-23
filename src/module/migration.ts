export default async function migrateWorld(version:string):Promise<void> {
  //@ts-ignore
  await migrationFileNames.sort().reduce(async (prev, migrationName) => {
    await prev;
    if (migrationName > version) {
      const migration = await import(`../migrations/${migrationName}.ts`);
      console.log("Migrating", migrationName);
      await migration.migrate();
      console.log("Done migrating", migrationName);
      await game.settings.set("twodsix", "systemMigrationVersion", migrationName);
    }
  }, Promise.resolve());
  console.log("Done with all migrations");
}

