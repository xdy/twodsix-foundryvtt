import { TwodsixItemSheet } from './TwodsixItemSheet';

export class ConsumableItemSheet extends TwodsixItemSheet {
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
    // Prevent processor/suite when attached to a computer
    if (this.actor) {
      const onComputer = this.actor.items.find(
        it => it.type === "computer" && it.system.consumables.includes(this.item.id)
      );
      if (onComputer) {
        delete context.config.CONSUMABLES.processor;
        delete context.config.CONSUMABLES.suite;
      }
    }
    return context;
  }
}
