// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllActors } from "../module/utils/migration-utils";
import { effectType } from "../module/hooks/showStatusIcons";

async function refactorConditions (actor: TwodsixActor): Promise<void> {

  const encumberedEffect = actor.effects.find(eff => [game.i18n.localize(effectType.encumbered), "Encumbered"].includes(eff.name));
  if (encumberedEffect) {
    const changeData = { key: "system.conditions.encumberedEffect", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: encumberedEffect.changes[0].value };
    await actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: encumberedEffect.id, changes: [changeData] }]);
  }

  const woundedEffect = actor.effects.find(eff => [game.i18n.localize(effectType.wounded), "Wounded"].includes(eff.name));
  if (woundedEffect) {
    const changeData = { key: "system.conditions.woundedEffect", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: woundedEffect.changes[0].value };
    await actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: woundedEffect.id, changes: [changeData] }]);
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(refactorConditions);

  return Promise.resolve();
}
