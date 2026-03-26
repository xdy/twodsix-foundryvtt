import { stackArmorValues } from "../utils/actorDamage";
import { applyAllStatusEffects, checkForDamageStat } from "../utils/showStatusIcons";
import { cleanSystemReferences } from "../utils/utils";

/** @typedef {import("@client/documents/active-effect.mjs").ActiveEffect} ActiveEffect */
/** @typedef {import("@client/documents/actor.mjs").Actor} Actor */
/** @typedef {import("@client/documents/item.mjs").Item} Item */

/** @typedef {import("@common/documents/user.mjs").BaseUser} BaseUser */

/**
 * The system-side TwodsixActiveEffect document which overrides/extends the common ActiveEffect model.
 * We extend to our own class to have isSuppressed getter work with equipped status and
 * check for encumbrance when an AE is created or deleted.  CUSTOM mode is applied as part of TwodsixActor.applyActiveEffects,
 * calling TwodsixActiveEffect.applyAllCustomEffects now.
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
   * Apply all custom effects for a given actor and phase, and populate actor.overrides for override effects.
   * @param {TwodsixActor} actor - The actor to apply effects to.
   * @param {Array<TwodsixActiveEffect>} effects - The list of effects to process.
   * @param {string} phase - The phase to apply.
   */
  static applyAllCustomEffects(actor, effects, phase) {
    // Do not reset actor.overrides here; let the AE workflow manage initialization.
    // Deduplicate override effects by highest priority
    const overrideMap = {};
    const normalCustoms = [];
    for (const effect of effects) {
      if (!effect.active) {
        continue;
      }
      for (const change of effect.system.changes ?? []) {
        if (!change.key || change.phase !== phase) {
          continue;
        }

        // Overrides are custom changes that start with '='; keep the highest priority per key
        if (change.type === "custom" && typeof change.value === "string" && change.value.trim().startsWith("=")) {
          const priority = change.priority ?? (effect.priority ?? 0);
          if (!overrideMap[change.key] || priority > overrideMap[change.key].priority) {
            overrideMap[change.key] = {change, priority};
          }
        } else if (change.type === "custom") {
          // Non-override custom changes are applied in order
          normalCustoms.push(change);
        }
      }
    }

    // Apply deduped override effects (highest priority per key)
    for (const entry of Object.values(overrideMap)) {
      TwodsixActiveEffect.applyCustomEffect(actor, entry.change);
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
  static applyCustomEffect(actor, change) {

    // Only handle CUSTOM mode effects
    if (change.type !== "custom") {
      return undefined;
    }

    console.log(`Applying custom effect: key=${change.key}, value=${change.value}, actor=${actor.name}`);

    // Get the current value
    const current = foundry.utils.getProperty(actor, change.key);
    if (current === undefined) {
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
    // Clean @system references for backward compatibility
    changeFormula = cleanSystemReferences(changeFormula);

    // Process operator
    if (["+", "/", "-", "*", "="].includes(changeFormula[0])) {
      operator = changeFormula[0];
      changeFormula = changeFormula.slice(1);
    }
    const formula = Roll.replaceFormulaData(changeFormula, actor.getRollData(), {missing: "0", warn: false});
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

  /**
   * Perform follow-up operations after a Document of this type is created.
   * Post-creation operations occur for all clients after the creation is broadcast.
   * @param {object} data               The initial data object provided to the document creation request
   * @param {object} options            Additional options which modify the creation request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onCreate}
   * @override
   */
  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);
    if (game.userId === userId && this.modifiesActor) {
      await evaluateEffectStatusImpact(this);
    }
    // A hack to fix a bug in v13
    //if (data.system.changes?.length === 0) {
    //  data.system.changes.push({});
    //}
  }

  /**
   * Perform preliminary operations before an Actor of this type is created.
   * Pre-creation operations only occur for the client which requested the operation.
   * @param {object} data               The initial data object provided to the document creation request.
   * @param {object} options            Additional options which modify the creation request.
   * @param {BaseUser} user                 The User requesting the document creation.
   * @returns {Promise<boolean|void>}   A return value of false indicates the creation operation should be cancelled.
   * @see {Document#_preCreate}
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    //console.log("TwodsixActiveEffect _preCreate allowed:", allowed, "data:", data, "options:", options, "user:", user);
    if (allowed === false) {
      return false;
    }
    if (!data?.system?.changes) {
      return;
    }

    // Add phase information
    const oldChanges = foundry.utils.duplicate(data.system.changes);
    if (Array.isArray(oldChanges) && oldChanges?.length > 0) {
      this.updatePhases(data, options, user);
      if (!foundry.utils.equals(oldChanges, data.system.changes)) {
        this.updateSource({"system.changes": data.system.changes});
      }
    }
  }

  /**
   * Perform preliminary operations before a Document of this type is updated.
   * Pre-update operations only occur for the client which requested the operation.
   * @param {object} data            The data object that is changed - NOT always relative to the documents prior values
   * @param {object} options            Additional options which modify the update request
   * @param {BaseUser} user   The User requesting the document update
   * @returns {Promise<boolean|void>}   A return value of false indicates the update operation should be cancelled.
   * @see {Document#_preUpdate}
   */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);
    if (allowed === false) {
      return false;
    }
    //console.log(data, options, user);
    this.updatePhases(data, options, user);
  }

  /**
   * Determines the phase of an active effect change based on the change's key.
   *
   * @param {object} change - The change object being processed.
   * @returns {string} - The phase of the change (e.g., "encumbMax", "custom", "derived", "initial").
   */
  determinePhase(change) {
    // Safeguard against undefined target
    let doc = this.target;
    if (doc?.documentName === 'Item') {
      doc = this.actor;
    }
    const isActor = doc?.documentName === 'Actor';
    const derivedKeys = isActor
      ? doc?.getDerivedDataKeys?.() ?? []
      : [".mod", "skills.", "primaryArmor.", "secondaryArmor.", "encumbrance.value", "radiationProtection.", "conditions.encumberedEffect", "conditions.woundedEffect"];

    // Remove leading 'system.' if present
    const key = change.key.startsWith('system.') ? change.key.slice(7) : change.key;
    if (key === "encumbrance.max") {
      return "encumbMax";
    } else if (change.type === "custom") {
      return "custom";
    }
    let isDerived = false;
    if (isActor) {
      isDerived = derivedKeys.includes(key);
    } else {
      isDerived = derivedKeys.some(dkey => key.includes(dkey)); // probably using fallback so can't do exact match
    }
    if (isDerived) {
      return "derived";
    } else if (typeof change.value === "string" && derivedKeys.some(dkey => change.value.includes(dkey))) {
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
   * @param {BaseUser} [user] - The user requesting the update.
   * @returns {void}
   */
  updatePhases(data, options, user) {
    // Ensure data and changes exist and are valid
    if (!data || !data.system?.changes || foundry.utils.getType(data.system?.changes) !== 'Array') {
      //console.log("No valid changes found in data.");
      return;
    }

    // Calculate differences and update phases only if there are changes
    const newChanges = foundry.utils.diffObject(this, data);
    if (newChanges?.system?.changes) {
      for (const change of data.system.changes) {
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
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
    if (game.userId === userId && this.modifiesActor) {
      await evaluateEffectStatusImpact(this);
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
  async _onDelete(options, userId) {
    await super._onDelete(options, userId);
    if (game.userId === userId && this.modifiesActor) {
      await evaluateEffectStatusImpact(this);
    }

  }
}

/**
 * Evaluate whether an ActiveEffect change could affect encumbrance or wounded status,
 * and request batched status effect updates for the resolved actor when appropriate.
 *
 * This handles both encumbrance (weight-related) and wounded/dead/unconscious checks
 * by inspecting the ActiveEffect's changes and respecting system settings.
 *
 * @param {TwodsixActiveEffect} activeEffect The active effect being changed
 * @returns {Promise<void>}
 */
async function evaluateEffectStatusImpact(activeEffect) {
  // Only proceed if the ActiveEffect is actually modifying an Actor
  if (!activeEffect.modifiesActor) {
    return;
  }

  const targetActor = activeEffect.target;
  if (!targetActor || targetActor?.documentName !== "Actor") {
    return;
  }

  const encumbranceEnabled = game.settings.get('twodsix', 'useEncumbranceStatusIndicators');
  const woundedEnabled = game.settings.get('twodsix', 'useWoundedStatusIndicators');
  const encumbranceApplicable = encumbranceEnabled && targetActor.type === 'traveller';
  const woundedApplicable = woundedEnabled && ["traveller", "animal", "robot"].includes(targetActor.type);
  if (!encumbranceApplicable && !woundedApplicable) {
    return;
  }

  // Determine whether this AE changes could impact encumbrance or wounded status
  // Only consider the AE's configured changes (not its status icons)
  const encumbranceRelevant = changesEncumbranceStat(activeEffect);
  const woundedRelevant = checkForDamageStat(
    {effects: [{system: activeEffect.system}]},
    targetActor.type
  );

  // If neither is relevant, skip
  if (!encumbranceRelevant && !woundedRelevant) {
    return;
  }

  // If this AE's configured changes could affect encumbrance or wounded status,
  // request the appropriate batched checks for the actor (respecting applicability).
  const encumbranceCheck = encumbranceApplicable && encumbranceRelevant;
  const woundedCheck = woundedApplicable && woundedRelevant;
  if (encumbranceCheck || woundedCheck) {
    await applyAllStatusEffects(targetActor, {encumbrance: encumbranceCheck, wounded: woundedCheck});
  }
}

/**
 * Checks the changes in an active effect and determines whether it might affect encumbrance
 * @param {TwodsixActiveEffect} activeEffect  The active effect being changed
 * @returns {boolean} Whether the effect could change encumbrance status
 */
function changesEncumbranceStat(activeEffect) {
  if (activeEffect.system.changes?.length > 0) {
    const ruleset = game.settings.get('twodsix', 'ruleset');
    for (const change of activeEffect.system.changes) {
      if (change.key) {
        if (change.key.includes('system.characteristics.strength.value') ||
          change.key.includes('system.characteristics.strength.current') ||
          change.key.includes('system.characteristics.strength.mod') ||
          (change.key.includes('system.characteristics.endurance.value') && ['CEATOM', "BARBARIC"].includes(ruleset)) ||
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
function calculateUpdate(current, effectChange, operator, key = '') {
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
 * @param {string} key
 * @returns {boolean}
 */
function isArmorKey(key) {
  return key.includes('armor') || key.includes('Armor');
}
