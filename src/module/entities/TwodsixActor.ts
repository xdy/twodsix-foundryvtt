// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { calcModFor, getDamageTypes} from "../utils/sheetUtils";
import { getKeyByValue } from "../utils/utils";
import { TWODSIX } from "../config";
import { TwodsixRollSettings} from "../utils/TwodsixRollSettings";
import { TwodsixDiceRoll } from "../utils/TwodsixDiceRoll";
import { roundToMaxDecimals, simplifySkillName, sortByItemName } from "../utils/utils";
import TwodsixItem from "./TwodsixItem";
import { getDamageCharacteristics, getParryValue, Stats } from "../utils/actorDamage";
import {Characteristic, Component, Gear, Ship, Skills, Traveller} from "../../types/template";
import { getCharShortName } from "../utils/utils";
import { applyToAllActors } from "../utils/migration-utils";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";
import { updateFinances } from "../hooks/updateFinances";
import { applyEncumberedEffect, applyWoundedEffect } from "../utils/showStatusIcons";
import { TwodsixActiveEffect } from "./TwodsixActiveEffect";

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export default class TwodsixActor extends Actor {
  /** @override */
  /**
   * Perform preliminary operations before an Actor of this type is created.
   * Pre-creation operations only occur for the client which requested the operation.
   * @param {object} data               The initial data object provided to the document creation request.
   * @param {object} options            Additional options which modify the creation request.
   * @param {User} userId                 The User requesting the document creation.
   * @returns {Promise<boolean|void>}   A return value of false indicates the creation operation should be cancelled.
   * @see {Document#_preCreate}
   * @protected
   */
  protected async _preCreate(data:object, options:object, userId:User): Promise<boolean|void> {
    const allowed:boolean = await super._preCreate(data, options, userId);

    let isDefaultImg = false;
    const changeData = {};

    switch (this.type) {
      case "traveller":
      case "animal":
      case "robot": {
        Object.assign(changeData, {
          "system.movement.walk": this.system.movement.walk || game.settings.get("twodsix", "defaultMovement"),
          "system.movement.units": this.system.movement.units || game.settings.get("twodsix", "defaultMovementUnits")
        });
        if (this.img === foundry.documents.BaseActor.DEFAULT_ICON ) {
          isDefaultImg = true;
          if (game.settings.get("twodsix", "defaultTokenSettings") && this.type === "traveller") {
            Object.assign(changeData, {
              "prototypeToken.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER,
              "prototypeToken.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER,
              "prototypeToken.sight": {
                "enabled": true,
                "visonMode": "basic",
                "brightness": 1
              },
              "prototypeToken.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
              "prototypeToken.bar1": {
                attribute: "hits"
              }
            });
          }

          let newImage = "";
          if (this.type === "traveller") {
            newImage = 'systems/twodsix/assets/icons/default_actor.png';
          } else if (this.type === "animal") {
            newImage = 'systems/twodsix/assets/icons/alien-bug.svg';
          } else if (this.type === "robot") {
            newImage = 'systems/twodsix/assets/icons/default_robot.svg';
          } else {
            newImage = foundry.documents.BaseActor.DEFAULT_ICON;
          }

          Object.assign(changeData, {
            'img': newImage
          });
        }

        //Setup Hits
        const newHits = this.getCurrentHits(this.system.characteristics);
        Object.assign(changeData, {
          'system.hits.value': newHits.value,
          'system.hits.max': newHits.max
        });

        if (this.type === "animal") {
          Object.assign(changeData, {
            'system.characteristics.education.label': 'Instinct',
            'system.characteristics.education.displayShortLabel': 'INS',
            'system.characteristics.socialStanding.label': 'Pack',
            'system.characteristics.socialStanding.displayShortLabel': 'PAK'
          });
        }

        //Add standard embedded items
        const items = this.items.map(i => i.toObject());
        let isUpdated = false;
        const untrainedSkillData = this.createUntrainedSkillData();
        if (untrainedSkillData) {
          const item = new CONFIG.Item.documentClass(untrainedSkillData);
          items.push(item.toObject());
          isUpdated = true;
          Object.assign(changeData, {"system.untrainedSkill": untrainedSkillData._id});
        }
        if (game.settings.get("twodsix", "autoAddUnarmed")) {
          const unarmedData = this.createUnarmedData();
          if (unarmedData) {
            unarmedData.system.skill = unarmedData.system.skill || untrainedSkillData?._id || "";
            const item = new CONFIG.Item.documentClass(unarmedData);
            items.push(item.toObject());
            isUpdated = true;
          }
        }
        if(isUpdated) {
          this.updateSource({ items });
        }

        break;
      }
      case "ship": {
        if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
          isDefaultImg = true;
          Object.assign(changeData, {
            'img': 'systems/twodsix/assets/icons/default_ship.png'
          });
        }
        break;
      }
      case "vehicle": {
        if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
          isDefaultImg = true;
          Object.assign(changeData, {
            'img': 'systems/twodsix/assets/icons/default_vehicle.png'
          });
        }
        break;
      }
      case "space-object": {
        if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
          isDefaultImg = true;
          Object.assign(changeData, {
            'img': 'systems/twodsix/assets/icons/default_space-object.png'
          });
        }
        break;
      }
    }
    await this.updateSource(changeData);

    if (game.settings.get("twodsix", "useSystemDefaultTokenIcon") && isDefaultImg) {
      await this.updateSource({
        'prototypeToken.texture.src': foundry.documents.BaseActor.DEFAULT_ICON //'icons/svg/mystery-man.svg'
      });
    }

    return allowed;
  }

  /**
   * Perform preliminary operations before a Document of this type is updated.
   * Pre-update operations only occur for the client which requested the operation.
   * @param {object} data            The data object that is changed - NOT always relative to the documents prior values
   * @param {object} options            Additional options which modify the update request
   * @param {documents.BaseUser} user   The User requesting the document update
   * @returns {Promise<boolean|void>}   A return value of false indicates the update operation should be cancelled.
   * @see {Document#_preUpdate}
   * @protected
   */
  async _preUpdate(data:object, options:object, user:any): Promise<boolean|void> {
    const allowed = await super._preUpdate(data, options, user);

    // Update hits & wounds
    let deltaHits = 0;
    if (data?.system?.characteristics && ['traveller', 'animal', 'robot'].includes(this.type)) {
      const charDiff = foundry.utils.diffObject(this.system._source.characteristics, data.system.characteristics); //v12 stopped passing diffferential
      if (Object.keys(charDiff).length > 0) {
        deltaHits = this.getDeltaHits(charDiff);
      }

      if (deltaHits !== 0) {
        //console.log ('need to update wounded status');
        Object.assign(options, {deltaHits: deltaHits});
        if (game.modules.get('splatter')?.active) {
          //A hack to get splatter to work correctly - it doesn't respect derived data
          const newHits = Math.clamp((this.system.hits.value - deltaHits), 0, this.system.hits.max);
          foundry.utils.mergeObject(data, {'system.hits.value': newHits});
        }
      }
    }

    // Update Finances
    if (this.type === 'traveller') {
      const financeDiff = {
        finances: data?.system?.finances ? foundry.utils.diffObject(this.system._source.finances, data.system.finances) : {},
        financeValues: data?.system?.financeValues ? foundry.utils.diffObject(this.system._source.financeValues, data.system.financeValues) : {} //v12 stopped passing diffferential
      };
      if (Object.keys(financeDiff.finances).length > 0 || Object.keys(financeDiff.financeValues).length > 0) {
        updateFinances(this, data, financeDiff);
      }
    }

    return allowed;
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

    //Check for status change
    if (options.diff && game.user?.id === userId) {  //Not certain why options.diff is needed, but opening token editor for tokenActor and cancelling fires updateActor
      if (!!options.deltaHits && (["traveller", "animal", "robot"].includes(this.type))) {
        if (game.settings.get('twodsix', 'useWoundedStatusIndicators')) {
          await applyWoundedEffect(this);
        }
      }
      if (game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && (this.type === 'traveller')) {
        if (isEncumbranceChange(changed)) {
          await applyEncumberedEffect(this);
        }
      }
    }

    //scroll hits change
    if (!!options.deltaHits && this.isOwner ) {
      this.scrollDamage(options.deltaHits);
    }
  }

  protected async _onDelete() {
    //Remove actor references from ship Positions
    if (this.type === "traveller") {
      if(this.id) {
        deleteIdFromShipPositions(this.id);
      }
    }
  }

  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareDerivedData(): void {
    super.prepareDerivedData();

    // Make separate methods for each Actor type (traveller, npc, etc.) to keep
    // things organized.
    switch (this.type) {
      case 'traveller':
      case 'animal':
      case 'robot':
        this._prepareActorDerivedData();
        break;
      case 'ship':
        if (game.settings.get("twodsix", "useShipAutoCalcs")) {
          this._prepareShipDerivedData();
        }
        this._checkCrewTitles();
        break;
      case 'vehicle':
      case 'space-object':
        break;
      default:
        console.log(game.i18n.localize("Twodsix.Actor.UnknownActorType") + " " + this.type);
    }
  }

  /**
  * Check Crew Titles for missing and set to localized default
  */
  _checkCrewTitles(): void {
    for (const pos in this.system.crewLabel) {
      if (this.system.crewLabel[pos] === "") {
        this.system.crewLabel[pos] = game.i18n.localize("TWODSIX.Ship.Crew." + pos.toUpperCase());
      }
    }
  }

  /**
   * Prepare Character type specific data
   */
  async _prepareActorDerivedData(): void {
    const {system} = this;

    //Update Damage
    for (const cha of Object.keys(system.characteristics)) {
      const characteristic: Characteristic = system.characteristics[cha];
      characteristic.current = characteristic.value - characteristic.damage;
      characteristic.mod = calcModFor(characteristic.current);
      if (characteristic.displayShortLabel === "") {
        characteristic.displayShortLabel = getCharShortName(characteristic.shortLabel);
      }
    }

    //Update hits
    const newHitsValue = this.getCurrentHits(system.characteristics);
    this.system.hits.value = newHitsValue.value;
    this.system.hits.max = newHitsValue.max;

    /// update skills formula reference
    const actorSkills = this.itemTypes.skills.map(
      (skill:TwodsixItem) => [simplifySkillName(skill.name ?? ""), Math.max(skill.system.value, this.getUntrainedSkill()?.system.value ?? CONFIG.Item.dataModels.skills.schema.getInitialValue().value)]
    );

    const handler = {
      has: (target: Record<string,number>, property:string) => {
        return property[property.length - 1] !== "_" ? true : property.slice(0, -1) in target;
      },
      get: (target: Record<string,number>, property:string) => {
        if (property[property.length - 1] === "_") {
          const newName = property[property.length - 1] === "_" ? property.slice(0, -1) : property;
          return newName in target && target[newName] > 0 ? target[newName] : 0;
        } else {
          return property in target ? target[property] : this.getUntrainedSkill()?.system.value ?? CONFIG.Item.dataModels.skills.schema.getInitialValue().value;
        }
      }
    };

    system.skills = new Proxy(Object.fromEntries(actorSkills), handler);
    system.encumbrance.max = this.getMaxEncumbrance();
    system.encumbrance.value = this.getActorEncumbrance();

    if (this.type === 'traveller') {
      const armorValues = this.getArmorValues();
      system.primaryArmor.value = armorValues.primaryArmor;
      system.secondaryArmor.value = armorValues.secondaryArmor;
      system.radiationProtection.value = armorValues.radiationProtection;
      system.layersWorn = armorValues.layersWorn;
      system.wearingNonstackable = armorValues.wearingNonstackable;
      system.armorType = armorValues.CTLabel;
      system.armorDM = armorValues.armorDM || 0;
      system.reflectOn = armorValues.reflectOn;
      system.protectionTypes = armorValues.protectionTypes.length > 0 ? ": " + armorValues.protectionTypes.map( x => game.i18n.localize(x)).join(', ') : "";
      system.totalArmor = armorValues.totalArmor;
      const baseArmor = system.primaryArmor.value;

      this.applyActiveEffectsCustom();
      if (this.overrides.system?.primaryArmor?.value) {
        system.totalArmor += this.overrides.system.primaryArmor.value - baseArmor;
      }
    } else {
      this.applyActiveEffectsCustom();
    }
  }
  /**
   * Method to evaluate the armor and radiation protection values for all armor worn.
   * @returns {object} An object of the total for primaryArmor, secondaryArmor, and radiationProteciton
   * @public
   */
  getArmorValues():object {
    const returnValue = {
      primaryArmor: 0,
      secondaryArmor: 0,
      radiationProtection: 0,
      layersWorn: 0,
      wearingNonstackable: false,
      CTLabel: "nothing",
      armorDM: 0,
      reflectOn: false,
      protectionTypes: [] as string[],
      totalArmor: 0
    };
    const armorItems = this.itemTypes.armor;
    const useMaxArmorValue = game.settings.get('twodsix', 'useMaxArmorValue');
    const damageTypes = getDamageTypes(false);
    let reflectDM = 0;

    for (const armor of armorItems) {
      if (armor.system.equipped === "equipped") {
        if (armor.system.armorType === 'reflec') {
          returnValue.reflectOn = true;
          reflectDM = armor.system.armorDM;
        } else {
          returnValue.CTLabel = armor.system.armorType;
          returnValue.armorDM = armor.system.armorDM;
        }
        const totalArmor:number = armor.system.secondaryArmor.value + armor.system.armor;
        const protectionDetails:string[] = armor.system.secondaryArmor.protectionTypes.map((type:string) => `${damageTypes[type]}`);
        if (useMaxArmorValue) {
          returnValue.primaryArmor = Math.max(armor.system.armor, returnValue.primaryArmor);
          if (totalArmor > returnValue.totalArmor) {
            returnValue.secondaryArmor = armor.system.secondaryArmor.value;
            returnValue.totalArmor = totalArmor;
          }
          returnValue.radiationProtection = Math.max(armor.system.radiationProtection.value, returnValue.radiationProtection);
        } else {
          returnValue.primaryArmor += armor.system.armor;
          returnValue.secondaryArmor += armor.system.secondaryArmor.value;
          returnValue.totalArmor += totalArmor;
          returnValue.radiationProtection += armor.system.radiationProtection.value;
        }
        protectionDetails.forEach((type:string) => {
          if (!returnValue.protectionTypes.includes(type)) {
            returnValue.protectionTypes.push(type);
          }
        });
        returnValue.layersWorn += 1;
        if (armor.system.nonstackable) {
          returnValue.wearingNonstackable = true;
        }
      }
    }
    // Case where only wearing reflec
    if (returnValue.reflectOn && returnValue.CTLabel === 'nothing') {
      returnValue.CTLabel = 'reflec';
      returnValue.armorDM = reflectDM;
    }
    return returnValue;
  }
  /**
   * Method to evaluate the secondary armor value depending on the damge type and actor type. Returns the effective value
   * for the secondary armor.
   * @param {string} damageType  The damage type key to check against secondary armor
   * @returns {number} The value added to effective armor due to secondary armor
   * @public
   */
  getSecondaryProtectionValue(damageType:string): number {
    let returnValue = 0;
    if (damageType !== "NONE"  && damageType !== ""  && damageType) {
      if (['traveller'].includes(this.type)) {
        const armorItems = this.itemTypes.armor;
        const useMaxArmorValue = game.settings.get('twodsix', 'useMaxArmorValue');
        for (const armor of armorItems) {
          if (armor.system.equipped === "equipped" && armor.system.secondaryArmor.protectionTypes.includes(damageType)) {
            if (useMaxArmorValue) {
              returnValue = Math.max(armor.system.secondaryArmor.value, returnValue);
            } else {
              returnValue += armor.system.secondaryArmor.value;
            }
          }
        }
      } else if (['robot', 'animal'].includes(this.type)) {
        if (this.system.secondaryArmor.protectionTypes.includes(damageType)) {
          returnValue = this.system.secondaryArmor.value;
        }
      }
    }
    return returnValue;
  }

  getMaxEncumbrance():number {
    //Ignore encumbrance if an active ItemPiles Shop
    if (game.modules.get("item-piles")?.active) {
      if (this.getFlag("item-piles", "data.enabled") && this.getFlag("item-piles", "data.type") === "merchant") {
        return Infinity;
      }
    }

    let maxEncumbrance = 0;
    const encumbFormula = game.settings.get('twodsix', 'maxEncumbrance');
    if (Roll.validate(encumbFormula)) {
      let rollData:object;
      if (game.settings.get('twodsix', 'ruleset') === 'CT') {
        rollData = foundry.utils.duplicate(this.getRollData()); //Not celar why deepClone doesn't work here
        const encumberedEffect:TwodsixActiveEffect = this.effects.find(eff  => eff.statuses.has('encumbered'));
        if (encumberedEffect) {
          for (const change of encumberedEffect.changes) {
            const rollKey = change.key.replace('system.', '');
            foundry.utils.mergeObject(rollData, {[rollKey]: foundry.utils.getProperty(this, change.key) - parseInt(change.value)});
          }
        }
      } else {
        rollData = this.getRollData();
      }
      maxEncumbrance = Roll.safeEval(Roll.replaceFormulaData(encumbFormula, rollData, {missing: "0", warn: false}));
    }
    return Math.max(maxEncumbrance, 0);
  }

  getActorEncumbrance():number {
    let encumbrance = 0;
    const actorItems = this.items.filter( i => ![...TWODSIX.WeightlessItems, "ship_position", "storage"].includes(i.type));
    for (const item of actorItems) {
      encumbrance += getEquipmentWeight(item);
    }
    return encumbrance;
  }

  _prepareShipDerivedData(): void {
    const calcShipStats = {
      power: {
        max: 0,
        used: 0,
        systems: 0,
        jDrive: 0,
        mDrive: 0,
        sensors: 0,
        weapons: 0
      },
      weight: {
        systems: 0,
        cargo: 0,
        vehicles: 0,
        fuel: 0,
        available: 0,
        baseHull: 0
      },
      cost: {
        baseHullValue: 0,
        hullOffset: 1.0,
        percentHull: 0,
        perHullTon: 0,
        componentValue: 0,
        total: 0
      },
      bandwidth: {
        used: 0,
        available: 0
      }
    };

    /* estimate displacement if missing */
    if (!this.system.shipStats.mass.max || this.system.shipStats.mass.max <= 0) {
      const calcDisplacement = estimateDisplacement(this);
      if (calcDisplacement && calcDisplacement > 0) {
        this.update({"system.shipStats.mass.max": calcDisplacement});
        /*actorData.system.shipStats.mass.max = calcDisplacement;*/
      }
    }

    const massProducedMultiplier = this.system.isMassProduced ? (1 - parseFloat(game.settings.get("twodsix", "massProductionDiscount"))) : 1;

    this.itemTypes.component.forEach((item: TwodsixItem) => {
      const anComponent = <Component>item.system;
      const powerForItem = getPower(item);
      const weightForItem = getWeight(item);

      /* Allocate Power */
      allocatePower(anComponent, powerForItem, item);

      /* Allocate Weight*/
      allocateWeight(anComponent, weightForItem);

      /*Calculate Cost*/
      calculateComponentCost(anComponent, weightForItem, this, massProducedMultiplier);

      /*Calculate Cost*/
      calculateBandwidth(anComponent);
    });

    //Update component costs for those that depend on base hull value
    this.itemTypes.component.filter((it:TwodsixItem) => ["pctHull", "pctHullPerUnit"].includes(it.system.pricingBasis) && !["fuel", "cargo", "vehicle"].includes(it.system.subtype)).forEach((item: TwodsixItem) => {
      item.system.installedCost = calcShipStats.cost.baseHullValue * Number(item.system.price) / 100;
      if (item.system.pricingBasis === "pctHullPerUnit") {
        item.system.installedCost *= item.system.quantity;
      }
    });

    /*Calculate implicit values*/
    calcShipStats.power.used = calcShipStats.power.jDrive + calcShipStats.power.mDrive + calcShipStats.power.sensors +
      calcShipStats.power.weapons + calcShipStats.power.systems;

    calcShipStats.weight.available = this.system.shipStats.mass.max - (calcShipStats.weight.vehicles ?? 0) - (calcShipStats.weight.cargo ?? 0)
      - (calcShipStats.weight.fuel ?? 0) - (calcShipStats.weight.systems ?? 0);

    calcShipStats.cost.total = calcShipStats.cost.componentValue + calcShipStats.cost.baseHullValue * ( 1 + calcShipStats.cost.percentHull / 100 );

    /*Push values to ship actor*/
    updateShipData(this);

    function estimateDisplacement(shipActor): number {
      let returnValue = 0;
      shipActor.itemTypes.component.filter((item: TwodsixItem) => (<Component>item.system).isBaseHull).forEach((item: TwodsixItem) => {
        returnValue += getWeight(item);
      });
      return Math.round(returnValue);
    }

    function calculateComponentCost(anComponent: Component, weightForItem: number, shipActor:TwodsixActor, multiplier:number): void {
      if (!["fuel", "cargo", "vehicle"].includes(anComponent.subtype)) {
        if (anComponent.subtype === "hull" && anComponent.isBaseHull) {
          switch (anComponent.pricingBasis) {
            case "perUnit":
              anComponent.installedCost = Number(anComponent.price) * anComponent.quantity * multiplier;
              break;
            case "perCompTon":
              anComponent.installedCost = Number(anComponent.price) * weightForItem * multiplier;
              break;
            case "perHullTon":
              anComponent.installedCost = (shipActor.system.shipStats.mass.max || calcShipStats.weight.baseHull) * Number(anComponent.price) * multiplier;
              break;
            case "per100HullTon":
              anComponent.installedCost = (shipActor.system.shipStats.mass.max || calcShipStats.weight.baseHull) * Number(anComponent.price)/100 * multiplier;
              break;
          }
          calcShipStats.cost.baseHullValue += anComponent.installedCost;
        } else {
          switch (anComponent.pricingBasis) {
            case "perUnit":
              anComponent.installedCost = Number(anComponent.price) * anComponent.quantity * multiplier;
              break;
            case "perCompTon":
              anComponent.installedCost = Number(anComponent.price) * weightForItem * multiplier;
              break;
            case "pctHull":
              calcShipStats.cost.percentHull += Number(anComponent.price);
              break;
            case "pctHullPerUnit":
              calcShipStats.cost.percentHull += Number(anComponent.price) * anComponent.quantity;
              break;
            case "perHullTon":
              anComponent.installedCost = Number(anComponent.price) * (shipActor.system.shipStats.mass.max || calcShipStats.weight.baseHull) * multiplier;
              break;
            case "per100HullTon":
              anComponent.installedCost = Number(anComponent.price)/100 * (shipActor.system.shipStats.mass.max || calcShipStats.weight.baseHull) * multiplier;
              break;
          }
          if (!["pctHull", "pctHullPerUnit"].includes(anComponent.pricingBasis)) {
            calcShipStats.cost.componentValue += anComponent.installedCost;
          }
        }
      }
    }

    function calculateBandwidth(anComponent: Component): void {
      if (game.settings.get("twodsix", "showBandwidth") && ["operational", "damaged"].includes(anComponent.status)) {
        if (anComponent.subtype === "computer") {
          calcShipStats.bandwidth.available += anComponent.bandwidth;
        } else if (anComponent.subtype === "software") {
          calcShipStats.bandwidth.used += anComponent.bandwidth;
        }
      }
    }

    function allocateWeight(anComponent: Component, weightForItem: number): void {
      switch (anComponent.subtype) {
        case "vehicle":
          calcShipStats.weight.vehicles += weightForItem;
          break;
        case "cargo":
          calcShipStats.weight.cargo += weightForItem;
          break;
        case "fuel":
          calcShipStats.weight.fuel += weightForItem;
          break;
        case "hull":
          //don't include hull displacment in weight calculations
          if (anComponent.isBaseHull) {
            calcShipStats.weight.baseHull += weightForItem;
          } else {
            calcShipStats.weight.systems += weightForItem;
          }
          break;
        default:
          calcShipStats.weight.systems += weightForItem;
          break;
      }
    }

    function allocatePower(anComponent: Component, powerForItem: number, item: TwodsixItem): void {
      if (anComponent.generatesPower) {
        calcShipStats.power.max += powerForItem;
      } else {
        switch (anComponent.subtype) {
          case 'drive': {
            const componentName = item.name?.toLowerCase() ?? "";
            const jDriveLabel = (game.i18n.localize(game.settings.get('twodsix', 'jDriveLabel'))).toLowerCase();
            const mDriveLabel = game.i18n.localize("TWODSIX.Ship.MDrive").toLowerCase();
            if (componentName.includes('j-drive') || componentName.includes('j drive') || componentName.includes(jDriveLabel)) {
              calcShipStats.power.jDrive += powerForItem;
            } else if (componentName.includes('m-drive') || componentName.includes('m drive') || componentName.includes(mDriveLabel)) {
              calcShipStats.power.mDrive += powerForItem;
            } else {
              calcShipStats.power.systems += powerForItem;
            }
            break;
          }
          case 'sensor':
            calcShipStats.power.sensors += powerForItem;
            break;
          case 'armament':
            calcShipStats.power.weapons += powerForItem;
            break;
          default:
            calcShipStats.power.systems += powerForItem;
            break;
        }
      }
    }

    function updateShipData(shipActor): void {
      shipActor.system.shipStats.power.value = roundToMaxDecimals(calcShipStats.power.used, 1);
      shipActor.system.shipStats.power.max = roundToMaxDecimals(calcShipStats.power.max, 1);
      shipActor.system.reqPower.systems = roundToMaxDecimals(calcShipStats.power.systems, 1);
      shipActor.system.reqPower["m-drive"] = roundToMaxDecimals(calcShipStats.power.mDrive, 1);
      shipActor.system.reqPower["j-drive"] = roundToMaxDecimals(calcShipStats.power.jDrive, 1);
      shipActor.system.reqPower.sensors = roundToMaxDecimals(calcShipStats.power.sensors, 1);
      shipActor.system.reqPower.weapons = roundToMaxDecimals(calcShipStats.power.weapons, 1);

      shipActor.system.shipStats.bandwidth.value = Math.round(calcShipStats.bandwidth.used);
      shipActor.system.shipStats.bandwidth.max = Math.round(calcShipStats.bandwidth.available);

      shipActor.system.weightStats.vehicles = roundToMaxDecimals(calcShipStats.weight.vehicles, 2);
      shipActor.system.weightStats.cargo = roundToMaxDecimals(calcShipStats.weight.cargo, 2);
      shipActor.system.weightStats.fuel = roundToMaxDecimals(calcShipStats.weight.fuel, 2);
      shipActor.system.weightStats.systems = roundToMaxDecimals(calcShipStats.weight.systems, 2);
      shipActor.system.weightStats.available = roundToMaxDecimals(calcShipStats.weight.available, 2);

      shipActor.system.shipValue = calcShipStats.cost.total.toLocaleString(game.i18n.lang, {minimumFractionDigits: 1, maximumFractionDigits: 1});
      shipActor.system.mortgageCost = (calcShipStats.cost.total / game.settings.get("twodsix", "mortgagePayment") * 1000000).toLocaleString(game.i18n.lang, {maximumFractionDigits: 0});
      shipActor.system.maintenanceCost = (calcShipStats.cost.total * 0.001 * 1000000 / 12).toLocaleString(game.i18n.lang, {maximumFractionDigits: 0});
    }
  }

  public async damageActor(damagePayload:any, showDamageDialog = true): Promise<void> {
    if (showDamageDialog) {
      const damageData = foundry.utils.duplicate(damagePayload);
      Object.assign(damageData, {
        damageId: "damage-" + foundry.utils.randomID(),
        actor: this
      });
      game.socket?.emit("system.twodsix", ["createDamageDialog", damageData]);
      Hooks.call('createDamageDialog', damageData);
    } else {
      const canOnlyBeBlocked = damagePayload.canBeBlocked && !damagePayload.canBeParried;
      const parryArmor = damagePayload.canBeParried || damagePayload.canBeBlocked ? await getParryValue(this, canOnlyBeBlocked) : 0;
      const stats = new Stats(this, damagePayload.damageValue, damagePayload.armorPiercingValue, damagePayload.damageType, damagePayload.damageLabel, parryArmor, canOnlyBeBlocked);
      await stats.applyDamage();
    }
  }

  public async healActor(healing: number): Promise<void> {
    if (["traveller", "animal", "robot"].includes(this.type)) {
      let damageCharacteristics: string[] = [];
      if (game.settings.get('twodsix', 'reverseHealingOrder')) {
        damageCharacteristics = getDamageCharacteristics(this.type).reverse();
      } else {
        damageCharacteristics = getDamageCharacteristics(this.type);
      }
      const charArray = {};
      for (const characteristic of damageCharacteristics) {
        const cur_damage = this.system.characteristics[characteristic].damage;

        if (cur_damage > 0) {
          const new_damage = Math.max(0, cur_damage - healing);
          const char_id = 'system.characteristics.' + characteristic + '.damage';
          charArray[char_id] = new_damage;
          healing -= cur_damage - new_damage;
        }

        if (healing < 1) {
          break;
        }
      }
      await this.update(charArray); /*update only once*/
    }
  }

  getDeltaHits(charDiff:any): number {
    const newCharacteristics = foundry.utils.mergeObject(this.system.characteristics, charDiff);
    const updatedHitValues = this.getCurrentHits(newCharacteristics);
    const deltaHits = this.system.hits.value - updatedHitValues.value;
    //Object.assign(update.system.hits, {lastDelta: deltaHits});
    if (deltaHits !== 0 && game.settings.get("twodsix", "showHitsChangesInChat")) {
      const appliedType = deltaHits > 0 ? game.i18n.localize("TWODSIX.Actor.damage") : game.i18n.localize("TWODSIX.Actor.healing");
      const actionWord = game.i18n.localize("TWODSIX.Actor.Applied");
      ChatMessage.create({ flavor: `${actionWord} ${appliedType}: ${Math.abs(deltaHits)}`, speaker: ChatMessage.getSpeaker({ actor: this }), whisper: ChatMessage.getWhisperRecipients("GM") });
    }
    return isNaN(deltaHits) ? 0 : deltaHits;
  };

  getCurrentHits(currentCharacteristics: Record<string, any>[]) {
    const hitsCharacteristics: string[] = getDamageCharacteristics(this.type);
    return Object.entries(currentCharacteristics).reduce((hits, [key, chr]) => {
      if (hitsCharacteristics.includes(key)) {
        hits.value += chr.value-chr.damage;
        hits.max += chr.value;
      }
      return hits;
    }, {value: 0, max: 0, lastDelta: 0});
  }

  public getCharacteristicModifier(characteristic: string): number {
    if (characteristic === 'NONE') {
      return 0;
    } else if (['ship', 'vehicle', 'space-object'].includes(this.type)) {
      return 0;
    } else {
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      return (<Traveller>this.system).characteristics[keyByValue].mod;
    }
  }

  public async characteristicRoll(tmpSettings: any, showThrowDialog: boolean, showInChat = true): Promise<TwodsixDiceRoll | void> {
    //Set charactersitic label
    if (!tmpSettings.rollModifiers?.characteristic) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoCharacteristicForRoll"));
      return;
    }
    //Select Difficulty if needed
    if (!tmpSettings.difficulty) {
      const difficultyObject = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')];
      tmpSettings.difficulty =  game.settings.get('twodsix', 'ruleset') === 'CU' ? difficultyObject.Routine : difficultyObject.Average ;
    }
    const settings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, undefined, undefined, this);
    if (!settings.shouldRoll) {
      return;
    }

    const diceRoll = new TwodsixDiceRoll(settings, this);
    await diceRoll.evaluateRoll();
    if (showInChat) {
      await diceRoll.sendToChat(settings.difficulties);
    }
    return diceRoll;
  }

  public getUntrainedSkill(): TwodsixItem {
    //TODO May need to update this type <Traveller>
    return <TwodsixItem>this.items.get((<Traveller>this.system).untrainedSkill);
  }

  public createUntrainedSkillData(): any {
    if ((<Traveller>this.system).untrainedSkill) {
      if (this.items.get(this.system.untrainedSkill)) {
        return;
      }
    }
    const existingSkill:Skills = this.itemTypes.skills?.find(sk => sk.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained"));
    if (existingSkill) {
      return;
    }
    return buildUntrainedSkillData();
  }

  public createUnarmedData(): any {
    if (this.items?.getName(game.i18n.localize("TWODSIX.Items.Weapon.Unarmed"))) {
      return;
    }
    const bandSetting = game.settings.get('twodsix', 'rangeModifierType');
    let rangeSetting = "";
    if ( bandSetting === 'CT_Bands' ) {
      rangeSetting = "hands";
    } else if (bandSetting === 'CE_Bands') {
      rangeSetting = "closeQuarters";
    } else if (bandSetting === 'CU_Bands') {
      rangeSetting = "personal";
    }
    return {
      "name": game.i18n.localize("TWODSIX.Items.Weapon.Unarmed"),
      "type": "weapon",
      "img": "systems/twodsix/assets/icons/unarmed.svg",
      "system": {
        "armorPiercing": 0,
        "description": game.i18n.localize("TWODSIX.Items.Weapon.UnarmedDescription"),
        "type": "weapon",
        "damage": game.settings.get("twodsix", "unarmedDamage") || "1d6",
        "quantity": 1,
        "skill": this.getUntrainedSkill()?.id || "",
        "equipped": "equipped",
        "damageType": game.settings.get('twodsix', 'ruleset') === 'CU' ? "melee" : "bludgeoning",
        "range": "Melee",
        "rangeBand": rangeSetting,
        "handlingModifiers": game.settings.get('twodsix', 'ruleset') === 'CT' ? "STR 6/-2 9/1" : ""
      }
    };
  }

  public static resetUntrainedSkill(): void {
    applyToAllActors(async (actor:TwodsixActor) => {
      if (["traveller", "animal", "robot"].includes(actor.type)) {
        await correctMissingUntrainedSkill(actor);
        const itemUpdates = [];
        for (const item of actor.items) {
          if (!["skills", "trait"].includes(item.type)) {
            const skill = actor.items.get((<Gear>item.system).skill);
            if (skill && skill.getFlag("twodsix", "untrainedSkill")) {
              //CHECK FOR ASSOCIATED SKILL NAME AS FIRST OPTION
              const associatedSkill = actor.getBestSkill(item.system.associatedSkillName, false);
              itemUpdates.push({_id: item.id, "system.skill": associatedSkill?.id ?? "" });
            }
          }
        }
        if (itemUpdates.length > 0) {
          actor.updateEmbeddedDocuments('Item', itemUpdates);
        }
      }
    });
  }

  public static setUntrainedSkillForItems(): void {
    applyToAllActors(async (actor: TwodsixActor) => {
      if (["traveller", "animal", "robot"].includes(actor.type)) {
        await correctMissingUntrainedSkill(actor);
        const itemUpdates = [];
        const untrainedSkill = actor.getUntrainedSkill();
        for (const item of actor.items) {
          if (!["skills", "trait"].includes(item.type)) {
            const attachedSkill = await actor.items.get(item.system.skill);
            if (!attachedSkill || (untrainedSkill.system.value === actor.system.skills[simplifySkillName(attachedSkill?.name)]) && !attachedSkill?.getFlag("twodsix", "untrainedSkill")) {
              //CHECK FOR ASSOCIATED SKILL NAME AS FIRST OPTION
              const associatedSkill = actor.getBestSkill(item.system.associatedSkillName, false);
              itemUpdates.push({_id: item.id, "system.skill": associatedSkill?.id ?? untrainedSkill.id});
            }
          }
        }
        if (itemUpdates.length > 0) {
          await actor.updateEmbeddedDocuments('Item', itemUpdates);
        }
      }
    });
  }

  /**
   * Method to modify Traveller, Robot or Animal actor from token bar input. Special processing for "hits" attribute.
   * @param {string} attribute    The characteristic attribute (full name) being changed or generic "hits" attribute
   * @param {number} value  The change to the attribute (either a delta or direct value)
   * @param {boolean} isDelta Whether the value is a delta or an absolute number
   * @param {boolean} isBar Whether the value is a bar on token
   * @returns {Promise}
   * @public
   */
  public async modifyTokenAttribute(attribute: string, value: number, isDelta: boolean, isBar: boolean): Promise <any>{
    if ( attribute === "hits" && ["traveller", "animal", "robot"].includes(this.type)) {
      const hits = foundry.utils.getProperty(this.system, attribute);
      const delta = isDelta ? (-1 * value) : (hits.value - value);
      if (delta > 0) {
        this.damageActor({damageValue: delta, armorPiercingValue: 9999, damageType: "NONE", damageLabel: "NONE", canBeParried: false}, false);
        return;
      } else if (delta < 0) {
        this.healActor(-delta);
        return;
      }
    }
    return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
  }

  /**
   * Function to add a dropped skill to an actor
   * @param {any} skillData    The skill document
   * @returns {Promise} A boolean promise of whether the drop was sucessful
   * @private
   */
  private async _addDroppedSkills(skillData: any): Promise<boolean>{
    // Handle item sorting within the same Actor SHOULD NEVER DO THIS
    const sameActor = this.items.get(skillData._id);
    if (sameActor) {
      console.log(`Twodsix | Moved Skill ${skillData.name} to another position in the skill list`);
      //return this._onSortItem(event, sameActor);
      return false;
    }

    //Check for pre-existing skill by same name
    const matching = this.items.find(it => it.name === skillData.name && it.type === "skills");

    if (matching) {
      console.log(`Twodsix | Skill ${skillData.name} already on character ${this.name}.`);
      //Increase skill value
      let updateValue = matching.system.value + 1;
      if (game.settings.get('twodsix', 'hideUntrainedSkills') && updateValue < 0) {
        updateValue = 0;
      }
      await matching.update({"system.value": updateValue});
      return false;
    }
    const addedSkill = (await (<ActorSheet>this.sheet)._onDropItemCreate(foundry.utils.duplicate(skillData)))[0];
    //const addedSkill = (await this.createEmbeddedDocuments("Item", [foundry.utils.duplicate(skillData)]))[0];
    if (addedSkill.system.value < 0 || !addedSkill.system.value) {
      if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
        const skillValue = CONFIG.Item.dataModels.skills.schema.getInitialValue().value ?? -3;
        addedSkill.update({"system.value": skillValue});
      } else {
        addedSkill.update({"system.value": 0});
      }
    }
    console.log(`Twodsix | Added Skill ${addedSkill.name} to character`);
    return(!!addedSkill);
  }

  /**
   * Method to add a dropped item to an actor
   * @param {any} itemData    The item document
   * @returns {Promise} A boolean promise of whether the drop was sucessful
   * @private
   */
  private async _addDroppedEquipment(itemData): Promise<boolean>{
    // Handle item sorting within the same Actor
    const sameActor = this.items.get(itemData._id);
    if (sameActor) {
      //return this.sheet._onSortItem(event, sameActor);
      return false;
    }

    let transferData = {};
    //Need to catch because Monk's enhanced Journal drops item data not TwodsixItem
    try {
      transferData = itemData.toJSON();
    } catch(err) {
      console.log(`Try importing as direct data ${err}`);
      transferData = itemData;
    }
    let numberToMove = itemData.system?.quantity ?? 1;

    //Handle moving items from another actor if enabled by settings
    if (itemData.actor  && game.settings.get("twodsix", "transferDroppedItems")) {
      const sourceActor = itemData.actor; //fix
      if (itemData.system.quantity > 1) {
        numberToMove = await getMoveNumber(itemData);
        if (numberToMove >= itemData.system.quantity) {
          await itemData.update({"system.equipped": "ship"});
          numberToMove = itemData.system.quantity;
          await sourceActor.deleteEmbeddedDocuments("Item", [itemData.id]);
        } else if (numberToMove === 0) {
          return false;
        } else {
          await sourceActor.updateEmbeddedDocuments("Item", [{_id: itemData.id, 'system.quantity': (itemData.system.quantity - numberToMove)}]);
        }
      } else if (itemData.system.quantity === 1) {
        await itemData.update({"system.equipped": "ship"});
        await sourceActor.deleteEmbeddedDocuments("Item", [itemData.id]);
      } else {
        return false;
      }
    }

    // Item already exists on actor
    let dupItem:TwodsixItem = {};
    if (itemData.type === "component") {
      dupItem = <TwodsixItem>this.items.find(it => it.name === itemData.name && it.type === itemData.type && it.system.subtype === itemData.system.subtype);
    } else {
      dupItem = <TwodsixItem>this.items.find(it => it.name === itemData.name && it.type === itemData.type);
    }

    if (dupItem) {
      console.log(`Twodsix | Item ${itemData.name} already on character ${this.name}.`);
      if( dupItem.type !== "skills"  && dupItem.type !== "trait" && dupItem.type !== "ship_position") {
        const newQuantity = dupItem.system.quantity + numberToMove;
        dupItem.update({"system.quantity": newQuantity});
      }
      return false;
    }

    // Create the owned item
    transferData.system.quantity = numberToMove;
    transferData.system.equipped = "backpack";
    delete transferData._id;
    // Prepare effects
    if ( transferData.effects?.length > 0) {
      for (const effect of transferData.effects) {
        effect.disabled = false;
        effect.transfer =  game.settings.get('twodsix', "useItemActiveEffects");
      }
    }

    //Link an actor skill with names defined by item.associatedSkillName
    transferData.system.skill = this.getBestSkill(transferData.system.associatedSkillName, false)?.id ?? this.getUntrainedSkill()?.id;

    //Remove any attached consumables
    transferData.system.consumables = [];
    transferData.system.useConsumableForAttack = '';

    //Create Item
    const addedItem = (await this.createEmbeddedDocuments("Item", [transferData]))[0];
    if (game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && this.type === 'traveller' && !TWODSIX.WeightlessItems.includes(addedItem.type)) {
      await applyEncumberedEffect(this);
    }
    console.log(`Twodsix | Added Item ${itemData.name} to character`);
    return (!!addedItem);
  }

  public async handleDroppedItem(itemData): Promise<boolean> {
    if(!itemData) {
      return false;
    }

    switch (this.type) {
      case 'traveller':
        if (itemData.type === 'skills') {
          return await this._addDroppedSkills(itemData);
        } else if (!["component", "ship_position"].includes(itemData.type)) {
          return await this._addDroppedEquipment(itemData);
        }
        break;
      case 'animal':
        if (itemData.type === 'skills') {
          return this._addDroppedSkills(itemData);
        } else if (["weapon", "trait"].includes(itemData.type)) {
          return await this._addDroppedEquipment(itemData);
        }
        break;
      case 'robot':
        if (itemData.type === 'skills') {
          return await this._addDroppedSkills(itemData);
        } else if (["weapon", "trait", "augment"].includes(itemData.type)) {
          return await this._addDroppedEquipment(itemData);
        }
        break;
      case 'ship':
        if (!TWODSIX.WeightlessItems.includes(itemData.type)) {
          return await this._addDroppedEquipment(itemData);
        }
        break;
      case 'vehicle':
        if (itemData.type === "component") {
          return await this._addDroppedEquipment(itemData);
        }
        break;
    }
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantDragOntoActor"));
    return false;
  }

  /**
   * Method to handle a dropped damage payload
   * @param {any} damagePayload The damage paylod being dropped (includes damage amount, AP value and damage type & label)
   * @param {boolean} showDamageDialog Whethter to show apply damage dialog
   * @returns {boolean}
   * @private
   */
  public async handleDamageData(damagePayload:any, showDamageDialog:boolean): Promise<boolean> {
    if (!this.isOwner && !showDamageDialog) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.LackPermissionToDamage"));
    } else if (["traveller", "animal", "robot"].includes(this.type)) {
      await this.damageActor(damagePayload, showDamageDialog);
      return true;
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantAutoDamage"));
    }
    return false;
  }

  /**
   * Apply any transformations to the Actor data which are caused by ActiveEffects - post prepare data.
   */
  applyActiveEffectsCustom() {
    //Fix for item-piles module
    if (game.modules.get("item-piles")?.active) {
      if (this.getFlag("item-piles", "data.enabled")) {
        return;
      }
    }
    const derivedData = [];

    //Add characteristics mods
    for (const char of Object.keys(this.system.characteristics)) {
      derivedData.push(`system.characteristics.${char}.mod`);
    }
    //Add skills
    for (const skill of this.itemTypes.skills) {
      derivedData.push(`system.skills.${simplifySkillName(skill.name)}`);
    }
    //Add specials
    if (this.type === 'traveller') {
      derivedData.push("system.encumbrance.max", "system.encumbrance.value", "system.primaryArmor.value", "system.secondaryArmor.value", "system.radiationProtection.value");
    }

    //Define derived data keys that can have active effects
    const overrides = {};

    // Organize non-disabled effect changes using derived data list or CUSTOM by their application priority
    const changes = [];
    for ( const effect of this.appliedEffects ) {
      changes.push(...effect.changes.filter( change => (change.mode === CONST.ACTIVE_EFFECT_MODES.CUSTOM || derivedData.includes(change.key))).map(change => {
        const c = foundry.utils.deepClone(change);
        c.effect = effect;
        c.priority = c.priority ?? (c.mode * 10);
        return c;
      }));
      for ( const statusId of effect.statuses ) {
        this.statuses.add(statusId);
      }
    }
    changes.sort((a, b) => a.priority - b.priority);

    // Apply derived data changes
    for ( const change of changes ) {
      const newChanges = change.effect.apply(this, change);
      Object.assign(overrides, newChanges);
    }

    // Expand the set of final overrides
    if (Object.keys(overrides).length > 0) {
      this.overrides = foundry.utils.mergeObject(this.overrides, foundry.utils.expandObject(overrides));
    }
  }

  /**
   * Display changes to health as scrolling combat text.
   * Adapt the font size relative to the Actor's HP total to emphasize more significant blows.
   * @param {number} damageApplied  The change in hit points that was applied
   * @public
   */
  public scrollDamage(damageApplied:number): void {
    if ( !damageApplied ) {
      return;
    }
    const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
    for ( const t of tokens ) {
      const pct = Math.clamp(Math.abs(damageApplied) / this.system.hits.max, 0, 1);
      canvas.interface.createScrollingText(t.center, -damageApplied.signedString(), {
        anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
        fontSize: 22 + (32 * pct), // Range between [22, 54]
        fill: -damageApplied < 0 ? 16711680 : 65280,
        stroke: 0x000000,
        strokeThickness: 4,
        jitter: 0.25
      });
    }
  }

  /**
   * Get skills level pairs.
   * @return {any} an object with skill name /level pairs
   * @public
   */
  public async getSkillNameList(): any {
    const returnObject = {};
    const skillsArray:TwodsixItem[] = sortByItemName(this.itemTypes.skills);
    for (const skill of skillsArray) {
      if ((skill.system.value >= 0 || !game.settings.get('twodsix', 'hideUntrainedSkills') || this.system.skills[simplifySkillName(skill.name)] >= 0)
         || (skill.getFlag("twodsix", "untrainedSkill") === game.settings.get('twodsix', 'hideUntrainedSkills'))) {
        Object.assign(returnObject, {[skill.uuid]: `${skill.name} (${this.system.skills[simplifySkillName(skill.name)]})`});
      }
    }
    return returnObject;
  }

  /**
   * Method stub to execute a ship action as a method from Token Action HUD.
   * @action {object} Ship Action type
   * @extra {object} Object of data defining the ship action
   * @public
   */
  public doShipAction(action: object, extra: object):void {
    if (this.type === 'ship') {
      TwodsixShipActions.availableMethods[action.type].action(action.command, extra);
    }
  }

  /**
   * Returns skill with highest value from an actor based on a list of skills
   * @param {string} skillList A string of skills separated by pipe, e.g. "Admin | Combat"
   * @param {boolean} includeChar Whether to include default charactrisic in selection
   * @returns {TwodsixItem|undefined} the skill document selected
   */
  public getBestSkill(skillList: string, includeChar: boolean): TwodsixItem|undefined {
    if (skillList === undefined) {
      return undefined;  //return if associatedSkillName doesn't exist (skillList is undefined, empty string is OK).
    }
    let skill:TwodsixItem|undefined = undefined;
    const skillOptions = skillList.split("|").map(str => str.trim());
    /* add qualified skill objects to an array*/
    const skillObjects = this.itemTypes.skills?.filter((itm: TwodsixItem) => skillOptions.includes(itm.name));
    // find the most advantageous skill to use from the collection
    if(skillObjects?.length > 0){
      skill = skillObjects.reduce((prev, current) => {
        //use this.system.skills[simplfiedSkillName] not system.value to account for Active Effects
        const prevValue = this.system.skills[simplifySkillName(prev.name)] + (includeChar ? this.getCharMoD(prev.system.characteristic) : 0);
        const currentValue = this.system.skills[simplifySkillName(current.name)] + (includeChar ? this.getCharMoD(current.system.characteristic) : 0);
        return (prevValue > currentValue) ? prev : current;
      });
    }
    // If skill missing, try to use Untrained
    if (!skill) {
      skill = this.itemTypes.skills.find((itm: TwodsixItem) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained")) as TwodsixItem;
    }
    return skill;
  }

  /**
   * Returns characteristic modifier based on the core short label (not the display label)
   * @param {string} charShort A string of the core short characteristic label (uncustomized). This is the static label and not the display label.
   * @returns {number} the characteristic value
   */
  private getCharMoD(charShort: string):number {
    if (charShort !== 'NONE' && charShort) {
      const key = getKeyByValue(TWODSIX.CHARACTERISTICS, charShort);
      return /*ObjectbyString(this.overrides, `system.characteristics.${key}`) ??*/ this.system.characteristics[key]?.mod ?? 0;
    } else {
      return 0;
    }
  }

  /**
   * Removes (damages) psionic characteristic and spreads excess to regular damage
   * @param {number} psiCost The number of psi points to remove
   */
  public async removePsiPoints(psiCost: number): Promise<void> {
    if (psiCost > 0) {
      const netPoints = Math.min(this.system.characteristics.psionicStrength.current, psiCost);
      await this.update({'system.characteristics.psionicStrength.damage': this.system.characteristics.psionicStrength.damage + netPoints});
      if (netPoints < psiCost) {
        await this.damageActor({damageValue: psiCost - netPoints, armorPiercingValue: 9999, damageType: "psionic", damageLabel: game.i18n.localize("TWODSIX.DamageType.Psionic"), canBeParried: false}, false);
      }
    }
  }
}

/**
 * Calculates the power draw for a ship component.
 * @param {TwodsixItem} item the ship component
 * @return {number} the power draw of the ship component (power units)
 * @public
 * @function
 */
export function getPower(item: TwodsixItem): number{
  if (["operational", "damaged"].includes(item.system.status)) {
    const pf = item.system.powerDraw || 0;
    if (item.system.powerBasis === 'perUnit') {
      let quant = item.system.quantity || 1;
      if (item.system.subtype === "armament"  && item.system.availableQuantity) {
        quant = parseInt(item.system.availableQuantity);
      }
      return (quant * pf);
    } else if (item.system.powerBasis === 'perHullTon') {
      return pf * (item.actor?.system.shipStats.mass.max ?? 0);
    } else if (item.system.powerBasis === 'perCompTon') {
      return pf * getWeight(item);
    }
  }
  return 0;
}

/**
 * Calculates the displacement weight for a ship component.
 * @param {TwodsixItem} item the ship component
 * @return {number} the displacement of the ship component (dtons)
 * @public
 * @function
 */
export function getWeight(item: TwodsixItem): number{
  const quant = item.system.quantity ?? 1;
  /*if (["armament", "fuel"].includes(item.subtype) && item.availableQuantity) {
    q = parseInt(item.availableQuantity);
  }  make true displacement and not mass*/
  let wf = 0;
  if (item.system.weightIsPct) {
    wf = (item.system.weight ?? 0) / 100 * (item.actor?.system.shipStats.mass.max ?? 0);
  } else {
    wf = item.system.weight ?? 0;
  }
  return (wf * quant);
}

/**
 * A function to delete a player actor from ship positions when that player actor is deleted.
 * @param {string} actorId the id of the actor deleted
 * @return {void}
 * @function
 */
async function deleteIdFromShipPositions(actorId: string) {
  const allShips = (game.actors?.contents.filter(actor => actor.type === "ship") ?? []) as TwodsixActor[];

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor && !token.actorLink && token.actor.type === "ship") {
        allShips.push(token.actor as TwodsixActor);
      }
    }
  }

  for (const ship of allShips) {
    if ((<Ship>ship.system).shipPositionActorIds[actorId]) {
      await ship.update({[`system.shipPositionActorIds.-=${actorId}`]: null });
    }
  }
}

/**
 * Calculates the carried weight for personal equipment. Includes offset for worn armor.
 * @param {Component} item the equipment carried
 * @return {number} the weight of the carried item
 * @function
 */
function getEquipmentWeight(item:TwodsixItem):number {
  if (!TWODSIX.WeightlessItems.includes(item.type)) {
    if (["backpack", "equipped"].includes(item.system.equipped)) {
      let q = item.system.quantity || 0;
      const w = item.system.weight || 0;
      if (item.type === "armor" && item.system.equipped === "equipped") {
        if (item.system.isPowered) {
          q = Math.max(0, q - 1);
        } else {
          q = Math.max(0, q - 1 + Number(game.settings.get("twodsix", "weightModifierForWornArmor")));
        }
      }
      return (q * w);
    }
  }
  return 0;
}

/**
 * A function that opens a dialog to determined the quantity moved when transfering an item.
 * @param {Component} item the equipment being transfered
 * @return {number} the quantity transfered
 * @function
 */
async function getMoveNumber(itemData:TwodsixItem): Promise <number> {
  const returnNumber:number = await new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("TWODSIX.Actor.Items.QuantityToTransfer"),
      content:
        `<div style="display: flex; align-items: center; gap: 2ch; justify-content: center;"><img src="` + itemData.img + `" data-tooltip = "` + itemData.name +`" width="50" height="50"> ` + itemData.name + `</div>`+
        `<div><label for='amount'>` + game.i18n.localize("TWODSIX.Actor.Items.Amount") + `<input type="number" name="amount" value="` +
        itemData.system.quantity + `" max="` + itemData.system.quantity + `" min = "0"></input></label></div>`,
      buttons: {
        Transfer: {
          label: `<i class="fa-solid fa-arrow-right-arrow-left"></i> ` + game.i18n.localize("TWODSIX.Actor.Items.Transfer"),
          callback:
            (html:JQuery) => {
              resolve(html.find('[name="amount"]')[0]["value"]);
            }
        }
      },
      default: `Transfer`
    }).render(true);
  });
  return Math.round(returnNumber);
}

/**
 * A function to check and correct when an actor is missing the Untrained skill.
 * @param {TwodsixActor} actor the actor being checked
 * @return {void}
 * @function
 * @public
 */
export async function correctMissingUntrainedSkill(actor: TwodsixActor): Promise<void> {
  if (["traveller", "robot", "animal"].includes(actor.type)) {
    //Check for missing untrained skill
    const untrainedSkill = actor.getUntrainedSkill();
    if (!untrainedSkill) {
      console.log(`TWODSIX: Fixing missing untrained skill in ${actor.id} (${actor.name}).`);
      const existingSkill:Skills = await actor.itemTypes.skills?.find(sk => (sk.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained")) || sk.getFlag("twodsix", "untrainedSkill"));
      if (existingSkill) {
        await actor.update({"system.untrainedSkill": existingSkill.id});
      } else {
        const untrainedSkillData = actor.createUntrainedSkillData();
        if (untrainedSkillData) {
          await actor.createEmbeddedDocuments("Item", [untrainedSkillData]);
          await actor.update({"system.untrainedSkill": untrainedSkillData['_id']});
        }
      }
    }
  }
}

function buildUntrainedSkillData(): any {
  return {
    "name": game.i18n.localize("TWODSIX.Actor.Skills.Untrained"),
    "type": "skills",
    "_id": foundry.utils.randomID(),
    "system": {"characteristic": "NONE"},
    "flags": {'twodsix': {'untrainedSkill': true}},
    "img": "./systems/twodsix/assets/icons/jack-of-all-trades.svg"
  };
}

function isEncumbranceChange(changed:object): boolean {
  if (changed.system?.characteristics?.strength) {
    return true;
  } else if (changed.system?.characteristics?.endurance && ['CEATOM', "BARBARIC"].includes(game.settings.get('twodsix', 'ruleset'))) {
    return true;
  }
  return false;
}
