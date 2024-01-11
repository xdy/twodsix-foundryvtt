// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

export async function applyToAllActors(fn: ((actor:TwodsixActor) => Promise<void>)): Promise<void> {
  const allActors = (game.actors?.contents ?? []) as TwodsixActor[];

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor && !token.actorLink) {
        allActors.push(token.actor as TwodsixActor);
      }
    }
  }

  for (const actor of allActors) {
    await fn(actor);
  }

  const actorPacks = game.packs.filter(pack => pack.metadata.type === 'Actor' && pack.metadata.packageType !== 'system');
  await applyToAllPacks(fn, actorPacks);

  return Promise.resolve();
}

export async function applyToAllItems(fn: ((item:TwodsixItem) => Promise<void>)): Promise<void> {
  const itemPacks = game.packs.filter(pack => pack.metadata.type === 'Item' && pack.metadata.packageType !== 'system');
  await applyToAllPacks(fn, itemPacks);

  const allItems = (game.items?.contents ?? []) as TwodsixItem[];
  for (const item of allItems) {
    await fn(item);
  }

  return Promise.resolve();

}

async function applyToAllPacks(fn: ((doc: TwodsixActor | TwodsixItem) => Promise<void>), packs:Compendium[]): Promise<void> {
  for (const pack of packs) {
    const wasLocked = pack.locked;
    if (pack.locked) {
      await pack.configure({locked: false});
    }
    for (const doc of await pack.getDocuments()) {
      await fn(doc);
    }
    if (wasLocked) {
      await pack.configure({locked: true});
    }
  }
}
