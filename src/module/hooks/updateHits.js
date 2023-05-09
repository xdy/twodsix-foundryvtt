import {getDamageCharacteristics} from "../utils/actorDamage";
import {mergeDeep} from "../utils/utils";

async function getCurrentHits(actorType, ...args) {
  const characteristics = mergeDeep({}, ...args);
  const hitsCharacteristics = getDamageCharacteristics(actorType);
  return Object.entries(characteristics).reduce((hits, [key, chr]) => {
    if (hitsCharacteristics.includes(key)) {
      hits.value += chr.value - chr.damage;
      hits.max += chr.value;
    }
    return hits;
  }, {value: 0, max: 0, lastDelta: 0});
}

Hooks.on('preUpdateActor', async (actor, update) => {
  if (update.system?.characteristics && (["traveller", "animal", "robot"].includes(actor.type))) {
    update.system.hits = await getCurrentHits(actor.type, actor.system.characteristics, update.system.characteristics);
    await Object.assign(update.system.hits, {lastDelta: actor.system.hits.value - update.system.hits.value});
    if (update.system.hits.lastDelta !== 0 && game.settings.get("twodsix", "showHitsChangesInChat")) {
      const appliedType = update.system.hits.lastDelta > 0 ? game.i18n.localize("TWODSIX.Actor.damage") : game.i18n.localize("TWODSIX.Actor.healing");
      const actionWord = game.i18n.localize("TWODSIX.Actor.Applied");
      ChatMessage.create({
        flavor: `${actionWord} ${appliedType}: ${Math.abs(update.system.hits.lastDelta)}`,
        speaker: ChatMessage.getSpeaker({actor: actor}),
        whisper: ChatMessage.getWhisperRecipients("GM")
      });
    }
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
