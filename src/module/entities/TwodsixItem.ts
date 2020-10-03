/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export default class TwodsixItem extends Item {
  data:TwodsixItemData;

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData():void {
    super.prepareData();

    const itemData:TwodsixItemData = this.data;

    switch (itemData.type) {
      case 'skills':
        this._prepareSkillData(itemData);
        break;
      default:
        break;
    }
  }

  private _prepareSkillData(itemData:TwodsixItemData) {
    if (this.isOwned) {
      const itemCharacteristic = itemData.data.characteristic;
      if (this.actor.data.data.characteristics) { //Temporary fix until issue #102
        const actorCharacteristics = Object.values(this.actor.data.data.characteristics);
        const activeCharacteristic:any = actorCharacteristics.filter((c:any) => {
          return c.key === itemCharacteristic;
        });

        let mod = 0;
        if (activeCharacteristic.length) {
          mod = activeCharacteristic[0].mod;
        }

        itemData.data.total = itemData.data.value + mod;
        itemData.data.mod = mod;
      }
    }
  }
}

//TODO Move these types to a better place.
//MUST match what's in the template.json. TODO Should build this from the template.json I guess
export type TwodsixItemType = "equipment" | "weapon" | "armor" | "augment" | "storage" | "tool" | "junk" | "skills";

export interface TwodsixItemData extends ItemData {
  type:TwodsixItemType;
  hasOwner:boolean;
}

