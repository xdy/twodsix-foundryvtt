//I18n related helper functions
export function advantageDisadvantageTerm(rollType) {
  switch (rollType.toLocaleLowerCase()) {
    case "advantage":
      return game.settings.get('twodsix', 'termForAdvantage');
    case "disadvantage":
      return game.settings.get('twodsix', 'termForDisadvantage');
    default:
      return rollType;
  }
}
