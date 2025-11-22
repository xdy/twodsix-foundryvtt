
//I18n related helper functions

/**
 * @param {string} rollType
 * @returns {string}
 */
export function advantageDisadvantageTerm(rollType) {
  switch (rollType.toLocaleLowerCase()) {
    case "advantage":
      return game.settings.get('twodsix', 'termForAdvantage');
    case "disadvantage":
      return game.settings.get('twodsix', 'termForDisadvantage');
    default:
      return game.i18n.localize(rollType);
  }
}
