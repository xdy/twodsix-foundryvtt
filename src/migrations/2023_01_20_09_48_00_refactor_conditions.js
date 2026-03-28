import { TWODSIX } from '../module/config';
import { applyToAllActors } from '../module/utils/migration-utils';

async function refactorConditions(actor) {
  const encumberedEffect = actor.effects.find(eff => [game.i18n.localize(TWODSIX.effectType.encumbered), "Encumbered"].includes(eff.name));
  if (encumberedEffect) {
    const changeData = { key: "system.conditions.encumberedEffect", type: "add", value: encumberedEffect.system.changes[0].value };
    await actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: encumberedEffect.id, 'system.changes': [changeData] }]);
  }

  const woundedEffect = actor.effects.find(eff => [game.i18n.localize(TWODSIX.effectType.wounded), "Wounded"].includes(eff.name));
  if (woundedEffect) {
    const changeData = { key: "system.conditions.woundedEffect", type: "add", value: woundedEffect.system.changes[0].value };
    await actor.updateEmbeddedDocuments('ActiveEffect', [{ _id: woundedEffect.id, 'system.changes': [changeData] }]);
  }
}

export async function migrate() {
  await applyToAllActors(refactorConditions);

  return Promise.resolve();
}
