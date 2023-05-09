export async function applyToAllActors(fn) {
  const allActors = (game.actors?.contents ?? []);
  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor && !token.actorLink) {
        allActors.push(token.actor);
      }
    }
  }
  const actorPacks = game.packs.filter(pack => pack.metadata.type === 'Actor' && !pack.locked);
  for (const pack of actorPacks) {
    for (const actor of await pack.getDocuments()) {
      allActors.push(actor);
    }
  }
  for (const actor of allActors) {
    await fn(actor);
  }
  return Promise.resolve();
}

export async function applyToAllItems(fn) {
  const allItems = (game.items?.contents ?? []);
  const itemPacks = game.packs.filter(pack => pack.metadata.type === 'Item' && !pack.locked);
  for (const pack of itemPacks) {
    for (const item of await pack.getDocuments()) {
      allItems.push(item);
    }
  }
  for (const item of allItems) {
    await fn(item);
  }
  return Promise.resolve();
}
