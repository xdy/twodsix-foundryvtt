import { CHARGEN_SUPPORTED_RULESETS } from '../features/chargen/CharGenRegistry.js';
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

    // Rulesets available for career items — driven by the chargen registry
    context.careerRulesets = [...CHARGEN_SUPPORTED_RULESETS].map(key => ({
      key,
      name: CONFIG.TWODSIX.RULESETS[key]?.name ?? key,
      selected: this.item.system.ruleset === key,
    }));

    // CU skill table options for the skillTable1/skillTable2 dropdowns.
    // Read from the CU chargen ruleset pack if available; fall back to config-defined names.
    const cuRulesetPack = game.packs.get('twodsix.cu-srd-chargen-ruleset');
    let cuSkillTableNames = [];
    if (cuRulesetPack) {
      try {
        const docs = await cuRulesetPack.getDocuments();
        const rulesetItem = docs[0];
        cuSkillTableNames = (rulesetItem?.system?.skillCategoryTables ?? []).map(t => t.name).filter(Boolean);
      } catch (e) {
        console.warn('twodsix | CareerItemSheet: failed to load CU skill table names from pack.', e);
      }
    }
    context.cuSkillTableOptions = cuSkillTableNames.map(name => ({ value: name, label: name }));

    return context;
  }
}
