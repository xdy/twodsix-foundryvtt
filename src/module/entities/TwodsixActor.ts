/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
import { calcModFor, getKeyByValue } from "../utils/sheetUtils";
import { TWODSIX } from "../config";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import { TwodsixDiceRoll } from "../utils/TwodsixDiceRoll";
import TwodsixItem from "./TwodsixItem";
import { Stats } from "../utils/actorDamage";
import {Characteristic, Gear, Skills, Traveller, Weapon} from "../../types/template";

export default class TwodsixActor extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData(): void {
    super.prepareData();

    const actorData = <TwodsixActor><unknown>this.data;
    // const data = actorData.data;
    // const flags = actorData.flags;

    // Make separate methods for each Actor type (traveller, npc, etc.) to keep
    // things organized.
    switch (actorData.type) {
      case 'traveller':
        this._prepareTravellerData(actorData);
        break;
      case 'ship':
        break;
      default:
        console.log(game.i18n.localize("Twodsix.Actor.UnknownActorType") + " " + actorData.type);
    }

  }

  /**
   * Prepare Character type specific data
   */
  _prepareTravellerData(actorData): void {
    const {data} = actorData;

    for (const cha of Object.keys(data.characteristics)) {
      const characteristic: Characteristic = data.characteristics[cha];
      characteristic.current = characteristic.value - characteristic.damage;
      characteristic.mod = calcModFor(characteristic.current);
    }
    const actorSkills = actorData.items.filter(
      (item:TwodsixItem) => item.type === "skills"
    ).map(
      (skill:TwodsixItem) => [TwodsixItem.simplifySkillName(skill.name ?? ""), (skill.data.data as Skills).value]
    );

    const handler = {
      has: (target: Record<string,number>, property:string) => {
        return property[property.length - 1] !== "_" ? true : property.slice(0, -1) in target;
      },
      get: (target: Record<string,number>, property:string) => {
        if (property[property.length - 1] === "_") {
          const newName = property[property.length - 1] === "_" ? property.slice(0, -1) : property;
          return newName in target && target[newName] > 0 ? target[newName] : 0;
        } else {
          return property in target ? target[property] : (this.getUntrainedSkill().data.data as Skills).value;
        }
      }
    };

    data.skills = new Proxy(Object.fromEntries(actorSkills), handler);
  }

  protected async _onCreate() {
    switch (this.data.type) {
      case "traveller":
        if (game.settings.get("twodsix", "defaultTokenSettings")) {
          this.update( {
            "token.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER,
            "token.displayBars": CONST.TOKEN_DISPLAY_MODES.ALWAYS,
            "token.vision": true,
            "token.brightSight": 1000,
            "token.dimSight": 0,
            "token.actorLink": true,
            "token.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
            "token.bar1": {
              attribute: "hits"
            }
          });
        }
        await this.createUntrainedSkill();
        if (this.data.img === CONST.DEFAULT_TOKEN) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_actor.png'
          });
        }
        break;
      case "ship":
        if (this.data.img === CONST.DEFAULT_TOKEN) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_ship.png'
          });
        }
        break;
    }
    if (game.settings.get("twodsix", "useSystemDefaultTokenIcon")) {
      await this.update({
        'token.img': CONST.DEFAULT_TOKEN //'icons/svg/mystery-man.svg'
      });
    }
  }

  public async damageActor(damage: number, showDamageDialog = true): Promise<void> {
    if (showDamageDialog) {
      const damageData: { damage: number; damageId: string, tokenId?: string|null, actorId?: string|null } = {
        damage: damage,
        damageId: "damage-" + Math.random().toString(36).substring(2, 15)
      };

      if (this.isToken) {
        damageData.tokenId = this.token?.id;
      } else {
        damageData.actorId = this.id;
      }
      game.socket?.emit("system.twodsix", ["createDamageDialog", damageData]);
      Hooks.call('createDamageDialog', damageData);
    } else {
      const stats = new Stats(this, damage);
      stats.applyDamage(); //TODO Should have await?
    }
  }

  public getCharacteristicModifier(characteristic: string): number {
    if (characteristic === 'NONE') {
      return 0;
    } else if (this.data.type === 'ship') {
      return 0;
    } else {
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      return calcModFor(this.data.data.characteristics[keyByValue].current);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async characteristicRoll(tmpSettings: any, showThrowDialog: boolean, showInChat = true): Promise<TwodsixDiceRoll | void> {
    if (!tmpSettings.characteristic) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoCharacteristicForRoll"));
      return;
    }
    const settings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings);
    if (!settings.shouldRoll) {
      return;
    }

    const diceRoll = new TwodsixDiceRoll(settings, this);
    if (showInChat) {
      await diceRoll.sendToChat();
    }
    return diceRoll;
  }

  public getUntrainedSkill(): TwodsixItem {
    return <TwodsixItem>this.items.get((<Traveller>this.data.data).untrainedSkill);
  }

  public async createUntrainedSkill(): Promise<void> {
    const untrainedSkill = await this.buildUntrainedSkill();
    if (untrainedSkill) {
      await this.update({"data.untrainedSkill": untrainedSkill['id']});
    }
  }

  public async buildUntrainedSkill(): Promise<Skills | void> {
    if ((<Traveller>this.data.data).untrainedSkill) {
      return;
    }
    const data = {
      "name": game.i18n.localize("TWODSIX.Actor.Skills.Untrained"),
      "type": "skills",
      "data": {"characteristic": "NONE"},
      "flags": {'twodsix.untrainedSkill': true}
    };


    const data1: Skills = <Skills><unknown>await (this.createEmbeddedDocuments("Item", [data]));
    return data1[0];
  }

  private static _applyToAllActorItems(func: (actor: TwodsixActor, item: TwodsixItem) => void): void {
    game.actors?.forEach(actor => {
      actor.items.forEach((item: TwodsixItem) => {
        func(<TwodsixActor><unknown>actor, item);
      });
    });
  }

  public static resetUntrainedSkill(): void {
    //TODO Some risk of race condition here, should return list of updates to do, then do the update outside the loop
    TwodsixActor._applyToAllActorItems((actor: TwodsixActor, item: TwodsixItem) => {
      if (item.type === "skills") {
        return;
      }
      const skill = actor.items.get((<Gear>item.data.data).skill);
      if (skill && skill.getFlag("twodsix", "untrainedSkill")) {
        item.update({"data.skill": ""}, {}); //TODO Should have await?
      }
    });
  }

  public static setUntrainedSkillForWeapons(): void {
    //TODO Some risk of race condition here, should return list of updates to do, then do the update outside the loop
    TwodsixActor._applyToAllActorItems((actor: TwodsixActor, item: TwodsixItem) => {
      if (item.type === "weapon" && !(<Weapon>item.data.data).skill && actor.type === "traveller") {
        item.update({"data.skill": actor.getUntrainedSkill().id}, {}); //TODO Should have await?
      }
    });
  }
}
