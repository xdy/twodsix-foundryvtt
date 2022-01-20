import { AvailableShipActionData, AvailableShipActions, ExtraData } from "../../types/twodsix";
import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import { TwodsixRollSettings } from "./TwodsixRollSettings";

export class TwodsixShipActions {
  public static availableMethods = <AvailableShipActions>{
    [TWODSIX.SHIP_ACTION_TYPE.chatMessage]: <AvailableShipActionData>{
      action: TwodsixShipActions.chatMessage,
      name: "Chat",
      placeholder: "Message"
    },
    [TWODSIX.SHIP_ACTION_TYPE.skillRoll]: <AvailableShipActionData>{
      action: TwodsixShipActions.skillRoll,
      name: "Skill Roll",
      placeholder: "Skill/CHR 8+"
    },
    [TWODSIX.SHIP_ACTION_TYPE.fireEnergyWeapons]: <AvailableShipActionData>{
      action: TwodsixShipActions.fireEnergyWeapons,
      name: "Fire Energy Weapons",
      placeholder: "Skill/CHR 8+=COMPONENT_ID"
    }
  };

  public static chatMessage(msg: string, extra: ExtraData) {
    return ChatMessage.create({ content: msg, speaker: ChatMessage.getSpeaker({ actor: extra.actor }) });
  }

  public static async skillRoll(text: string, extra: ExtraData) {
    const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showTrowDiag = useInvertedShiftClick ? extra.event["shiftKey"] : !extra.event["shiftKey"];
    const difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
    const re = new RegExp(/^(.+?)\/?([A-Z]*?) ?(\d*?)\+?$/);
    const parsedResult: RegExpMatchArray | null = re.exec(text);

    if (parsedResult !== null) {
      const [, parsedSkill, char, diff] = parsedResult;
      const skill = extra.actor?.items.filter((itm: TwodsixItem) => itm.name === parsedSkill)[0] as TwodsixItem;
      if (!skill) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Ship.ActorLacksSkill").replace("_ACTOR_NAME_", extra.actor?.name ?? "").replace("_SKILL_", parsedSkill));
        return false;
      }
      const settings = {
        characteristic: char ? char : undefined
      };
      if (diff) {
        settings["difficulty"] = Object.values(difficulties).filter((difficulty: Record<string, number>) => difficulty.target === parseInt(diff, 10))[0];
      }
      const options = await TwodsixRollSettings.create(showTrowDiag, settings, skill);
      if (!options.shouldRoll) {
        return false;
      }
      return skill.skillRoll(showTrowDiag, options);

    } else {
      ui.notifications.error(game.i18n.localize("TWODSIX.Ship.CannotParseArgument"));
      return false;
    }
  }

  public static async fireEnergyWeapons(text: string, extra: ExtraData) {
    const [skilText, componentId] = text.split("=");
    const result = await TwodsixShipActions.skillRoll(skilText, extra);
    if (!result) {
      return false;
    }
    const component = extra.ship?.items.find(item => item.id === componentId);
    const extraStr = component ? `while using ${component.name} ` : '';
    if (result.effect >= 0) {
      TwodsixShipActions.chatMessage(`Hit ${extraStr}with effect ${result.effect}`, extra);
    } else {
      TwodsixShipActions.chatMessage(`Missed ${extraStr}with effect ${result.effect}`, extra);
    }
  }
}
