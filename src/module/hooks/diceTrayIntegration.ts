// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { getKeyByValue } from "../utils/sheetUtils";
import { simplifySkillName } from "../utils/utils";
import {TWODSIX} from "../config";

Hooks.on('dice-calculator.calculator', (calculators, Template) => {
  class twodsixDiceCalculator extends Template {
    actorSpecificButtons(actor) {
      const abilities = [];
      const attributes = [];
      const customButtons = [];

      if (actor) {
        if (game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics')) {
          attributes.push(...[
            {
              label: 'endurance',
              name: game.i18n.localize('TWODSIX.Actor.Characteristics.END'),
              formula: actor.system.characteristics.endurance.current !== undefined ? `(@characteristics.endurance.current)[${game.i18n.localize('TWODSIX.Actor.Characteristics.END')}]` : ''
            },
            {
              label: 'lifeblood',
              name: game.i18n.localize('TWODSIX.Actor.Characteristics.LFB'),
              formula: actor.system.characteristics.strength.current !== undefined ? `(@characteristics.strength.current)[${game.i18n.localize('TWODSIX.Actor.Characteristics.LFB')}]` : ''
            }]);
          if (game.settings.get('twodsix', 'showContaminationBelowLifeblood')) {
            attributes.push({
              label: 'contamination',
              name: game.i18n.localize('TWODSIX.Actor.Characteristics.CTM'),
              formula: actor.system.characteristics.psionicStrength.current !== undefined ? `(@characteristics.psionicStrength.current)[${game.i18n.localize('TWODSIX.Actor.Characteristics.CTM')}]` : ''
            });
          }
        } else {
          const filter = ['stamina', 'lifeblood'];
          switch (game.settings.get('twodsix', 'showAlternativeCharacteristics')) {
            case 'core':
              filter.push(...['psionicStrength', 'alternative1', 'alternative2', 'alternative3']);
              break;
            case 'base':
              filter.push(...['alternative1', 'alternative2', 'alternative3']);
              break;
            case 'alternate':
              filter.push(...['psionicStrength', 'alternative3']);
              break;
            case 'all':
              break;
          }
          for (const char in actor.system.characteristics) {
            if (!filter.includes(char)) {
              attributes.push({
                label: actor.system.characteristics[char].key,
                name: actor.system.characteristics[char].displayShortLabel,
                formula: actor.system.characteristics[char].mod !== undefined ? `(@characteristics.${char}.mod)[${actor.system.characteristics[char].displayShortLabel}]` : ''
              });
            }
          }
        }
        for (const skill of actor.itemTypes.skills) {
          const simpleSkillName = simplifySkillName(skill.name);
          const fullCharLabel = skill.system.characteristic !== 'NONE' ? getKeyByValue(TWODSIX.CHARACTERISTICS, skill.system.characteristic) : '';
          customButtons.push({
            label: simpleSkillName,
            name: skill.name,
            formula: `(@skills.${simpleSkillName}${fullCharLabel !== '' ? ` + @characteristics.${fullCharLabel}.mod` : ''})[${skill.name}]`
          });
        }
      }
      return { abilities, attributes, customButtons };
    }
  }
  calculators.twodsix = twodsixDiceCalculator;
});
