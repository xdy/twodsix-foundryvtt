/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
import {calcModFor, getKeyByValue} from "../utils/sheetUtils";
import {TWODSIX} from "../config";
import {TwodsixRollSettings} from "../utils/TwodsixRollSettings";
import {TwodsixDiceRoll} from "../utils/TwodsixDiceRoll";
import TwodsixItem from "./TwodsixItem";

export default class TwodsixActor extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData():void {
    super.prepareData();

    const actorData = this.data;
    // const data = actorData.data;
    // const flags = actorData.flags;

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.data.items = Array.from(this.items.values()).map(i => duplicate(i.data));

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
  _prepareTravellerData(actorData:any):void {
    // Get the Actor's data object
    const {data} = actorData;

    for (const cha of Object.values(data.characteristics as Record<any, any>)) {
      cha.current = cha.value - cha.damage;
      cha.mod = calcModFor(cha.current);
    }
  }

  protected async damageActor(damage:number):Promise<number> {
    //TODO Naive implementation, assumes always choose current highest, assumes armor works
    //TODO Implement choice of primary/secondary/no armor, and full/half/double armor, as well as 'ignore first X points of armor'.
    //TODO Rewrite this...
    const characteristics = this.data.data.characteristics;
    const armor = this.data.data.primaryArmor.value;
    let remaining:number = damage - armor;
    let updateData = {};

    [remaining, updateData] = this.addDamage(remaining, updateData, 'endurance');
    if (remaining > 0 && characteristics['strength'].current > characteristics['dexterity'].current) {
      [remaining, updateData] = this.addDamage(remaining, updateData, 'strength');
      [remaining, updateData] = this.addDamage(remaining, updateData, 'dexterity');
    } else {
      [remaining, updateData] = this.addDamage(remaining, updateData, 'dexterity');
      [remaining, updateData] = this.addDamage(remaining, updateData, 'strength');
    }
    if (remaining > 0) {
      console.log(`Twodsix | Actor ${this.name} was overkilled by ${remaining}`);
    }
    this.update(updateData);
    return remaining;
  }

  private addDamage(damage:number, updateData, chrName):[number,any] {
    const characteristics = this.data.data.characteristics;
    const  characteristic = characteristics[chrName];
    if (characteristic.current > 0) {
      let handledDamage = 0;
      let totalDamage = characteristic.damage;
      if (damage + characteristic.damage > characteristic.value) {
        handledDamage = characteristic.value - characteristic.damage;
        totalDamage = characteristic.value;
      } else if (damage > 0) {
        handledDamage = damage;
        totalDamage = characteristic.damage + damage;
      }
      updateData[`data.characteristics.${chrName}.damage`] = totalDamage;
      return [damage - handledDamage, updateData];
    } else {
      return [damage, updateData];
    }
  }

  public getCharacteristicModifier(characteristic:string):number {
    if (characteristic === 'NONE') {
      return 0;
    } else {
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      return calcModFor(this.data.data.characteristics[keyByValue].current);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async characteristicRoll(tmpSettings:any, showThrowDialog:boolean, showInChat = true):Promise<TwodsixDiceRoll> {
    if (!tmpSettings["characteristic"]) {
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
    console.log("DEBUG CHARACTERISTICS ROLL:", diceRoll);
    return diceRoll;
  }

  public getUntrainedSkill():TwodsixItem {
    return this.getOwnedItem(this.data.data.untrainedSkill) as TwodsixItem;
  }

  public async createUntrainedSkill(): Promise<void> {
    const untrainedSkill = await this.buildUntrainedSkill();
    await this.update({"data.untrainedSkill": untrainedSkill._id});
  }

  public async buildUntrainedSkill():Promise<TwodsixItem> {
    if (this.data.data.untrainedSkill) {
      return;
    }
    const data = {
      "name": game.i18n.localize("TWODSIX.Actor.Skills.Untrained"),
      "type": "skills",
      "flags": {'twodsix.untrainedSkill': true}
    };
    return await this.createOwnedItem(data) as unknown as TwodsixItem;
  }

  private static _applyToAllActorItems(func: (actor:TwodsixActor, item:TwodsixItem) => void):void {
    TwodsixActor.collection.forEach(actor => {
      // @ts-ignore
      actor.data.items.forEach((itemData:Record<string,any>) => {
        // @ts-ignore
        const item = actor.getOwnedItem(itemData._id);
        // @ts-ignore
        func(actor, item);
      });
    });
  }

  public static resetUntrainedSkill():void {
    TwodsixActor._applyToAllActorItems((actor:TwodsixActor, item:TwodsixItem) => {
      if (item.type === "skills") {
        return;
      }
      const skill = actor.getOwnedItem(item.data.data.skill);
      if (skill && skill.getFlag("twodsix", "untrainedSkill")) {
        item.update({ "data.skill": "" }, {});
      }
    });
  }

  public static setUntrainedSkillForWeapons():void {
    TwodsixActor._applyToAllActorItems((actor:TwodsixActor, item:TwodsixItem) => {
      if (item.type === "weapon" && !item.data.data.skill) {
        item.update({"data.skill": actor.getUntrainedSkill().id}, {});
      }
    });
  }
}
