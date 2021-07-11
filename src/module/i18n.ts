//I18n related helper functions

import {getGame} from './utils/utils';

export function advantageDisadvantageTerm(rollType:string):string {
  switch (rollType.toLowerCase()) {
    case 'advantage':
      return (<string>getGame().settings.get('twodsix', 'termForAdvantage'));
    case 'disadvantage':
      return (<string>getGame().settings.get('twodsix', 'termForDisadvantage'));
    default:
      return rollType;
  }
}
