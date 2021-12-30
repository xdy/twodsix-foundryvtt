import TwodsixActor from "../entities/TwodsixActor";
import { getDamageCharacteristics } from "../utils/actorDamage";
import { mergeDeep } from "../utils/utils";
import Traveller = dataTwodsix.Traveller;

function getCurrentHits(...args: Record<string, any>[]) {
  const characteristics = mergeDeep({}, ...args);
  const hitsCharacteristics: string[] = getDamageCharacteristics();

  return Object.entries(characteristics).reduce((hits, [key, chr]) => {
    if (hitsCharacteristics.includes(key)) {
      hits.value += chr.value-chr.damage;
      hits.max += chr.value;
    }
    return hits;
  }, {value: 0, max: 0});
}

Hooks.on('preUpdateActor', async (actor:TwodsixActor, update:Record<string, any>) => {
  if (update.data?.characteristics && actor.type=== 'traveller') {
    update.data.hits = getCurrentHits((<Traveller>actor.data.data).characteristics, update.data.characteristics);
  }
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on('preUpdateToken', async (scene, token:Record<string, any>, update:Record<string, any>) => {
  if (update.actorData?.data?.characteristics) {
    const actor = <TwodsixActor><unknown>game.actors?.get(token.actorId);
    if (actor && actor.type === 'traveller') {
      update.actorData.data.hits = getCurrentHits(
        (<Traveller>actor.data.data).characteristics,
        token.actorData?.data?.characteristics ?? {},
        update.actorData.data.characteristics
      );
    }
  }
});
