import {TwodsixItemData} from "./entities/TwodsixItem";
import {before} from "./hooks/ready";
import {TWODSIX} from "./config";
import {getKeyByValue} from "./utils/sheetUtils";

//TODO Move all types to a better place
export type UpdateData = {
  _id?:any;
  items?:any;
  tokens?:any[];
};

export class Migration {

  private static async migrateActorData(actor:Actor, systemMigrationVersion:string):Promise<UpdateData> {
    const updateData:UpdateData = <UpdateData>{};
    const actorData = actor.data;
    await this.migrateActorItems(actorData, systemMigrationVersion, actor);

    if (before(systemMigrationVersion, "0.6.20")) {
      updateData['data.hits.value'] = 0;
      updateData['data.hits.min'] = 0;
      updateData['data.hits.max'] = 0;
      updateData['data.radiationDose.max'] = 0;
    }

    return updateData;
  }

  private static async migrateActorItems(actorData:ActorData<any>, systemMigrationVersion:string, actor:Actor<any>) {
    //Handle any items that are on the actor
    const actorItems = actorData["items"];
    for (const i of actorItems) {
      const migratedItemData = await this.migrateItemData(i, systemMigrationVersion);
      const migratedItem = mergeObject(i, migratedItemData);
      try {
        await actor.updateEmbeddedEntity("OwnedItem", migratedItem);
      } catch (err) {
        console.error(err);
      }
    }
  }

  private static async migrateItemData(item:TwodsixItemData, systemMigrationVersion:string):Promise<UpdateData> {
    const updateData:UpdateData = <UpdateData>{};

    if (before(systemMigrationVersion, "0.6.9")) {
      updateData['data.name'] = item.name;
    }

    if (before(systemMigrationVersion, "0.6.15")) {
      updateData['data.skillModifier'] = 0;
    }

    if (before(systemMigrationVersion, "0.6.22")) {
      if (item.type != 'skills') {
        if (!item.data.skill) {
          updateData['data.skill'] = "";
        }
        if (!item.data.skillModifier) {
          updateData['data.skillModifier'] = 0;
        }
      }
    }

    if (before(systemMigrationVersion, "0.6.23")) {
      if (item.type === 'skills') {
        updateData['data.description'] = "";
        updateData['data.shortDesc'] = "";
      }
    }

    if (before(systemMigrationVersion, "0.6.24")) {
      if (item.type === 'skills') {
        updateData['data.subtype'] = "";
        updateData['data.reference'] = "";
        updateData['data.key'] = "";
      }
    }

    if (before(systemMigrationVersion, "0.6.25")) {
      // This migration failed horribly, so removed in 0.6.26
      // let cost;
      // try {
      //   const price = item.data.price as string;
      //   cost = Number(price.toLowerCase().replace(" ", "").replace("cr", ""));
      // } catch (e) {
      //   cost = 0;
      //   const message = game.i18n.format("TWODSIX.Migration.MigrationError0_6_25", {
      //     name: item.name,
      //     price: item.data.price
      //   });
      //   console.log(message);
      //   ui.notifications.warn(message);
      // }
      // updateData['data.price'] = cost;

      if (item.type === 'weapon') {
        updateData['data.lawLevel'] = 0;
        updateData['data.rangeBand'] = "";
        updateData['data.weaponType'] = "";
        updateData['data.damageType'] = "";
        updateData['data.rateOfFire'] = "";
        updateData['data.recoil'] = false;
      }
    }

    if (before(systemMigrationVersion, "0.6.30")) {
      if (item.type === 'skills') {
        let characteristic;
        //If it can be found, it's already correct
        const alreadyCorrect = !!(TWODSIX.CHARACTERISTICS)[item.data.characteristic];
        if (!alreadyCorrect) {
          //If it's in the reverse map, use that.
          characteristic = getKeyByValue(TWODSIX.CHARACTERISTICS, item.data.characteristic);
          if (!characteristic) {
            //Failed somehow, so set it to strength as a fallback (unlikely to be right, but at least it's obviously wrong...)
            characteristic = 'strength';
            console.log(game.i18n.format("TWODSIX.Migration.MigrationError0_6_29", {
              characteristic: item.data.characteristic,
              name: item.data.name,
              fallback: TWODSIX.CHARACTERISTICS[0]
            }));
          }
        }
        if (!alreadyCorrect) {
          updateData['data.characteristic'] = characteristic;
        }
      }
    }

    // Remove deprecated fields
    this._migrateRemoveDeprecated(item, updateData);

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
          const updateData = Migration.migrateActorData(token.actor, systemMigrationVersion);
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
            updateData = Migration.migrateActorData(ent, systemMigrationVersion);
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

  /**
   * A general migration to remove all fields from the data model which are flagged with a _deprecated tag
   * @private
   */
  static _migrateRemoveDeprecated(ent:TwodsixItemData, updateData:UpdateData):void {
    const flat = flattenObject(ent.data);
    // console.warn('flat', flat);
    // Identify objects to deprecate
    const toDeprecate = Object.entries(flat)
      .filter((e) => e[0].endsWith('_deprecated') && e[1] === true)
      .map((e) => {
        const parent = e[0].split('.');
        parent.pop();
        return parent.join('.');
      });

    // Remove them
    for (const k of toDeprecate) {
      const parts = k.split('.');
      parts[parts.length - 1] = '-=' + parts[parts.length - 1];
      updateData[`data.${parts.join('.')}`] = null;
    }
  }

  static async migrateWorld():Promise<void> {
    const systemMigrationVersion = game.settings.get('twodsix', 'systemMigrationVersion');
    const packs = game.packs.filter(p => {
      return (p.metadata.package === 'twodsix') && ['Actor', 'Item', 'Scene'].includes(p.metadata.entity);
    });

    ui.notifications.info(game.i18n.format("TWODSIX.Migration.DoNotClose", {version: game.system.data.version}), {permanent: true});

    const actorMigrations = game.actors.entities.map(async actor => {
      try {
        const updateData = await Migration.migrateActorData(actor, systemMigrationVersion);
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
        const updateData = await Migration.migrateItemData(<TwodsixItemData>item.data, systemMigrationVersion);
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
    ui.notifications.info(game.i18n.format("TWODSIX.Migration.Completed", {version: game.system.data.version}), {permanent: true});
  }
}
