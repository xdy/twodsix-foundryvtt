// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import TwodsixActor from "../module/entities/TwodsixActor";
import TwodsixItem from "../module/entities/TwodsixItem";
import { applyToAllActors, applyToAllItems } from "../module/utils/migration-utils";

/**
 * Migrates a document's active effects by updating AE phases using the determinePhase method.
 * Processes active effects from actor or item in the world and compendium packs.
 * @param {Document} doc
 * @returns {Promise<void>} A promise that resolves when the migration is complete.
 */
async function updatePhasesForActiveEffects(doc: TwodsixActor | TwodsixItem): Promise<void> {
  const derivedKeys = doc.documentName === "Actor"
    ? doc.getDerivedDataKeys()
    : [".mod", ".skills.", "primaryArmor.", "secondaryArmor.", "encumbrance.value", "radiationProtection."];

  const effectsList = (doc.documentName === "Actor"
    ? Array.from(doc.allApplicableEffects())
    : doc.effects?.contents)
    ?? [];

  if (!effectsList.length) {
    return;
  }

  for (const effect of effectsList) {
    if (!effect.changes || !Array.isArray(effect.changes)) {
      console.log(`No valid changes found for effect: ${effect.name} on ${doc.name}`);
      continue;
    }

    for (const change of effect.changes) {
      const phase = determinePhase(change, doc.documentName === "Actor" ? doc : undefined, derivedKeys);
      change.phase = phase;
    }

    try {
      await effect.update({ changes: effect.changes });
      console.log(`Updated effect: ${effect.name} for document: ${doc.name}`);
    } catch (error) {
      console.error(`Failed to update effect: ${effect.name} for document: ${doc.name}`, error);
    }
  }
}

/**
 * Determines the phase of a change based on its key, type, and the actor's derived keys.
 *
 * @param {object} change - The change object being processed.
 * @param {TwodsixActor | undefined} actor - The actor associated with the change, if available.
 * @param {string[]} derivedKeys - A list of derived keys to compare against the change key.
 * @returns {string} - The phase of the change (e.g., "encumbMax", "custom", "derived", "initial").
 */
function determinePhase(change: any, actor: TwodsixActor | undefined, derivedKeys: string[]): string {
  if (change.key === "system.encumbrance.max") {
    return "encumbMax";
  } else if (change.type === "custom") {
    return "custom";
  } else if (actor) {
    return derivedKeys.includes(change.key) ? "derived" : "initial";
  } else if (derivedKeys.some(dkey => change.key.indexOf(dkey) >= 0)) {
    return "derived";
  } else {
    return "initial";
  }
}

export async function migrate(): Promise<void> {
  const validActorTypes = ["traveller", "animal", "robot"];
  const validItemTypes = ['equipment', 'weapon', 'armor', 'augment', 'tool', 'trait', 'consumable', 'computer'];

  // Process all actors
  await applyToAllActors(async (actor: TwodsixActor) => {
    if (validActorTypes.includes(actor.type)) {
      await updatePhasesForActiveEffects(actor);
    }
  });

  // Process all items
  await applyToAllItems(async (item: TwodsixItem) => {
    if (validItemTypes.includes(item.type)) {
      await updatePhasesForActiveEffects(item);
    }
  });
  console.log("AE Phase Migration Complete");
  return Promise.resolve();
}
