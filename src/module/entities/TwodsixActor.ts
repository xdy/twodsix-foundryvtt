// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { calcModFor, getKeyByValue } from "../utils/sheetUtils";
import { TWODSIX } from "../config";
import { TwodsixRollSettings} from "../utils/TwodsixRollSettings";
import { TwodsixDiceRoll } from "../utils/TwodsixDiceRoll";
import { simplifySkillName, sortByItemName } from "../utils/utils";
import TwodsixItem from "./TwodsixItem";
import { getDamageCharacteristics, Stats } from "../utils/actorDamage";
import {Characteristic, Component, Gear, Ship, Skills, Traveller} from "../../types/template";
import { getCharShortName } from "../utils/utils";
import { applyToAllActors } from "../utils/migration-utils";
import { applyEncumberedEffect } from "../hooks/showStatusIcons";
import { TwodsixShipActions } from "../utils/TwodsixShipActions";

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export default class TwodsixActor extends Actor {
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
        this._prepareTravellerData();
        break;
      case 'ship':
        if (game.settings.get("twodsix", "useShipAutoCalcs")) {
          this._prepareShipData();
        }
        this._checkCrewTitles();
        super.applyActiveEffects();
        break;
      case 'vehicle':
      case 'space-object':
        super.applyActiveEffects();
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
  async _prepareTravellerData(): void {
    this._updateActiveEffects(false);
    const {system} = this;

    for (const cha of Object.keys(system.characteristics)) {
      const characteristic: Characteristic = system.characteristics[cha];
      characteristic.current = characteristic.value - characteristic.damage;
      characteristic.mod = calcModFor(characteristic.current);
      if (characteristic.displayShortLabel === "") {
        characteristic.displayShortLabel = getCharShortName(characteristic.shortLabel);
      }
    }
    const actorSkills = this.itemTypes.skills.map(
      (skill:TwodsixItem) => [simplifySkillName(skill.name ?? ""), Math.max(skill.system.value, this.getUntrainedSkill()?.system.value ?? game.system.template.Item.skills.value)]
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
          return property in target ? target[property] : this.getUntrainedSkill()?.system.value ?? game.system.template.Item.skills.value;
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
    }
    await this._updateActiveEffects(true);
  }
  /**
   * Method to evaluate the armor and radiation protection values for all armor worn.
   * @returns {object} An object of the total for primaryArmor, secodnaryArmor, and radiationProteciton
   * @public
   */
  getArmorValues():object {
    const returnValue = {
      primaryArmor: 0,
      secondaryArmor: 0,
      radiationProtection: 0,
      layersWorn: 0,
      wearingNonstackable: false
    };
    const armorItems = this.itemTypes.armor;
    const useMaxArmorValue = game.settings.get('twodsix', 'useMaxArmorValue');
    for (const armor of armorItems) {
      if (armor.system.equipped === "equipped") {
        if (useMaxArmorValue) {
          returnValue.primaryArmor = Math.max(armor.system.armor, returnValue.primaryArmor);
          returnValue.secondaryArmor = Math.max(armor.system.secondaryArmor.value, returnValue.secondaryArmor);
          returnValue.radiationProtection = Math.max(armor.system.radiationProtection.value, returnValue.radiationProtection);
        } else {
          returnValue.primaryArmor += armor.system.armor;
          returnValue.secondaryArmor += armor.system.secondaryArmor.value;
          returnValue.radiationProtection += armor.system.radiationProtection.value;
        }

        returnValue.layersWorn += 1;
        if (armor.system.nonstackable) {
          returnValue.wearingNonstackable = true;
        }
      }
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
    let maxEncumbrance = 0;
    const encumbFormula = game.settings.get('twodsix', 'maxEncumbrance');
    if (Roll.validate(encumbFormula)) {
      maxEncumbrance = Roll.safeEval(Roll.replaceFormulaData(encumbFormula, this.system));
    }
    return maxEncumbrance;
  }

  getActorEncumbrance():number {
    let encumbrance = 0;
    const actorItems = this.items.filter( i => !["skills", "trait", "ship_position", "storage"].includes(i.type));
    for (const item of actorItems) {
      encumbrance += getEquipmentWeight(<TwodsixItem>item);
    }
    return encumbrance;
  }

  _prepareShipData(): void {
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
        hullValue: 0,
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

    this.itemTypes.component.forEach((item: TwodsixItem) => {
      const anComponent = <Component>item.system;
      const powerForItem = getPower(item);
      const weightForItem = getWeight(item);

      /* Allocate Power */
      allocatePower(anComponent, powerForItem, item);

      /* Allocate Weight*/
      allocateWeight(anComponent, weightForItem);

      /*Calculate Cost*/
      calculateComponentCost(anComponent, weightForItem, this);

      /*Calculate Cost*/
      calculateBandwidth(anComponent);
    });

    /*Calculate implicit values*/
    calcShipStats.power.used = calcShipStats.power.jDrive + calcShipStats.power.mDrive + calcShipStats.power.sensors +
      calcShipStats.power.weapons + calcShipStats.power.systems;

    calcShipStats.weight.available = this.system.shipStats.mass.max - (calcShipStats.weight.vehicles ?? 0) - (calcShipStats.weight.cargo ?? 0)
      - (calcShipStats.weight.fuel ?? 0) - (calcShipStats.weight.systems ?? 0);

    calcShipStats.cost.total = calcShipStats.cost.componentValue + calcShipStats.cost.hullValue * ( 1 + calcShipStats.cost.percentHull / 100 ) * calcShipStats.cost.hullOffset
      + calcShipStats.cost.perHullTon * (this.system.shipStats.mass.max || calcShipStats.weight.baseHull);
    if(this.system.isMassProduced) {
      calcShipStats.cost.total *= (1 - parseFloat(game.settings.get("twodsix", "massProductionDiscount")));
    }
    /*Push values to ship actor*/
    updateShipData(this);

    function estimateDisplacement(shipActor): number {
      let returnValue = 0;
      shipActor.itemTypes.component.filter((item: TwodsixItem) => (<Component>item.system).isBaseHull).forEach((item: TwodsixItem) => {
        returnValue += getWeight(item);
      });
      return Math.round(returnValue);
    }

    function calculateComponentCost(anComponent: Component, weightForItem: number, shipActor): void {
      if (!["fuel", "cargo", "vehicle"].includes(anComponent.subtype)) {
        if (anComponent.subtype === "hull") {
          switch (anComponent.pricingBasis) {
            case "perUnit":
              calcShipStats.cost.hullValue += Number(anComponent.price) * anComponent.quantity;
              break;
            case "perCompTon":
              calcShipStats.cost.hullValue += Number(anComponent.price) * weightForItem;
              break;
            case "pctHull":
              calcShipStats.cost.hullOffset *= (1 + Number(anComponent.price) / 100);
              break;
            case "pctHullPerUnit":
              calcShipStats.cost.hullOffset *= (1 + Number(anComponent.price) * anComponent.quantity / 100);
              break;
            case "perHullTon":
              calcShipStats.cost.hullValue += (shipActor.system.shipStats.mass.max || calcShipStats.weight.baseHull) * Number(anComponent.price);
              break;
            case "per100HullTon":
              calcShipStats.cost.hullValue += (shipActor.system.shipStats.mass.max || calcShipStats.weight.baseHull) * Number(anComponent.price)/100;
              break;
          }
        } else {
          switch (anComponent.pricingBasis) {
            case "perUnit":
              calcShipStats.cost.componentValue += Number(anComponent.price) * anComponent.quantity;
              break;
            case "perCompTon":
              calcShipStats.cost.componentValue += Number(anComponent.price) * weightForItem;
              break;
            case "pctHull":
              calcShipStats.cost.percentHull += Number(anComponent.price);
              break;
            case "pctHullPerUnit":
              calcShipStats.cost.percentHull += Number(anComponent.price) * anComponent.quantity;
              break;
            case "perHullTon":
              calcShipStats.cost.perHullTon += Number(anComponent.price);
              break;
            case "per100HullTon":
              calcShipStats.cost.perHullTon += Number(anComponent.price)/100;
              break;
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
          case 'drive':
            if (item.name?.toLowerCase().includes('j-drive') || item.name?.toLowerCase().includes('j drive')) {
              calcShipStats.power.jDrive += powerForItem;
            } else if (item.name?.toLowerCase().includes('m-drive') || item.name?.toLowerCase().includes('m drive')) {
              calcShipStats.power.mDrive += powerForItem;
            } else {
              calcShipStats.power.systems += powerForItem;
            }
            break;
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
      shipActor.system.shipStats.power.value = Math.round(calcShipStats.power.used);
      shipActor.system.shipStats.power.max = Math.round(calcShipStats.power.max);
      shipActor.system.reqPower.systems = Math.round(calcShipStats.power.systems);
      shipActor.system.reqPower["m-drive"] = Math.round(calcShipStats.power.mDrive);
      shipActor.system.reqPower["j-drive"] = Math.round(calcShipStats.power.jDrive);
      shipActor.system.reqPower.sensors = Math.round(calcShipStats.power.sensors);
      shipActor.system.reqPower.weapons = Math.round(calcShipStats.power.weapons);

      shipActor.system.shipStats.bandwidth.value = Math.round(calcShipStats.bandwidth.used);
      shipActor.system.shipStats.bandwidth.max = Math.round(calcShipStats.bandwidth.available);

      shipActor.system.weightStats.vehicles = Math.round(calcShipStats.weight.vehicles);
      shipActor.system.weightStats.cargo = Math.round(calcShipStats.weight.cargo);
      shipActor.system.weightStats.fuel = Math.round(calcShipStats.weight.fuel);
      shipActor.system.weightStats.systems = Math.round(calcShipStats.weight.systems);
      shipActor.system.weightStats.available = Math.round(calcShipStats.weight.available);

      shipActor.system.shipValue = calcShipStats.cost.total.toLocaleString(game.i18n.lang, {minimumFractionDigits: 1, maximumFractionDigits: 1});
      shipActor.system.mortgageCost = (calcShipStats.cost.total / game.settings.get("twodsix", "mortgagePayment") * 1000000).toLocaleString(game.i18n.lang, {maximumFractionDigits: 0});
      shipActor.system.maintenanceCost = (calcShipStats.cost.total * 0.001 * 1000000 / 12).toLocaleString(game.i18n.lang, {maximumFractionDigits: 0});
    }
  }
  /** @override */
  protected async _onCreate(data, options, userId) {
    if (userId === game.user.id) {
      if (this.name.includes(game.i18n.localize("DOCUMENT.CopyOf").split(" ").pop())) {
        return; // Don't do anything if a duplicate
      }

      const oldRenderSheet = options.renderSheet;
      options.renderSheet = false;
      await super._onCreate(data, options, userId);

      let isDefaultImg = false;
      const changeData = {};
      //console.log("onCreate Start", this);
      switch (this.type) {
        case "traveller":
        case "animal":
        case "robot":
          await this.createUntrainedSkill();
          Object.assign(changeData, {
            "system.movement.walk": this.system.movement.walk || game.settings.get("twodsix", "defaultMovement"),
            "system.movement.units": this.system.movement.units || game.settings.get("twodsix", "defaultMovementUnits")
          });
          if (this.img === foundry.documents.BaseActor.DEFAULT_ICON ) {
            isDefaultImg = true;
            if (game.settings.get("twodsix", "defaultTokenSettings") && this.type === "traveller") {
              Object.assign(changeData, {
                "token.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER,
                "token.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER,
                "token.sight": {
                  "enabled": true,
                  "visonMode": "basic",
                  "brightness": 1
                },
                "token.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
                "token.bar1": {
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

          if (game.settings.get("twodsix", "autoAddUnarmed")) {
            await this.createUnarmedSkill();
          }
          break;
        case "ship":
          if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
            isDefaultImg = true;
            Object.assign(changeData, {
              'img': 'systems/twodsix/assets/icons/default_ship.png'
            });
          }
          break;
        case "vehicle":
          if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
            isDefaultImg = true;
            Object.assign(changeData, {
              'img': 'systems/twodsix/assets/icons/default_vehicle.png'
            });
          }
          break;
        case "space-object":
          if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
            isDefaultImg = true;
            Object.assign(changeData, {
              'img': 'systems/twodsix/assets/icons/default_space-object.png'
            });
          }
          break;
      }
      await this.update(changeData);

      if (game.settings.get("twodsix", "useSystemDefaultTokenIcon") && isDefaultImg) {
        await this.update({
          'prototypeToken.texture.src': foundry.documents.BaseActor.DEFAULT_ICON //'icons/svg/mystery-man.svg'
        });
      }

      if ( oldRenderSheet ) {
        this.sheet?.render(true, {action: "create", data: data});
      }
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

  public async damageActor(damageValue: number, armorPiercingValue: number, damageType:string, showDamageDialog = true): Promise<void> {
    if (showDamageDialog) {
      const damageData: { damageValue: number, armorPiercingValue: number, damageType:string, damageId: string, tokenId?: string|null, actorId?: string|null } = {
        damageValue: damageValue,
        armorPiercingValue: armorPiercingValue,
        damageType: damageType,
        damageId: "damage-" + Math.random().toString(36).substring(2, 15)
      };

      if (this.isToken) {
        damageData.tokenId = this.token?.id;
      } else {
        damageData.actorId = this.id;
      }
      game.socket?.emit("system.twodsix", ["createDamageDialog", damageData]);
      Hooks.call('createDamageDialog', damageData);
    } else {
      const stats = new Stats(this, damageValue, armorPiercingValue, damageType);
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
    if (!tmpSettings.rollModifiers?.characteristic) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoCharacteristicForRoll"));
      return;
    }
    const settings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, undefined, undefined, this);
    if (!settings.shouldRoll) {
      return;
    }

    const diceRoll = new TwodsixDiceRoll(settings, this);
    if (showInChat) {
      await diceRoll.sendToChat(settings.difficulties);
    }
    return diceRoll;
  }

  public getUntrainedSkill(): TwodsixItem {
    //TODO May need to update this type <Traveller>
    return <TwodsixItem>this.items.get((<Traveller>this.system).untrainedSkill);
  }

  public async createUntrainedSkill(): Promise<void> {
    const untrainedSkill = await this.buildUntrainedSkill();
    if (untrainedSkill) {
      await this.update({"system.untrainedSkill": untrainedSkill['id']});
    }
  }

  public async buildUntrainedSkill(): Promise<Skills | void> {
    if ((<Traveller>this.system).untrainedSkill) {
      if (this.items.get(this.system.untrainedSkill)) {
        return;
      }
    }
    const existingSkill:Skills = this.itemTypes.skills?.find(sk => sk.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained"));
    if (existingSkill) {
      return existingSkill;
    }
    const data = {
      "name": game.i18n.localize("TWODSIX.Actor.Skills.Untrained"),
      "type": "skills",
      "system": {"characteristic": "NONE"},
      "flags": {'twodsix.untrainedSkill': true},
      "img": "./systems/twodsix/assets/icons/jack-of-all-trades.svg"
    };

    //const data1: Skills = <Skills><unknown>await ((<ActorSheet>this.sheet)._onDropItemCreate(data));
    const data1 = await (this.createEmbeddedDocuments("Item", [data]));
    return data1[0];
  }

  public async createUnarmedSkill(): Promise<Skills | void> {
    if (this.items?.getName(game.i18n.localize("TWODSIX.Items.Weapon.Unarmed"))) {
      return;
    }
    const data = {
      "name": game.i18n.localize("TWODSIX.Items.Weapon.Unarmed"),
      "type": "weapon",
      "img": "systems/twodsix/assets/icons/unarmed.svg",
      "system": {
        "armorPiercing": 0,
        "description": game.i18n.localize("TWODSIX.Items.Weapon.UnarmedDescription"),
        "type": "weapon",
        "damage": game.settings.get("twodsix", "unarmedDamage") || "1d6",
        "quantity": 1,
        "skill": this.getUntrainedSkill()?.id ?? "",
        "equipped": "equipped",
        "damageType": "bludgeoning",
        "range": "Melee"
      }
    };
    await (this.createEmbeddedDocuments("Item", [data]));
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
  public async modifyTokenAttribute(attribute, value, isDelta, isBar): Promise <any>{
    if ( attribute === "hits" && ["traveller", "animal", "robot"].includes(this.type)) {
      const hits = getProperty(this.system, attribute);
      const delta = isDelta ? (-1 * value) : (hits.value - value);
      if (delta > 0) {
        this.damageActor(delta, 9999, "NONE", false);
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
  private async _addDroppedSkills(skillData): Promise<boolean>{
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
    const addedSkill = (await (<ActorSheet>this.sheet)._onDropItemCreate(duplicate(skillData)))[0];
    //const addedSkill = (await this.createEmbeddedDocuments("Item", [duplicate(skillData)]))[0];
    if (addedSkill.system.value < 0 || !addedSkill.system.value) {
      if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
        const skills: Skills = <Skills>game.system.template.Item?.skills;
        addedSkill.update({"system.value": skills?.value});
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
      transferData.effects[0].disabled = (transferData.type !== "trait");
      transferData.effects[0].transfer =  game.settings.get('twodsix', "useItemActiveEffects");
    }

    //Link an actor skill with names defined by item.associatedSkillName
    transferData.system.skill = this.getBestSkill(transferData.system.associatedSkillName, false)?.id ?? this.getUntrainedSkill()?.id;

    //Remove any attached consumables
    transferData.system.consumables = [];
    transferData.system.useConsumableForAttack = '';

    //Create Item
    const addedItem = (await this.createEmbeddedDocuments("Item", [transferData]))[0];
    if (game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && this.type === 'traveller' && !["skills", "trait", "spell"].includes(addedItem.type)) {
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
        if (!["skills", "trait", "spell"].includes(itemData.type)) {
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
   * Method to add handle a dropped damage payload
   * @param {any} damagePayload The damage paylod being dropped (includes damage amount, AP value and damage type)
   * @param {boolean} showDamageDialog Whethter to show apply damage dialog
   * @returns {boolean}
   * @private
   */
  public async handleDamageData(damagePayload:any, showDamageDialog:boolean):boolean {
    if (["traveller", "animal", "robot"].includes(this.type)) {
      await this.damageActor(damagePayload.damageValue, damagePayload.armorPiercingValue, damagePayload.damageType, showDamageDialog);
      return true;
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantAutoDamage"));
    }
    return false;
  }

  /**
   * We override this with an empty implementation because we have our own custom way of applying
   * {@link ActiveEffect} and {@link Actor#prepareEmbeddedDocuments} calls this.
   * @override
   */
  override applyActiveEffects() {
    return;
  }

  /**
   * The TWODSIX override for applying active effects to traveller actors.  Depends on whenther this is before or after derived data calc.
   *  @param {boolean} isPost after derived values calculated
   */
  public async _updateActiveEffects(isPost:boolean): Promise<void> {
    //Fix for item-piles module
    if (game.modules.get("item-piles")?.active) {
      if (this.getFlag("item-piles", "data.enabled")) {
        return;
      }
    }
    // Re do overrides to include derived data (code from core FVTT)
    this.applyActiveEffectsCustom(isPost);
  }

  /**
   * Apply any transformations to the Actor data which are caused by ActiveEffects.
   *  @param {boolean} isPost after derived values calculated
   */
  applyActiveEffectsCustom(isPost: boolean) {
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
    derivedData.push("system.encumbrance.max", "system.encumbrance.value", "system.primaryArmor.value", "system.secondaryArmor.value", "system.radiationProtection.value");

    //Define derived data keys that can have active effects
    const overrides = {};
    const specialStatuses = new Map();
    if (!isPost) {
      this.statuses ??= new Set();
      // Identify which special statuses had been active
      for ( const statusId of Object.values(CONFIG.specialStatusEffects) ) {
        specialStatuses.set(statusId, this.statuses.has(statusId));
      }
      this.statuses.clear();
    }

    // Organize non-disabled effects by their application priority and add CUSTOM to derivedData
    const changes = [];
    for ( const effect of this.appliedEffects ) {
      changes.push(...effect.changes.map(change => {
        const c = foundry.utils.deepClone(change);
        c.effect = effect;
        c.priority = c.priority ?? (c.mode * 10);
        return c;
      }));
      for ( const statusId of effect.statuses ) {
        this.statuses.add(statusId);
      }
      //Add custom effects to the derivedData array
      const customChanges = effect.changes.filter( change => change.mode === CONST.ACTIVE_EFFECT_MODES.CUSTOM);
      for ( const change of customChanges) {
        if(!derivedData.includes(change.key)) {
          derivedData.push(change.key);
        }
      }
    }
    changes.sort((a, b) => a.priority - b.priority);

    // Apply all changes
    for ( const change of changes ) {
      if (isPost ? derivedData.includes(change.key) : !derivedData.includes(change.key)) {
        const newChanges = change.effect.apply(this, change);
        Object.assign(overrides, newChanges);
      }
    }

    // Expand the set of final overrides
    if (!isPost) {
      this.overrides = foundry.utils.expandObject(overrides);
    } else if (Object.keys(overrides).length > 0) {
      this.overrides = foundry.utils.mergeObject(this.overrides, foundry.utils.expandObject(overrides));
    }

    //Apply special statuses that changed to active tokens
    if (!isPost) {
      let tokens;
      for ( const [statusId, wasActive] of specialStatuses ) {
        const isActive = this.statuses.has(statusId);
        if ( isActive !== wasActive ) {
          tokens ??= this.getActiveTokens();
          for ( const token of tokens ) {
            token._onApplyStatusEffect(statusId, isActive);
          }
        }
      }
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
      const pct = Math.clamped(Math.abs(damageApplied) / this.system.hits.max, 0, 1);
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
      if ((skill.system.value >= 0 || !game.settings.get('twodsix', 'hideUntrainedSkills')) || (skill.getFlag("twodsix", "untrainedSkill") === game.settings.get('twodsix', 'hideUntrainedSkills'))) {
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
  if (!["skills", "spell", "trait"].includes(item.type)) {
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
        `<div><label for='amount'>` + game.i18n.localize("TWODSIX.Actor.Items.Amount") + `<input type="number" name="amount" id="amount" value="` +
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
        await actor.createUntrainedSkill();
      }
    }
  }
}
