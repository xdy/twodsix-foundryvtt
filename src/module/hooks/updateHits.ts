import TwodsixActor from "../entities/TwodsixActor";
import { mergeDeep } from "../utils/utils";

function getCurrentHits(target: Record<string, any>, ...args: Record<string, any>[]) {
  const characteristics = mergeDeep(target, ...args);
  const hitsCharacteristics = ["strength", "dexterity", "endurance"];

  return Object.entries(characteristics).reduce((hits, [key, chr]) => {
    if (hitsCharacteristics.includes(key)) {
      hits.value += chr.value-chr.damage;
      hits.max += chr.value;
    }
    return hits;
  }, {value: 0, max: 0});
}

Hooks.on('preUpdateActor', async (actor:TwodsixActor, update:Record<string, any>) => {
  if (update.data?.characteristics) {
    update.data.hits =getCurrentHits(actor.data.data.characteristics, update.data.characteristics);
  }
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on('preUpdateToken', async (scene, token:Record<string, any>, update:Record<string, any>) => {
  if (update.actorData?.data?.characteristics) {
    const actor = TwodsixActor.collection.get(token.actorId);
    update.actorData.data.hits = getCurrentHits(
      actor.data.data.characteristics,
      token.actorData.data.characteristics,
      update.actorData.data.characteristics
    );
  }
});
