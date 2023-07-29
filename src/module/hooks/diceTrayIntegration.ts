// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { getKeyByValue } from "../utils/sheetUtils";
import { simplifySkillName } from "../utils/utils";
import {TWODSIX} from "../config";

Hooks.on('dcCalcWhitelist', (whitelist, actor) => {
  // Add whitelist support for the calculator.
  whitelist.twodsix = {
    attributes: [],
    abilities: [],
    custom: {
      attributes: {},
      abilities: {},
      custom: {}
    }
  };

  if (game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics')) {
    whitelist.twodsix.custom.attributes = {
      endurance: {
        label: "endurance",
        name: game.i18n.localize("TWODSIX.Actor.Characteristics.END"),
        formula: actor.system.characteristics.endurance.current !== undefined ? `(@characteristics.endurance.current)[${game.i18n.localize("TWODSIX.Actor.Characteristics.END")}]` : ``
      },
      lifeblood: {
        label: "lifeblood",
        name: game.i18n.localize("TWODSIX.Actor.Characteristics.LFB"),
        formula: actor.system.characteristics.strength.current !== undefined ? `(@characteristics.strength.current)[${game.i18n.localize("TWODSIX.Actor.Characteristics.LFB")}]` : ``
      }
    };
    if (game.settings.get('twodsix', 'showContaminationBelowLifeblood')) {
      whitelist.twodsix.custom.attributes.contamination = {
        label: "contamination",
        name: game.i18n.localize("TWODSIX.Actor.Characteristics.CTM"),
        formula: actor.system.characteristics.psionicStrength.current !== undefined ? `(@characteristics.psionicStrength.current)[${game.i18n.localize("TWODSIX.Actor.Characteristics.CTM")}]` : ``
      };
    }
  } else {
    for (const char in actor.system.characteristics) {
      if (!["stamina", "lifeblood"].includes(char)) {
        whitelist.twodsix.custom.attributes[char] = {
          label: actor.system.characteristics[char].key,
          name: actor.system.characteristics[char].displayShortLabel,
          formula: actor.system.characteristics[char].mod !== undefined ? `(@characteristics.${char}.mod)[${actor.system.characteristics[char].displayShortLabel}]` : ``
        };
      }
    }
    switch (game.settings.get('twodsix', 'showAlternativeCharacteristics')) {
      case 'base':
        delete whitelist.twodsix.custom.attributes.alternative1;
        delete whitelist.twodsix.custom.attributes.alternative2;
        break;
      case 'alternate':
        delete whitelist.twodsix.custom.attributes.psionicStrength;
        break;
      case 'all':
        break;
    }
  }

  for (const skill of actor.itemTypes.skills) {
    const simpleSkillName = simplifySkillName(skill.name);
    const fullCharLabel = skill.system.characteristic !== "NONE" ? getKeyByValue(TWODSIX.CHARACTERISTICS, skill.system.characteristic) : "";
    const formula = `(@skills.${simpleSkillName}` + (fullCharLabel !== "" ? ` + @characteristics.${fullCharLabel}.mod` : ``) + `)[${skill.name}]`;
    whitelist.twodsix.custom.abilities[simpleSkillName] = {
      label: simpleSkillName,
      name: `${skill.name}`,
      formula: formula
    };
  }
});
