// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

//I18n related helper functions

export function advantageDisadvantageTerm(rollType:string):string {
  switch (rollType.toLocaleLowerCase()) {
    case "advantage":
      return (<string>game.settings.get('twodsix', 'termForAdvantage'));
    case "disadvantage":
      return (<string>game.settings.get('twodsix', 'termForDisadvantage'));
    default:
      return game.i18n.localize(rollType);
  }
}
