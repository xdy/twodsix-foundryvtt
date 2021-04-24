const migrations = {};

//I wish rollup had require.context. But, as it doesn't, follow this pattern when you add new migrations or they won't take effect.
migrations["2021_02_10_10_10"]= "../migrations/2021_02_10_10_10-old_migrations.ts";
migrations["2021_02_10_10_20"]= "../migrations/2021_02_10_10_20-ship_stats.ts";

export default async function migrateWorld(version:string):Promise<void> {
  await Promise.all(Object.keys(migrations).sort().map(async migrationName => {
    if (migrationName > version) {
      console.log("Migrating", migrationName);
      await migrations[migrationName].migrate();
      console.log("Done migrating", migrationName);
      await game.settings.set("twodsix", "systemMigrationVersion", migrationName);
    }
  }));
  console.log("Done with all migrations");
}

