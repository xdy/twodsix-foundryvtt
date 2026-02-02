// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { TwodsixActiveEffect } from "src/module/entities/TwodsixActiveEffect";
import TwodsixActor from "../module/entities/TwodsixActor";
import TwodsixItem from "../module/entities/TwodsixItem";
import { applyToAllActors, applyToAllItems } from "../module/utils/migration-utils";
import { cleanSystemReferences } from '../module/utils/utils';

/**
 * Migrates a document's active effects by:
 * 1) updating AE phases using the determinePhase method.
 * 2) cleaning value formula references to remove @system. prefix
 * 3) migrate custom AE to standard FVTT mode
 * Processes active effects from actor or item in the world and compendium packs.
 * @param {Document} doc
 * @returns {Promise<void>} A promise that resolves when the migration is complete.
 */
async function updateActiveEffects(doc: TwodsixActor | TwodsixItem): Promise<void> {
  const isActor = doc.documentName === "Actor";
  const derivedKeys = isActor
    ? doc.getDerivedDataKeys()
    : [".mod", ".skills.", "primaryArmor.", "secondaryArmor.", "encumbrance.value", "radiationProtection."];

  const effectsList:TwodsixActiveEffect[] = (doc.documentName === "Actor"
    ? Array.from(doc.allApplicableEffects())
    : doc.effects?.contents)
    ?? [];

  if (!effectsList.length) {
    return;
  }

  for (const effect of effectsList) {
    if (!effect.system?.changes || foundry.utils.getType(effect.system?.changes) !== 'Array') {
      console.log(`No valid changes found for effect: ${effect.name} on ${doc.name}`);
      continue;
    }

    for (const change of effect.system.changes) {
      //console.log(`Processing change:`, change);

      if (!change.key || change.value === undefined || change.value === null || change.value === "") {
        console.warn(`Skipping invalid change:`, change);
        continue;
      }

      // Only migrate formulas and types for changes with type === 'custom'
      if (change.type === "custom" && (typeof change.value === "string" || typeof change.value === "number")) {
        migrateCustomChange(change);
      }

      const phase = determinePhase(change, derivedKeys, isActor);
      change.phase = phase;
    }

    try {
      await effect.update({ 'system.changes': effect.system.changes });
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
function determinePhase(change: any, derivedKeys: string[], isActor: boolean): string {
  // Remove leading 'system.' if present
  const key = change.key.startsWith('system.') ? change.key.slice(7) : change.key;
  if (key === "encumbrance.max") {
    return "encumbMax";
  } else if (change.type === "custom") {
    return "custom";
  }
  let isDerived = false;
  if (isActor) {
    // Exact match for actors (full keys)
    isDerived = derivedKeys.includes(key);
  } else {
    // Substring match for items (fallback patterns)
    isDerived = derivedKeys.some(dkey => key.includes(dkey));
  }
  if (isDerived) {
    return "derived";
  } else if (typeof change.value === "string" && derivedKeys.some(dkey => change.value.includes(dkey))) {
    return "derived";
  } else {
    return "initial";
  }
}

function migrateCustomChange(change: any): void {
  if (typeof change.value === "number") {
    change.type = "add";
    return;
  }

  if (typeof change.value !== "string") {
    console.warn(`Skipping change with unsupported value type:`, change);
    return;
  }

  change.value = cleanSystemReferences(change.value);
  const operator = change.value.trim().charAt(0);
  const operand = change.value.trim().slice(1).trim();
  const typeMap: Record<string, string> = {
    "+": "add",
    "-": "subtract",
    "*": "multiply",
    "=": "override"
  };

  if (operator === "/") {
    change.type = "multiply";
    change.value = `1/(${operand})`;
  } else if (operator in typeMap) {
    change.type = typeMap[operator];
    change.value = operand;
  } else {
    console.warn(`Unhandled operator: ${operator} in change value: ${change.value}`);
    change.type = "custom"; // Fallback to custom type
  }
}

export async function migrate(): Promise<void> {
  const validActorTypes = ["traveller", "animal", "robot"];
  const validItemTypes = ['equipment', 'weapon', 'armor', 'augment', 'tool', 'trait', 'consumable', 'computer'];

  // Process all actors
  await applyToAllActors(async (actor: TwodsixActor) => {
    if (validActorTypes.includes(actor.type)) {
      await updateActiveEffects(actor);
    }
  });

  // Process all items
  await applyToAllItems(async (item: TwodsixItem) => {
    if (validItemTypes.includes(item.type)) {
      await updateActiveEffects(item);
    }
  });
  console.log("AE Phase Migration Complete");
  return Promise.resolve();
}


