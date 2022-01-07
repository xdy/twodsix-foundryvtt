import TwodsixActor from "src/module/entities/TwodsixActor";
import Trait = dataTwodsix.Trait;

async function applyActiveEffects(actor:TwodsixActor) {
  for (const item of actor.items.filter((itm:TwodsixItem) => itm.type === "trait")) {
    if (!(<Trait>item.data.data).effectId) {
      const effects = await actor.createEmbeddedDocuments("ActiveEffect", [{
        origin: item.uuid,
        icon: item.img
      }]);
      await item.update({ "data.effectId": effects[0].id });
    }
  }
  return Promise.resolve();
}

export async function migrate(): Promise<void> {
  const allActors = (game.actors?.filter(actor => actor.type === 'traveller') ?? []) as unknown as TwodsixActor[];
	
	for (const scene of game.scenes ?? []) {
		for (const token of scene.tokens ?? []) {
			if (token.actor && !token.data.actorLink && token.actor.type === 'traveller') {
				allActors.push(token.actor as TwodsixActor);
			}
		}
	}

	// @ts-expect-error The type definitions for metadata must be updated to support "type"
	const actorPacks = game.packs.filter(pack => pack.metadata.type === 'Actor' && !pack.locked);
	for (const pack of actorPacks) {
    for (const actor of await pack.getDocuments()) {
      allActors.push(actor as unknown as TwodsixActor);
    }
	}

	for (const actor of allActors) {
		await applyActiveEffects(actor);
	}

	return Promise.resolve();
}