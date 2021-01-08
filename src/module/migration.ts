import {TwodsixItemData, UpdateData} from "../types/twodsix";
import TwodsixActor from "./entities/TwodsixActor";
import TwodsixItem from "./entities/TwodsixItem";

/**
 * New style migrations should look at the object instead of the version to figure out what needs to be done.
 * E.g. if a field is missing, add it with a default value. If a field has been renamed, check if the old one exists, and if so, copy over the data to the new field and delete the old one.
 * A lot of old migrations have been removed, look in git history if you want to take a look at them.
 */
export class Migration {

  private static async migrateActorData(actor:TwodsixActor):Promise<UpdateData> {
    const updateData:UpdateData = <UpdateData>{};

    let untrainedSkill = actor.getUntrainedSkill();
    if (!untrainedSkill) {
      untrainedSkill = await actor.buildUntrainedSkill();
      updateData['data.untrainedSkill'] = untrainedSkill.id;
    }

    //TODO Get rid of the untrainedSkill passing
    await this.migrateActorItems(actor, untrainedSkill);

    return updateData;
  }

  private static async migrateActorItems(actor:TwodsixActor, untrainedSkill:TwodsixItem=null) {
    //Handle any items that are on the actor
    const actorItems = actor.data["items"];
    const toUpdate = [];
    for (const i of actorItems) {
      toUpdate.push(mergeObject(i, this.migrateItemData(i, actor, untrainedSkill)));
    }
    await actor.updateEmbeddedEntity("OwnedItem", toUpdate);
  }

  private static migrateItemData(item:TwodsixItemData, actor:TwodsixActor = null, untrainedSkill:TwodsixItem=null):UpdateData {
    const updateData:UpdateData = <UpdateData>{};

    if (item.type === 'skills') { //0.6.82
      updateData['data.rolltype'] = item.data.rolltype || 'Normal';
      if (typeof item.data.value ===  "string") { // 0.7.8
        updateData['data.value'] = parseInt(item.data.value, 10);
      }
    }

    if (actor) {
      if (item.type !== 'skills') {
        if (!item.data.skill) { //0.6.84
          updateData['data.skill'] = untrainedSkill.id;
        }
      }
    }

    return updateData;
  }


  private static async migrateSceneData(scene:EntityData):Promise<{ tokens }> {
    const tokens = duplicate(scene["tokens"]);
    return {
      tokens: tokens.map(t => {
        const token = new Token(t);
        if (!token.actor) {
          t.actorId = null;
          t.actorData = {};
        } else if (!t.actorLink) {
          const updateData = Migration.migrateActorData(<TwodsixActor>token.actor);
          t.actorData = mergeObject(token.data.actorData, updateData);
        }
        return t;
      })
    };
  }

  private static async migrateCompendium(pack:{ metadata:{ entity; }; migrate:() => any; getContent:() => any; updateEntity:(arg0:any) => any; collection; }):Promise<void> {
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
    for (const actor of content) {
      try {
        let updateData = null;
        switch (entity) {
          case 'Item':
            updateData = Migration.migrateItemData(actor.data, actor);
            break;
          case 'Actor':
            updateData = Migration.migrateActorData(actor);
            break;
          case 'Scene':
            updateData = Migration.migrateSceneData(actor.data);
            break;
        }
        if (updateData && !isObjectEmpty(updateData)) {
          expandObject(updateData);
          updateData._id = actor._id;
          promises.push(pack.updateEntity(updateData));
          console.log(`Migrating ${entity} entity ${actor.name} in Compendium ${pack.collection}`);
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
  static _migrateRemoveDeprecated(itemData:TwodsixItemData, updateData:UpdateData):void {
    const flat = flattenObject(itemData.data);
    // console.warn('flat', flat);
    // Identify objects to deprecate
    const toDeprecate = Object.entries(flat)
      .filter((e) => e[0].endsWith('_deprecated') && e[1] === true)
      .map((e) => {
        const path = e[0].split('.');
        path.pop();
        return path.join('.');
      });

    // Remove them
    for (const k of toDeprecate) {
      const parts = k.split('.');
      parts[parts.length - 1] = '-=' + parts[parts.length - 1];
      updateData[`data.${parts.join('.')}`] = null;
    }

    //TODO Do as follows to remove a key in a migration.
    //entity.update({ '-=key.to.remove': null });
  }

  static async migrateWorld():Promise<void> {
    const packs = game.packs.filter(p => {
      return (p.metadata.package === 'twodsix') && ['Actor', 'Item', 'Scene'].includes(p.metadata.entity);
    });

    ui.notifications.info(game.i18n.format("TWODSIX.Migration.DoNotClose", {version: game.system.data.version}), {permanent: true});

    const actorMigrations = game.actors.entities.map(async actor => {
      try {
        const updateData = await Migration.migrateActorData(<TwodsixActor>actor);
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
        const updateData = await Migration.migrateItemData(<TwodsixItemData>item.data);
        if (!isObjectEmpty(updateData)) {
          console.log(`Migrating Item ${item.name}`);
          await item.update(updateData, {enforceTypes: false});
        }
      } catch (err) {
        console.error(err);
      }
    });

    const sceneMigrations = [];
    let scene:any;
    for (scene of game.scenes) {
      try {
        const updateData = await Migration.migrateSceneData(scene.data);
        if (!isObjectEmpty(updateData)) {
          console.log(`Migrating Scene ${scene.name}`);
          await scene.update(updateData, {enforceTypes: false});
        }
      } catch (err) {
        console.error(err);
      }
    }

    const packMigrations = packs.map(async pack => {
      await Migration.migrateCompendium(pack);
    });

    await Promise.all([...actorMigrations, ...itemMigrations, ...sceneMigrations, ...packMigrations]);

    await game.settings.set("twodsix", "systemMigrationVersion", game.system.data.version);
    ui.notifications.info(game.i18n.format("TWODSIX.Migration.Completed", {version: game.system.data.version}), {permanent: true});
  }
}
