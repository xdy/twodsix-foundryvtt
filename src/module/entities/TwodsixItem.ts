/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export default class TwodsixItem extends Item {
  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData():void {
    super.prepareData();

    const itemData:ItemData = this.data;

    switch (itemData.type) {
      case 'skills':
        this._prepareSkillData(itemData);
        break;
      default:

    }
  // Get the Item's data
  // const itemData = this.data;
  // const actorData = this.actor ? this.actor.data : {};
  // const {data} = itemData;
  }

  private _prepareSkillData(itemData:ItemData) {
    if (this.isOwned) {
      const itemCharacteristic = itemData.data.characteristic;
      const actorCharacteristics = Object.values(this.actor.data.data.characteristics);
      const activeCharacteristic:any = actorCharacteristics.filter((c:any) => c.shortLabel === itemCharacteristic);

      let mod = 0;
      if (activeCharacteristic.length) {
        mod = activeCharacteristic[0].mod;
      }

      itemData.data.total = itemData.data.value + mod;
      itemData.data.mod = mod;

    }
  }
}
