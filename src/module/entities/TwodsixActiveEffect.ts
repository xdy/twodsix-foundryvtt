// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyEncumberedEffect } from "../utils/showStatusIcons";
import TwodsixActor from "./TwodsixActor";

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
   * Apply this ActiveEffect to a provided Actor.
   * This override filters changes based on whether we're in the standard or custom (derived data) pass,
   * and handles CUSTOM mode effects with formula evaluation.
   * @param {TwodsixActor} actor                   The Actor to whom this effect should be applied
   * @param {EffectChangeData} change       The change data being applied
   * @returns {*}                           The resulting applied value
   * @override
   */
  apply(actor: TwodsixActor, change: EffectChangeData): any {
    // Check if this is a custom (derived data) pass by looking at the actor's internal state
    // During custom pass, only apply derived data and CUSTOM mode changes
    // During standard pass, skip derived data and CUSTOM mode changes
    if (actor._applyingCustomEffects) {
      const derivedData = actor._getDerivedDataKeys?.() || [];
      if (!derivedData.includes(change.key) && change.mode !== CONST.ACTIVE_EFFECT_MODES.CUSTOM) {
        return {}; // Skip non-derived, non-CUSTOM changes during custom pass
      }
    } else {
      const derivedData = actor._getDerivedDataKeys?.() || [];
      if (derivedData.includes(change.key) || change.mode === CONST.ACTIVE_EFFECT_MODES.CUSTOM) {
        return {}; // Skip derived data and CUSTOM mode during standard pass
      }
    }

    // Handle CUSTOM mode with formula evaluation
    if (change.mode === CONST.ACTIVE_EFFECT_MODES.CUSTOM) {
      return this._applyCustomEffect(actor, change);
    }

    return super.apply(actor, change);
  }

  /**
   * Apply a CUSTOM mode active effect with formula evaluation.
   * Supports formulas with operators: +, -, *, /, =
   * Returns the change object so Foundry can track it in overrides (for tooltips/highlighting).
   * @param {TwodsixActor} actor - The actor to apply the effect to
   * @param {EffectChangeData} change - The change data
   * @returns {object} The resulting change object with value
   * @private
   */
  _applyCustomEffect(actor: TwodsixActor, change: EffectChangeData): any {
    const current = foundry.utils.getProperty(actor, change.key);

    // Return empty if current doesn't exist (probably derived value without base)
    if (current === undefined) {
      return {};
    }

    let update = 0;
    let operator = '+';
    let changeFormula: string = change.value;

    if (foundry.utils.getType(changeFormula) !== 'string') {
      changeFormula = changeFormula.toString();
    } else {
      changeFormula = changeFormula.trim();
    }

    // Process operator
    if (['+', '-', '/', '*', '='].includes(changeFormula[0])) {
      operator = changeFormula[0];
      changeFormula = changeFormula.slice(1);
    }

    const formula = Roll.replaceFormulaData(changeFormula, actor, {missing: "0", warn: false});
    const ct = foundry.utils.getType(current);

    if (Roll.validate(formula)) {
      const r = Roll.safeEval(formula);
      switch (ct) {
        case "string": {
          const currentAsFloat = Number.parseFloat(current);
          if (Number.isInteger(currentAsFloat)) {
            update = this._calculateUpdate(parseInt(current), parseInt(r), operator);
          } else {
            update = this._calculateUpdate(currentAsFloat, r, operator);
          }
          break;
        }
        case "number": {
          update = this._calculateUpdate(current, r, operator);
          break;
        }
      }
    } else if (ct === 'string') {
      update = operator === '+' ? current + changeFormula : changeFormula;
    }

    // Return the change object so Foundry can track it in actor.overrides
    // This enables tooltips and orange highlighting
    return {[change.key]: update};
  }

  /**
   * Apply a numerical effect value using a math operator
   * @param {number} current - Current value to apply effect
   * @param {number} effectChange - Value of the effect change
   * @param {string} operator - Numerical operator to use for applying effect
   * @returns {number} The updated value when effectChange is applied to current
   * @private
   */
  _calculateUpdate(current: number, effectChange: number, operator: string): number {
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
   * Perform follow-up operations after a Document of this type is updated.
   * Post-update operations occur for all clients after the update is broadcast.
   * @param {object} changed            The differential data that was changed relative to the documents prior values
   * @param {object} options            Additional options which modify the update request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onUpdate}
   * @override
   */
  async _onUpdate(changed: object, options: object, userId: string):void {
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
  async _onDelete(options: object, userId: string):void {
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
