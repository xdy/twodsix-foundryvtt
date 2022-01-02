//I18n related helper functions

export function advantageDisadvantageTerm(rollType:string):string {
  switch (rollType.toLocaleLowerCase()) {
    case "advantage":
      return (<string>game.settings.get('twodsix', 'termForAdvantage'));
    case "disadvantage":
      return (<string>game.settings.get('twodsix', 'termForDisadvantage'));
    default:
      return rollType;
  }
}
