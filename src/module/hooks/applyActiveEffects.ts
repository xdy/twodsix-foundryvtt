// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
//This hook applies CUSTOM active effects values as a formula that is evaluated and not a static
Hooks.on('applyActiveEffect', (actor:TwodsixActor, change:any, current: any, _delta: any) => {
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
  foundry.utils.setProperty(actor, change.key, update);
});

Hooks.on(`renderActiveEffectConfig`, (app, _html, _data) => {
  app.setPosition({width: 700});
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
