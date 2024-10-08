// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {TwodsixDiceRoll} from "../utils/TwodsixDiceRoll";
import {TwodsixRollSettings} from "../utils/TwodsixRollSettings";
import TwodsixActor from "./TwodsixActor";
import {DICE_ROLL_MODES} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import {Component, Consumable, Gear, Skills, UsesConsumables, Weapon} from "../../types/template";
import { confirmRollFormula } from "../utils/sheetUtils";
import { getCharacteristicFromDisplayLabel } from "../utils/utils";
import ItemTemplate from "../utils/ItemTemplate";
import { getDamageTypes } from "../utils/sheetUtils";
import { TWODSIX } from "../config";
import { applyEncumberedEffect, applyWoundedEffect, checkForDamageStat } from "../utils/showStatusIcons";
import { getTargetModifiers } from "../utils/targetModifiers";

/**
 * Extend the base Item entity
 * @extends {Item}
 */
export default class TwodsixItem extends Item {
  /**
   * Perform preliminary operations before a Document of this type is created.
   * Pre-creation operations only occur for the client which requested the operation.
   * Modifications to the pending document before it is persisted should be performed with this.updateSource().
   * @param {object} data               The initial data object provided to the document creation request
   * @param {object} options            Additional options which modify the creation request
   * @param {documents.BaseUser} user   The User requesting the document creation
   * @returns {Promise<boolean|void>}   A return value of false indicates the creation operation should be cancelled.
   * @protected
   */
  async _preCreate(data, options, user): Promise <void> {
    await super._preCreate(data, options, user);
    const updates = {};
    if ((this.img === "" || this.img === foundry.documents.BaseItem.DEFAULT_ICON)) {
      if (this.type === 'weapon') {
        Object.assign(updates, {img: 'systems/twodsix/assets/icons/default_weapon.png'});
      } else if (this.type === "spell") {
        const defaultSkill = await game.settings.get("twodsix", "sorcerySkill") ?? "";
        Object.assign(updates, {
          img: 'systems/twodsix/assets/icons/spell-book.svg',
          'system.associatedSkillName': defaultSkill
        });
      } else if (this.type === 'component') {
        Object.assign(updates, {img: 'systems/twodsix/assets/icons/components/other.svg'});
      } else if (this.type === 'computer') {
        Object.assign(updates, {img: 'systems/twodsix/assets/icons/components/computer.svg'});
      }
    }

    if (this.type === "skills" && game.settings.get('twodsix', 'hideUntrainedSkills') && !this.getFlag('twodsix', 'untrainedSkill') && this.system.value < 0) {
      Object.assign(updates, {"system.value": 0});
    }

    if (!["trait", "skills", "ship_position", "component"].includes(this.type)) {
      //Remove any attached consumables - needed for modules (like Monks Enhanced Journals) that have own drop management
      if (!["spell"].includes(this.type)) {
        if (this.system.consumables?.length > 0) {
          Object.assign(updates, {"system.consumables": []});
        }
        Object.assign(updates, {"system.useConsumableForAttack": ""});
      }

      //Try to set linked skill
      if (this.actor) {
        if (this.system.associatedSkillName === '') {
          Object.assign(updates, {"system.skill": this.actor.system.untrainedSkill});
        } else {
          const tempSkill = (<TwodsixActor>this.actor).getBestSkill(this.system.associatedSkillName, false);
          Object.assign(updates, {"system.skill": tempSkill?.id ?? this.actor.system.untrainedSkill});
        }
      }
    }

    Object.assign(updates, {"system.type": this.type});
    Object.assign(updates, {"flags.twodsix.newItem": true});
    await this.updateSource(updates);
  }

  /**
   * Perform follow-up operations after a Document of this type is updated.
   * Post-update operations occur for all clients after the update is broadcast.
   * @param {object} changed            The differential data that was changed relative to the documents prior values
   * @param {object} options            Additional options which modify the update request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onUpdate}
   * @protected
   */
  async _onUpdate(changed:object, options:object, userId:string) {
    await super._onUpdate(changed, options, userId);
    if (game.user?.id === userId) {
      const owningActor: TwodsixActor = this.actor;
      if (game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && owningActor?.type === 'traveller' && !options.dontSync) {
        if (!["skills", "trait", "spell"].includes(this.type) && changed.system) {
          if ((Object.hasOwn(changed.system, "weight") || Object.hasOwn(changed.system, "quantity") || (Object.hasOwn(changed.system, "equipped")) && this.system.weight > 0)) {
            await applyEncumberedEffect(owningActor);
          }
        }
      }
      //Needed - for active effects changing damage stats
      if (game.settings.get('twodsix', 'useWoundedStatusIndicators') && owningActor) {
        if (checkForDamageStat(changed, owningActor.type) && ["traveller", "animal", "robot"].includes(owningActor.type)) {
          await applyWoundedEffect(owningActor);
        }
      }
    }

    //Update item tab list if TL Changed
    if (game.settings.get('twodsix', 'showTLonItemsTab')) {
      if(["skills", "trait", "spell", "ship_position"].includes(this.type)) {
        return;
      } else if (this.isEmbedded || this.compendium) {
        return;
      } else if (changed.system?.techLevel) {
        ui.items.render();
      }
    }

  }

  public static async create(data, options?):Promise<TwodsixItem> {
    const item = await super.create(data, options) as unknown as TwodsixItem;
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

  /**
   * Augment the basic item data with additional dynamic data.
   */
  prepareDerivedData(): void {
    super.prepareDerivedData();
    this.system.canProcess = (this.type === "consumable" && ["processor", "suite"].includes(this.system.subtype));
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
  /**
   * Perform a weapon attack.
   * @param attackType {string} Type of autofire attack (e.g. 'single', 'auto-full', 'auto-burst')
   * @param showThrowDialog {boolean} Whether to show roll/through dialog
   * @param rateOfFireCE {number} Fire rate / consumables used
   * @param showInChat Whehter to show attack in chat
   */
  public async performAttack(attackType:string, showThrowDialog:boolean, rateOfFireCE:number, showInChat = true):Promise<void> {
    if (this.type !== "weapon") {
      return;
    }
    const weapon:Weapon = <Weapon>this.system;
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
        //  ItemTemplate.targetTokensInTemplate(templates[0]);
        //}
      } catch(err) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Errors.CantPlaceTemplate"));
      }
    }

    // Initialize settings
    const tmpSettings = {
      rollType: "Normal",
      bonusDamage: "0",
      rollModifiers: {
        characteristic: "",
        other: 0
      }
    };

    // Set characteristic from skill
    const skill:TwodsixItem | undefined  = this.actor?.items.get(weapon.skill) ?? (game.settings.get("twodsix", "hideUntrainedSkills") ? this.actor?.getUntrainedSkill() : undefined);
    if (!skill) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoSkillForSkillRoll"));
      return;
    }
    tmpSettings.rollModifiers.characteristic = (<Skills>skill.system).characteristic || 'NONE';
    tmpSettings.rollType = skill.system.rolltype || "Normal";

    // Get fire mode parameters
    const { weaponType, isAutoFull, usedAmmo, numberOfAttacks } = this.getFireModeParams(rateOfFireCE, attackType, tmpSettings);
    const useCTBands: boolean = game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands';

    // Define Targets
    const targetTokens = Array.from(game.user.targets);
    const controlledTokens = this.actor?.getActiveTokens();

    // Get target Modifiers
    if (targetTokens.length === 0 && useCTBands) {
      Object.assign(tmpSettings.rollModifiers, {armorModifier: 0, armorLabel: game.i18n.localize('TWODSIX.Ship.Unknown')});
    } else if (targetTokens.length === 1) {
      // Get Single Target Dodge Parry information
      const dodgeParryInfo = this.getDodgeParryValues(targetTokens[0]);
      Object.assign(tmpSettings.rollModifiers, dodgeParryInfo);

      //Get single target weapon-armor modifier
      if (useCTBands) {
        const weaponArmorInfo = this.getWeaponArmorValues(targetTokens[0], weaponType, isAutoFull);
        Object.assign(tmpSettings.rollModifiers, weaponArmorInfo);
      }
    }

    // Get weapon handling modifier
    if (this.system.handlingModifiers !== "") {
      Object.assign(tmpSettings.rollModifiers, {weaponsHandling: this.getWeaponsHandlingMod(rateOfFireCE)});
    }

    //Get single target weapons range modifier
    if (controlledTokens?.length === 1) {
      let rangeLabel = "";
      let rangeModifier = 0;
      let appliedStatuses = [];
      const isQualitativeBands = ['CE_Bands', 'CT_Bands', 'CU_Bands'].includes(game.settings.get('twodsix', 'rangeModifierType'));
      const localizePrefix = "TWODSIX.Chat.Roll.RangeBandTypes.";
      if (targetTokens.length === 1) {
        const targetRange = canvas.grid.measurePath([controlledTokens[0], targetTokens[0]]).distance;
        const rangeData = this.getRangeModifier(targetRange, weaponType, isAutoFull);
        rangeModifier = rangeData.rangeModifier;
        if (rangeData.rollType !== tmpSettings.rollType ) {
          Object.assign(tmpSettings, {rollType: (tmpSettings.rollType === 'Normal' ? rangeData.rollType : 'Normal')});
        }
        if (isQualitativeBands) {
          rangeLabel = this.system.rangeBand === 'none' ? game.i18n.localize(localizePrefix + "none") : `${game.i18n.localize('TWODSIX.Chat.Roll.WeaponRangeTypes.' + weaponType)} @ ${game.i18n.localize(localizePrefix + getRangeBand(targetRange))}`;
        } else {
          rangeLabel = `${this.system.range} @ ${targetRange.toLocaleString(game.i18n.lang, {maximumFractionDigits: 2})}${canvas.scene.grid.units}`;
        }
        appliedStatuses = getTargetModifiers(targetTokens[0].actor);
      } else if (targetTokens.length === 0) {
        rangeLabel = isQualitativeBands && this.system.rangeBand === 'none' ? game.i18n.localize(localizePrefix + "none") : game.i18n.localize("TWODSIX.Ship.Unknown");
      }
      //console.log("Actual Range: ", rangeLabel, "Weapon Range: ", isQualitativeBands ? `${game.i18n.localize('TWODSIX.Chat.Roll.WeaponRangeTypes.' + weaponType)}` : `${this.system.range} ${canvas.scene.grid.units}`);
      Object.assign(tmpSettings.rollModifiers, {weaponsRange: rangeModifier, rangeLabel: rangeLabel, targetModifier: appliedStatuses});
    }
    //Flag that targetDM is an override
    Object.assign(tmpSettings.rollModifiers, {targetModifierOverride: targetTokens.length > 1});

    const settings:TwodsixRollSettings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, skill, this, <TwodsixActor>this.actor);

    if (!settings.shouldRoll) {
      return;
    }

    // Update consumables for use
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

    //Make attack rolls
    const targetModifierOverride = [...settings.rollModifiers.targetModifier];
    for (let i = 0; i < numberOfAttacks; i++) {
      if (targetTokens.length > 1) {
        //need to update dodgeParry and weapons range modifiers for each target
        const dodgeParryInfo = this.getDodgeParryValues(targetTokens[i%targetTokens.length]);
        Object.assign(settings.rollModifiers, dodgeParryInfo);

        // Get armor modifier, if necessary
        if (useCTBands) {
          const weaponArmorInfo = this.getWeaponArmorValues(targetTokens[i%targetTokens.length], weaponType, isAutoFull);
          Object.assign(settings.rollModifiers, weaponArmorInfo);
        }
        //Set range modifiers if possible
        if (controlledTokens.length === 1) {
          const targetRange = canvas.grid.measurePath([controlledTokens[0], targetTokens[i%targetTokens.length]]).distance;
          const rangeData = this.getRangeModifier(targetRange, weaponType, isAutoFull);
          Object.assign(settings.rollModifiers, {weaponsRange: rangeData.rangeModifier});
          Object.assign(settings, {rollType: rangeData.rollType});
        }
        //Assign target modifiers based on statuses, if not overridden
        if (targetModifierOverride.length > 0 ) {
          Object.assign(settings.rollModifiers, {targetModifier: targetModifierOverride});
        } else {
          Object.assign(settings.rollModifiers, {targetModifier: getTargetModifiers(targetTokens[i%targetTokens.length].actor)});
        }
      }
      const roll = await this.skillRoll(false, settings, showInChat);
      const addEffect:boolean = game.settings.get('twodsix', 'addEffectToDamage');
      if (game.settings.get("twodsix", "automateDamageRollOnHit") && roll?.isSuccess()) {
        let totalBonusDamage = addEffect ? `${roll.effect}` : ``;
        if (tmpSettings.bonusDamage !== "0" && tmpSettings.bonusDamage !== "") {
          totalBonusDamage += (addEffect ? ` + `: ``) + `${tmpSettings.bonusDamage}`;
        }
        const damagePayload = await this.rollDamage(settings.rollMode, totalBonusDamage, showInChat, false) || null;
        if (targetTokens.length >= 1 && damagePayload) {
          targetTokens[i%targetTokens.length].actor.handleDamageData(damagePayload, <boolean>!game.settings.get('twodsix', 'autoDamageTarget'));
        }
      }
    }
  }

  /**
   * A method to get the weapon fire mode parameters.
   * @param {number} rateOfFireCE  The rate of fire used
   * @param {string} attackType The type of attack (e.g. burst, double-tap, etc.)
   * @param {any} tmpSettings the temporary settings object for the roll
   * @returns {any} { weaponType, isAutoFull, usedAmmo, numberOfAttacks }
   */
  private getFireModeParams( rateOfFireCE: number, attackType: string, tmpSettings: any): any {
    const ruleSet = game.settings.get('twodsix', 'ruleset');
    const weapon:Weapon = <Weapon>this.system;
    let numberOfAttacks = 1;
    let bonusDamage = "0";
    let isAutoFull = false;
    let skillLevelMax: number | undefined = undefined;
    const rof = parseInt(weapon.rateOfFire, 10);
    const rateOfFire: number = rateOfFireCE ?? (!isNaN(rof) ? rof : 1);
    if (attackType !== 'single' && !rateOfFire) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoROFForAttack"));
    }

    let usedAmmo = rateOfFire;
    let weaponTypeOverride = "";
    const autoFireRules: string = game.settings.get('twodsix', 'autofireRulesUsed');

    switch (attackType) {
      case "single":
        // Need a single fire override for auto weapons
        if (game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands') {
          if (weapon.rangeBand === 'autoRifle') {
            weaponTypeOverride = 'rifle';
          } else if (weapon.rangeBand === 'submachinegun') {
            weaponTypeOverride = 'autoPistol';
          }
        }
        break;
      case "auto-full":
        numberOfAttacks = getNumberOfAttacks(autoFireRules, rateOfFire);
        if (autoFireRules === 'CEL') {
          usedAmmo = 3 * rateOfFire;
        }
        skillLevelMax = ruleSet === "CDEE" ? 1 : undefined; //special rule for CD-EE
        isAutoFull = true;
        break;
      case "auto-burst":
        if (autoFireRules !== 'CT') {
          bonusDamage = ruleSet === "CDEE" ? `${rateOfFire}d6kh` : rateOfFire.toString(); //special rule for CD-EE
        }
        break;
      case "burst-attack-dm":
        Object.assign(tmpSettings.rollModifiers, { rof: TwodsixItem.burstAttackDM(rateOfFire) });
        break;
      case "burst-bonus-damage":
        bonusDamage = TwodsixItem.burstBonusDamage(rateOfFire);
        break;
      case "double-tap":
        //Need to assign as bonus damage or rof bonus depending on rules
        if ( ['CD', 'CLU'].includes(ruleSet)) {
          bonusDamage = "1d6";
        } else if (['AC', 'CEL'].includes(ruleSet)) {
          bonusDamage = "1";
        } else {
          Object.assign(tmpSettings.rollModifiers, { rof: 1 });
        }
        usedAmmo = 2;
        break;
    }
    Object.assign(tmpSettings, { bonusDamage: bonusDamage });
    Object.assign(tmpSettings.rollModifiers, { skillLevelMax: skillLevelMax });
    const weaponType: string = weaponTypeOverride || weapon.rangeBand;
    return { weaponType, isAutoFull, usedAmmo, numberOfAttacks };
  }

  /**
   * A method to get the weapons range modifer based on the weapon type and measured range (distance).
   * Valid for Classic Traveller and Cepheus Engine band types as well as other rule sets with range values.
   * @param {number} range  The measured distance to the target
   * @param {string} weaponBand The type of weapon used - as key string
   * @returns {any} {rangeModifier: rangeModifier, rollType: rollType}
   */
  public getRangeModifier(range:number, weaponBand: string, isAutoFull:boolean): any {
    let rangeModifier = 0;
    let rollType = 'Normal';
    const rangeModifierType = game.settings.get('twodsix', 'rangeModifierType');
    // Return immediately with default if bad migration
    if (typeof this.system.range === 'number' && !['CE_Bands', 'CT_Bands', 'CU_Bands'].includes(rangeModifierType)){
      console.log("Bad weapon system.range value - should be string");
      return {rangeModifier: rangeModifier, rollType: rollType};
    }

    const rangeValues = this.system.range?.split('/', 2).map((s:string) => parseFloat(s));
    if (rangeModifierType === 'none') {
      //rangeModifier = 0;
    } else if (['CE_Bands', 'CT_Bands', 'CU_Bands'].includes(rangeModifierType)) {
      const targetBand:string = getRangeBand(range);
      if (targetBand !== "unknown") {
        rangeModifier = this.getRangeBandModifier(weaponBand, targetBand, isAutoFull, range);
      }
    } else if (this.system.range?.toLowerCase().includes('melee')) {
      // Handle special case of melee weapon
      if (range > game.settings.get('twodsix', 'meleeRange')) {
        rangeModifier = INFEASIBLE;
      }
    } else if (isNaN(rangeValues[0]) /*|| (rangeValues[0] === 0 && range === 0)*/) {
      //rangeModifier = 0;
    } else if (range <= game.settings.get('twodsix', 'meleeRange')) {
      // Handle within melee range
      if (range > (rangeModifierType === 'singleBand' ? rangeValues[0] : rangeValues[1] ?? rangeValues[0])) {
        rangeModifier = INFEASIBLE;
      } else if (game.settings.get('twodsix', 'termForAdvantage').toLowerCase() === this.system.meleeRangeModifier.toLowerCase()){
        rollType = 'Advantage';
      } else if (game.settings.get('twodsix', 'termForDisadvantage').toLowerCase() === this.system.meleeRangeModifier.toLowerCase()) {
        rollType = 'Disadvantage';
      } else {
        rangeModifier = parseInt(this.system.meleeRangeModifier) || 0;
      }
    } else if (rangeModifierType === 'singleBand') {
      if (range <= rangeValues[0] * 0.25) {
        rangeModifier = 1;
      } else if (range <= rangeValues[0]) {
        //rangeModifier = 0;
      } else if (range <= rangeValues[0] * 2) {
        rangeModifier = -2;
      } else if (range <= rangeValues[0] * 4) {
        rangeModifier = -4;
      } else {
        rangeModifier = INFEASIBLE;
      }
    } else if (rangeModifierType === 'doubleBand') {
      if (rangeValues[0] > rangeValues[1]) {
        //rangeModifier = 0;
      } else if (range <= rangeValues[0]) {
        //rangeModifier = 0;
      } else if (range <= rangeValues[1]) {
        rangeModifier = -2;
      } else {
        rangeModifier = INFEASIBLE;
      }
    }
    return {rangeModifier: rangeModifier, rollType: rollType};
  }

  /**
   * A method to get the dodge / parry modifer based on the target's corresponding skill used for attack.
   * @param {Token} target  The target token
   * @returns {any} {dodgeParry: dodgeParryModifier, dodgeParryLabel: skillName}
   */
  public getDodgeParryValues(target: Token): object {
    let dodgeParryModifier = 0;
    let skillName = "";
    if (game.settings.get("twodsix", "useDodgeParry") && target) {
      const weaponSkill = this.actor?.items.get(this.system.skill);
      skillName = weaponSkill?.getFlag("twodsix", "untrainedSkill") ? this.system.associatedSkillName : weaponSkill?.name;
      const targetMatchingSkill = target.actor?.itemTypes.skills?.find(sk => sk.name === skillName);
      dodgeParryModifier = -targetMatchingSkill?.system.value || 0;
    }
    return {dodgeParry: dodgeParryModifier, dodgeParryLabel: skillName};
  }

  /**
   * A method to parse and return the weapon's handling modifier based on attacker's characteristics.
   * @param {number} rateOfFire The weapon rate of fire (needed for CU)
   * @returns {number} The DM for the actor firing the weapon used
   */
  public getWeaponsHandlingMod(rateOfFire:number): number {
    // Handle CU special case of auto fire affecting recoil
    let rofOffset = 0;
    if (game.settings.get('twodsix', 'ruleset') === 'CU') {
      if ( rateOfFire === 4) {
        rofOffset = 1;
      } else if (rateOfFire >= 10 ) {
        rofOffset = 2;
      }
    }

    let weaponHandlingMod = 0;
    const re = new RegExp(/^(\w+)\s+([0-9]+)-?\/(.+)\s+([0-9]+)\+?\/(.+)/gm);
    const parsedResult: RegExpMatchArray | null = re.exec(this.system.handlingModifiers);
    if (parsedResult) {
      const checkCharacteristic = getCharacteristicFromDisplayLabel(parsedResult[1], this.actor);
      if (checkCharacteristic) {
        const charValue = game.settings.get('twodsix', 'ruleset') === 'CU' ? this.actor.system.characteristics[checkCharacteristic].current : this.actor.system.characteristics[checkCharacteristic].value;
        if (charValue <= parseInt(parsedResult[2], 10) + rofOffset) {
          weaponHandlingMod = getValueFromRollFormula(parsedResult[3], this);
        } else if (charValue >= parseInt(parsedResult[4], 10) + rofOffset) {
          weaponHandlingMod = getValueFromRollFormula(parsedResult[5], this);
        }
      }
    }
    return weaponHandlingMod;
  }

  /**
   * Perform a skill roll / check based on input settings.
   * @param showThrowDialog {boolean} Whether to show roll/through dialog
   * @param tmpSettings {TwodsixRollSettings|undefined} Roll settings to use
   * @param showInChat Whehter to show attack in chat
   */
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
      const skillList = `${game.settings.get("twodsix", "sorcerySkill")}|` + this.system?.associatedSkillName;
      skill =  <TwodsixItem>(workingActor.getBestSkill(skillList, false));
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      item = this;
    } else if (this.type === "component") {
      workingActor = await fromUuid(tmpSettings?.flags.actorUUID);
      skill = <TwodsixItem>workingActor?.items.getName(tmpSettings?.skillName);
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      item = this;
    } else if (usesConsumable.skill) {
      skill = this.actor?.items.get(usesConsumable.skill) as TwodsixItem;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      item = this;
    }

    if (!skill) {
      skill = workingActor?.getUntrainedSkill();
      if(!skill) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoSkillForSkillRoll"));
        return;
      }
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
    await diceRoll.evaluateRoll();

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
        await damage.evaluate();
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
          await radDamage.evaluate();
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
      const canBeBlocked = game.settings.get('twodsix', 'ruleset') === 'CU'  && damageType === 'melee';
      const canBeParried = canBeBlocked && ['personal', 'close'].includes(this.system.rangeBand);
      Object.assign(contentData, {
        flavor: flavor,
        roll: damage,
        dice: getDiceResults(damage), //damage.terms[0]["results"]
        armorPiercingValue: apValue,
        damageValue: (damage.total && damage.total > 0) ? damage.total : 0,
        damageType: damageType,
        damageLabel: damageLabels[damageType] || "",
        canBeParried: canBeParried,
        canBeBlocked: canBeBlocked
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
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
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

  /**
   * A function to resolve autofire mode when a weapon is fired without selecting mode.
   * Through an NPC sheet or macro, typically.
   */
  public async resolveUnknownAutoMode() {
    let attackType = 'single';
    let rof:number;
    const modes = ((<Weapon>this.system).rateOfFire ?? "").split(/[-/]/);
    switch (game.settings.get('twodsix', 'autofireRulesUsed')) {
      case TWODSIX.RULESETS.CEL.key:
        if (this.shouldShowCELAutoFireDialog()) {
          attackType = await promptForCELROF(this);
        }
        rof = (attackType === 'single') ? 1 : Number(modes[0]);
        await this.performAttack(attackType, true, rof);
        break;
      case TWODSIX.RULESETS.CT.key:
        if (modes.length > 1) {
          attackType = await promptForCTROF(modes);
          rof = (attackType === 'single') ? 1 : Number(modes[1]);
          await this.performAttack(attackType, true, rof);
        } else {
          await this.performAttack(attackType, true, Number(modes[0]));
        }
        break;
      case TWODSIX.RULESETS.CE.key:
        if (modes.length > 1) {
          await promptAndAttackForCE(modes, this);
        } else {
          await this.performAttack(attackType, true, Number(modes[0]));
        }
        break;
      case TWODSIX.RULESETS.CU.key:
        if (modes[0] > 1) {
          attackType = await promptForCTROF(modes);
          rof = (attackType === 'single') ? 1 : Number(modes[0]);
          await this.performAttack(attackType, true, rof);
        } else {
          await this.performAttack(attackType, true, 1);
        }
        break;
      default:
        await this.performAttack(attackType, true, 1);
        break;
    }
  }

  public shouldShowCELAutoFireDialog(): boolean {
    const rateOfFire: string = (<Weapon>this.system).rateOfFire;
    return (
      /*(game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key) && */
      (Number(rateOfFire) > 1  || (this.system.doubleTap && game.settings.get('twodsix', 'ShowDoubleTap')))
    );
  }

  /*public shouldShowCEAutoFireDialog(): boolean {
    const modes = ((<Weapon>this.system).rateOfFire ?? "").split(/[-/]/);
    return (
      (game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CE.key) &&
      (modes.length > 1)
    );
  }*/

  //////// CONSUMABLE ////////
  /**
   * A function decrement a consumable selected consumbles from inventory.
   * @param {number} quantity The amount to decrement consumable count
   */
  public async consume(quantity:number):Promise<void> {
    const consumableLeft = (<Consumable>this.system).currentCount - quantity;
    if (consumableLeft >= 0) {
      await this.update({"system.currentCount": consumableLeft}, {});
    } else {
      throw { name: 'NoAmmoError' };
    }
  }
  /**
   * A function refill selected consumbles from inventory.
   */
  public async refill():Promise<void> {
    const consumable = <Consumable>this.system;
    if (consumable.currentCount < consumable.max) {
      if (consumable.quantity > 1) {
        //Make a duplicate and add to inventory if not empty
        if (consumable.currentCount > 0) {
          const partialConsumable = foundry.utils.duplicate(this);
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
  /**
   * A method for returning the weapons-armor modifier based on target and weapon type used - Classic Traveller
   * @param {Token} targetToken Token for target
   * @param {string} weaponType Weapon's type description, (e.g., club, rifle, hands). Can be an override based on fire mode (e.g. auto rifle in single fire mode)
   * @param {boolean} isAuto is full auto fire
   * @returns {object} Object of {armorModifier:number, armorLabel:string}
   */
  public getWeaponArmorValues(targetToken:Token, weaponType:string, isAuto:boolean): object {
    let armorModifier = 0;
    let armorLabel = "";
    if (weaponType !== 'none') {
      const targetActor = targetToken?.actor;
      const lookupRow = weaponType === 'custom' ? this.getCustomArmorMod(isAuto): CT_Armor_Table[weaponType];
      if (targetActor && lookupRow) {
        if (targetActor.type === 'traveller') {
          const wornArmor = targetActor.itemTypes.armor.filter((armor:TwodsixItem) => armor.system.equipped === 'equipped');
          if (wornArmor.length > 2) {
            ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.TooManyLayersOnTarget"));
          } else if (targetActor.system.reflectOn && wornArmor.length === 2) {
            const armor0Mod = lookupRow[wornArmor[0].system.armorType] + (wornArmor[0].system.armorDM ?? 0);
            const armor1Mod = lookupRow[wornArmor[1].system.armorType] + (wornArmor[1].system.armorDM ?? 0);
            armorModifier = armor0Mod < armor1Mod ? armor0Mod : armor1Mod;
            armorLabel = armor0Mod < armor1Mod ? wornArmor[0].system.armorType : wornArmor[1].system.armorType;
          } else if (wornArmor.length === 1) {
            armorModifier = lookupRow[wornArmor[0].system.armorType] + (wornArmor[0].system.armorDM ?? 0);
            armorLabel = wornArmor[0].system.armorType;
          } else if (wornArmor.length === 0) {
            armorModifier = lookupRow['nothing'];
            armorLabel = 'nothing';
          }
        } else if (['animal', 'robot'].includes(targetActor.type)) {
          armorModifier = lookupRow[targetActor.system.armorType] + (targetActor.system.armorDM ?? 0);
          armorLabel = targetActor.system.armorType;
        }
      } else {
        ui.notifications.error(game.i18n.localize("TWODSIX.Errors.InvalidWeaponArmor"));
      }
    }
    armorLabel = game.i18n.localize(armorLabel !== "" ? TWODSIX.CT_ARMOR_TYPES[armorLabel] : 'TWODSIX.Ship.Unknown');
    return {armorModifier: armorModifier, armorLabel: armorLabel };
  }

  private getCustomArmorMod(isAuto:boolean):any {
    return {
      nothing: parseCustomCTValue(this.system.customCT.armor.nothing, isAuto),
      jack: parseCustomCTValue(this.system.customCT.armor.jack, isAuto),
      mesh: parseCustomCTValue(this.system.customCT.armor.mesh, isAuto),
      cloth: parseCustomCTValue(this.system.customCT.armor.cloth, isAuto),
      reflec: parseCustomCTValue(this.system.customCT.armor.reflec, isAuto),
      ablat: parseCustomCTValue(this.system.customCT.armor.ablat, isAuto),
      combat: parseCustomCTValue(this.system.customCT.armor.combat, isAuto)
    };
  }
  /**
   * A method for returning range modifier based on RangeTable constant
   * @param {string} weaponBand   Weapon's range description, (.e.g., close quarters, thrown, rifle)
   * @param {string} targetDistanceBand Qualitative distance to target, (e.g. close, short, very long)
   * @param {number} range Range to target, in meters
   * @param {boolean} isAuto Is full automatic fire
   * @returns {number} Range Modifier
   */
  public getRangeBandModifier(weaponBand: string, targetDistanceBand: string, isAuto:boolean, range:number): number {
    const rangeSettings = game.settings.get('twodsix', 'rangeModifierType');
    let returnVal = 0;
    if (targetDistanceBand !== 'unknown' && weaponBand !== 'none') {
      try {
        switch (rangeSettings) {
          case 'CE_Bands':
            returnVal = CE_Range_Table[weaponBand][targetDistanceBand];
            break;
          case 'CU_Bands': {
            if (weaponBand === 'thrown') {
              //Special case for thrown weapons
              const maxThrow = 10 + this.actor?.system.characteristics.strength.value - this.system.weight;
              if (range < maxThrow / 2) {
                returnVal = 0;
              } else if (range > maxThrow) {
                returnVal = INFEASIBLE;
              } else {
                returnVal = -2; //Thrown weapons default to DIFFICULT
              }
            } else {
              returnVal = CU_Range_Table[weaponBand][targetDistanceBand];
            }
            break;
          }
          case 'CT_Bands': {
            const lookupRow = (weaponBand === 'custom') ? this.getCustomRangeMod(isAuto): CT_Range_Table[weaponBand];
            returnVal = lookupRow[targetDistanceBand] || 0;
            break;
          }
          default:
            console.log("Not a valid weapon range band type");
            break;
        }
      } catch(err) {
        ui.notifications.error(game.i18n.localize("TWODSIX.Errors.InvalidRangeBand"));
      }
    }
    return returnVal;
  }

  private getCustomRangeMod(isAuto:boolean):any {
    return {
      close: parseCustomCTValue(this.system.customCT.range.close, isAuto),
      short: parseCustomCTValue(this.system.customCT.range.short, isAuto),
      medium: parseCustomCTValue(this.system.customCT.range.medium, isAuto),
      long: parseCustomCTValue(this.system.customCT.range.long, isAuto),
      veryLong: parseCustomCTValue(this.system.customCT.range.veryLong, isAuto)
    };
  }
}

/**
 * Parse a custom Weapon Range/Armor modifier for CT and return value
 * @param {string} inputString   The custom input string of format x/y or x
 * @param {boolean} isAuto Is full automatic fire
 * @returns {number} modifier value, return defaults to zero if no valid number found
 */
function parseCustomCTValue(inputString:string, isAuto:boolean):number {
  const parsedInput = inputString.split("/");
  let returnVal = 0;
  if (parsedInput.length > 0) {
    returnVal = parseInt(parsedInput[isAuto? 1:0]);
    if (isNaN(returnVal) && isAuto) { // base case where no slash and auto is default, e.g. submachinegun
      returnVal = parseInt(parsedInput[0]);
    }
  }
  return returnVal || 0;
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
 * @param {string} rollFormula    The original roll. It must be deterministic
 * @param {TwodsixItem } item     Item making the roll
 * @returns {number}              The resulting roll value.
 */
export function getValueFromRollFormula(rollFormula:string, item:TwodsixItem): number {
  let returnValue = 0;
  if (Roll.validate(rollFormula)) {
    returnValue = Roll.safeEval(Roll.replaceFormulaData(rollFormula, item.actor?.getRollData())) ?? 0;
  }
  return returnValue;
}

async function promptForCELROF(weapon: TwodsixItem): Promise<string> {
  if (weapon.system.doubleTap && game.settings.get('twodsix', 'ShowDoubleTap')) {
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("TWODSIX.Dialogs.ROFPickerTitle"),
        content: "",
        buttons: {
          single: {
            label: game.i18n.localize("TWODSIX.Dialogs.ROFSingle"), callback: () => {
              resolve('single');
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
              resolve('single');
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

async function promptAndAttackForCE(modes: string[], item: TwodsixItem):void {
  const buttons = {};

  for ( const mode of modes) {
    const number = Number(mode);
    const attackDM = TwodsixItem.burstAttackDM(number);
    const bonusDamage =TwodsixItem.burstBonusDamage(number);

    if (number === 1) {
      buttons["single"] = {
        "label": game.i18n.localize("TWODSIX.Dialogs.ROFSingle"),
        "callback": () => {
          item.performAttack("single", true, 1);
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

async function promptForCTROF(modes: string[]): Promise<string> {
  if (parseInt(modes[0]) === 0) {
    return 'auto-full';
  } else {
    return new Promise((resolve) => {
      new Dialog({
        title: game.i18n.localize("TWODSIX.Dialogs.ROFPickerTitle"),
        content: "",
        buttons: {
          single: {
            label: game.i18n.localize("TWODSIX.Dialogs.ROFSingle"), callback: () => {
              resolve('single');
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

/**
 * A function for returning qualitative range band. Per CE rules https://www.orffenspace.com/cepheus-srd/personal-combat.html#range
 * or per Classic Traveller Rules https://www.drivethrurpg.com/product/80192/CTTTBThe-Traveller-Book?cPath=21_4767
 *
 * @param {number} range    The range in meters
 * @returns {string}        The resulting range band
 */
function getRangeBand(range: number):string {
  //Convert ft to m if necessay
  const rangeModifierType = game.settings.get('twodsix', 'rangeModifierType');
  const units = canvas.scene.grid.units.toLowerCase();
  if (units === 'ft' || units === 'feet') {
    range /= 3.28;
  }
  if ( rangeModifierType === 'CE_Bands') {
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
  } else if (rangeModifierType === 'CT_Bands') {
    if (range < 1) {
      return 'close';
    } else if (range <= 5) {
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
  } else if ( rangeModifierType === 'CU_Bands') {
    if (range < 1.5) {
      return 'personal';
    } else if (range <= 3) {
      return 'close';
    } else if (range <= 15) {
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
  } else {
    return 'unknown';
  }
}

// CE SRD Range Table Cepheus Engine SRD Table https://www.orffenspace.com/cepheus-srd/personal-combat.html#range.
const INFEASIBLE = -99;
const CE_Range_Table = Object.freeze({
  closeQuarters: { personal: 0, close: -2, short: INFEASIBLE, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE, distant: INFEASIBLE },
  extendedReach: { personal: -2, close: 0, short: INFEASIBLE, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE, distant: INFEASIBLE },
  thrown: { personal: INFEASIBLE, close: 0, short: -2, medium: -2, long: INFEASIBLE, veryLong: INFEASIBLE, distant: INFEASIBLE },
  pistol: { personal: -2, close: 0, short: 0, medium: -2, long: -4, veryLong: INFEASIBLE, distant: INFEASIBLE },
  rifle: { personal: -4, close: -2, short: 0, medium: 0, long: 0, veryLong: -2, distant: -4 },
  shotgun: { personal: -2, close: 0, short: -2, medium: -2, long: -4, veryLong: INFEASIBLE, distant: INFEASIBLE },
  assaultWeapon: { personal: -2, close: 0, short: 0, medium: 0, long: -2, veryLong: -4, distant: -6 },
  rocket: { personal: -4, close: -2, short: -2, medium: 0, long: 0, veryLong: -2, distant: -4 }
});

// From Combat Data Sheet pg 427 Cepheus Universal
const CU_Range_Table = Object.freeze({
  personal: { personal: 0, close: -1, short: INFEASIBLE, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE, distant: INFEASIBLE },
  close: { personal: -1, close: 0, short: INFEASIBLE, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE, distant: INFEASIBLE },
  short: { personal: 2, close: 2, short: -0, medium: -2, long: -4, veryLong: INFEASIBLE, distant: INFEASIBLE },
  medium: { personal: 2, close: 2, short: 0, medium: 0, long: -2, veryLong: -4, distant: INFEASIBLE },
  shotgun: { personal: 2, close: 2, short: 1, medium: 0, long: -2, veryLong: -4, distant: INFEASIBLE },
  long: { personal: 2, close: 2, short: 0, medium: 0, long: 0, veryLong: -2, distant: -4 },
  veryLong: { personal: 2, close: 2, short: 0, medium: 0, long: 0, veryLong: 0, distant: -2 },
  distant: { personal: 2, close: 2, short: 0, medium: 0, long: 0, veryLong: 0, distant: 0 },
});

//Classic Traveller Range Modifiers from https://www.drivethrurpg.com/product/355200/Classic-Traveller-Facsimile-Edition puls errat corrections from
// CONSOLIDATED CT ERRATA, v0.7 (06/01/12)
const CT_Range_Table = Object.freeze({
  hands: { close: 2, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  claws: { close: 1, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  teeth: { close: 2, short: 0, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  horns: { close: -1, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  hooves: { close: -1, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  stinger: { close: 4, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  thrasher: { close: 5, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  club: { close: 1, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  dagger: { close: 1, short: -1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  blade: { close: 1, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  foil: { close: -1, short: 0, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  cutlass: { close: -4, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  sword: { close: -2, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  broadsword: { close: -8, short: 3, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  bayonet: { close: -1, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  spear: { close: -2, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  halberd: { close: 0, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  pike: { close: -4, short: 4, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  cudgel: { close: 0, short: 0, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE },
  bodyPistol: { close: 2, short: 1, medium: -6, long: INFEASIBLE, veryLong: INFEASIBLE },
  autoPistol: { close: 1, short: 2, medium: -4, long: -6, veryLong: INFEASIBLE },
  revolver: { close: 1, short: 2, medium: -3, long: -5, veryLong: INFEASIBLE },
  carbine: { close: -4, short: 1, medium: -2, long: -4, veryLong: -5 },
  rifle: { close: -4, short: 1, medium: 0, long: -1, veryLong: -3 },
  autoRifle: { close: -8, short: 0, medium: 2, long: 1, veryLong: -2 },
  shotgun: { close: -8, short: 1, medium: 3, long: -6, veryLong: INFEASIBLE },
  submachinegun: { close: -4, short: 3, medium: 3, long: -3, veryLong: -9 },
  laserCarbine: { close: -2, short: 1, medium: 1, long: 1, veryLong: 0 },
  laserRifle: { close: -4, short: 2, medium: 2, long: 2, veryLong: 1 }
});

const CT_Armor_Table = Object.freeze({
  hands: { nothing: 1, jack: -1, mesh: -4, cloth: -4, reflec: 0, ablat: -1, combat: -6 },
  claws: { nothing: 3, jack: 0, mesh: 0, cloth: 1, reflec: -1, ablat: -3, combat: -7 },
  teeth: { nothing: 2, jack: 1, mesh: -1, cloth: 0, reflec: -2, ablat: -4, combat: -7 },
  horns: { nothing: 2, jack: 1, mesh: 0, cloth: -1, reflec: 2, ablat: -2, combat: -5 },
  hooves: { nothing: 3, jack: 3, mesh: 2, cloth: 2, reflec: 3, ablat: 2, combat: -6 },
  stinger: { nothing: 4, jack: 3, mesh: 0, cloth: 1, reflec: 2, ablat: 0, combat: -6 },
  thrasher: { nothing: 7, jack: 7, mesh: 4, cloth: 4, reflec: 7, ablat: 4, combat: 0 },
  club: { nothing: 0, jack: 0, mesh: -2, cloth: -3, reflec: 0, ablat: -2, combat: -7 },
  dagger: { nothing: 0, jack: -1, mesh: -4, cloth: -4, reflec: 0, ablat: -2, combat: -7 },
  blade: { nothing: 0, jack: -1, mesh: -4, cloth: -4, reflec: 0, ablat: -2, combat: -7 },
  foil: { nothing: 2, jack: 0, mesh: -4, cloth: -3, reflec: 2, ablat: -2, combat: -6 },
  cutlass: { nothing: 4, jack: 3, mesh: -2, cloth: -3, reflec: 4, ablat: -2, combat: -6 },
  sword: { nothing: 3, jack: 3, mesh: -3, cloth: -3, reflec: 3, ablat: -2, combat: -6 },
  broadsword: { nothing: 5, jack: 5, mesh: 1, cloth: 0, reflec: 5, ablat: 1, combat: -4 },
  bayonet: { nothing: 2, jack: 1, mesh: 0, cloth: -1, reflec: 2, ablat: -2, combat: -6 },
  spear: { nothing: 1, jack: 0, mesh: -2, cloth: -2, reflec: -1, ablat: -3, combat: -6 },
  halberd: { nothing: 4, jack: 3, mesh: -2, cloth: -3, reflec: 4, ablat: -2, combat: -5 },
  pike: { nothing: 1, jack: 0, mesh: -2, cloth: -2, reflec: -1, ablat: -3, combat: -6 },
  cudgel: { nothing: 0, jack: 0, mesh: -2, cloth: -3, reflec: 0, ablat: -2, combat: -7 },
  bodyPistol: { nothing: 0, jack: 0, mesh: -2, cloth: -4, reflec: -4, ablat: -2, combat: -7 },
  autoPistol: { nothing: 1, jack: 1, mesh: -1, cloth: -3, reflec: 1, ablat: -1, combat: -5 },
  revolver: {nothing: 1, jack: 1, mesh: -1, cloth: -3, reflec: 1, ablat: -1, combat: -5 },
  carbine: { nothing: 2, jack: 2, mesh: 0, cloth: -3, reflec: 2, ablat: -1, combat: -5 },
  rifle: { nothing: 3, jack: 3, mesh: 0, cloth: -3, reflec: 2, ablat: 1, combat: -5 },
  autoRifle: { nothing: 6, jack: 6, mesh: 2, cloth: -1, reflec: 6, ablat: 3, combat: -3 },
  shotgun: { nothing: 5, jack: 5, mesh: -1, cloth: -3, reflec: 5, ablat: 2, combat: -5 },
  submachinegun: { nothing: 5, jack: 5, mesh: 0, cloth: -3, reflec: 5, ablat: 2, combat: -4 },
  laserCarbine: { nothing: 2, jack: 2, mesh: 1, cloth: 1, reflec: -8, ablat: -7, combat: -6 },
  laserRifle: { nothing: 3, jack: 3, mesh: 2, cloth: 2, reflec: -8, ablat: -7, combat: -6 }
});

/**
 * A function to return number of attacks for auto fire depending on rules set and rof
 * @param {string} autoFireRulesUsed The automatic fire rules used
 * @param {number} rateOfFire The fire rate (rounds used)
 * @returns {number} The number of attacks
 */
function getNumberOfAttacks(autoFireRulesUsed:string, rateOfFire:number): number {
  let returnValue = rateOfFire;
  switch (autoFireRulesUsed) {
    case 'CT':
      returnValue = 2;
      break;
    case 'CU':
      if (rateOfFire === 4) {
        returnValue = 2;
      } else if (rateOfFire === 10 || rateOfFire === 20) {
        returnValue = 3;
      }
      break;
    default:
      break;
  }
  return returnValue;
}
