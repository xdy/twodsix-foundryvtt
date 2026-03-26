import { applyToAllActors, applyToAllItems } from "../module/utils/migration-utils";

async function resetActorDisabled(actor) {
  if (["traveller", "animal", "robot"].includes(actor.type)) {
    const applicableEffects = Array.from(actor.allApplicableEffects());
    for (const effect of applicableEffects) {
      if (effect.parent?.documentName === 'Item' && (effect.disabled || !effect.transfer)) {
        await effect.update({'disabled': false, transfer: game.settings.get('twodsix', 'useItemActiveEffects')});
      }
    }
  }
}

async function resetItemDisabled(item) {
  for (const effect of item.effects.contents) {
    if (effect.disabled || !effect.transfer) {
      await effect.update({'disabled': false, transfer: game.settings.get('twodsix', 'useItemActiveEffects')});
    }
  }
}

export async function migrate() {
  await applyToAllActors(resetActorDisabled);
  await applyToAllItems(resetItemDisabled);
  console.log("Disabled Migration Complete");
  return Promise.resolve();
}
