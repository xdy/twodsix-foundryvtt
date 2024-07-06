// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * The system-side TwodsixActiveEffect document which overrides/extends the common ActiveEffect model.
 * We extend to our own class to have isSuppressed getter work with equipped status and
 * include a CUSTOM calulation mode directly rather than in a hook
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
   * Apply an ActiveEffect that uses a CUSTOM application mode.
   * @param {TwodsixActor} actor                   The Actor to whom this effect should be applied
   * @param {EffectChangeData} change       The change data being applied
   * @param {*} current                     The current value being modified
   * @param {*} delta                       The parsed value of the change object
   * @param {object} changes                An object which accumulates changes to be applied
   * @private
   * @override
   */
  _applyCustom(actor: TwodsixActor, change: EffectChangeData, current: any, _delta: any, changes: object) {
    //console.log("Custom Data", actor, change, current, _delta, changes);

    let update = 0;
    let operator = '+';
    let changeFormula:string = change.value;
    if (foundry.utils.getType(changeFormula) !== 'string') {
      changeFormula = changeFormula.toString();
    } else {
      changeFormula = changeFormula.trim();
    }
    // Process operator
    if (['+', '/', '*', '='].includes(changeFormula[0])) {
      operator = changeFormula[0];
      changeFormula = changeFormula.slice(1);
    }
    if (Roll.validate(changeFormula)) {
      const r = Roll.safeEval(Roll.replaceFormulaData(changeFormula, actor));
      const ct = foundry.utils.getType(current);
      switch ( ct ) {
        case "string": {
          if (Number.isInteger(Number.parseFloat(current))) {
            update = calculateUpdate(parseInt(current), parseInt(r), operator);
          } else {
            update = calculateUpdate(Number.parseFloat(current), r, operator);
          }
          break;
        }
        case "number":
        {
          update = calculateUpdate(current, r, operator);
          break;
        }
      }
    }
    foundry.utils.setProperty(changes, change.key, update);
  }
}

/**
 * Apply a numerical effect value using a math operator
 * @param {number} current  Current value to apply effect
 * @param {number} effectChange Value of the effect change
 * @param {string} operator nunberical operator to use for applying effect
 * @returns {number}  The updated value when effectChange is applied to current
 */
function calculateUpdate(current:number, effectChange:number, operator:string): number {
  switch (operator) {
    case '+':
      return current + effectChange;
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
