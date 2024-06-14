// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";

export function updateFinances(actor:TwodsixActor, update:Record<string, any>, financeDiff:any): void {
  if (["traveller"].includes(actor.type)) {
    if (Object.keys(financeDiff.finances).length > 0) {
      updateFinanceValues(update, financeDiff);
    } else if (Object.keys(financeDiff.financeValues).length > 0) {
      updateFinanceText(actor, update, financeDiff);
    }
  }
}

function updateFinanceValues(update:Record<string, any>, financeDiff:any) {
  const financeValueUpdates = {};
  for (const financeField in financeDiff.finances) {
    if (financeField !== "financial-notes") {
      const parsedText = getParsedFinanceText(update.system.finances[financeField]);
      if (parsedText) {
        const newValue = parseLocaleNumber(parsedText.num) * getMultiplier(parsedText.units);
        Object.assign(financeValueUpdates, {[financeField]: newValue});
      }
    }
  }
  Object.assign(update.system, {financeValues: financeValueUpdates});
}

function updateFinanceText(actor:TwodsixActor, update:Record<string, any>, financeDiff:any) {
  const financeTextUpdates = {};
  for (const financeField in financeDiff.financeValues) {
    const parsedText = getParsedFinanceText(actor.system.finances[financeField]);
    let newValue = financeDiff.financeValues[financeField];
    const numberDigits = newValue === 0 ? 1 : Math.floor(Math.log10(Math.abs(newValue))) + 1;
    if (parsedText?.units) {
      newValue /= getMultiplier(parsedText.units);
    }
    const newText = ''.concat(newValue.toLocaleString(game.i18n.lang, {minimumSignificantDigits: numberDigits}), (parsedText?.units ? ' ' + parsedText.units : ''));
    Object.assign(financeTextUpdates, {[financeField]: newText});
  }
  Object.assign(update.system, {finances: financeTextUpdates});
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
