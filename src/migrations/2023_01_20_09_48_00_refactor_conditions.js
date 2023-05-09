import {applyToAllActors} from "../module/utils/migration-utils";
import {effectType} from "../module/hooks/showStatusIcons";

async function refactorConditions(actor) {

  const encumberedEffect = actor.effects.find(eff => eff.label === effectType.encumbered);
  if (encumberedEffect) {
    const changeData = {
      key: "system.conditions.encumberedEffect",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: encumberedEffect.changes[0].value
    };
    await actor.updateEmbeddedDocuments('ActiveEffect', [{_id: encumberedEffect.id, changes: [changeData]}]);
  }

  const woundedEffect = actor.effects.find(eff => eff.label === effectType.wounded);
  if (woundedEffect) {
    const changeData = {
      key: "system.conditions.woundedEffect",
      mode: CONST.ACTIVE_EFFECT_MODES.ADD,
      value: woundedEffect.changes[0].value
    };
    await actor.updateEmbeddedDocuments('ActiveEffect', [{_id: woundedEffect.id, changes: [changeData]}]);
  }
}

export async function migrate() {
  await applyToAllActors(refactorConditions);

  return Promise.resolve();
}
