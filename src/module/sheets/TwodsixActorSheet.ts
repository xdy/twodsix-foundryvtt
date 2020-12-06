import {TwodsixRolls} from "../utils/TwodsixRolls";
import {AbstractTwodsixActorSheet} from "./AbstractTwodsixActorSheet";
import type {UpdateData} from "../migration";
import {calcModFor} from "../utils/sheetUtils";
import {TWODSIX} from "../config";
import {CharacteristicType} from "../TwodsixSystem";
import TwodsixItem from "../entities/TwodsixItem";
import {TwodsixItemData} from "../../types/TwodsixItemData";

export class TwodsixActorSheet extends AbstractTwodsixActorSheet {

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType():string {
    return this.actor.data.type;
  }

  /** @override */
  getData():any {
    const data:any = super.getData();
    data.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.data.type == 'traveller') {
      TwodsixActorSheet._prepareItemContainers(data);
    }
    this.actor.data.showEffect = game.settings.get("twodsix", "effectOrTotal");

    // Add relevant data from system settings
    data.data.settings = {
      ShowRangeBandAndHideRange: game.settings.get('twodsix', 'ShowRangeBandAndHideRange'),
      ExperimentalFeatures: game.settings.get('twodsix', 'ExperimentalFeatures'),
      untrainedSkillValue: game.settings.get('twodsix', 'untrainedSkillValue'),
    };
    data.config = TWODSIX;

    return data;
  }

  /** @override */
  static get defaultOptions():FormApplicationOptions {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "actor"],
      template: "systems/twodsix/templates/actors/actor-sheet.html",
      width: 825,
      height: 648,
      resizable: false,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills"}],
      scrollY: [".skills", ".inventory", ".finances", ".info", ".notes"]
    });
  }


  protected activateListeners(html:JQuery):void {
    super.activateListeners(html);

    // Rollable abilities. Really should be in base class, but that will have to wait for issue 86
    html.find('.rollable').on('click', (this._onRoll.bind(this)));

    html.find('.roll-damage').on('click', (this._onRollDamage.bind(this)));

    html.find('.stat-damage').on('change', this._handleDamageEvent.bind(this));
    html.find('.special-damage').on('change', this._handleDamageEvent.bind(this));
  }

  private async _handleDamageEvent(event:Event):Promise<void> {
    const eventTargets = $(event.currentTarget);
    const characteristicKey = eventTargets.parents('.stat:first,.special:first').attr('data-characteristic');
    const characteristic:CharacteristicType = this.actor.data.data.characteristics[characteristicKey];
    let damage = Number(eventTargets.children("").val());
    if (damage > characteristic.current) {
      damage = characteristic.current;
    } else if (damage < 0) {
      damage = 0;
    }
    eventTargets.children("").val(damage);
    characteristic.damage = damage;
    characteristic.current = characteristic.value - characteristic.damage;
    characteristic.mod = calcModFor(characteristic.current);
    await this.updateHits();
  }


  private async updateHits():Promise<void> {
    const updateData = <UpdateData>{};
    const characteristics = this.actor.data.data.characteristics;
    updateData['data.hits.value'] = characteristics["endurance"].current + characteristics["strength"].current + characteristics["dexterity"].current;
    updateData['data.hits.max'] = characteristics["endurance"].value + characteristics["strength"].value + characteristics["dexterity"].value;
    updateData['data.characteristics.endurance.damage'] = characteristics["endurance"].damage;
    updateData['data.characteristics.strength.damage'] = characteristics["strength"].damage;
    updateData['data.characteristics.dexterity.damage'] = characteristics["dexterity"].damage;
    updateData['data.characteristics.endurance.current'] = characteristics["endurance"].current;
    updateData['data.characteristics.strength.current'] = characteristics["strength"].current;
    updateData['data.characteristics.dexterity.current'] = characteristics["dexterity"].current;
    await this.actor.update(updateData);
  }

  /**
   * Handle clickable skill rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onRoll(event:Event):Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const showThrowDialog = event["shiftKey"];
    const element = event.currentTarget;
    const dataset = element["dataset"];
    const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
    await TwodsixRolls.performThrow(this.actor, itemId, dataset, showThrowDialog);
  }

  /**
   * Handle clickable damage rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  private _onRollDamage(event:Event):void {
    event.preventDefault();
    event.stopPropagation();
    const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
    const item = this.actor.getOwnedItem(itemId) as TwodsixItem;

    async function extracted(this):Promise<void> {
      return await TwodsixRolls.rollDamage(item, true, this.actor, true, 0, game.settings.get('core', 'rollMode'));
    }

    extracted.call(this);
  }

  protected async damageActor(itemData:TwodsixItemData):Promise<number> {
    //TODO Naive implementation, assumes always choose current highest, assumes armor works
    //TODO Implement choice of primary/secondary/no armor, and full/half/double armor, as well as 'ignore first X points of armor'.
    const damage = itemData["damage"];
    const characteristics = this.actor.data.data.characteristics;
    for (const cha of Object.values(characteristics as Record<any, any>)) {
      cha.current = cha.value - cha.damage;
    }

    const armor = this.actor.data.data.primaryArmor.value;
    let remaining:number = damage - armor;
    remaining = TwodsixActorSheet.handleDamage(remaining, characteristics['endurance']);
    if (remaining > 0 && characteristics['strength'].current > characteristics['dexterity'].current) {
      remaining = TwodsixActorSheet.handleDamage(remaining, characteristics['strength']);
      remaining = TwodsixActorSheet.handleDamage(remaining, characteristics['dexterity']);
    } else {
      remaining = TwodsixActorSheet.handleDamage(remaining, characteristics['dexterity']);
      remaining = TwodsixActorSheet.handleDamage(remaining, characteristics['strength']);
    }
    if (remaining > 0) {
      console.log(`Twodsix | Actor ${this.actor.name} was overkilled by ${remaining}`);
    }
    await this.updateHits();
    return remaining;
  }

  private static handleDamage(damage:number, characteristic:CharacteristicType):number {
    let handledDamage = damage;
    if (damage > characteristic.current) {
      handledDamage = characteristic.current;
    } else if (damage < 0) {
      handledDamage = 0;
    }
    characteristic.damage += handledDamage;
    characteristic.current = characteristic.value - characteristic.damage;
    characteristic.mod = calcModFor(characteristic.current);
    return damage - handledDamage;
  }


}



