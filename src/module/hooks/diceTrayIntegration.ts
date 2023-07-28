// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { getKeyByValue } from "../utils/sheetUtils";
import { simplifySkillName } from "../utils/utils";
import {TWODSIX} from "../config";

Hooks.on('dcCalcWhitelist', (whitelist, actor) => {
  console.log("Made it to Whitelist");
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

  for( const char in actor.system.characteristics) {
    whitelist.twodsix.custom.attributes[char] = {
      label: actor.system.characteristics[char].key,
      name: actor.system.characteristics[char].displayShortLabel,
      formula: actor.system.characteristics[char].mod !== undefined ? `(@characteristics.${char}.mod)[${actor.system.characteristics[char].displayShortLabel}]` : ``
    };
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

  for (const skill of actor.itemTypes.skills) {
    const prop = simplifySkillName(skill.name);
    //let charModifier = 0;
    let fullCharLabel = "";
    if (skill.system.characteristic !== "NONE") {
      fullCharLabel = getKeyByValue(TWODSIX.CHARACTERISTICS, skill.system.characteristic);
      //charModifier = actor.system["characteristics"][fullCharLabel]?.mod ?? 0;
    }
    const formula = `(@skills.${prop}` + (fullCharLabel !== "" ? ` + @characteristics.${fullCharLabel}.mod` : ``) + `)[${skill.name}]`;
    whitelist.twodsix.custom.abilities[prop] = {
      label: prop,
      name: `${skill.name}`,
      formula: formula
    };
  }
});
