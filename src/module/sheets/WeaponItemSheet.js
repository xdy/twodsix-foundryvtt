import { TwodsixItemSheet } from './TwodsixItemSheet';

export class WeaponItemSheet extends TwodsixItemSheet {
  getApplicableTabs(tabs) {
    delete tabs.displacement;
    delete tabs.price;
    delete tabs.power;
    delete tabs.chargenRuleset;
    delete tabs.career;
    return tabs;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.disableMeleeRangeDM = typeof this.item.system.range === 'string'
      ? this.item.system.range.toLowerCase() === 'melee'
      : false;
    return context;
  }
}
