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
function updateFinanceValues(actor, update, financeDiff) {
  const updateMods = {};
  for (const financeField in financeDiff.finances) {
    if (financeField !== "financial-notes") {
      const isDelta = ["+", "-"].includes(update.system.finances[financeField][0]);

      if (isDelta) {
        const delta = TravellerData.getParsedFinanceText(update.system.finances[financeField]);
        foundry.utils.mergeObject(updateMods, {
          financeValues: {
            [financeField]: actor.system.financeValues[financeField] + (parseFloat(delta.num) * TravellerData.getMultiplier(delta.units))
          }
        });
        const parsedText = TravellerData.getParsedFinanceText(actor.system.finances[financeField]);
        foundry.utils.mergeObject(updateMods, {
          finances: {
            [financeField]: TravellerData.convertNumberToFormattedText(
              updateMods.financeValues[financeField],
              (TravellerData.getMultiplier(parsedText.units) > TravellerData.getMultiplier(delta.units) ? parsedText.units : delta.units)
            )
          }
        });
      } else {
        const parsedText = TravellerData.getParsedFinanceText(update.system.finances[financeField]);
        if (parsedText) {
          foundry.utils.mergeObject(updateMods, {
            financeValues: {
              [financeField]: parseLocaleNumber(parsedText.num) * TravellerData.getMultiplier(parsedText.units)
            }
          });
        }
      }
    }
  }
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
    const parsedText = TravellerData.getParsedFinanceText(actor.system.finances[financeField]);
    const newValue = financeDiff.financeValues[financeField];
    foundry.utils.mergeObject(financeTextUpdates, {
      [financeField]: TravellerData.convertNumberToFormattedText(newValue, parsedText.units)
    });
  }
  foundry.utils.mergeObject(update.system, {finances: financeTextUpdates});
}

