// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { Component, Skills } from "src/types/template";
import { AvailableShipActionData, AvailableShipActions, ExtraData } from "../../types/twodsix";
import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import TwodsixActor from "../entities/TwodsixActor";
import { confirmRollFormula, getKeyByValue } from "./sheetUtils";
import { TwodsixRollSettings } from "./TwodsixRollSettings";
import { DICE_ROLL_MODES } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";

export class TwodsixShipActions {
  public static availableMethods = <AvailableShipActions>{
    [TWODSIX.SHIP_ACTION_TYPE.chatMessage]: <AvailableShipActionData>{
      action: TwodsixShipActions.chatMessage,
      name: "TWODSIX.Ship.Chat",
      placeholder: "TWODSIX.Ship.chatPlaceholder",
      tooltip: "TWODSIX.Ship.chatTooltip"
    },
    [TWODSIX.SHIP_ACTION_TYPE.skillRoll]: <AvailableShipActionData>{
      action: TwodsixShipActions.skillRoll,
      name: "TWODSIX.Ship.SkillRoll",
      placeholder: "TWODSIX.Ship.skillPlaceholder",
      tooltip: "TWODSIX.Ship.skillTooltip"
    },
    [TWODSIX.SHIP_ACTION_TYPE.fireEnergyWeapons]: <AvailableShipActionData>{
      action: TwodsixShipActions.fireEnergyWeapons,
      name: "TWODSIX.Ship.UseAComponent",
      placeholder: "TWODSIX.Ship.firePlaceholder",
      tooltip: "TWODSIX.Ship.fireTooltip"
    }
  };

  public static async chatMessage(msgStr: string, extra: ExtraData) {
    const speakerData = ChatMessage.getSpeaker({ actor: extra.actor });
    if (msgStr.startsWith("/r") || msgStr.startsWith("/R")) {
      let rollText = msgStr.substring(msgStr.indexOf(' ') + 1); /* return roll formula after first space */
      const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showRollDiag = useInvertedShiftClick ? extra.event["shiftKey"] : !extra.event["shiftKey"];
      if(showRollDiag) {
        rollText = await confirmRollFormula(rollText, (extra.positionName + " " + game.i18n.localize("TWODSIX.Ship.ActionRollFormula")));
      }
      if (Roll.validate(rollText)) {
        const rollData = extra.actor?.getRollData();
        const flavorTxt:string = game.i18n.localize("TWODSIX.Ship.MakesChatRollAction").replace( "_ACTION_NAME_", extra.actionName || game.i18n.localize("TWODSIX.Ship.Unknown")).replace("_POSITION_NAME_", (extra.positionName || game.i18n.localize("TWODSIX.Ship.Unknown")));
        const msg =  await new Roll(rollText, rollData).toMessage({speaker: speakerData, flavor: flavorTxt, type: CONST.CHAT_MESSAGE_TYPES.ROLL});
        return msg;
      }
    }
    return ChatMessage.create({ content: msgStr, speaker: speakerData });
  }

  public static async skillRoll(text: string, extra: ExtraData) {
    const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showTrowDiag = useInvertedShiftClick ? extra.event["shiftKey"] : !extra.event["shiftKey"];
    const difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
    // eslint-disable-next-line no-useless-escape
    const re = new RegExp(/^(.[^\/\+=]*?) ?(?:\/(\w{0,4}))? ?(?:(\d{0,2})\+)? ?(?:=(\w*))? ?$/);
    const parsedResult: RegExpMatchArray | null = re.exec(text);
    const selectedActor = <TwodsixActor>extra.actor;

    if (parsedResult !== null) {
      const [, parsedSkills, char, diff] = parsedResult;
      const skillOptions = parsedSkills.split("|");
      let skill = {};
      for (const skillOption of skillOptions) {
        skill = selectedActor?.itemTypes.skills.find((itm: TwodsixItem) => itm.name === skillOption) as TwodsixItem;
        if(skill){
          break;
        }
      }

      /*if skill missing, try to use Untrained*/
      if (!skill) {
        skill = selectedActor?.itemTypes.skills.find((itm: TwodsixItem) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained")) as TwodsixItem;
        if (!skill) {
          ui.notifications.error(game.i18n.localize("TWODSIX.Ship.ActorLacksSkill").replace("_ACTOR_NAME_", selectedActor?.name ?? "").replace("_SKILL_", parsedSkills));
          return false;
        }
      }

      /*get characteristic key, default to skill key if none specificed in formula */
      let characteristicKey = "";
      if(!char) {
        characteristicKey = getKeyByValue(TWODSIX.CHARACTERISTICS, (<Skills>skill.system).characteristic);
      } else {
        characteristicKey = getCharacteristicFromDisplayLabel(char, selectedActor);
      }

      const charObject = selectedActor?.system["characteristics"];
      let shortLabel = "NONE";
      let displayLabel = "NONE";
      if (charObject && characteristicKey) {
        shortLabel = charObject[characteristicKey].shortLabel;
        displayLabel = charObject[characteristicKey].displayShortLabel;
      }
      const settings = {
        displayLabel: displayLabel,
        extraFlavor: game.i18n.localize("TWODSIX.Ship.MakesChatRollAction").replace( "_ACTION_NAME_", extra.actionName || game.i18n.localize("TWODSIX.Ship.Unknown")).replace("_POSITION_NAME_", (extra.positionName || game.i18n.localize("TWODSIX.Ship.Unknown"))),
        rollModifiers: {characteristic: shortLabel, item: extra.diceModifier ? parseInt(extra.diceModifier) : 0},
        flags: {tokenUUID: extra.ship?.uuid}
      };
      if (diff) {
        settings["difficulty"] = Object.values(difficulties).filter((difficulty: Record<string, number>) => difficulty.target === parseInt(diff, 10))[0];
      }
      const options = await TwodsixRollSettings.create(showTrowDiag, settings, skill, <TwodsixItem>extra.component, selectedActor);
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

  public static async fireEnergyWeapons(text: string, extra: ExtraData) {
    const [skillText, componentId] = text.split("=");
    const component = extra.ship?.items.find(item => item.id === componentId);
    extra.component = <TwodsixItem>component;
    const result = await TwodsixShipActions.skillRoll(skillText, extra);
    if (!result) {
      return false;
    }

    const usingCompStr = component ? (game.i18n.localize("TWODSIX.Ship.WhileUsing") + component.name + ` `) : '';
    if (game.settings.get("twodsix", "automateDamageRollOnHit") && (<Component>component?.system)?.subtype === "armament") {
      if (result.effect >= 0 && component) {
        const bonusDamage = game.settings.get("twodsix", "addEffectForShipDamage") ? result.effect.toString() : "";
        await (<TwodsixItem>component).rollDamage((<DICE_ROLL_MODES>game.settings.get('core', 'rollMode')), bonusDamage, true, false);
      } else {
        await TwodsixShipActions.chatMessage(game.i18n.localize("TWODSIX.Ship.ActionMisses").replace("_WHILE_USING_", usingCompStr).replace("_EFFECT_VALUE_", result.effect.toString()), extra);
      }
    }
  }
}

/**
 * A function for getting the full characteristic label from the displayed short label.
 *
 * @param {string} char           The displayed characteristic short label.
 * @param {TwodsixActor} actor    The Actor in question.
 * @returns {string}              Full logical name of the characteristic.
 */
export function getCharacteristicFromDisplayLabel(char:string, actor?:TwodsixActor):string {
  let tempObject = {};
  let charObject= {};
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
