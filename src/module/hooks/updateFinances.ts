// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";

export async function updateFinances(actor:TwodsixActor, update:Record<string, any>): Promise<void> {
  if (["traveller"].includes(actor.type)) {
    if (update.system?.finances) {
      await updateFinanceValues(update);
    } else if (update.system?.financeValues) {
      await updateFinanceText(actor, update);
    }
  }
}

async function updateFinanceValues(update:Record<string, any>) {
  for (const financeField in update.system.finances) {
    if (financeField !== "financial-notes") {
      const parsedText = getParsedFinanceText(update.system.finances[financeField]);
      if (parsedText) {
        const newValue = parseLocaleNumber(parsedText.num) * getMultiplier(parsedText.units);
        await Object.assign(update.system, {financeValues: {[financeField]: newValue}});
      }
    }
  }
}

async function updateFinanceText(actor:TwodsixActor, update:Record<string, any>) {
  for (const financeField in update.system.financeValues) {
    const parsedText = getParsedFinanceText(actor.system.finances[financeField]);
    let newValue = update.system.financeValues[financeField];
    const numberDigits = Math.floor(Math.log10(newValue)) + 1;
    if (parsedText?.units) {
      newValue /= getMultiplier(parsedText.units);
    }
    const newText = ''.concat(newValue.toLocaleString(game.i18n.lang, {minimumSignificantDigits: numberDigits}), (parsedText?.units ? ' ' + parsedText.units : ''));
    await Object.assign(update.system, {finances: {[financeField]: newText}});
  }
}

/**
 * Parse a localized number to a float.
 * @param {string} stringNumber - the localized number
 * @returns {number} - the float value of localized number
 */
export function parseLocaleNumber(stringNumber:string): number {
  const thousandSeparator = Intl.NumberFormat(game.i18n.lang).formatToParts(11111)[1].value;
  const decimalSeparator = Intl.NumberFormat(game.i18n.lang).formatToParts(1.1)[1].value;

  return parseFloat(stringNumber
    .replace(new RegExp('\\' + thousandSeparator, 'g'), '')
    .replace(new RegExp('\\' + decimalSeparator), '.')
  );
}

/**
 * Parse a finance text field into separate value and units.
 * @param {string} stringNumber - the localized number
 * @returns {Record<any>} - object with keys num and units
 */
export function getParsedFinanceText(financeString: string): Record<string, any> | undefined {
  const re = new RegExp(/^(?<pre>\D*?)(?<num>[0-9,.]*)(?<sp>\s*)(?<units>.*?)$/);
  const parsedResult: RegExpMatchArray | null = re.exec(financeString);
  return parsedResult?.groups;
}

/**
 * Lookup the first letter of units and determine magnitude
 * @param {string} stringNumber - the units
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
