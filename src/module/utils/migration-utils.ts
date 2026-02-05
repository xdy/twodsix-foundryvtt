// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

const BATCH_SIZE = 100;

/**
 * Helper to process documents in either legacy or batch mode
 */
async function processDocuments<T extends TwodsixActor | TwodsixItem>(
  documents: T[],
  fn: (doc: T) => void | Record<string, any> | Promise<void | Record<string, any>>,
  options: { batch?: boolean } = {}
): Promise<Array<{ _id: string; [key: string]: any }>> {
  if (options.batch) {
    const updates: Array<{ _id: string; [key: string]: any }> = [];
    for (const doc of documents) {
      const result = fn(doc);
      // Handle both sync and async results
      const resolved = result instanceof Promise ? await result : result;
      if (resolved && typeof resolved === 'object') {
        updates.push({ _id: doc.id, ...resolved });
      }
    }
    return updates;
  } else {
    // Legacy mode: call function directly (it handles updates)
    for (const doc of documents) {
      await fn(doc);
    }
    return [];
  }
}

/**
 * Helper to apply batched updates
 */
async function applyBatchedUpdates(
  updates: Array<{ _id: string; [key: string]: any }>,
  DocumentClass: typeof Actor | typeof Item,
  packCollection?: string
): Promise<void> {
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    await DocumentClass.updateDocuments(batch, packCollection ? { pack: packCollection } : {});
  }
}

/**
 * Applies a function to all TwodsixActor instances in the world and in compendium packs (if they can be unlocked).
 * Includes actors from the world, unlinked tokens in all scenes, and all actor compendiums.
 * Errors in packs are caught and logged.
 *
 * @param fn - A function (sync or async) to apply to each TwodsixActor. Can either:
 *             - Return void and call actor.update() itself (old behavior)
 *             - Return an update object to be batched (new batching behavior)
 * @param options - Optional configuration
 * @param options.batch - If true, collects updates and applies them in batches. Default: false
 * @returns A promise that resolves when all actors and packs have been processed.
 */
export async function applyToAllActors(
  fn: ((actor:TwodsixActor) => void | Record<string, any> | Promise<void | Record<string, any>>),
  options: { batch?: boolean } = {}
): Promise<void> {
  const validActorTypes = Object.keys(CONFIG.Actor.dataModels);
  const allActors = (game.actors?.filter(act => validActorTypes.includes(act.type)) ?? []) as TwodsixActor[];

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor && !token.actorLink && validActorTypes.includes(token.actor.type)) {
        allActors.push(token.actor as TwodsixActor);
      }
    }
  }

  const updates = await processDocuments(allActors, fn, options);
  if (options.batch && updates.length > 0) {
    await applyBatchedUpdates(updates, Actor);
  }

  const actorPacks = game.packs.filter(pack => pack.metadata.type === 'Actor' && pack.metadata.packageType !== 'system');
  await applyToAllPacks(fn, actorPacks, options);
}

/**
 * Applies a function to all TwodsixItem instances in the world and in compendium packs that can be unlocked.
 * Includes items from the world and all item compendiums.
 * Errors in individual packs are caught and logged.
 *
 * @param fn - A function (sync or async) to apply to each TwodsixItem. Can either:
 *             - Return void and call item.update() itself (old behavior)
 *             - Return an update object to be batched (new batching behavior)
 * @param options - Optional configuration
 * @param options.batch - If true, collects updates and applies them in batches. Default: false
 * @returns A promise that resolves when all items and packs have been processed.
 */
export async function applyToAllItems(
  fn: ((item:TwodsixItem) => void | Record<string, any> | Promise<void | Record<string, any>>),
  options: { batch?: boolean } = {}
): Promise<void> {
  const validItemsTypes = Object.keys(CONFIG.Item.dataModels);
  const allItems = (game.items?.filter(itm => validItemsTypes.includes(itm.type)) ?? []) as TwodsixItem[];

  const updates = await processDocuments(allItems, fn, options);
  if (options.batch && updates.length > 0) {
    await applyBatchedUpdates(updates, Item);
  }

  const itemPacks = game.packs.filter(pack => pack.metadata.type === 'Item' && pack.metadata.packageType !== 'system');
  await applyToAllPacks(fn, itemPacks, options);
}

/**
 * Applies a function to all documents (TwodsixActor or TwodsixItem) in the provided compendium packs.
 * Temporarily unlocks locked packs if possible, processes all documents, and relocks packs if they were originally locked.
 * Errors in unlocking, processing, or relocking packs and individual documents are caught and logged.
 *
 * @param fn - A function (sync or async) to apply to each document in the pack. Can either:
 *             - Return void and call doc.update() itself (old behavior)
 *             - Return an update object to be batched (new batching behavior)
 * @param packs - An array of compendium collections to process.
 * @param options - Optional configuration
 * @param options.batch - If true, collects updates and applies them in batches. Default: false
 * @returns A promise that resolves when all packs have been processed.
 */
async function applyToAllPacks(
  fn: ((doc: TwodsixActor | TwodsixItem) => void | Record<string, any> | Promise<void | Record<string, any>>),
  packs: CompendiumCollection[],
  options: { batch?: boolean } = {}
): Promise<void> {
  for (const pack of packs) {
    const wasLocked = pack.locked;
    try {
      if (pack.locked) {
        await pack.configure({ locked: false });
      }

      // Determine valid types based on pack metadata
      const validTypes = pack.metadata.type === 'Actor'
        ? Object.keys(CONFIG.Actor.dataModels)
        : pack.metadata.type === 'Item'
          ? Object.keys(CONFIG.Item.dataModels)
          : [];

      const docs = await pack.getDocuments();
      const validDocs = docs.filter(doc => {
        if (!validTypes.includes(doc.type)) {
          console.log(`Skipping document with invalid type in pack ${pack.collection}:`, doc);
          return false;
        }
        return true;
      });

      const updates: Array<{ _id: string; [key: string]: any }> = [];

      if (options.batch) {
        // Collect updates with error handling
        for (const doc of validDocs) {
          try {
            const result = fn(doc);
            // Handle both sync and async results
            const resolved = result instanceof Promise ? await result : result;
            if (resolved && typeof resolved === 'object') {
              updates.push({ _id: doc.id, ...resolved });
            }
          } catch (docError) {
            console.warn(`Error applying function to document in pack ${pack.collection}:`, docError);
          }
        }

        // Apply batched updates
        if (updates.length > 0) {
          const DocumentClass = pack.metadata.type === 'Actor' ? Actor : Item;
          await applyBatchedUpdates(updates, DocumentClass, pack.collection);
        }
      } else {
        // Legacy mode: call function directly with error handling
        for (const doc of validDocs) {
          try {
            await fn(doc);
          } catch (docError) {
            console.warn(`Error applying function to document in pack ${pack.collection}:`, docError);
          }
        }
      }

      if (wasLocked) {
        await pack.configure({ locked: true });
      }
    } catch (packError) {
      console.warn(`Error processing pack ${pack.collection}:`, packError);
    }
  }
}
