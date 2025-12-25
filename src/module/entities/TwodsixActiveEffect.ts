// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { stackArmorValues } from "../utils/actorDamage";
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
      } else if (["consumable"].includes(this.parent.type) && this.parent.system.subtype === "software" && !this.parent.system.softwareActive) {
        return true;
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
   * @param {string} userId                 The User requesting the document creation.
   * @returns {Promise<boolean|void>}   A return value of false indicates the creation operation should be cancelled.
   * @see {Document#_preCreate}
   * @protected
   */
  protected async _preCreate(data:object, options:object, userId:string): Promise<boolean|void> {
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

  /**
   * Determines the phase of an active effect change based on the change's key.
   *
   * @param {object} change - The change object being processed.
   * @returns {string} - The phase of the change (e.g., "encumbMax", "custom", "derived", "initial").
   */
  determinePhase(change: any): string {
    // Safeguard against undefined target
    const actor: TwodsixActor | undefined = this.target;
    const derivedKeys = actor?.getDerivedDataKeys() ?? [".mod", ".skills.", "primaryArmor.", "secondaryArmor.", "encumbrance.value", "radiationProtection."];

    if (change.key === "system.encumbrance.max") {
      return "encumbMax";
    } else if (change.type === "custom") {
      return "custom";
    } else if (actor && ["traveller", "animal", "robot"].includes(actor.type)) {
      return derivedKeys.includes(change.key) ? "derived" : "initial";
    } else if (derivedKeys.some(dkey => change.key.indexOf(dkey) >= 0)) {
      return "derived";
    } else {
      return "initial";
    }
  }

  /**
   * Updates the phases of changes in the provided data object.
   *
   * @param {object} data - The data object containing changes to process.
   * @param {object} [options] - Additional options for processing changes.
   * @param {documents.BaseUser} [user] - The user requesting the update.
   * @returns {void}
   */
  updatePhases(data: object, options?: object, user?: documents.BaseUser): void {
    // Ensure changes exist and are an array
    if (!data.changes || !Array.isArray(data.changes)) {
      //console.log("No valid changes found in data.");
      return;
    }

    // Calculate differences
    const newChanges = foundry.utils.diffObject(this, data);
    if (newChanges?.changes) {
      for (const change of data.changes) {
        change.phase = this.determinePhase(change);
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

  /**
   * Apply all custom effects for a given actor and phase, and populate actor.overrides for override effects.
   * @param {TwodsixActor} actor - The actor to apply effects to.
   * @param {Array<TwodsixActiveEffect>} effects - The list of effects to process.
   * @param {string} phase - The phase to apply.
   */
  static applyAllCustomEffects(actor: TwodsixActor, effects: Array<TwodsixActiveEffect>, phase: string) {
    // Do not reset actor.overrides here; let the AE workflow manage initialization.
    // Deduplicate override effects by highest priority
    const overrideMap = {};
    const normalCustoms = [];
    for (const effect of effects) {
      if (!effect.active) continue;
      for (const change of effect.changes) {
        if (!change.key || change.phase !== phase) continue;
        if (
          change.type === "custom" &&
          typeof change.value === "string" &&
          change.value.trim().startsWith("=")
        ) {
          const priority = change.priority ?? effect.priority ?? 0;
          if (!overrideMap[change.key] || (priority > (overrideMap[change.key]?.priority ?? 0))) {
            overrideMap[change.key] = change;
          }
        } else if (
          change.type === "custom" &&
          (!change.value || typeof change.value !== "string" || !change.value.trim().startsWith("="))
        ) {
          normalCustoms.push(change);
        }
      }
    }
    // Apply deduped override effects (highest priority per key)
    for (const change of Object.values(overrideMap)) {
      TwodsixActiveEffect.applyCustomEffect(actor, change);
    }
    // Apply all other custom effects (not starting with "=")
    for (const change of normalCustoms) {
      TwodsixActiveEffect.applyCustomEffect(actor, change);
    }
  }

  /**
   * Apply a custom effect change to the actor, evaluating as a formula if needed.
   * @param {TwodsixActor} actor - The actor to apply the effect to.
   * @param {object} change - The change object from the effect.
   */
  static applyCustomEffect(actor:TwodsixActor, change:object) {
    // Only handle CUSTOM mode effects
    if (change.type !== "custom") {
      return undefined;
    }

    // Get the current value
    const current = foundry.utils.getProperty(actor, change.key);
    if (current == undefined) {
      return undefined;
    }

    let update = 0;
    let operator = '+';
    let changeFormula = change.value;
    if (foundry.utils.getType(changeFormula) !== 'string') {
      changeFormula = changeFormula.toString();
    } else {
      changeFormula = changeFormula.trim();
    }
    // Process operator
    if (["+", "/", "-", "*", "="].includes(changeFormula[0])) {
      operator = changeFormula[0];
      changeFormula = changeFormula.slice(1);
    }
    const formula = Roll.replaceFormulaData(changeFormula, actor, { missing: "0", warn: false });
    const ct = foundry.utils.getType(current);
    if (Roll.validate(formula)) {
      const r = Roll.safeEval(formula);
      switch (ct) {
        case "string": {
          const currentAsFloat = Number.parseFloat(current);
          if (Number.isInteger(currentAsFloat)) {
            update = calculateUpdate(parseInt(current), parseInt(r), operator, change.key);
          } else {
            update = calculateUpdate(currentAsFloat, r, operator, change.key);
          }
          break;
        }
        case "number":
          update = calculateUpdate(current, r, operator, change.key);
          break;
      }
    } else if (ct === 'string') {
      update = operator === '+' ? current + changeFormula : changeFormula;
    }

    // For CUSTOM mode, we've computed the value ourselves
    foundry.utils.setProperty(actor, change.key, update);
    foundry.utils.setProperty(actor.overrides, change.key, update);
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

/**
 * Apply a numerical effect value using a math operator
 * @param {number} current  Current value to apply effect
 * @param {number} effectChange Value of the effect change
 * @param {string} operator numerical operator to use for applying effect
 * @param {string} key The property key being modified (for armor detection)
 * @returns {number}  The updated value when effectChange is applied to current
 */
function calculateUpdate(current:number, effectChange:number, operator:string, key:string = ''): number {
  // Detect armor keys and use stackArmorValues for '+' operator
  if (operator === '+' && isArmorKey(key)) {
    return stackArmorValues(current, effectChange);
  }

  switch (operator) {
    case '+':
      return current + effectChange;
    case '-':
      return current - effectChange;
    case '=':
      return effectChange;
    case '*':
      return current * effectChange;
    case '/':
      return current / effectChange;
    default:
      return current;
  }
}

/**
 * Check if a change key refers to an armor-related property
 */
function isArmorKey(key: string): boolean {
  return key.includes('armor') || key.includes('Armor');
}
