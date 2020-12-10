/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
import {CharacteristicType} from "../TwodsixSystem";
import {TwodsixItemData} from "../../types/TwodsixItemData";
import {calcModFor} from "../utils/sheetUtils";

export default class TwodsixItem extends Item {

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData():void {
    super.prepareData();

    const itemData:TwodsixItemData = <TwodsixItemData>this.data;

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
        const actorCharacteristics:CharacteristicType[] = Object.values(this.actor.data.data.characteristics);
        const activeCharacteristic:CharacteristicType[] = actorCharacteristics.filter((c) => {
          return c.shortLabel === itemCharacteristic;
        });

        let mod = 0;
        if (activeCharacteristic.length) {
          mod = calcModFor(activeCharacteristic[0].current);
        }

        itemData.data.total = itemData.data.value + mod;
        itemData.data.mod = mod;
      }
    }
  }
}


