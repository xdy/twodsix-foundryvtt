import { getCharacteristicList } from '../utils/TwodsixRollSettings';
import { TwodsixItemSheet } from './TwodsixItemSheet';

export class SkillItemSheet extends TwodsixItemSheet {
  getApplicableTabs(tabs) {
    delete tabs.attack;
    delete tabs.magazine;
    delete tabs.displacement;
    delete tabs.power;
    delete tabs.price;
    delete tabs.career;
    delete tabs.chargenRuleset;
    return tabs;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.settings.characteristicsList = getCharacteristicList(this.item.actor);
    if (Object.keys(context.settings.characteristicsList).includes(this.item.system.characteristic)) {
      context.system.initialCharacteristic = this.item.system.characteristic;
    } else {
      context.system.initialCharacteristic = 'NONE';
    }
    return context;
  }
}
