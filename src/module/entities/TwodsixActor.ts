/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
import {calcModFor} from "../utils/sheetUtils";
import {CharacteristicType} from "../TwodsixSystem";
import {UpdateData} from "../migration";

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
  _prepareTravellerData(actorData:ActorData):void {
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
    remaining = characteristics['endurance'].current > 0 ? TwodsixActor.addDamage(remaining, characteristics['endurance']) : remaining;
    if (remaining > 0 && characteristics['strength'].current > characteristics['dexterity'].current) {
      remaining = characteristics['strength'].current > 0 ? TwodsixActor.addDamage(remaining, characteristics['strength']) : remaining;
      remaining = characteristics['dexterity'].current > 0 ? TwodsixActor.addDamage(remaining, characteristics['dexterity']) : remaining;
    } else {
      remaining = characteristics['dexterity'].current > 0 ? TwodsixActor.addDamage(remaining, characteristics['dexterity']) : remaining;
      remaining = characteristics['strength'].current > 0 ? TwodsixActor.addDamage(remaining, characteristics['strength']) : remaining;
    }
    if (remaining > 0) {
      console.log(`Twodsix | Actor ${this.name} was overkilled by ${remaining}`);
    }
    await this.updateActor();
    return remaining;
  }

  private static addDamage(damage:number, characteristic:CharacteristicType):number {
    let handledDamage = 0;
    if (damage + characteristic.damage > characteristic.value) {
      handledDamage = characteristic.value - characteristic.damage;
      characteristic.damage = characteristic.value;
    } else if (damage > 0) {
      handledDamage = damage;
      characteristic.damage += damage;
    }
    characteristic.current = characteristic.value - characteristic.damage;
    characteristic.mod = calcModFor(characteristic.current);
    return damage - handledDamage;
  }

  async updateActor():Promise<void> {
    const updateData = <UpdateData>{};
    const characteristics = this.data.data.characteristics;

    for (const cha of Object.values(characteristics as Record<any, any>)) {
      cha.current = cha.value - cha.damage;
      cha.mod = calcModFor(cha.current);
      updateData[`data.characteristics.${cha.key}.current`] = cha.current;
      updateData[`data.characteristics.${cha.key}.damage`] = cha.damage;
    }

    this.data.data.hits.value = characteristics["endurance"].current + characteristics["strength"].current + characteristics["dexterity"].current;
    this.data.data.hits.max = characteristics["endurance"].value + characteristics["strength"].value + characteristics["dexterity"].value;
    updateData['data.hits.value'] = this.data.data.hits.value;
    updateData['data.hits.max'] = this.data.data.hits.max;
    await this.update(updateData);
  }

}
