import {TWODSIX} from "../config";
import {confirmRollFormula, getKeyByValue} from "./sheetUtils";
import {TwodsixRollSettings} from "./TwodsixRollSettings";

class TwodsixShipActions {
  static async chatMessage(msgStr, extra) {
    const speakerData = ChatMessage.getSpeaker({actor: extra.actor});
    if (msgStr.startsWith("/r") || msgStr.startsWith("/R")) {
      let rollText = msgStr.substring(msgStr.indexOf(' ') + 1); /* return roll formula after first space */
      const useInvertedShiftClick = game.settings.get('twodsix', 'invertSkillRollShiftClick');
      const showRollDiag = useInvertedShiftClick ? extra.event["shiftKey"] : !extra.event["shiftKey"];
      if (showRollDiag) {
        rollText = await confirmRollFormula(rollText, (extra.positionName + " " + game.i18n.localize("TWODSIX.Ship.ActionRollFormula")));
      }
      if (Roll.validate(rollText)) {
        const rollData = extra.actor?.getRollData();
        const flavorTxt = game.i18n.localize("TWODSIX.Ship.MakesChatRollAction").replace("_ACTION_NAME_", extra.actionName || game.i18n.localize("TWODSIX.Ship.Unknown")).replace("_POSITION_NAME_", (extra.positionName || game.i18n.localize("TWODSIX.Ship.Unknown")));
        const msg = await new Roll(rollText, rollData).toMessage({
          speaker: speakerData,
          flavor: flavorTxt,
          type: CONST.CHAT_MESSAGE_TYPES.ROLL
        });
        return msg;
      }
    }
    return ChatMessage.create({content: msgStr, speaker: speakerData});
  }

  static async skillRoll(text, extra) {
    const useInvertedShiftClick = game.settings.get('twodsix', 'invertSkillRollShiftClick');
    const showTrowDiag = useInvertedShiftClick ? extra.event["shiftKey"] : !extra.event["shiftKey"];
    const difficulties = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
    // eslint-disable-next-line no-useless-escape
    const re = new RegExp(/^(.[^\/\+=]*?) ?(?:\/([\S]+))? ?(?:(\d{0,2})\+)? ?(?:=(\w*))? ?$/);
    const parsedResult = re.exec(text);
    const selectedActor = extra.actor;
    if (parsedResult !== null) {
      const [, parsedSkills, char, diff] = parsedResult;
      const skillOptions = parsedSkills.split("|");
      let skill = undefined;
      /* add qualified skill objects to an array*/
      const skillObjects = selectedActor?.itemTypes.skills.filter((itm) => skillOptions.includes(itm.name));
      // find the most advantageous sill to use from the collection
      if (skillObjects?.length > 0) {
        skill = skillObjects.reduce((prev, current) => (prev.system.value > current.system.value) ? prev : current);
      }
      /*if skill missing, try to use Untrained*/
      if (!skill) {
        skill = selectedActor?.itemTypes.skills.find((itm) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained"));
        if (!skill) {
          ui.notifications.error(game.i18n.localize("TWODSIX.Ship.ActorLacksSkill").replace("_ACTOR_NAME_", selectedActor?.name ?? "").replace("_SKILL_", parsedSkills));
          return false;
        }
      }
      /*get characteristic key, default to skill key if none specificed in formula */
      let characteristicKey = "";
      const charObject = selectedActor?.system["characteristics"] ?? {};
      //we need an array
      const charObjectArray = Object.values(charObject);
      if (!char) {
        characteristicKey = getKeyByValue(TWODSIX.CHARACTERISTICS, skill.system.characteristic);
      } else {
        //find the most advantageous characteristic to use
        const charOptions = char.split("|");
        let candidateCharObject = undefined;
        const candidateCharObjects = charObjectArray.filter(ch => charOptions.includes(ch.displayShortLabel));
        if (candidateCharObjects.length > 0) {
          candidateCharObject = candidateCharObjects.reduce((prev, current) => (prev.mod > current.mod) ? prev : current);
        }
        characteristicKey = candidateCharObject?.key ?? getCharacteristicFromDisplayLabel(char, selectedActor);

      }
      let shortLabel = "NONE";
      let displayLabel = "NONE";
      if (charObject && characteristicKey) {
        shortLabel = charObject[characteristicKey].shortLabel;
        displayLabel = charObject[characteristicKey].displayShortLabel;
      }
      const settings = {
        displayLabel: displayLabel,
        extraFlavor: game.i18n.localize("TWODSIX.Ship.MakesChatRollAction").replace("_ACTION_NAME_", extra.actionName || game.i18n.localize("TWODSIX.Ship.Unknown")).replace("_POSITION_NAME_", (extra.positionName || game.i18n.localize("TWODSIX.Ship.Unknown"))),
        rollModifiers: {characteristic: shortLabel, item: extra.diceModifier ? parseInt(extra.diceModifier) : 0},
        flags: {tokenUUID: extra.ship?.uuid}
      };
      if (diff) {
        settings["difficulty"] = Object.values(difficulties).filter((difficulty) => difficulty.target === parseInt(diff, 10))[0];
      }
      const options = await TwodsixRollSettings.create(showTrowDiag, settings, skill, extra.component, selectedActor);
      if (!options.shouldRoll) {
        return false;
      }
      if (extra.component) {
        return extra.component.skillRoll(showTrowDiag, options);
      } else {
        return skill.skillRoll(showTrowDiag, options);
      }
    } else {
      ui.notifications.error(game.i18n.localize("TWODSIX.Ship.CannotParseArgument"));
      return false;
    }
  }

  static async fireEnergyWeapons(text, extra) {
    const [skillText, componentId] = text.split("=");
    const component = extra.ship?.items.find(item => item.id === componentId);
    extra.component = component;
    const result = await TwodsixShipActions.skillRoll(skillText, extra);
    if (!result) {
      return false;
    }
    const usingCompStr = component ? (game.i18n.localize("TWODSIX.Ship.WhileUsing") + component.name + ` `) : '';
    if (game.settings.get("twodsix", "automateDamageRollOnHit") && component?.system?.subtype === "armament") {
      if (result.effect >= 0 && component) {
        const bonusDamage = game.settings.get("twodsix", "addEffectForShipDamage") ? result.effect.toString() : "";
        await component.rollDamage(game.settings.get('core', 'rollMode'), bonusDamage, true, false);
      } else {
        await TwodsixShipActions.chatMessage(game.i18n.localize("TWODSIX.Ship.ActionMisses").replace("_WHILE_USING_", usingCompStr).replace("_EFFECT_VALUE_", result.effect.toString()), extra);
      }
    }
  }
}

TwodsixShipActions.availableMethods = {
  [TWODSIX.SHIP_ACTION_TYPE.chatMessage]: {
    action: TwodsixShipActions.chatMessage,
    name: "TWODSIX.Ship.Chat",
    placeholder: "TWODSIX.Ship.chatPlaceholder",
    tooltip: "TWODSIX.Ship.chatTooltip"
  },
  [TWODSIX.SHIP_ACTION_TYPE.skillRoll]: {
    action: TwodsixShipActions.skillRoll,
    name: "TWODSIX.Ship.SkillRoll",
    placeholder: "TWODSIX.Ship.skillPlaceholder",
    tooltip: "TWODSIX.Ship.skillTooltip"
  },
  [TWODSIX.SHIP_ACTION_TYPE.fireEnergyWeapons]: {
    action: TwodsixShipActions.fireEnergyWeapons,
    name: "TWODSIX.Ship.UseAComponent",
    placeholder: "TWODSIX.Ship.firePlaceholder",
    tooltip: "TWODSIX.Ship.fireTooltip"
  }
};
export {TwodsixShipActions};

/**
 * A function for getting the full characteristic label from the displayed short label.
 *
 * @param {string} char           The displayed characteristic short label.
 * @param {TwodsixActor} actor    The Actor in question.
 * @returns {string}              Full logical name of the characteristic.
 */
export function getCharacteristicFromDisplayLabel(char, actor) {
  let tempObject = {};
  let charObject = {};
  if (actor) {
    charObject = actor.system["characteristics"];
    for (const key in charObject) {
      tempObject[key] = charObject[key].displayShortLabel;
    }
  } else {
    tempObject = TWODSIX.CHARACTERISTICS;
  }
  return getKeyByValue(tempObject, char);
}
