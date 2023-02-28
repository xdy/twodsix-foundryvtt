// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * @extends {Item}
 */

import {TwodsixDiceRoll} from "../utils/TwodsixDiceRoll";
import {TwodsixRollSettings} from "../utils/TwodsixRollSettings";
import TwodsixActor from "./TwodsixActor";
import {DICE_ROLL_MODES} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import {Component, Consumable, Gear, Skills, UsesConsumables, Weapon} from "../../types/template";
//import { simplifyRollFormula } from "../utils/dice";
import { confirmRollFormula } from "../utils/sheetUtils";
import { getCharacteristicFromDisplayLabel } from "../utils/TwodsixShipActions";
import ItemTemplate from "../utils/ItemTemplate";
//import {targetTokensInTemplate} from "../utils/ItemTemplate";
//import { ItemDataConstructorData } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/itemData";

export default class TwodsixItem extends Item {
  public static async create(data, options?):Promise<TwodsixItem> {
    const item = await super.create(data, options) as unknown as TwodsixItem;
    item?.setFlag('twodsix', 'newItem', true);
    if ((item?.img === "" || item?.img === foundry.documents.BaseItem.DEFAULT_ICON)) {
      if (item?.type === 'weapon') {
        await item.update({'img': 'systems/twodsix/assets/icons/default_weapon.png'});
      } else if (item?.type === "spell") {
        await item.update({'img': 'systems/twodsix/assets/icons/spell-book.svg'});
      } else if (item?.type === 'component') {
        await item.update({'img': 'systems/twodsix/assets/icons/components/other.svg'});
      }
    }
    if (item?.type === "skills" && game.settings.get('twodsix', 'hideUntrainedSkills')) {
      item.update({"system.value": 0});
    }
    return item;
  }


  /*protected override async _onCreate(data): Promise<void> {
    if (data.effects) {
      const newEffects = data.effects.map((effect:Record<string, any>) => {
        effect._id = randomID();
        if (effect.flags.twodsix === undefined) {
          effect.flags.twodsix = {};
        }
        effect.flags.twodsix.sourceId = effect._id;
        effect.origin = "";
        return effect;
      });
      this.update({ "effects": newEffects });
    }
  }*/


  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData():void {
    super.prepareData();
    if (this.getFlag("twodsix", "untrainedSkill")) {
      this.name = game.i18n.localize("TWODSIX.Actor.Skills.Untrained");
    }
  }

  prepareConsumable(gear:Gear = <Gear>this.system):void {
    if (gear.consumables !== undefined && gear.consumables.length > 0 && this.actor != null) {

      //TODO What is consumableData? Where does it come from? Not in template.json
      const allConsumables = gear.consumables.map((consumableId:string) => {
        return this.actor?.items.find((item) => item.id === consumableId);
      });
      gear.consumableData = allConsumables.filter((item) => !item?.system.isAttachment) ?? [];
      if (gear.consumableData.length > 0) {
        gear.consumableData.sort((a, b) => {
          return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
      }
      gear.attachmentData = allConsumables.filter((item) => item?.system.isAttachment) ?? [];
      if (gear.attachmentData.length > 0) {
        gear.attachmentData.sort((a, b) => {
          return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });
      }
    }
  }

  public async addConsumable(consumableId:string, gear:Gear = <Gear>this.system):Promise<void> {
    if (gear.consumables != undefined) {
      if (gear.consumables.includes(consumableId)) {
        console.error(`Twodsix | Consumable already exists for item ${this.id}`);
      } else {
        await this.update({"system.consumables": gear.consumables.concat(consumableId)}, {});
      }
    } else {
      ui.notifications.error(`Twodsix | Consumable can't be added to item ${this.id}`);
    }
  }

  public async removeConsumable(consumableId:string, gear:Gear = <Gear>this.system):Promise<void> {
    const updatedConsumables = gear.consumables.filter((cId:string) => {
      return (cId !== consumableId && cId !== null && this.actor?.items.get(cId) !== undefined);
    });
    const updateData = {"system.consumables": updatedConsumables};
    if (gear.useConsumableForAttack === consumableId) {
      updateData["system.useConsumableForAttack"] = "";
    }
    await this.update(updateData, {});
  }

  //////// WEAPON ////////

  public async performAttack(attackType:string, showThrowDialog:boolean, rateOfFireCE:number | null = null, showInChat = true, weapon:Weapon = <Weapon>this.system):Promise<void> {
    if (this.type !== "weapon") {
      return;
    }
    if (!weapon.skill) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoSkillForSkillRoll"));
      return;
    }

    /*Apply measured template if valid AOE*/
    if ( weapon.target?.type !== "none" ) {
      try {
        await (ItemTemplate.fromItem(this))?.drawPreview();
        //const templates = await (ItemTemplate.fromItem(this))?.drawPreview();
        //if (templates?.length > 0) {
        //  targetTokensInTemplate(templates[0]);
        //}
      } catch(err) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Errors.CantPlaceTemplate"));
      }
    }

    let numberOfAttacks = 1;
    let bonusDamage = "0";
    const rof = parseInt(weapon.rateOfFire, 10);
    const rateOfFire:number = rateOfFireCE ?? (!isNaN(rof) ? rof : 0);
    if (attackType && !rateOfFire) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoROFForAttack"));
    }
    const skill:TwodsixItem = this.actor?.items.get(weapon.skill) as TwodsixItem;
    const tmpSettings = {
      rollModifiers: {
        characteristic: "",
        other: 0
      }
    };
    if (skill) {
      tmpSettings.rollModifiers.characteristic = (<Skills>skill.system).characteristic || 'NONE';
    }

    let usedAmmo = 1;
    switch (attackType) {
      case "auto-full":
        numberOfAttacks = rateOfFire;
        usedAmmo = 3 * rateOfFire;
        break;
      case "auto-burst":
        bonusDamage = rateOfFire.toString();
        usedAmmo = parseInt(weapon.rateOfFire, 10);
        break;
      case "burst-attack-dm":
        //tmpSettings.diceModifier = TwodsixItem.burstAttackDM(rateOfFireCE);  // ***Delete on refactor of Roll Settings
        Object.assign(tmpSettings.rollModifiers, {rof: TwodsixItem.burstAttackDM(rateOfFireCE)});
        usedAmmo = rateOfFireCE || 0;
        break;
      case "burst-bonus-damage":
        bonusDamage = TwodsixItem.burstBonusDamage(rateOfFireCE);
        usedAmmo = rateOfFireCE || 0;
        break;
    }
    Object.assign(tmpSettings, {bonusDamage: bonusDamage});

    //Get Dodge Parry information
    if (game.settings.get("twodsix", "useDodgeParry")) {
      const weaponSkill = this.actor?.items.get(this.system.skill);
      const skillName = weaponSkill?.getFlag("twodsix", "untrainedSkill") ? this.system.associatedSkillName : weaponSkill?.name;
      if(game.user?.targets) {
        const selectedTarget = (<Token> Array.from(game.user.targets)[0])?.actor;
        const targetMatchingSkill = selectedTarget?.itemTypes.skills.find(sk => sk.name === skillName);
        const dodgeParryModifier:number = targetMatchingSkill?.system.value || 0;
        if (dodgeParryModifier > 0) {
          Object.assign(tmpSettings.rollModifiers, {dodgeParry: -dodgeParryModifier, dodgeParryLabel: skillName});
        }
      }
    }

    //Get weapon characteristic modifier
    if (this.system.handlingModifiers !== "") {
      const re = new RegExp(/^(\w+)\s+([0-9]+)-?\/(.+)\s+([0-9]+)\+?\/(.+)/gm);
      const parsedResult: RegExpMatchArray | null = re.exec(this.system.handlingModifiers);
      if (parsedResult) {
        let weaponHandlingMod = 0;
        const checkCharacteristic = getCharacteristicFromDisplayLabel(parsedResult[1], this.actor);
        if (checkCharacteristic) {
          const charValue = this.actor.system.characteristics[checkCharacteristic].value;
          if (charValue <= parseInt(parsedResult[2], 10)) {
            weaponHandlingMod = getValueFromRollFormula(parsedResult[3], this);
          } else if (charValue >= parseInt(parsedResult[4], 10)) {
            weaponHandlingMod = getValueFromRollFormula(parsedResult[5], this);
          }
        }
        Object.assign(tmpSettings.rollModifiers, {weaponsHandling: weaponHandlingMod});
        //console.log(tmpSettings);
      }
    }

    const settings:TwodsixRollSettings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, skill, this, <TwodsixActor>this.actor);

    if (!settings.shouldRoll) {
      return;
    }

    if (weapon.useConsumableForAttack) {
      const magazine = this.actor?.items.get(weapon.useConsumableForAttack) as TwodsixItem;
      if (magazine) {
        try {
          await magazine.consume(usedAmmo);
        } catch (err) {
          if (err.name == "NoAmmoError") {
            ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoAmmo"));
            return;
          } else {
            throw err;
          }
        }
      }
    }

    for (let i = 0; i < numberOfAttacks; i++) {
      const roll = await this.skillRoll(false, settings, showInChat);
      if (game.settings.get("twodsix", "automateDamageRollOnHit") && roll && roll.isSuccess()) {
        const totalBonusDamage = (bonusDamage !== "0" && bonusDamage !== "") ? `${roll.effect} + ${bonusDamage}` : `${roll.effect}`;
        const damagePayload = await this.rollDamage(settings.rollMode, totalBonusDamage, showInChat, false) || null;
        if (game.user?.targets.size === 1 && damagePayload) {
          game.user?.targets.values().next().value.actor.handleDamageData(damagePayload, <boolean>!game.settings.get('twodsix', 'invertSkillRollShiftClick'));
        } else if (game.user?.targets && game.user?.targets.size > 1) {
          ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.AutoDamageForMultipleTargetsNotImplemented"));
        }
      }
    }
  }

  public async skillRoll(showThrowDialog:boolean, tmpSettings?:TwodsixRollSettings, showInChat = true):Promise<TwodsixDiceRoll | void> {
    let skill:TwodsixItem | null = null;
    let item:TwodsixItem | undefined;
    let workingActor:TwodsixActor = this.actor;
    // Determine if this is a skill or an item
    const usesConsumable = <UsesConsumables>this.system;
    if (this.type == "skills") {
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      skill = this;
      item = undefined;
    } else if (this.type === "spell") {
      skill = <TwodsixItem>this.actor?.items.getName(game.settings.get("twodsix", "sorcerySkill"));
      if (skill === undefined) {
        skill = (<TwodsixActor>this.actor).getUntrainedSkill();
      }
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      item = this;
    } else if (this.type === "component") {
      workingActor = await fromUuid(tmpSettings?.flags.actorUUID);
      skill = <TwodsixItem>workingActor?.items.getName(tmpSettings?.skillName);
      if (skill === undefined) {
        skill = workingActor.getUntrainedSkill();
      }
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      item = this;
    } else if (usesConsumable.skill) {
      skill = this.actor?.items.get(usesConsumable.skill) as TwodsixItem;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      item = this;
    }

    if (!skill) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoSkillForSkillRoll"));
      return;
    }

    //TODO Refactor. This is an ugly fix for weapon attacks, when settings are first created, then skill rolls are made, creating new settings, so multiplying bonuses.
    if (!tmpSettings) {
      if(this.type === "spell") {
        // Spells under SOC and Barbaric have a sequential difficulty class based on spell level.  Create an override to system difficulties.
        const workingSettings = {"difficulties": {}, "difficulty": ""};
        for (let i = 1; i <= 6; i++) {
          const levelKey = game.i18n.localize("TWODSIX.Items.Spells.Level") + " " + i;
          workingSettings.difficulties[levelKey] = {mod: -i, target: i+6};
        }
        const level = game.i18n.localize("TWODSIX.Items.Spells.Level") + " " + (this.system.value > Object.keys(workingSettings.difficulties).length ? Object.keys(workingSettings.difficulties).length : this.system.value);
        workingSettings.difficulty = workingSettings.difficulties[level];
        if ( this.system.target?.type !== "none" ) {
          try {
            await (ItemTemplate.fromItem(this))?.drawPreview();
          } catch(err) {
            ui.notifications.error(game.i18n.localize("TWODSIX.Errors.CantPlaceTemplate"));
          }
        }
        tmpSettings = await TwodsixRollSettings.create(showThrowDialog, workingSettings, skill, item, workingActor);
      } else {
        tmpSettings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, skill, item, workingActor);
      }
      if (!tmpSettings.shouldRoll) {
        return;
      }
    }

    /* Decrement the item's consumable by one if present and not a weapon (attack role handles separately)*/
    if (usesConsumable.useConsumableForAttack && item && item.type != "weapon") {
      const magazine = <TwodsixItem>this.actor?.items.get(usesConsumable.useConsumableForAttack); //this shoould always be this.actor as components on ship, not working actor
      if (magazine) {
        try {
          await magazine.consume(1);
        } catch (err) {
          if (err.name == "NoAmmoError") {
            ui.notifications.error(game.i18n.localize("TWODSIX.Errors.EmptyConsumable"));
            return;
          } else {
            throw err;
          }
        }
      } else {
        ui.notifications.error(game.i18n.localize("TWODSIX.Errors.EmptyConsumable"));
        return;
      }
    }

    const diceRoll = new TwodsixDiceRoll(tmpSettings, workingActor, skill, item);

    if (showInChat) {
      await diceRoll.sendToChat(tmpSettings.difficulties);
    }
    return diceRoll;
  }

  public async rollDamage(rollMode:DICE_ROLL_MODES, bonusDamage = "", showInChat = true, confirmFormula = false):Promise<any | void> {
    const weapon = <Weapon | Component>this.system;
    const consumableDamage = this.getConsumableBonusDamage();
    if (!weapon.damage && !consumableDamage) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoDamageForWeapon"));
      return;
    } else {
      //Calc regular damage
      let rollFormula = weapon.damage + ((bonusDamage !== "0" && bonusDamage !== "") ? " + " + bonusDamage : "") + (consumableDamage != "" ? " + " + consumableDamage : "");
      //console.log(rollFormula);
      if (confirmFormula) {
        rollFormula = await confirmRollFormula(rollFormula, game.i18n.localize("TWODSIX.Damage.DamageFormula"));
      }
      rollFormula = rollFormula.replace(/dd/ig, "d6*10"); //Parse for a destructive damage roll DD = d6*10
      //rollFormula = simplifyRollFormula(rollFormula, { preserveFlavor: true });
      let damage = <Roll>{};
      let apValue = weapon.armorPiercing ?? 0;

      if (Roll.validate(rollFormula)) {
        damage = new Roll(rollFormula, this.actor?.getRollData());
        await damage.evaluate({async: true}); // async: true will be default in foundry 0.10
        apValue += this.getConsumableBonus("armorPiercing");
      } else {
        ui.notifications.error(game.i18n.localize("TWODSIX.Errors.InvalidRollFormula"));
        return;
      }

      //Calc radiation damage
      let radDamage = <Roll>{};
      if (this.type === "component") {
        if (Roll.validate(this.system.radDamage)) {
          const radFormula = this.system.radDamage.replace(/dd/ig, "d6*10"); //Parse for a destructive damage roll DD = d6*10
          //radFormula = simplifyRollFormula(radFormula);
          radDamage = new Roll(radFormula, this.actor?.getRollData());
          await radDamage.evaluate({async: true});
        }
      }

      const contentData = {};
      const flavor = `${game.i18n.localize("TWODSIX.Rolls.DamageUsing")} ${this.name}, ${game.i18n.localize("TWODSIX.Damage.AP")}(${apValue})`;
      Object.assign(contentData, {
        flavor: flavor,
        roll: damage,
        dice: getDiceResults(damage), //damage.terms[0]["results"]
        armorPiercingValue: apValue,
        damage: (damage.total && damage.total > 0) ? damage.total : 0
      });

      if (radDamage.total) {
        Object.assign(contentData, {
          radDamage: radDamage.total,
          radRoll: radDamage,
          radDice: getDiceResults(radDamage)
        });
      }
      if (showInChat) {
        const html = await renderTemplate('systems/twodsix/templates/chat/damage-message.html', contentData);
        const transfer = JSON.stringify(
          {
            type: 'damageItem',
            payload: contentData
          }
        );
        await damage.toMessage({
          speaker: this.actor ? ChatMessage.getSpeaker({actor: this.actor}) : null,
          content: html,
          type: CONST.CHAT_MESSAGE_TYPES.ROLL,
          flags: {
            "core.canPopout": true,
            "transfer": transfer,
            "twodsix.itemUUID": this.uuid,
            "twodsix.rollClass": "Damage",
            "twodsix.tokenUUID": (<Actor>this.actor)?.getActiveTokens()[0]?.document.uuid ?? "",
            "twodsix.actorUUID": (<Actor>this.actor)?.uuid ?? ""
          }
        }, {rollMode: rollMode});
      }
      return contentData;
    }
  }

  public getConsumableBonusDamage():string {
    let returnValue = "";
    if (this.system.useConsumableForAttack && this.actor) {
      const magazine = this.actor.items.get(this.system.useConsumableForAttack);
      if (magazine?.type === "consumable") {
        returnValue = (<Consumable>magazine.system)?.bonusDamage;
      }
    }
    return returnValue;
  }

  public getConsumableBonus(type:string):number {
    let returnValue = 0;
    if (this.system.attachmentData) {
      for (const attach of this.system.attachmentData) {
        returnValue += attach.system[type];
      }
    }
    if (this.system.useConsumableForAttack && this.actor) {
      const magazine = this.actor.items.get(this.system.useConsumableForAttack);
      if (magazine?.type === "consumable" && magazine?.system[type]) {
        returnValue += (<Consumable>magazine.system)[type];
      }
    }
    return returnValue;
  }

  public static burstAttackDM(number:number | null):number {
    if (number === null) {
      return 0;
    }
    if (number >= 100) {
      return 4;
    } else if (number >= 20) {
      return 3;
    } else if (number >= 10) {
      return 2;
    } else if (number >= 3) {
      return 1;
    } else {
      return 0;
    }
  }

  public static burstBonusDamage(number:number | null):string {
    if (number === null) {
      return '0';
    }
    if (number >= 100) {
      return '4d6';
    } else if (number >= 20) {
      return '3d6';
    } else if (number >= 10) {
      return '2d6';
    } else if (number >= 4) {
      return '1d6';
    } else if (number >= 3) {
      return '1';
    } else {
      return '0';
    }
  }

  public static simplifySkillName(skillName:string):string {
    return skillName.replace(/\W/g, "");
  }

  //////// CONSUMABLE ////////
  public async consume(quantity:number):Promise<void> {
    const consumableLeft = (<Consumable>this.system).currentCount - quantity;
    if (consumableLeft >= 0) {
      await this.update({"system.currentCount": consumableLeft}, {});
    } else {
      throw { name: 'NoAmmoError' };
    }
  }

  public async refill():Promise<void> {
    const consumable = <Consumable>this.system;
    if (consumable.currentCount < consumable.max) {
      if (consumable.quantity > 1) {
        //Make a duplicate and add to inventory if not empty
        if (consumable.currentCount > 0) {
          const partialConsumable = duplicate(this);
          (<Consumable>partialConsumable.system).quantity = 1;
          await this.actor?.createEmbeddedDocuments("Item", [partialConsumable]);
        }
        //refill quantity
        await this.update({
          "system.quantity": consumable.quantity - 1,
          "system.currentCount": consumable.max
        }, {});
      } else {
        throw {name: 'TooLowQuantityError'};
      }
    }
  }
}

/**
 * Handle clickable damage rolls.
 * @param {Event} event   The originating click event
 * @private
 */
export async function onRollDamage(event):Promise<void> {
  event.preventDefault();
  event.stopPropagation();
  const itemId = $(event.currentTarget).parents('.item').data('item-id');
  const item = this.actor.items.get(itemId) as TwodsixItem;

  const element = $(event.currentTarget);
  let bonusDamageFormula = String(element.data('bonus-damage') || 0);
  if (game.settings.get('twodsix', 'addEffectToManualDamage')) {
    const lastMessage = <ChatMessage>(game.messages?.contents.pop());
    if (lastMessage?.getFlag("twodsix", "effect")) {
      bonusDamageFormula === "0" ? bonusDamageFormula = String(lastMessage.getFlag("twodsix", "effect")) : bonusDamageFormula += `+` + String(lastMessage.getFlag("twodsix", "effect"));
    }
  }

  const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
  const showFormulaDialog = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];

  await item.rollDamage((<DICE_ROLL_MODES>game.settings.get('core', 'rollMode')), bonusDamageFormula, true, showFormulaDialog);

}
/**
 * A function for simplifying the dice results of a multipart roll formula.
 *
 * @param {Roll} inputRoll    The original roll.
 * @returns {object[]}        The resulting simplified dice terms.
 */
export function getDiceResults(inputRoll:Roll) {
  const returnValue:any[] = [];
  for (const die of inputRoll.dice) {
    returnValue.push(die.results);
  }
  return returnValue.flat(2);
}

/**
 * A function for getting a value from a roll string.
 *
 * @param {string} rollFormula    The original roll.
 * @param {TwodsixItem } item     Item making the roll
 * @returns {number}              The resulting roll value.
 */
export function getValueFromRollFormula(rollFormula:string, item:TwodsixItem): number {
  let returnValue = 0;
  if (Roll.validate(rollFormula)) {
    returnValue = new Roll(rollFormula, item.actor?.getRollData()).evaluate({async: false}).total;
  }
  return returnValue;
}
