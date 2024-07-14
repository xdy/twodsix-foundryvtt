// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";

export function updateFinances(actor:TwodsixActor, update:Record<string, any>, financeDiff:any): void {
  if (["traveller"].includes(actor.type)) {
    if (Object.keys(financeDiff.finances).length > 0) {
      updateFinanceValues(actor, update, financeDiff);
    } else if (Object.keys(financeDiff.financeValues).length > 0) {
      updateFinanceText(actor, update, financeDiff);
    }
  }
}

function updateFinanceValues(actor:TwodsixActor, update:Record<string, any>, financeDiff:any) {
  const updateMods = {};
  for (const financeField in financeDiff.finances) {
    if (financeField !== "financial-notes") {
      const isDelta:boolean = ["+", "-"].includes(update.system.finances[financeField][0]);

      if (isDelta) {
        const delta = getParsedFinanceText(update.system.finances[financeField]);
        foundry.utils.mergeObject(updateMods, {financeValues: {[financeField]: actor.system.financeValues[financeField] + (parseFloat(delta.num) * getMultiplier(delta.units))}}) ;
        const parsedText = getParsedFinanceText(actor.system.finances[financeField]);
        foundry.utils.mergeObject(updateMods, {finances: {[financeField]: convertNumberToFormatedText(updateMods.financeValues[financeField], (getMultiplier(parsedText.units) > getMultiplier(delta.units) ? parsedText.units : delta.units))}});
      } else {
        const parsedText = getParsedFinanceText(update.system.finances[financeField]);
        if (parsedText) {
          foundry.utils.mergeObject(updateMods, {financeValues: {[financeField]: parseLocaleNumber(parsedText.num) * getMultiplier(parsedText.units)}});
        }
      }
    }
  }
  foundry.utils.mergeObject(update.system, updateMods);
}

function updateFinanceText(actor:TwodsixActor, update:Record<string, any>, financeDiff:any) {
  const financeTextUpdates = {};
  for (const financeField in financeDiff.financeValues) {
    const parsedText = getParsedFinanceText(actor.system.finances[financeField]);
    const newValue = financeDiff.financeValues[financeField];
    foundry.utils.mergeObject(financeTextUpdates, {[financeField]: convertNumberToFormatedText(newValue, parsedText.units)});
  }
  foundry.utils.mergeObject(update.system, {finances: financeTextUpdates});
}

/**
 * Parse a localized number to a float.
 * @param {number} newValue - the new value
 * @param {string} units -  any units for the number, e.g. M or k
 * @returns {string} - the localized number as a string
 */
function convertNumberToFormatedText(newValue: number, units?:string): string {
  const numberDigits = newValue === 0 ? 1 : Math.floor(Math.log10(Math.abs(newValue))) + 1;
  if (units) {
    newValue /= getMultiplier(units);
  }
  return ''.concat(newValue.toLocaleString(game.i18n.lang, {minimumSignificantDigits: numberDigits}), (units ? ' ' + units : ''));
}

/**
 * Parse a localized number to a float.
 * @param {string} stringNumber - the localized number
 * @returns {number} - the float value of localized number
 */
export function parseLocaleNumber(stringNumber:string): number {
  if (stringNumber) {
    const thousandSeparator = Intl.NumberFormat(game.i18n.lang).formatToParts(11111)[1].value;
    const decimalSeparator = Intl.NumberFormat(game.i18n.lang).formatToParts(1.1)[1].value;

    return parseFloat(stringNumber
      .replace(new RegExp('\\' + thousandSeparator, 'g'), '')
      .replace(new RegExp('\\' + decimalSeparator), '.')
    );
  } else {
    return NaN;
  }
}

/**
 * Parse a finance text field into separate value and units.
 * @param {string} financeString - the localized number
 * @returns {Record<any>} - object with keys num and units
 */
export function getParsedFinanceText(financeString: string): Record<string, any> | undefined {
  const re = new RegExp(/^(?<pre>\D*?)(?<num>[0-9,.\-+]*)(?<sp>\s*)(?<units>.*?)$/);
  const parsedResult: RegExpMatchArray | null = re.exec(financeString);
  return parsedResult?.groups;
}

/**
 * Lookup the first letter of units and determine magnitude
 * @param {string} units - the units
 * @returns number - magnitude for units
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
