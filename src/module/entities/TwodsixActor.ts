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
import {Characteristic, Component, Gear, Skills, Traveller, Weapon} from "../../types/template";

export default class TwodsixActor extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareDerivedData(): void {
    super.prepareDerivedData();
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
        this._prepareShipData(actorData);
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

  _prepareShipData(actorData): void {

    let calcPowerMax = 0;
    let calcPowerUsed = 0;
    /*let weight = 0;*/
    let calcSystemsPower = 0;
    let calcjDrivePower = 0;
    let calcmDrivePower = 0;
    let calcSensorsPower = 0;
    let calcWeaponsPower = 0;

    actorData.items.filter((item: TwodsixItem) => item.type === "component").forEach((item: TwodsixItem) => {
      const anComponent = <Component>item.data.data;
      const powerForItem = TwodsixActor._getPowerNeeded(anComponent);

      switch (anComponent.subtype) {
        case 'power':
          calcPowerMax -= powerForItem;
          break;
        case 'drive':
          if (item.data.name.toLowerCase().includes('j-drive') || item.data.name.toLowerCase().includes('j drive')) {
            calcjDrivePower += powerForItem;
          } else if (item.data.name.toLowerCase().includes('m-drive') || item.data.name.toLowerCase().includes('m drive')) {
            calcmDrivePower += powerForItem;
          } else {
            calcSystemsPower += powerForItem;
          }
          break;
        case 'sensor':
          calcSensorsPower += powerForItem;
          break;
        case 'armament':
          calcWeaponsPower += powerForItem;
          break;
        default:
          calcSystemsPower += powerForItem;
          break;
      }
    });

    calcPowerUsed = calcjDrivePower + calcmDrivePower + calcSensorsPower + calcWeaponsPower + calcSystemsPower;
    if ((calcPowerUsed > 0) || (calcPowerMax > 0)) {
      actorData.data.shipStats.power.value = calcPowerUsed;
      actorData.data.shipStats.power.max = calcPowerMax;
      actorData.data.reqPower.systems = calcSystemsPower;
      actorData.data.reqPower["m-drive"] = calcmDrivePower;
      actorData.data.reqPower["j-drive"] = calcjDrivePower;
      actorData.data.reqPower.sensors = calcSensorsPower;
      actorData.data.reqPower.weapons = calcWeaponsPower;
    }
  }

  private static _getPowerNeeded(item: Component): number{
    if ((item.status === "operational") || (item.status === "damaged")) {
      const q = item.quantity || 1;
      const p = item.powerDraw || 0;
      if (item.subtype === "power"){
        return -(q * p);
      }
      return (q * p);
    }
    return 0;
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
      return calcModFor((<Traveller>this.data.data).characteristics[keyByValue].current);
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
