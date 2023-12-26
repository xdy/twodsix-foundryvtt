// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
//This hook applies CUSTOM active effects values as a formula that is evaluated and not a static
Hooks.on('applyActiveEffect', (actor:TwodsixActor, change:any, current: any, _delta: any) => {
  let update = 0;
  let changeFormula = change.value;
  if (foundry.utils.getType(changeFormula) !== 'string') {
    changeFormula = changeFormula.toString();
  }
  if (Roll.validate(changeFormula)) {
    const r = Roll.safeEval(Roll.replaceFormulaData(changeFormula, actor));
    const ct = foundry.utils.getType(current);
    switch ( ct ) {
      case "string": {
        if (Number.isInteger(Number.parseFloat(current))) {
          update = (parseInt(current) + parseInt(r));
        } else {
          update = Number.parseFloat(current) + r;
        }
        break;
      }
      case "number":
      {
        update = current + r;
        break;
      }
    }
  }
  foundry.utils.setProperty(actor, change.key, update);
});

Hooks.on(`renderActiveEffectConfig`, (app, _html, _data) => {
  app.setPosition({width: 700});
});
