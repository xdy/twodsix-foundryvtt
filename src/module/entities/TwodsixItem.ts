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
import { confirmRollFormula } from "../utils/sheetUtils";
import { getCharacteristicFromDisplayLabel } from "../utils/TwodsixShipActions";
import ItemTemplate from "../utils/ItemTemplate";
import { getDamageTypes } from "../sheets/TwodsixItemSheet";
import { TWODSIX } from "../config";

export default class TwodsixItem extends Item {
  public static async create(data, options?):Promise<TwodsixItem> {
    const item = await super.create(data, options) as unknown as TwodsixItem;
    item?.setFlag('twodsix', 'newItem', true);
    if ((item?.img === "" || item?.img === foundry.documents.BaseItem.DEFAULT_ICON)) {
      if (item?.type === 'weapon') {
        await item.update({'img': 'systems/twodsix/assets/icons/default_weapon.png'});
      } else if (item?.type === "spell") {
        const defaultSkill = await game.settings.get("twodsix", "sorcerySkill") ?? "";
        await item.update({
          img: 'systems/twodsix/assets/icons/spell-book.svg',
          'system.associatedSkillName': defaultSkill
        });
      } else if (item?.type === 'component') {
        await item.update({'img': 'systems/twodsix/assets/icons/components/other.svg'});
      } else if (item?.type === 'computer') {
        await item.update({'img': 'systems/twodsix/assets/icons/components/computer.svg'});
      }
    }
    if (item?.type === "skills" && game.settings.get('twodsix', 'hideUntrainedSkills')) {
      item.update({"system.value": 0});
    }

    //Remove any attached consumables - needed for modules (like Monks Enhanced Journals) that have own drop management
    if (item?.system?.consumables?.length > 0) {
      await item.update({"system.consumables": []});
    }

    return item;
  }

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
    let skillLevelMax = undefined;
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
        skillLevelMax =  game.settings.get("twodsix", "ruleset") === "CDEE" ? 1 : undefined; //special rule for CD-EE
        break;
      case "auto-burst":
        bonusDamage = game.settings.get("twodsix", "ruleset") === "CDEE" ? `${rateOfFire}d6kh`: rateOfFire.toString(); //special rule for CD-EE
        usedAmmo = parseInt(weapon.rateOfFire, 10);
        break;
      case "burst-attack-dm":
        Object.assign(tmpSettings.rollModifiers, {rof: TwodsixItem.burstAttackDM(rateOfFireCE)});
        usedAmmo = rateOfFireCE || 0;
        break;
      case "burst-bonus-damage":
        bonusDamage = TwodsixItem.burstBonusDamage(rateOfFireCE);
        usedAmmo = rateOfFireCE || 0;
        break;
      case "double-tap":
        Object.assign(tmpSettings.rollModifiers, {rof: 1});
        usedAmmo = 2;
        break;
    }
    Object.assign(tmpSettings, {bonusDamage: bonusDamage});
    Object.assign(tmpSettings.rollModifiers, {skillLevelMax: skillLevelMax});
    const targetTokens = Array.from(game.user.targets);
    const controlledTokens = this.actor?.getActiveTokens();

    //Get Single Target Dodge Parry information
    if (targetTokens.length === 1) {
      const dodgeParryInfo = this.getDodgeParryValues(targetTokens[0]);
      Object.assign(tmpSettings.rollModifiers, dodgeParryInfo);
    }

    //Get weapon characteristic modifier
    if (this.system.handlingModifiers !== "") {
      Object.assign(tmpSettings.rollModifiers, {weaponsHandling: this.getWeaponsHandlingMod()});
    }

    //Get single target weapons range modifier
    if (controlledTokens?.length === 1) {
      let rangeLabel = "";
      let rangeModifier = 0;
      const isCEBands =  game.settings.get('twodsix', 'rangeModifierType') === 'CE_Bands';
      const localizePrefix = "TWODSIX.Chat.Roll.RangeBandTypes.";
      if (targetTokens.length === 1) {
        const targetRange = canvas.grid.measureDistance(controlledTokens[0], targetTokens[0], {gridSpaces: true});
        rangeModifier = this.getRangeModifier(targetRange);
        rangeLabel = isCEBands ? (this.system.rangeBand === 'none' ? game.i18n.localize(localizePrefix + "none") : `${game.i18n.localize(localizePrefix + getRangeBand(targetRange))}`) : `${targetRange.toLocaleString(game.i18n.lang, {maximumFractionDigits: 2})} ${canvas.scene.grid.units}`;
      } else if (targetTokens.length === 0) {
        rangeLabel = isCEBands && this.system.rangeBand === 'none' ? game.i18n.localize(localizePrefix + "none") : game.i18n.localize("TWODSIX.Ship.Unknown");
      }
      Object.assign(tmpSettings.rollModifiers, {weaponsRange: rangeModifier, rangeLabel: rangeLabel});
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

    if (targetTokens.length > numberOfAttacks) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.TooManyTargets"));
    }

    for (let i = 0; i < numberOfAttacks; i++) {
      if (targetTokens.length > 1) {
        //need to update dodgeParry and weapons range modifiers for each target
        const dodgeParryInfo = this.getDodgeParryValues(targetTokens[i%targetTokens.length]);
        Object.assign(settings.rollModifiers, dodgeParryInfo);
        if (controlledTokens.length === 1) {
          const targetRange = canvas.grid.measureDistance(controlledTokens[0], targetTokens[i%targetTokens.length], {gridSpaces: true});
          settings.rollModifiers.weaponsRange = this.getRangeModifier(targetRange);
        }
      }
      const roll = await this.skillRoll(false, settings, showInChat);
      const addEffect:boolean = game.settings.get('twodsix', 'addEffectToDamage');
      if (game.settings.get("twodsix", "automateDamageRollOnHit") && roll?.isSuccess()) {
        let totalBonusDamage = addEffect ? `${roll.effect}` : ``;
        if (bonusDamage !== "0" && bonusDamage !== "") {
          totalBonusDamage += (addEffect ? ` + `: ``) + `${bonusDamage}`;
        }
        const damagePayload = await this.rollDamage(settings.rollMode, totalBonusDamage, showInChat, false) || null;
        if (targetTokens.length >= 1 && damagePayload) {
          targetTokens[i%targetTokens.length].actor.handleDamageData(damagePayload, <boolean>!game.settings.get('twodsix', 'autoDamageTarget'));
        }
      }
    }
  }

  public getRangeModifier(range:number): number {
    const rangeModifierType = game.settings.get('twodsix', 'rangeModifierType');
    //Handle special case of melee
    if (!['CE_Bands', 'none'].includes(rangeModifierType) && this.system.range?.toLowerCase().includes('melee')) {
      if (range <= canvas.scene.grid.distance) {
        return 0;
      } else {
        return INFEASIBLE;
      }
    }
    const rangeValues = this.system.range?.split('/', 2).map((s:string) => parseFloat(s));
    switch (rangeModifierType) {
      case 'none': {
        return 0;
      }
      case 'singleBand': {
        if (isNaN(rangeValues[0]) || (rangeValues[0] === 0 && range === 0)) {
          return 0;
        } else if (range <= rangeValues[0] * 0.25) {
          return 1;
        } else if (range <= rangeValues[0]) {
          return 0;
        } else if (range <= rangeValues[0] * 2) {
          return -2;
        } else if (range <= rangeValues[0] * 4) {
          return -4;
        } else {
          return INFEASIBLE;
        }
      }
      case 'doubleBand': {
        if (isNaN(rangeValues[0]) || rangeValues[0] > rangeValues[1] || range <= rangeValues[0]) {
          return 0;
        } else if (range <= rangeValues[1]) {
          return -2;
        } else {
          return INFEASIBLE;
        }
      }
      case 'CE_Bands': {
        const targetBand:string = getRangeBand(range);
        if (targetBand === "unknown") {
          return 0;
        } else {
          return getRangeBandModifier(this.system.rangeBand, targetBand);
        }
      }
      default: {
        return 0;
      }
    }
  }

  public getDodgeParryValues(target: Token): object {
    let dodgeParryModifier = 0;
    let skillName = "";
    if (game.settings.get("twodsix", "useDodgeParry") && target) {
      const weaponSkill = this.actor?.items.get(this.system.skill);
      skillName = weaponSkill?.getFlag("twodsix", "untrainedSkill") ? this.system.associatedSkillName : weaponSkill?.name;
      const targetMatchingSkill = target.actor?.itemTypes.skills?.find(sk => sk.name === skillName);
      dodgeParryModifier = targetMatchingSkill?.system.value || 0;
    }
    return {dodgeParry: dodgeParryModifier, dodgeParryLabel: skillName};
  }

  public getWeaponsHandlingMod(): number {
    let weaponHandlingMod = 0;
    const re = new RegExp(/^(\w+)\s+([0-9]+)-?\/(.+)\s+([0-9]+)\+?\/(.+)/gm);
    const parsedResult: RegExpMatchArray | null = re.exec(this.system.handlingModifiers);
    if (parsedResult) {
      const checkCharacteristic = getCharacteristicFromDisplayLabel(parsedResult[1], this.actor);
      if (checkCharacteristic) {
        const charValue = this.actor.system.characteristics[checkCharacteristic].value;
        if (charValue <= parseInt(parsedResult[2], 10)) {
          weaponHandlingMod = getValueFromRollFormula(parsedResult[3], this);
        } else if (charValue >= parseInt(parsedResult[4], 10)) {
          weaponHandlingMod = getValueFromRollFormula(parsedResult[5], this);
        }
      }
    }
    return weaponHandlingMod;
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
      skill =  <TwodsixItem>(workingActor?.itemTypes.skills.find(sk => sk.name === this.system?.associatedSkillName) ?? workingActor?.itemTypes.skills.find(sk => sk.name === game.settings.get("twodsix", "sorcerySkill")));
      if (skill === undefined  && workingActor) {
        skill = workingActor.getUntrainedSkill();
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
        for (let i = 1; i <= game.settings.get("twodsix", "maxSpellLevel"); i++) {
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

      //Deterime Damage type
      let damageType:string = this.getConsumableDamageType();
      if (damageType === '' || damageType === "NONE") {
        damageType = weapon.damageType ?? "NONE"; //component doesn't have a specified damage type
      }
      const damageLabels = getDamageTypes(true);
      const contentData = {};
      const flavor = `${game.i18n.localize("TWODSIX.Rolls.DamageUsing")} ${this.name}`;

      Object.assign(contentData, {
        flavor: flavor,
        roll: damage,
        dice: getDiceResults(damage), //damage.terms[0]["results"]
        armorPiercingValue: apValue,
        damageValue: (damage.total && damage.total > 0) ? damage.total : 0,
        damageType: damageType,
        damageLabel: damageLabels[damageType] ?? ""
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
        if (attach.system.subtype !== "software" || attach.system.softwareActive) {
          returnValue += attach.system[type];
        }
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

  public getConsumableDamageType():string {
    let returnValue = "";
    if (this.system.useConsumableForAttack && this.actor) {
      const magazine = this.actor.items.get(this.system.useConsumableForAttack);
      returnValue = magazine ? magazine.system.damageType : "NONE";
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

  public async resolveUnknownAutoMode() {
    let attackType = "";
    const modes = ((<Weapon>this.system).rateOfFire ?? "").split(/[-/]/);;
    switch (game.settings.get('twodsix', 'autofireRulesUsed')) {
      case TWODSIX.RULESETS.CEL.key:
        if (this.shouldShowCELAutoFireDialog()) {
          attackType = await promptForCELROF(this);
        }
        await this.performAttack(attackType, true);
        break;
      case TWODSIX.RULESETS.CE.key:
        if (modes.length > 1) {
          await promptAndAttackForCE(modes, this);
        } else {
          await this.performAttack("", true, Number(modes[0]));
        }
        break;
      default:
        await this.performAttack(attackType, true);
        break;
    }
  }

  public shouldShowCELAutoFireDialog(): boolean {
    const rateOfFire: string = (<Weapon>this.system).rateOfFire;
    return (
      (game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key) &&
      (Number(rateOfFire) > 1  || (this.system.doubleTap && game.settings.get('twodsix', 'ShowDoubleTap')))
    );
  }

  public shouldShowCEAutoFireDialog(): boolean {
    const modes = ((<Weapon>this.system).rateOfFire ?? "").split(/[-/]/);
    return (
      (game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CE.key) &&
      (modes.length > 1)
    );
  }

  ////// ACTIVE EFFECTS //////
  /**
   * A method to change the suspened state of an Actor Active effect linked to item
   *
   * @param {boolean} newSuspendedState    The new Active Effect suspended state for the actor
   * @returns {Promise<void>}
   */
  public async toggleActiveEffectStatus(newSuspendedState:boolean): Promise<void> {
    for (const effect of this.effects) {
      if (effect.disabled !== newSuspendedState) {
        await effect.update({disabled: newSuspendedState});
      }
    }
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
  if (game.settings.get('twodsix', 'addEffectToManualDamage') && game.settings.get('twodsix', 'addEffectToDamage')) {
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

export async function promptForCELROF(weapon: TwodsixItem): Promise<string> {
  if (weapon.system.doubleTap && game.settings.get('twodsix', 'ShowDoubleTap')) {
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("TWODSIX.Dialogs.ROFPickerTitle"),
        content: "",
        buttons: {
          single: {
            label: game.i18n.localize("TWODSIX.Dialogs.ROFSingle"), callback: () => {
              resolve('');
            }
          },
          doubleTap: {
            label: game.i18n.localize("TWODSIX.Dialogs.ROFDoubleTap"), callback: () => {
              resolve('double-tap');
            }
          }
        },
        default: 'single',
      }).render(true);
    });
  } else {
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("TWODSIX.Dialogs.ROFPickerTitle"),
        content: "",
        buttons: {
          single: {
            label: game.i18n.localize("TWODSIX.Dialogs.ROFSingle"), callback: () => {
              resolve('');
            }
          },
          burst: {
            label: game.i18n.localize("TWODSIX.Dialogs.ROFBurst"), callback: () => {
              resolve('auto-burst');
            }
          },
          full: {
            label: game.i18n.localize("TWODSIX.Dialogs.ROFFull"), callback: () => {
              resolve('auto-full');
            }
          }
        },
        default: 'single',
      }).render(true);
    });
  }
}

export async function promptAndAttackForCE(modes: string[], item: TwodsixItem) {
  const buttons = {};

  for ( const mode of modes) {
    const number = Number(mode);
    const attackDM = TwodsixItem.burstAttackDM(number);
    const bonusDamage =TwodsixItem.burstBonusDamage(number);

    if (number === 1) {
      buttons["single"] = {
        "label": game.i18n.localize("TWODSIX.Dialogs.ROFSingle"),
        "callback": () => {
          item.performAttack("", true, 1);
        }
      };
    } else if (number > 1){
      let key = game.i18n.localize("TWODSIX.Rolls.AttackDM")+ ' +' + attackDM;
      buttons[key] = {
        "label": key,
        "callback": () => {
          item.performAttack('burst-attack-dm', true, number);
        }
      };

      key = game.i18n.localize("TWODSIX.Rolls.BonusDamage") + ' +' + bonusDamage;
      buttons[key] = {
        "label": key,
        "callback": () => {
          item.performAttack('burst-bonus-damage', true, number);
        }
      };
    }
  }

  await new Dialog({
    title: game.i18n.localize("TWODSIX.Dialogs.ROFPickerTitle"),
    content: "",
    buttons: buttons,
    default: "single"
  }).render(true);
}

/**
 * A function for returning qualitative range band. Per CE rules https://www.orffenspace.com/cepheus-srd/personal-combat.html#range
 *
 * @param {number} range    The range in meters
 * @returns {string}        The resulting range band
 */
function getRangeBand(range: number):string {
  //Convert ft to m if necessay
  const units = canvas.scene.grid.units.toLowerCase();
  if (units === 'ft' || units === 'feet') {
    range /= 3.28;
  }

  if (range < 1.5) {
    return 'personal';
  } else if (range <= 3) {
    return 'close';
  } else if (range <= 12) {
    return 'short';
  } else if (range <= 50) {
    return 'medium';
  } else if (range <= 250) {
    return 'long';
  } else if (range <= 500) {
    return 'veryLong';
  } else if (range > 500) {
    return 'distant';
  } else {
    return 'unknown';
  }
}

/**
 * A function for returning range modifier based on RangeTable constant
 * @param {string} weaponBand   Weapon's range description, (.e.g., close quarters, thrown, rifle)
 * @param {string} targetDistanceBand Qualitative distance to target, (e.g. close, short, very long)
 * @returns {number} Range Modifier
 */
function getRangeBandModifier(weaponBand: string, targetDistanceBand: string): number {
  if (targetDistanceBand === 'unknown' || weaponBand === 'none') {
    return 0;
  } else {
    return CE_Range_Table[weaponBand][targetDistanceBand];
  }
}

// CE SRD Range Table Cepheus Engine SRD Table https://www.orffenspace.com/cepheus-srd/personal-combat.html#range.
const INFEASIBLE = -99;
const CE_Range_Table = Object.freeze({
  closeQuarters: {
    personal: 0,
    close: -2,
    short: INFEASIBLE,
    medium: INFEASIBLE,
    long: INFEASIBLE,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  extendedReach: {
    personal: -2,
    close: 0,
    short: INFEASIBLE,
    medium: INFEASIBLE,
    long: INFEASIBLE,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  thrown: {
    personal: INFEASIBLE,
    close: 0,
    short: -2,
    medium: -2,
    long: INFEASIBLE,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  pistol: {
    personal: -2,
    close: 0,
    short: 0,
    medium: -2,
    long: -4,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  rifle: {
    personal: -4,
    close: -2,
    short: 0,
    medium: 0,
    long: 0,
    veryLong: -2,
    distant: -4
  },
  shotgun: {
    personal: -2,
    close: 0,
    short: -2,
    medium: -2,
    long: -4,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  assaultWeapon: {
    personal: -2,
    close: 0,
    short: 0,
    medium: 0,
    long: -2,
    veryLong: -4,
    distant: -6
  },
  rocket: {
    personal: -4,
    close: -2,
    short: -2,
    medium: 0,
    long: 0,
    veryLong: -2,
    distant: -4
  }
});
