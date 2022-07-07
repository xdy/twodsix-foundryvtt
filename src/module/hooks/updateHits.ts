import TwodsixActor from "../entities/TwodsixActor";
import { getDamageCharacteristics } from "../utils/actorDamage";
import { mergeDeep } from "../utils/utils";
import {Traveller} from "../../types/template";

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
  if (update.system?.characteristics && actor.type=== 'traveller') {
    update.system.hits = getCurrentHits((<Traveller>actor.system).characteristics, update.system.characteristics);
  }
});

//Not needed???
/*
Hooks.on('preUpdateToken', async (token:Record<string, any>, update:Record<string, any>) => {
  if (update.actorData?.system?.characteristics) {
    if (token.actor?.type === 'traveller') {
      update.actorData.system.hits = getCurrentHits(
        (<Traveller>token.actor.system).characteristics,
        token.actorData.system.characteristics ?? {},
        update.actorData.system.characteristics
      );
    }
  }
});*/
