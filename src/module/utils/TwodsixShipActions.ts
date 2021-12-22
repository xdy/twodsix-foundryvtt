import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import { TwodsixRollSettings } from "./TwodsixRollSettings";

export class TwodsixShipActions {
    public static availableMethods = {
        "chatMessage": {
            action: TwodsixShipActions.chatMessage,
            name: "Chat",
            placeholder: "Message"
        },
        "skillRoll": {
            action: TwodsixShipActions.skillRoll,
            name: "Skill Roll",
            placeholder: "Skill/CHR 8+"
        },
        "fireEnergyWeapons": {
            action: TwodsixShipActions.fireEnergyWeapons,
            name: "Fire Energy Weapons",
            placeholder: "Skill/CHR 8+=COMPONENT_ID"
        }
    }

    public static chatMessage(msg, extra) {
        return ChatMessage.create({"content": msg});
    }

    public static async skillRoll(text, extra) { 
        const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
        const showTrowDiag = useInvertedShiftClick ? extra["event"]["shiftKey"] : !extra["event"]["shiftKey"];
        const difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
        const re = new RegExp(/^(.+?)\/?([A-Z]*?) ?(\d*?)\+?$/);
        const [_, parsedSkill, char, diff] = re.exec(text);
        const skill = extra["actor"].items.filter(itm => itm.name === parsedSkill)[0] as TwodsixItem;
        if (!skill) {
            ui.notifications.error(game.i18n.localize("TWODSIX.Ship.ActorLacksSkill").replace("_ACTOR_NAME_", extra["actor"].name).replace("_SKILL_", parsedSkill));
            return false;
        }
        let settings = {
            characteristic: char ? char : undefined
        };
        if (diff) {
            settings["difficulty"] = Object.values(difficulties).filter(difficulty => difficulty.target === parseInt(diff, 10))[0];
        }
        const options = await TwodsixRollSettings.create(showTrowDiag, settings, skill, null);
        if (!options.shouldRoll) {
            return false;
        }
        return skill.skillRoll(showTrowDiag, options);
    }

    public static async fireEnergyWeapons(text, extra) {
        const [skilText, componentId] = text.split("=");
        const result = await TwodsixShipActions.skillRoll(skilText, extra);
        if (!result) {
            return false;
        }
        const component = extra["ship"].items.find(item => item.id === componentId);
        const extraStr = component ? `while using ${component.name}` : '';
        if (result.effect >= 0) {
            ChatMessage.create({"content": `Hit ${extraStr}`});
        } else {
            ChatMessage.create({"content": `Missed ${extraStr}`});
        }
    }
}