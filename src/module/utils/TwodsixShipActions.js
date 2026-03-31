import { TWODSIX } from '../config';
import { confirmRollFormula } from './sheetUtils';
import { getInitialSettingsFromFormula, TwodsixRollSettings } from './TwodsixRollSettings';

export class TwodsixShipActions {
  /** @type {object} */
  static availableMethods = {
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
    },
    [TWODSIX.SHIP_ACTION_TYPE.executeMacro]: {
      action: TwodsixShipActions.executeMacro,
      name: "TWODSIX.Ship.ExecuteMacro",
      placeholder: "TWODSIX.Ship.macroPlaceholder",
      tooltip: "TWODSIX.Ship.MacroTooltip"
    }
  };

  /**
   * @param {string} msgStr
   * @param {object} extra
   * @returns {Promise<ChatMessage>}
   */
  static async chatMessage(msgStr, extra) {
    const speakerData = ChatMessage.getSpeaker({actor: extra.actor});
    if (msgStr.startsWith("/r") || msgStr.startsWith("/R")) {
      const parsedText = msgStr.split('#');
      let rollText = parsedText[0].substring(msgStr.indexOf(' ') + 1).trim();
      const flavorText = parsedText.length > 1 ? parsedText[1].trim() : game.i18n.localize("TWODSIX.Ship.MakesChatRollAction").replace("_ACTION_NAME_", extra.actionName || game.i18n.localize("TWODSIX.Ship.Unknown")).replace("_POSITION_NAME_", (extra.positionName || game.i18n.localize("TWODSIX.Ship.Unknown")));

      const useInvertedShiftClick = (game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showRollDiag = useInvertedShiftClick ? extra.event["shiftKey"] : !extra.event["shiftKey"];
      if (showRollDiag) {
        rollText = await confirmRollFormula(rollText, (extra.positionName + " " + game.i18n.localize("TWODSIX.Ship.ActionRollFormula")));
      }
      if (Roll.validate(rollText)) {
        const rollData = extra.actor.getRollData() ?? {};
        Object.assign(rollData, {ship: extra.ship.getRollData()});
        const msg = await new Roll(rollText, rollData).toMessage({
          title: game.i18n.localize("TWODSIX.Chat.Roll.Types.ShipAction"),
          speaker: speakerData,
          flavor: flavorText,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER
        });
        return msg;
      }
    }
    return ChatMessage.create({content: msgStr, speaker: speakerData});
  }

  /**
   * @param {string} text
   * @param {object} extra
   * @returns {Promise<TwodsixDiceRoll | boolean>}
   */
  static async skillRoll(text, extra) {
    const useInvertedShiftClick = (game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showTrowDiag = useInvertedShiftClick ? extra.event["shiftKey"] : !extra.event["shiftKey"];

    const settings = getInitialSettingsFromFormula(text, extra.actor);
    if (settings) {
      Object.assign(settings, {
        extraFlavor: game.i18n.localize("TWODSIX.Ship.MakesChatRollAction").replace("_ACTION_NAME_", extra.actionName || game.i18n.localize("TWODSIX.Ship.Unknown")).replace("_POSITION_NAME_", (extra.positionName || game.i18n.localize("TWODSIX.Ship.Unknown"))),
        flags: {tokenUUID: extra.ship?.uuid}
      });
      Object.assign(settings.rollModifiers, {item: extra.diceModifier ? parseInt(extra.diceModifier) : 0});
      const skill = settings.skill;
      delete settings.skill;
      if (!settings.skillRoll) {
        // Special case of characteristic roll
        if (settings.rollModifiers.characteristic) {
          extra.actor.characteristicRoll({
            rollModifiers: settings.rollModifiers,
            difficulty: settings.difficulty
          }, true);
        } else {
          return false;
        }
      } else {
        const options = await TwodsixRollSettings.create(showTrowDiag, settings, skill, extra.component, extra.actor);
        if (!options.shouldRoll) {
          return false;
        }

        if (extra.component) {
          return await extra.component.skillRoll(false, options);
        } else {
          return await skill.skillRoll(false, options);
        }
      }
    } else {
      ui.notifications.error("TWODSIX.Ship.CannotParseArgument", {localize: true});
      return false;
    }
  }

  /**
   * @param {string} text
   * @param {object} extra
   * @returns {Promise<void>}
   */
  static async fireEnergyWeapons(text, extra) {
    const skillTextAndComponentId = text.trim().split("=");
    if (skillTextAndComponentId.length > 1 && !extra.component) {
      // still suport depecated old xx=COMPONENT style but use the component from selection if one is given
      const componentId = skillTextAndComponentId[1];
      extra.component = extra.ship?.items.find(item => item.id === componentId);
    }
    const skillText = skillTextAndComponentId[0];
    const result = await TwodsixShipActions.skillRoll(skillText, extra);
    if (!result) {
      return false;
    }

    const usingCompStr = extra.component ? (game.i18n.localize("TWODSIX.Ship.WhileUsing") + extra.component.name + ` `) : '';
    if (game.settings.get("twodsix", "automateDamageRollOnHit") && extra.component?.system?.isArmament) {
      if (result.effect >= 0 && extra.component) {
        if (extra.component.system.ammoLink !== "none") {
          const linkedAmmo = extra.ship?.items.get(extra.component.system.ammoLink);
          if (linkedAmmo) {
            extra.component = linkedAmmo;
          }
        }
        const bonusDamage = game.settings.get("twodsix", "addEffectForShipDamage") ? result.effect.toString() : "";
        await (extra.component).rollDamage((game.settings.get('core', 'messageMode')), bonusDamage, true, false, result.effect);
      } else {
        await TwodsixShipActions.chatMessage(game.i18n.localize("TWODSIX.Ship.ActionMisses").replace("_WHILE_USING_", usingCompStr).replace("_EFFECT_VALUE_", result.effect.toString()), extra);
      }
    }
  }

  /**
   * @param {string} macroName
   * @param {object} extra
   * @returns {Promise<void>}
   */
  static async executeMacro(macroName, extra) {
    const foundMacros = await game.macros.find((macro) => macro.name === macroName);
    if (!foundMacros) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.MacroNotFound").replace("_MACRO_NAME_", macroName));
    } else {
      if (foundMacros.canExecute) {
        const scope = {actor: extra.actor, ship: extra.ship, component: extra.component};
        foundMacros.execute(scope);
      } else {
        ui.notifications.warn("TWODSIX.Warnings.PlayerDoesNotHavePermission", {localize: true});
      }
    }
  }
}
