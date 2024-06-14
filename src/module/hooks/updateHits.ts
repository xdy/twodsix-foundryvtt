// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
import { getDamageCharacteristics } from "../utils/actorDamage";
//import { mergeDeep } from "../utils/utils";
import {Traveller} from "../../types/template";

function getCurrentHits(actorType: string, current: Record<string, any>[], diff: Record<string, any>[]) {
  const characteristics = foundry.utils.mergeObject(current, diff);
  const hitsCharacteristics: string[] = getDamageCharacteristics(actorType);

  return Object.entries(characteristics).reduce((hits, [key, chr]) => {
    if (hitsCharacteristics.includes(key)) {
      hits.value += chr.value-chr.damage;
      hits.max += chr.value;
    }
    return hits;
  }, {value: 0, max: 0, lastDelta: 0});
}

export function updateHits(actor:TwodsixActor, update:Record<string, any>, charDiff:any): number {
  update.system.hits = getCurrentHits(actor.type, (<Traveller>actor.system).characteristics, charDiff);
  const deltaHits = actor.system.hits.value - update.system.hits.value;
  //Object.assign(update.system.hits, {lastDelta: deltaHits});
  if (deltaHits !== 0 && game.settings.get("twodsix", "showHitsChangesInChat")) {
    const appliedType = deltaHits > 0 ? game.i18n.localize("TWODSIX.Actor.damage") : game.i18n.localize("TWODSIX.Actor.healing");
    const actionWord = game.i18n.localize("TWODSIX.Actor.Applied");
    ChatMessage.create({ flavor: `${actionWord} ${appliedType}: ${Math.abs(deltaHits)}`, speaker: ChatMessage.getSpeaker({ actor: actor }), whisper: ChatMessage.getWhisperRecipients("GM") });
  }
  return deltaHits;
};
