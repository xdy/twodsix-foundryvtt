import { getCharacteristicList } from '../utils/TwodsixRollSettings';
import { TwodsixItemSheet } from './TwodsixItemSheet';

export class CareerItemSheet extends TwodsixItemSheet {
  getApplicableTabs(tabs) {
    delete tabs.modifiers;
    delete tabs.attack;
    delete tabs.magazine;
    delete tabs.displacement;
    delete tabs.power;
    delete tabs.price;
    delete tabs.chargenRuleset;
    return tabs;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.settings.characteristicsList = getCharacteristicList(this.item.actor);
    return context;
  }
}
