// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../module/config";
import { applyToAllActors } from "../module/utils/migration-utils";

async function refactorConditions (actor: TwodsixActor): Promise<void> {
  const encumberedEffect = actor.effects.find(eff => [game.i18n.localize(TWODSIX.effectType.encumbered), "Encumbered"].includes(eff.name));
  if (encumberedEffect) {
    const changeData = { key: "system.conditions.encumberedEffect", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: encumberedEffect.changes[0].value };
    await actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: encumberedEffect.id, changes: [changeData] }]);
  }

  const woundedEffect = actor.effects.find(eff => [game.i18n.localize(TWODSIX.effectType.wounded), "Wounded"].includes(eff.name));
  if (woundedEffect) {
    const changeData = { key: "system.conditions.woundedEffect", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: woundedEffect.changes[0].value };
    await actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: woundedEffect.id, changes: [changeData] }]);
  }
}

export async function migrate(): Promise<void> {
  await applyToAllActors(refactorConditions);

  return Promise.resolve();
}
