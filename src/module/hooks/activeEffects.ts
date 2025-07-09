// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
//This hook applies CUSTOM active effects values as a formula that is evaluated and not a static value.
Hooks.on('applyActiveEffect', (actor:TwodsixActor, change:any, current: any/*, delta: any, changes:object*/) => {
  //return if current doesn't exist (probably derived value)
  if (current == undefined) {
    return;
  }

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
  const formula = Roll.replaceFormulaData(changeFormula, actor, {missing: "0", warn: false});
  const ct = foundry.utils.getType(current);
  if (Roll.validate(formula)) {
    const r = Roll.safeEval(formula);
    switch ( ct ) {
      case "string": {
        const currentAsFloat = Number.parseFloat(current);
        if (Number.isInteger(currentAsFloat)) {
          update = calculateUpdate(parseInt(current), parseInt(r), operator);
        } else {
          update = calculateUpdate(currentAsFloat, r, operator);
        }
        break;
      }
      case "number":
      {
        update = calculateUpdate(current, r, operator);
        break;
      }
    }
  } else if (ct === 'string') {
    update = operator === '+' ? current + changeFormula : changeFormula;
  }
  foundry.utils.setProperty(actor, change.key, update);
});

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
