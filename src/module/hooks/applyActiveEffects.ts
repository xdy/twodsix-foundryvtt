// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
//This hook applies CUSTOM active effects values as a formula that is evaluated and not a static
Hooks.on('applyActiveEffect', (actor:TwodsixActor, change:any, current: any, delta: any) => {
  //const r = new Roll(delta, actor);
  //r.evaluate({async: false});
  const r = Roll.safeEval(Roll.replaceFormulaData(delta, actor));
  const ct = foundry.utils.getType(current);
  let update = 0;
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
  foundry.utils.setProperty(actor, change.key, update);
});
