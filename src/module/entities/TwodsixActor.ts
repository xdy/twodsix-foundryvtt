/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
import {calcModFor} from "../utils/sheetUtils";

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
  }
}
