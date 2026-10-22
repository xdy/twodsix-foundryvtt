/** @typedef {import("../entities/TwodsixActor").default} TwodsixActor */
import { TravellerData } from '../data/actors/travellerData.js';
import { parseLocaleNumber } from '../data/commonSchemaUtils.js';

/**
 * Update the finances for a traveller actor based on the provided financeDiff.
 * Delegates to value or text update functions as appropriate.
 * @param {TwodsixActor} actor - The actor whose finances are being updated.
 * @param {Record<string, any>} update - The update object to be merged.
 * @param {any} financeDiff - The difference object containing finance changes.
 */
export function updateFinances(actor, update, financeDiff) {
  if (["traveller"].includes(actor.type)) {
    if (!foundry.utils.isEmpty(financeDiff.finances)) {
      updateFinanceValues(actor, update, financeDiff);
    } else if (!foundry.utils.isEmpty(financeDiff.financeValues)) {
      updateFinanceText(actor, update, financeDiff);
    }
  }
}

/**
 * Update the finances for a ship actor based on the provided financeDiff.
 * @param {TwodsixActor} actor - The ship actor whose finances are being updated.
 * @param {Record<string, any>} update - The update object to be merged.
 * @param {any} financeDiff - The difference object containing finance changes.
 */
export function updateShipFinances(actor, update, financeDiff) {
  if (["ship"].includes(actor.type)) {
    if (financeDiff.financesCash) {
      foundry.utils.mergeObject(update.system, {commonFunds: financeDiff.financesCash / 1e6});
    } else if (financeDiff.commonFunds) {
      foundry.utils.mergeObject(update.system, {financeValues: {cash: financeDiff.commonFunds * 1e6}});
    }
  }
}

/**
 * Update finance values for an actor, handling both delta and absolute changes.
 * @param {TwodsixActor} actor - The actor whose finances are being updated.
 * @param {Record<string, any>} update - The update object to be merged.
 * @param {any} financeDiff - The difference object containing finance changes.
 */
/**
 * Update finance values for an actor, handling both delta and absolute changes.
 * @param {TwodsixActor} actor - The actor whose finances are being updated.
 * @param {Record<string, any>} update - The update object to be merged.
 * @param {any} financeDiff - The difference object containing finance changes.
 */
function updateFinanceValues(actor, update, financeDiff) {
  // Guard against missing financial update targets in partial payloads
  if (!financeDiff?.finances || !update?.system?.finances) return;

  const updateMods = { financeValues: {}, finances: {} };

  // Correctly use financeDiff to target ONLY fields that the user actively changed
  for (const financeField in financeDiff.finances) {
    if (financeField === "financial-notes") continue;

    const rawInput = update.system.finances[financeField]?.trim();
    if (typeof rawInput !== "string" || !rawInput) continue;

    const delta = TravellerData.getParsedFinanceText(rawInput);
    if (!delta) continue; // Safety check for regex extraction matches

    const isDelta = ["+", "-"].includes(rawInput[0]);
    const currentVal = actor.system.financeValues?.[financeField] || 0;

    if (isDelta) {
      updateMods.financeValues[financeField] = currentVal + (parseFloat(delta.num) * TravellerData.getMultiplier(delta.units));

      const parsedText = TravellerData.getParsedFinanceText(actor.system.finances?.[financeField] || "0");
      const currentUnits = parsedText?.units || "";

      updateMods.finances[financeField] = TravellerData.convertNumberToFormattedText(
        updateMods.financeValues[financeField],
        (TravellerData.getMultiplier(currentUnits) > TravellerData.getMultiplier(delta.units) ? currentUnits : delta.units)
      );
    } else {
      updateMods.financeValues[financeField] = parseLocaleNumber(delta.num) * TravellerData.getMultiplier(delta.units);
      updateMods.finances[financeField] = TravellerData.convertNumberToFormattedText(updateMods.financeValues[financeField], delta.units);
    }
  }

  // Safely pack the updates into the system payload
  foundry.utils.mergeObject(update.system, updateMods);
}

/**
 * Update finance text fields for an actor based on new values.
 * @param {TwodsixActor} actor - The actor whose finances are being updated.
 * @param {Record<string, any>} update - The update object to be merged.
 * @param {any} financeDiff - The difference object containing finance changes.
 */
function updateFinanceText(actor, update, financeDiff) {
  const financeTextUpdates = {};
  for (const financeField in financeDiff.financeValues) {
    const parsedText = TravellerData.getParsedFinanceText(actor.system.finances[financeField] || "0");
    const newValue = financeDiff.financeValues[financeField];
    foundry.utils.mergeObject(financeTextUpdates, {
      [financeField]: TravellerData.convertNumberToFormattedText(newValue, parsedText?.units)
    });
  }
  foundry.utils.mergeObject(update.system, {finances: financeTextUpdates});
}

