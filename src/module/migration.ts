type UpdateData = {
  _id?:any;
  items?:any;
  tokens?:any[];
};

export class Migration {

  private static async migrateActorData(actor:ActorData<any>, systemMigrationVersion:string):Promise<UpdateData> {
    const updateData:UpdateData = <UpdateData>{};

    //Insert migrations here
    // if (systemMigrationVersion < "0.6.0") {
    //  updateData['data.new'] = 42;
    //  I.e. set, calculate or copy in a reasonable value
    // }

    return updateData;
  }

  private static async migrateItemData(item:ItemData<any>, systemMigrationVersion:string):Promise<UpdateData> {
    const updateData:UpdateData = <UpdateData>{};

    if (systemMigrationVersion < "0.6.8") {
      updateData['data.name'] = item.name;
    }

    return updateData;
  }


  private static async migrateSceneData(scene:EntityData<any>, systemMigrationVersion:string):Promise<{ tokens:any }> {
    const tokens = duplicate(scene["tokens"]);
    return {
      tokens: tokens.map(t => {
        const token = new Token(t);
        if (!token.actor) {
          t.actorId = null;
          t.actorData = {};
        } else if (!t.actorLink) {
          const updateData = Migration.migrateActorData(token.data.actorData, systemMigrationVersion);
          t.actorData = mergeObject(token.data.actorData, updateData);
        }
        return t;
      })
    };
  }

  private static async migrateCompendium(pack:{ metadata:{ entity:any; }; migrate:() => any; getContent:() => any; updateEntity:(arg0:any) => any; collection:any; }, systemMigrationVersion:string):Promise<void> {
    const entity = pack.metadata.entity;
    if (!['Actor', 'Item', 'Scene'].includes(entity)) {
      return;
    }

    if (pack["locked"]) {
      //Not much we can, or probably should, do.
      return;
    }

    await pack.migrate();
    const content = await pack.getContent();

    const promises = [];
    for (const ent of content) {
      try {
        let updateData = null;
        switch (entity) {
          case 'Item':
            updateData = Migration.migrateItemData(ent.data, systemMigrationVersion);
            break;
          case 'Actor':
            updateData = Migration.migrateActorData(ent.data, systemMigrationVersion);
            break;
          case 'Scene':
            updateData = Migration.migrateSceneData(ent.data, systemMigrationVersion);
            break;
        }
        if (updateData && !isObjectEmpty(updateData)) {
          expandObject(updateData);
          updateData._id = ent._id;
          promises.push(pack.updateEntity(updateData));
          console.log(`Migrating ${entity} entity ${ent.name} in Compendium ${pack.collection}`);
        }
      } catch (err) {
        console.error(err);
      }
    }
    await Promise.all(promises);

    console.log(`Migrated all ${entity} entities from Compendium ${pack.collection}`);
  }

  static async migrateWorld():Promise<void> {
    const systemMigrationVersion = game.settings.get('twodsix', 'systemMigrationVersion');
    const packs:any[] = game.packs.filter(p => {
      return (p.metadata.package === 'twodsix') && ['Actor', 'Item', 'Scene'].includes(p.metadata.entity);
    });

    ui.notifications.info(`Migrating Twodsix to  ${(game.system.data.version)}. Do not close your game or shut down your sever.`, {permanent: true});

    const actorMigrations = game.actors.entities.map(async actor => {
      try {
        const updateData = await Migration.migrateActorData(actor.data, systemMigrationVersion);
        if (!isObjectEmpty(updateData)) {
          console.log(`Migrating Actor ${actor.name}`);
          await actor.update(updateData, {enforceTypes: false});
        }
      } catch (err) {
        console.error(err);
      }
    });

    const itemMigrations = game.items.entities.map(async item => {
      try {
        const updateData = await Migration.migrateItemData(item.data, systemMigrationVersion);
        if (!isObjectEmpty(updateData)) {
          console.log(`Migrating Item ${item.name}`);
          await item.update(updateData, {enforceTypes: false});
        }
      } catch (err) {
        console.error(err);
      }
    });

    const sceneMigrations = game.scenes.entities.map(async scene => {
      try {
        const updateData = await Migration.migrateSceneData(scene.data, systemMigrationVersion);
        if (!isObjectEmpty(updateData)) {
          console.log(`Migrating Scene ${scene.name}`);
          await scene.update(updateData, {enforceTypes: false});
        }
      } catch (err) {
        console.error(err);
      }
    });

    const packMigrations = packs.map(async pack => {
      await Migration.migrateCompendium(pack, systemMigrationVersion);
    });

    await Promise.all([...actorMigrations, ...itemMigrations, ...sceneMigrations, ...packMigrations]);


    game.settings.set("twodsix", "systemMigrationVersion", game.system.data.version);
    ui.notifications.info(`Twodsix System Migration to version ${game.system.data.version} completed!`, {permanent: true});
  }
}
