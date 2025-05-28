// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";

/**
 * Update the finances for a traveller actor based on the provided financeDiff.
 * Delegates to value or text update functions as appropriate.
 * @param {TwodsixActor} actor - The actor whose finances are being updated.
 * @param {Record<string, any>} update - The update object to be merged.
 * @param {any} financeDiff - The difference object containing finance changes.
 */
export function updateFinances(actor: TwodsixActor, update: Record<string, any>, financeDiff: any): void {
  if (["traveller"].includes(actor.type)) {
    if (Object.keys(financeDiff.finances).length > 0) {
      updateFinanceValues(actor, update, financeDiff);
    } else if (Object.keys(financeDiff.financeValues).length > 0) {
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
export function updateShipFinances(actor: TwodsixActor, update: Record<string, any>, financeDiff: any): void {
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
function updateFinanceValues(actor: TwodsixActor, update: Record<string, any>, financeDiff: any): void {
  const updateMods = {};
  for (const financeField in financeDiff.finances) {
    if (financeField !== "financial-notes") {
      const isDelta: boolean = ["+", "-"].includes(update.system.finances[financeField][0]);

      if (isDelta) {
        const delta = getParsedFinanceText(update.system.finances[financeField]);
        foundry.utils.mergeObject(updateMods, {
          financeValues: {
            [financeField]: actor.system.financeValues[financeField] + (parseFloat(delta.num) * getMultiplier(delta.units))
          }
        });
        const parsedText = getParsedFinanceText(actor.system.finances[financeField]);
        foundry.utils.mergeObject(updateMods, {
          finances: {
            [financeField]: convertNumberToFormatedText(
              updateMods.financeValues[financeField],
              (getMultiplier(parsedText.units) > getMultiplier(delta.units) ? parsedText.units : delta.units)
            )
          }
        });
      } else {
        const parsedText = getParsedFinanceText(update.system.finances[financeField]);
        if (parsedText) {
          foundry.utils.mergeObject(updateMods, {
            financeValues: {
              [financeField]: parseLocaleNumber(parsedText.num) * getMultiplier(parsedText.units)
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
function updateFinanceText(actor: TwodsixActor, update: Record<string, any>, financeDiff: any): void {
  const financeTextUpdates = {};
  for (const financeField in financeDiff.financeValues) {
    const parsedText = getParsedFinanceText(actor.system.finances[financeField]);
    const newValue = financeDiff.financeValues[financeField];
    foundry.utils.mergeObject(financeTextUpdates, {
      [financeField]: convertNumberToFormatedText(newValue, parsedText.units)
    });
  }
  foundry.utils.mergeObject(update.system, { finances: financeTextUpdates });
}

/**
 * Convert a number to a localized string with optional units.
 * @param {number} newValue - The new value to format.
 * @param {string} [units] - Optional units for the number, e.g. 'M' or 'k'.
 * @returns {string} - The localized number as a string, with units if provided.
 */
function convertNumberToFormatedText(newValue: number, units?: string): string {
  const numberDigits = newValue === 0 ? 1 : Math.floor(Math.log10(Math.abs(newValue))) + 1;
  if (units) {
    newValue /= getMultiplier(units);
  }
  return ''.concat(
    newValue.toLocaleString(game.i18n.lang, { minimumSignificantDigits: numberDigits }),
    (units ? ' ' + units : '')
  );
}

/**
 * Parse a localized number string to a float.
 * @param {string} stringNumber - The localized number string.
 * @returns {number} - The float value of the localized number.
 */
export function parseLocaleNumber(stringNumber: string): number {
  if (stringNumber) {
    const thousandSeparator = Intl.NumberFormat(game.i18n.lang).formatToParts(11111)[1].value;
    const decimalSeparator = Intl.NumberFormat(game.i18n.lang).formatToParts(1.1)[1].value;

    return parseFloat(
      stringNumber
        .replace(new RegExp('\\' + thousandSeparator, 'g'), '')
        .replace(new RegExp('\\' + decimalSeparator), '.')
    );
  } else {
    return NaN;
  }
}

/**
 * Parse a finance text field into separate value and units.
 * @param {string} financeString - The finance string to parse.
 * @returns {Record<string, any> | undefined} - Object with keys num and units, or undefined if parsing fails.
 */
export function getParsedFinanceText(financeString: string): Record<string, any> | undefined {
  const re = new RegExp(/^(?<pre>\D*?)(?<num>[0-9,.\-+]*)(?<sp>\s*)(?<units>.*?)$/);
  const parsedResult: RegExpMatchArray | null = re.exec(financeString);
  return parsedResult?.groups;
}

/**
 * Lookup the first letter of units and determine magnitude.
 * @param {string} units - The units string (e.g., 'M', 'k', 'G').
 * @returns {number} - The numeric multiplier for the units.
 */
export function getMultiplier(units: string): number {
  switch (units[0]) {
    case 'G':
      return 1e+9;
    case 'M':
      return 1e+6;
    case 'k':
    case 'K':
      return 1e+3;
    default:
      return 1;
  }
}
