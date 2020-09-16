/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
import {calcModFor} from "../utils/sheetUtils";
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

    // Make separate methods for each Actor type (traveller, npc, etc.) to keep
    // things organized.
    switch (actorData.type) {
      case 'traveller':
        this._prepareCharacterData(actorData);
        break;
      case 'ship':
        break;
      default:
        console.log(game.i18n.localize("Twodsix.Actor.UnknownActorType") + actorData.type);
    }
  }

  /**
   * Prepare Character type specific data
   */
  async _prepareCharacterData(actorData:ActorData):Promise<void> {
    // Get the Actor's data object
    const {data} = actorData;

    for (const cha of Object.values(data.characteristics as Record<any, any>)) {
      cha.current = cha.value - cha.damage;
      cha.mod = calcModFor(cha.current);
    }

    const updateData = <UpdateData>{};
    const characteristics = data.characteristics;
    updateData['data.hits.value'] = characteristics["endurance"].current + characteristics["strength"].current + characteristics["dexterity"].current;
    updateData['data.hits.max'] = characteristics["endurance"].value + characteristics["strength"].value + characteristics["dexterity"].value;
    try {
      await this.update(updateData);
    } catch (e) {
      //TODO How do I make sure this doesn't happen due to this being called when the character isn't fully loaded. For now I'll just eat the exception. And feel bad about it...
    }
  }
}
