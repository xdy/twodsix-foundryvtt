// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { getKeyByValue } from "../utils/sheetUtils";
import { simplifySkillName } from "../utils/utils";
import {TWODSIX} from "../config";

Hooks.on('dcCalcWhitelist', (whitelist, actor) => {
  console.log("Made it to Whitelist");
  // Add whitelist support for the calculator.
  whitelist.twodsix = {
    // Currently, the only flag that's supported is the adv flag (whether to
    // say "Adv." or "kh" on the kh/kl buttons).
    flags: {
      adv: false
    },
    // List any abilities on actor.data.data.abilities that should be allowed.
    abilities: [],
    // List any attributes on actor.data.data.attributes that should be allowed.
    // Level is automatically pulled from actor.data.data.details and added to
    // this array as well.
    attributes: [],
    // The custom section can be used to replace abilities or attributes outright,
    // or it can be used to add a third row of custom buttons. Anything added
    // to this section needs to have 3 keys: label, name, and formula.
    custom: {
      abilities: {},
      custom: {},
      attributes: {
        strength: {
          label: actor.system.characteristics.strength.key,
          name: actor.system.characteristics.strength.displayShortLabel,
          formula: actor.system.characteristics.strength.mod !== undefined ? `(@characteristics.strength.mod)[${actor.system.characteristics.strength.displayShortLabel}]` : ``
        },
        dexterity: {
          label: actor.system.characteristics.dexterity.key,
          name: actor.system.characteristics.dexterity.displayShortLabel,
          formula: actor.system.characteristics.dexterity.mod !== undefined ? `(@characteristics.dexterity.mod)[${actor.system.characteristics.dexterity.displayShortLabel}]` : ``
        },
        endurance: {
          label: actor.system.characteristics.endurance.key,
          name: actor.system.characteristics.endurance.displayShortLabel,
          formula: actor.system.characteristics.endurance.mod !== undefined ? `(@characteristics.endurance.mod)[${actor.system.characteristics.endurance.displayShortLabel}]` : ``
        },
        intelligence: {
          label: actor.system.characteristics.intelligence.key,
          name: actor.system.characteristics.intelligence.displayShortLabel,
          formula: actor.system.characteristics.intelligence.mod !== undefined ? `(@characteristics.intelligence.mod)[${actor.system.characteristics.intelligence.displayShortLabel}]` : ``
        },
        education: {
          label: actor.system.characteristics.education.key,
          name: actor.system.characteristics.education.displayShortLabel,
          formula: actor.system.characteristics.endurance.mod !== undefined ? `(@characteristics.education.mod)[${actor.system.characteristics.education.displayShortLabel}]` : ``
        },
        socialStanding: {
          label: actor.system.characteristics.socialStanding.key,
          name: actor.system.characteristics.socialStanding.displayShortLabel,
          formula: actor.system.characteristics.socialStanding.mod !== undefined ? `(@characteristics.socialStanding.mod)[${actor.system.characteristics.socialStanding.displayShortLabel}]` : ``
        },
        psionicStrength: {
          label: actor.system.characteristics.psionicStrength.key,
          name: actor.system.characteristics.psionicStrength.displayShortLabel,
          formula: actor.system.characteristics.socialStanding.mod !== undefined ? `(@characteristics.psionicStrength.mod)[${actor.system.characteristics.psionicStrength.displayShortLabel}]` : ``
        },
        alternative1: {
          label: actor.system.characteristics.alternative1.key,
          name: actor.system.characteristics.alternative1.displayShortLabel,
          formula: actor.system.characteristics.alternative1.mod !== undefined ? `(@characteristics.alternative1.mod)[${actor.system.characteristics.alternative1.displayShortLabel}]` : ``
        },
        alternative2: {
          label: actor.system.characteristics.alternative2.key,
          name: actor.system.characteristics.alternative2.displayShortLabel,
          formula: actor.system.characteristics.alternative2.mod !== undefined ? `(@characteristics.alternative2.mod)[${actor.system.characteristics.alternative2.displayShortLabel}]` : ``
        },
      }
    }
  };

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
