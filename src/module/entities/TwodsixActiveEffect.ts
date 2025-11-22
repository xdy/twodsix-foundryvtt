// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyEncumberedEffect } from "../utils/showStatusIcons";

/**
 * The system-side TwodsixActiveEffect document which overrides/extends the common ActiveEffect model.
 * We extend to our own class to have isSuppressed getter work with equipped status and
 * check for encumbrance when an AE is created or deleted.  CUSTOM mode is still applied as a hook.
 * Each TwodsixActiveEffect belongs to the effects collection of its parent Document.
 * Each TwodsixActiveEffect contains a ActiveEffectData object which provides its source data.
 */
export class TwodsixActiveEffect extends ActiveEffect {
  /**
   * Is there some system logic that makes this active effect ineligible for application?  Accounts for equipped status
   * @type {boolean}
   * @override
   */
  get isSuppressed() {
    if (this.parent instanceof Item) {
      if (["trait"].includes(this.parent.type)) {
        return false;
      } else if (["storage", "junk"].includes(this.parent.type) || this.parent.system.equipped !== 'equipped') {
        return true;
      }
    }
    return false;
  }
  /**
   * Perform follow-up operations after a Document of this type is created.
   * Post-creation operations occur for all clients after the creation is broadcast.
   * @param {object} data               The initial data object provided to the document creation request
   * @param {object} options            Additional options which modify the creation request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onCreate}
   * @override
   */
  async _onCreate(data: object, options: object, userId: string):void {
    await super._onCreate(data, options, userId);
    if (game.userId === userId  && this.parent?.type === 'traveller') {
      await checkEncumbranceStatus(this);
    }
    // A hack to fix a bug in v13
    if (data.changes?.length === 0) {
      data.changes.push({});
    }
  }

  /**
   * Perform preliminary operations before an Actor of this type is created.
   * Pre-creation operations only occur for the client which requested the operation.
   * @param {object} data               The initial data object provided to the document creation request.
   * @param {object} options            Additional options which modify the creation request.
   * @param {User} userId                 The User requesting the document creation.
   * @returns {Promise<boolean|void>}   A return value of false indicates the creation operation should be cancelled.
   * @see {Document#_preCreate}
   * @protected
   */
  protected async _preCreate(data:object, options:object, userId:User): Promise<boolean|void> {
    const allowed:boolean = await super._preCreate(data, options, userId);
    if (!allowed) {
      return false;
    }
    this.updatePhases(data, options, user);
  }
  /**
   * Perform preliminary operations before a Document of this type is updated.
   * Pre-update operations only occur for the client which requested the operation.
   * @param {object} data            The data object that is changed - NOT always relative to the documents prior values
   * @param {object} options            Additional options which modify the update request
   * @param {documents.BaseUser} user   The User requesting the document update
   * @returns {Promise<boolean|void>}   A return value of false indicates the update operation should be cancelled.
   * @see {Document#_preUpdate}
   * @protected
   */
  async _preUpdate(data: object, options: object, user: documents.BaseUser): Promise<void|boolean> {
    await super._preUpdate(data, options, user);
    //console.log(data, options, user);
    this.updatePhases(data, options, user);
  }

  updatePhases(data: object, options?: object, user?: documents.BaseUser): void {
    // Ensure changes exist and are an array
    if (!data.changes || !Array.isArray(data.changes)) {
      console.warn("No valid changes found in data.");
      return;
    }

    // Calculate differences
    const newChanges = foundry.utils.diffObject(this, data);

    // Safeguard against undefined target
    const actor: TwodsixActor | undefined = this.target;
    const derivedKeys = actor?._getDerivedDataKeys() ?? [".mod", ".skills.", "primaryArmor.", "secondaryArmor.", "encumbrance.value", "radiationProtection."];

    for (const change of data.changes) {
      // Determine phase based on change properties
      if (change.key === "system.encumbrance.max") {
        change.phase = "encumbMax";
      } else if (change.type === "custom") {
        change.phase = "custom";
      } else if (actor && ["traveller", "animal", "robot"].includes(actor.type)) {
        change.phase = derivedKeys.includes(change.key) ? "derived" : "initial";
      } else if (derivedKeys.some(dkey => change.key.indexOf(dkey) >= 0)) {
        change.phase = "derived";
      } else {
        change.phase = "initial";
      }
    }
  }

  /**
   * Perform follow-up operations after a Document of this type is updated.
   * Post-update operations occur for all clients after the update is broadcast.
   * @param {object} changed            The differential data that was changed relative to the documents prior values
   * @param {object} options            Additional options which modify the update request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onUpdate}
   * @override
   */
  async _onUpdate(changed: object, options: object, userId: string):Promise<void> {
    await super._onUpdate(changed, options, userId);
    if(game.userId === userId  && this.parent?.type === 'traveller') {
      await checkEncumbranceStatus(this);
    }
  }

  /**
   * Perform follow-up operations after a Document of this type is deleted.
   * Post-deletion operations occur for all clients after the deletion is broadcast.
   * @param {object} options            Additional options which modify the deletion request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onDelete}
   * @override
   */
  async _onDelete(options: object, userId: string):Promis<void> {
    await super._onDelete(options, userId);
    if(game.userId === userId && this.parent?.type === 'traveller') {
      await checkEncumbranceStatus(this);
    }

  }
}

/**
 * Calls applyEncumberedEffect if active effect could change encumbered status
 * @param {TwodsixActiveEffect} activeEffect  The active effect being changed
 * @returns {void}
 */
async function checkEncumbranceStatus (activeEffect:TwodsixActiveEffect):void {
  if (game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && (changesEncumbranceStat(activeEffect) || activeEffect.statuses.has('dead'))) {
    if (activeEffect.statuses.size === 0 ) {
      await applyEncumberedEffect(activeEffect.parent);
    } else {
      const notEncumbered = !activeEffect.statuses.has('encumbered');
      const notUnc = !activeEffect.statuses.has('unconscious');
      if (notEncumbered && notUnc) {
        await applyEncumberedEffect(activeEffect.parent);
      }
    }
  }
}
/**
 * Checks the changes in an active effect and determines whether it might affect encumbrance
 * @param {TwodsixActiveEffect} activeEffect  The active effect being changed
 * @returns {boolean} Whether the effect could change encumbrance status
 */
function changesEncumbranceStat(activeEffect:TwodsixActiveEffect):boolean {
  if (activeEffect.changes.length > 0) {
    for (const change of activeEffect.changes) {
      if (change.key){
        if (change.key.includes('system.characteristics.strength.value')  ||
        change.key.includes('system.characteristics.strength.current') ||
        change.key.includes('system.characteristics.strength.mod') ||
        (change.key.includes('system.characteristics.endurance.value') && ['CEATOM', "BARBARIC"].includes(game.settings.get('twodsix', 'ruleset'))) ||
        change.key.includes('system.encumbrance.max') ||
        change.key.includes('system.encumbrance.value')) {
          return true;
        }
      }
    }
  }
  return false;
}
