import { TwodsixItemSheet } from './TwodsixItemSheet';

export class ChargenRulesetItemSheet extends TwodsixItemSheet {
  getApplicableTabs(tabs) {
    delete tabs.modifiers;
    delete tabs.attack;
    delete tabs.magazine;
    delete tabs.displacement;
    delete tabs.power;
    delete tabs.price;
    delete tabs.career;
    return tabs;
  }
}
