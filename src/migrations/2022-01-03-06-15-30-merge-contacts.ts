import Traveller = dataTwodsix.Traveller;

async function mergeContacts(actor: TwodsixActor): Promise<void> {
	const actorData = actor.data.data as Traveller;
	const contacts = actorData.contacts;
	const allies = actorData.allies;
	const enemies = actorData.enemies;

	if (actor.type === 'traveller' && (allies || enemies)) {
		let contactAddition = '';

		if (contacts) {
			contactAddition += `Contacts:<br>${contacts}`;
		}

		if (allies) {
			contactAddition += `<br><br>Allies:<br>${allies}`;
		}

		if (enemies) {
			contactAddition += `<br><br>Enemies:<br>${enemies}`;
		}

		await actor.update({'data.contacts': contactAddition, 'data.allies': '', 'data.enemies': ''});
		return Promise.resolve();
	}

	return Promise.resolve();
}

export async function migrate(): Promise<void[]> {
	const allActors = game.actors?.contents.filter(actor => actor.type === 'traveller') ?? [] as TwodsixActor[];
	
	for (const scene of game.scenes ?? []) {
		for (const token of scene.tokens ?? []) {
			if (token.actor && !token.data.actorLink && token.actor.type === 'traveller') {
				allActors.push(token.actor);
			}
		}
	}

	const promisedActors = [] as Array<Promise<TwodsixActor[]>>;
	// @ts-expect-error The type definitions for metadata must be updated to support "type"
	const actorPacks = game.packs.filter(pack => pack.metadata.type === 'Actor' && !pack.locked);
	for (const pack of actorPacks) {
		const actors = pack.getDocuments() as Promise<TwodsixActor[]>;
		promisedActors.push(actors);
	}

	const flatPromisedActors = await Promise.all(promisedActors);
	const finalResults = [] as Array<Promise<void>>;
	for (const actor of allActors.concat(flatPromisedActors.flat())) {
		finalResults.push(mergeContacts(actor));
	}

	return Promise.all(finalResults);
}
