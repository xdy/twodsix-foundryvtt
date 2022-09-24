// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
import { getDamageCharacteristics } from "../utils/actorDamage";
import { mergeDeep } from "../utils/utils";
import {Traveller} from "../../types/template";

function getCurrentHits(actorType: string, ...args: Record<string, any>[]) {
  const characteristics = mergeDeep({}, ...args);
  const hitsCharacteristics: string[] = getDamageCharacteristics(actorType);

  return Object.entries(characteristics).reduce((hits, [key, chr]) => {
    if (hitsCharacteristics.includes(key)) {
      hits.value += chr.value-chr.damage;
      hits.max += chr.value;
    }
    return hits;
  }, {value: 0, max: 0});
}

Hooks.on('preUpdateActor', async (actor:TwodsixActor, update:Record<string, any>) => {
  if (update.system?.characteristics && (actor.type === 'traveller' || actor.type === 'animal')) {
    update.system.hits = getCurrentHits(actor.type, (<Traveller>actor.system).characteristics, update.system.characteristics);
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
