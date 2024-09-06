// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { Component} from "src/types/template";
import { AvailableShipActionData, AvailableShipActions, ExtraData } from "../../types/twodsix";
import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import TwodsixActor from "../entities/TwodsixActor";
import { confirmRollFormula} from "./sheetUtils";
import { TwodsixRollSettings, getInitialSettingsFromFormula } from "./TwodsixRollSettings";
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
    },
    [TWODSIX.SHIP_ACTION_TYPE.executeMacro]: <AvailableShipActionData>{
      action: TwodsixShipActions.executeMacro,
      name: "TWODSIX.Ship.ExecuteMacro",
      placeholder: "TWODSIX.Ship.macroPlaceholder",
      tooltip: "TWODSIX.Ship.MacroTooltip"
    }
  };

  public static async chatMessage(msgStr: string, extra: ExtraData): Promise<any> {
    const speakerData = ChatMessage.getSpeaker({ actor: extra.actor });
    if (msgStr.startsWith("/r") || msgStr.startsWith("/R")) {
      const parsedText: string[] = msgStr.split('#');
      let rollText: string = parsedText[0].substring(msgStr.indexOf(' ') + 1).trim();
      const flavorText: string = parsedText.length > 1 ? parsedText[1].trim() : game.i18n.localize("TWODSIX.Ship.MakesChatRollAction").replace( "_ACTION_NAME_", extra.actionName || game.i18n.localize("TWODSIX.Ship.Unknown")).replace("_POSITION_NAME_", (extra.positionName || game.i18n.localize("TWODSIX.Ship.Unknown")));

      const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showRollDiag = useInvertedShiftClick ? extra.event["shiftKey"] : !extra.event["shiftKey"];
      if(showRollDiag) {
        rollText = await confirmRollFormula(rollText, (extra.positionName + " " + game.i18n.localize("TWODSIX.Ship.ActionRollFormula")));
      }
      if (Roll.validate(rollText)) {
        const rollData = extra.actor.getRollData() ?? {};
        Object.assign(rollData, {ship: extra.ship.getRollData()});
        const msg =  await new Roll(rollText, rollData).toMessage({speaker: speakerData, flavor: flavorText, type: CONST.CHAT_MESSAGE_TYPES.OTHER});
        return msg;
      }
    }
    return ChatMessage.create({ content: msgStr, speaker: speakerData });
  }

  public static async skillRoll(text: string, extra: ExtraData) {
    const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showTrowDiag:boolean = useInvertedShiftClick ? extra.event["shiftKey"] : !extra.event["shiftKey"];

    const settings = getInitialSettingsFromFormula(text, extra.actor);
    if (settings) {
      Object.assign (settings, {
        extraFlavor: game.i18n.localize("TWODSIX.Ship.MakesChatRollAction").replace( "_ACTION_NAME_", extra.actionName || game.i18n.localize("TWODSIX.Ship.Unknown")).replace("_POSITION_NAME_", (extra.positionName || game.i18n.localize("TWODSIX.Ship.Unknown"))),
        flags: {tokenUUID: extra.ship?.uuid}
      });
      Object.assign(settings.rollModifiers, {item: extra.diceModifier ? parseInt(extra.diceModifier) : 0});
      const skill:TwodsixItem|undefined = settings.skill;
      delete settings.skill;
      if (!settings.skillRoll) {
        // Special case of characteristic roll
        if (settings.rollModifiers.characteristic) {
          extra.actor.characteristicRoll({rollModifiers: settings.rollModifiers, difficulty: settings.difficulty}, true);
        } else {
          return false;
        }
      } else {
        const options = await TwodsixRollSettings.create(showTrowDiag, settings, skill, <TwodsixItem>extra.component, extra.actor);
        if (!options.shouldRoll) {
          return false;
        }

        if (extra.component) {
          return extra.component.skillRoll(false, options);
        } else {
          return skill.skillRoll(false, options);
        }
      }
    } else {
      ui.notifications.error(game.i18n.localize("TWODSIX.Ship.CannotParseArgument"));
      return false;
    }
  }

  public static async fireEnergyWeapons(text: string, extra: ExtraData) {
    const skillTextAndComponentId = text.trim().split("=");
    if (skillTextAndComponentId.length > 1 && !extra.component) {
      // still suport depecated old xx=COMPONENT style but use the component from selection if one is given
      const componentId = skillTextAndComponentId[1];
      extra.component = <TwodsixItem>extra.ship?.items.find(item => item.id === componentId);
    }
    const skillText = skillTextAndComponentId[0];
    const result = await TwodsixShipActions.skillRoll(skillText, extra);
    if (!result) {
      return false;
    }

    const usingCompStr = extra.component ? (game.i18n.localize("TWODSIX.Ship.WhileUsing") + extra.component.name + ` `) : '';
    if (game.settings.get("twodsix", "automateDamageRollOnHit") && (<Component>extra.component?.system)?.subtype === "armament") {
      if (result.effect >= 0 && extra.component) {
        const bonusDamage = game.settings.get("twodsix", "addEffectForShipDamage") ? result.effect.toString() : "";
        await (<TwodsixItem>extra.component).rollDamage((<DICE_ROLL_MODES>game.settings.get('core', 'rollMode')), bonusDamage, true, false);
      } else {
        await TwodsixShipActions.chatMessage(game.i18n.localize("TWODSIX.Ship.ActionMisses").replace("_WHILE_USING_", usingCompStr).replace("_EFFECT_VALUE_", result.effect.toString()), extra);
      }
    }
  }

  public static async executeMacro(macroName: string, extra: ExtraData) {
    const foundMacros = await game.macros.find((macro) => macro.name === macroName);
    if (!foundMacros) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.MacroNotFound").replace("_MACRO_NAME_", macroName));
    } else {
      if (foundMacros.canExecute) {
        const scope = {actor: <TwodsixActor>extra.actor, ship: extra.ship, component: extra.component};
        foundMacros.execute(scope);
      } else {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.PlayerDoesNotHavePermission"));
      }
    }
  }
}
