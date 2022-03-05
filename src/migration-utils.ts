export async function applyToAllActors(fn: ((actor:TwodsixActor) => Promise<void>)): Promise<void> {
  const allActors = (game.actors?.contents ?? []) as TwodsixActor[];

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor && !token.data.actorLink) {
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
    await fn(actor);
  }

  return Promise.resolve();
}

export async function applyToAllItems(fn: ((item:TwodsixItem) => Promise<void>)): Promise<void> {
  const allItems = (game.items?.contents ?? []) as TwodsixItem[];
  // @ts-expect-error The type definitions for metadata must be updated to support "type"
  const itemPacks = game.packs.filter(pack => pack.metadata.type === 'Item' && !pack.locked);
  for (const pack of itemPacks) {
    for (const item of await pack.getDocuments()) {
      allItems.push(item as unknown as TwodsixItem);
    }
  }

  for (const item of allItems) {
    await fn(item);
  }

  return Promise.resolve();

}
