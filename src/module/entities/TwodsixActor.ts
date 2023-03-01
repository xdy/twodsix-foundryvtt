// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
import { calcModFor, getKeyByValue } from "../utils/sheetUtils";
import { TWODSIX } from "../config";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import { TwodsixDiceRoll } from "../utils/TwodsixDiceRoll";
import { simplifySkillName } from "../utils/utils";
import { DocumentModificationOptions } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/abstract/document.mjs";
import TwodsixItem from "./TwodsixItem";
import { getDamageCharacteristics, Stats } from "../utils/actorDamage";
import {Characteristic, Component, Gear, Ship, Skills, Traveller, Weapon} from "../../types/template";
import { getCharShortName } from "../utils/utils";

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
        this._prepareTravellerData();
        break;
      case 'ship':
        if (game.settings.get("twodsix", "useShipAutoCalcs")) {
          this._prepareShipData();
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
  _prepareTravellerData(): void {
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
      (skill:TwodsixItem) => [simplifySkillName(skill.name ?? ""), (skill.system as Skills).value]
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
          return property in target ? target[property] : (this.getUntrainedSkill().system as Skills).value;
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
    }
    this._updateDerivedDataActiveEffects();
  }

  getArmorValues():object {
    const returnValue = {
      primaryArmor: 0,
      secondaryArmor: 0,
      radiationProtection: 0
    };
    const armorItems = this.itemTypes.armor;
    for (const armor of armorItems) {
      if (armor.system.equipped === "equipped") {
        returnValue.primaryArmor += armor.system.armor;
        returnValue.secondaryArmor += armor.system.secondaryArmor.value;
        returnValue.radiationProtection += armor.system.radiationProtection.value;
      }
    }
    return returnValue;
  }

  getMaxEncumbrance():number {
    let maxEncumbrance = 0;
    const encumbFormula = game.settings.get('twodsix', 'maxEncumbrance');
    if (Roll.validate(encumbFormula)) {
      maxEncumbrance = new Roll(encumbFormula, this.system).evaluate({async: false}).total;
    }
    return maxEncumbrance;
  }

  getActorEncumbrance():number {
    let encumbrance = 0;
    const actorItems = this.items.filter( i => !["skills", "junk", "storage", "trait", "ship_position"].includes(i.type));
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
      const powerForItem = getPower(anComponent);
      const weightForItem = getWeight(anComponent, this);

      /* Allocate Power */
      allocatePower(anComponent, powerForItem, item);

      /* Allocate Weight*/
      allocateWeight(anComponent, weightForItem);

      /*Calculate Cost*/
      calculateComponentCost(anComponent, weightForItem, this);
    });

    /*Calculate implicit values*/
    calcShipStats.power.used = calcShipStats.power.jDrive + calcShipStats.power.mDrive + calcShipStats.power.sensors +
      calcShipStats.power.weapons + calcShipStats.power.systems;

    calcShipStats.weight.available = this.system.shipStats.mass.max - (calcShipStats.weight.vehicles ?? 0) - (calcShipStats.weight.cargo ?? 0)
      - (calcShipStats.weight.fuel ?? 0) - (calcShipStats.weight.systems ?? 0);

    calcShipStats.cost.total = calcShipStats.cost.componentValue + calcShipStats.cost.hullValue * ( 1 + calcShipStats.cost.percentHull / 100 ) * calcShipStats.cost.hullOffset
      + calcShipStats.cost.perHullTon * (this.system.shipStats.mass.max || calcShipStats.weight.baseHull);
    if(this.system.isMassProduced) {
      calcShipStats.cost.total *= (1 - game.settings.get("twodsix", "massProductionDiscount"));
    }
    /*Push values to ship actor*/
    updateShipData(this);

    function estimateDisplacement(shipActor): number {
      let returnValue = 0;
      shipActor.itemTypes.component.filter((item: TwodsixItem) => (<Component>item.system).isBaseHull).forEach((item: TwodsixItem) => {
        const anComponent = <Component>item.system;
        returnValue += getWeight(anComponent, shipActor);
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

  protected override _onUpdateEmbeddedDocuments(embeddedName:string, documents:foundry.abstract.Document<any, any>[], result:Record<string, unknown>[], options: DocumentModificationOptions, userId: string): void {
    super._onUpdateEmbeddedDocuments(embeddedName, documents, result, options, userId);
    if (embeddedName === "ActiveEffect" && !result[0].flags && !options.dontSync && game.settings.get('twodsix', 'useItemActiveEffects')) {
      documents.forEach(async (element:ActiveEffect, i) => {
        const activeEffectId = element.getFlag("twodsix", "sourceId");
        if (activeEffectId) {
          const match = element.origin?.match(/Item\.(.+)/);
          if (match) {
            const item = (<TwodsixActor>element.parent)?.items.get(match[1]);
            delete result[i]._id;
            const newEffects = item?.effects.map(effect => {
              if (effect.id === activeEffectId) {
                return foundry.utils.mergeObject(effect.toObject(), result[i]);
              } else {
                return effect.toObject();
              }
            });
            // @ts-ignore
            await item?.update({"effects": newEffects}, {recursive: true}).then();
          }
        }
      });
    }
    //this.render();
  }

  /*protected override _onCreateEmbeddedDocuments(embeddedName:string, documents:foundry.abstract.Document<any, any>[], result:Record<string, unknown>[], options: DocumentModificationOptions, userId: string): void {
    super._onCreateEmbeddedDocuments(embeddedName, documents, result, options, userId);
    //Try to get rid of duplicate effects - This shouldn't be needed
    if(embeddedName === "Item") {
      while (documents[0].effects.size > 1) {
        documents[0].delete(documents[0].effects.contents[1].id);
      }
    }
    console.log(embeddedName, documents, result, options, userId );
  }*/
  /*protected async _onDeleteEmbeddedDocuments(embeddedName:string, documents:foundry.abstract.Document<any, any>[], result, options, userId: string): void {
    if (game.settings.get('twodsix', 'useItemActiveEffects') && embeddedName === "Item") {
      const ownedItem = <TwodsixItem>documents[0];
      const selectedActor = <TwodsixActor>ownedItem.actor;
      const effectToDelete = <ActiveEffect>selectedActor?.effects.find(effect => effect.getFlag("twodsix", "sourceId") === ownedItem.effects.contents[0]?.id);
      if (effectToDelete?.id) {
        await selectedActor?.deleteEmbeddedDocuments('ActiveEffect', [effectToDelete?.id]);
      }
    }
    super._onDeleteEmbeddedDocuments(embeddedName, documents, result, options, userId);
  }*/

  protected async _onCreate() {
    switch (this.type) {
      case "traveller":
        if (game.settings.get("twodsix", "defaultTokenSettings")) {
          this.update( {
            "token.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER,
            "token.displayBars": CONST.TOKEN_DISPLAY_MODES.ALWAYS,
            "token.vision": true,
            "token.brightSight": 1000,
            "token.dimSight": 0,
            "token.actorLink": true,
            "token.disposition": CONST.TOKEN_DISPOSITIONS.FRIENDLY,
            "token.bar1": {
              attribute: "hits"
            }
          });
        }
        this.update({
          "system.movement.walk": this.system.movement.walk ?? game.settings.get("twodsix", "defaultMovement"),
          "system.movement.units": this.system.movement.units ?? game.settings.get("twodsix", "defaultMovementUnits")
        });
        await this.createUntrainedSkill();
        if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_actor.png'
          });
        }

        if (game.settings.get("twodsix", "autoAddUnarmed")) {
          await this.createUnarmedSkill();
        }
        this.deleteCustomAEs();
        this.fixItemAEs();
        break;
      case "animal":
        await this.createUntrainedSkill();
        if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/alien-bug.svg'
          });
        }

        if (game.settings.get("twodsix", "autoAddUnarmed")) {
          await this.createUnarmedSkill();
        }
        this.deleteCustomAEs();
        this.fixItemAEs();
        break;
      case "ship":
        if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_ship.png'
          });
        }
        break;
      case "vehicle":
        if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_vehicle.png'
          });
        }
        break;
      case "space-object":
        if (this.img === foundry.documents.BaseActor.DEFAULT_ICON) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_space-object.png'
          });
        }
        break;
    }
    if (game.settings.get("twodsix", "useSystemDefaultTokenIcon")) {
      await this.update({
        'token.img': foundry.documents.BaseActor.DEFAULT_ICON //'icons/svg/mystery-man.svg'
      });
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

  public async damageActor(damage: number, armorPiercingValue: number, showDamageDialog = true): Promise<void> {
    if (showDamageDialog) {
      const damageData: { damage: number, armorPiercingValue: number, damageId: string, tokenId?: string|null, actorId?: string|null } = {
        damage: damage,
        armorPiercingValue: armorPiercingValue,
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
      const stats = new Stats(this, damage, armorPiercingValue);
      await stats.applyDamage();
    }
  }

  public async healActor(healing: number): Promise<void> {
    if (this.type === "traveller" || this.type === "animal") {
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
    } else if (this.type === 'ship') {
      return 0;
    } else {
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      //return calcModFor((<Traveller>this.system).characteristics[keyByValue].current);
      return (<Traveller>this.system).characteristics[keyByValue].mod;
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
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
      return;
    }
    const data = {
      "name": game.i18n.localize("TWODSIX.Actor.Skills.Untrained"),
      "type": "skills",
      "system": {"characteristic": "NONE"},
      "flags": {'twodsix.untrainedSkill': true},
      "img": "./systems/twodsix/assets/icons/jack-of-all-trades.svg"
    };

    const data1: Skills = <Skills><unknown>await ((<ActorSheet>this.sheet)._onDropItemCreate(data));
    //const data1: Skills = <Skills><unknown>await (this.createEmbeddedDocuments("Item", [data]));
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
        "skill": this.getUntrainedSkill().id || "",
        "equipped": "equipped"
      },
    };
    await (this.createEmbeddedDocuments("Item", [data]));
  }

  private static _applyToAllActorItems(func: (actor: TwodsixActor, item: TwodsixItem) => void): void {
    game.actors?.forEach(actor => {
      actor.items.forEach((item: TwodsixItem) => {
        func(<TwodsixActor><unknown>actor, item);
      });
    });
  }

  public static resetUntrainedSkill(): void {
    //TODO Some risk of race condition here, should return list of updates to do, then do the update outside the loop
    TwodsixActor._applyToAllActorItems((actor: TwodsixActor, item: TwodsixItem) => {
      if (item.type === "skills") {
        return;
      }
      const skill = actor.items.get((<Gear>item.system).skill);
      if (skill && skill.getFlag("twodsix", "untrainedSkill")) {
        item.update({"system.skill": ""}, {}); //TODO Should have await?
      }
    });
  }

  public static setUntrainedSkillForWeapons(): void {
    //TODO Some risk of race condition here, should return list of updates to do, then do the update outside the loop
    TwodsixActor._applyToAllActorItems((actor: TwodsixActor, item: TwodsixItem) => {
      if (item.type === "weapon" && !(<Weapon>item.system).skill && (actor.type === "traveller" || actor.type === 'animal')) {
        item.update({"system.skill": actor.getUntrainedSkill().id}, {}); //TODO Should have await?
      }
    });
  }

  public async modifyTokenAttribute(attribute, value, isDelta, isBar) {
    if ( attribute === "hits" && (this.type === "traveller" || this.type === 'animal')) {
      const hits = getProperty(this.system, attribute);
      const delta = isDelta ? (-1 * value) : (hits.value - value);
      if (delta > 0) {
        this.damageActor(delta, 9999, false);
        return;
      } else if (delta < 0) {
        this.healActor(-delta);
        return;
      }
    }
    return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
  }

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

  private async _addDroppedEquipment(itemData): Promise<boolean>{
    // Handle item sorting within the same Actor
    const sameActor = this.items.get(itemData._id);
    if (sameActor) {
      //return this.sheet._onSortItem(event, sameActor);
      return false;
    }

    const transferData = itemData.toJSON();
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
    // Prepare effects
    transferData.system.equipped = "ship";
    transferData._id = "";
    if (game.settings.get('twodsix', "useItemActiveEffects")  && transferData.effects.length > 0) {
      //clear extra item effects - should be fixed
      while (transferData.effects.length > 1) {
        transferData.effects.pop();
      }
      //use Object.assign() ?
      transferData.effects[0].transfer = false;
      transferData.effects[0]._id = randomID(); //dont need random, just blank?
      transferData.effects[0].origin = "";
      transferData.effects[0].disabled = true;
    }

    const addedItem = (await this.createEmbeddedDocuments("Item", [transferData]))[0];
    await addedItem.update({"system.quantity": numberToMove});
    if (game.settings.get('twodsix', "useItemActiveEffects") && this.type !== "ship" && this.type !== "vehicle" && addedItem.effects.size > 0) {
      const newEffect = addedItem.effects.contents[0].toObject();
      //newEffect.disabled = true;
      newEffect._id = "";
      newEffect.origin = addedItem.uuid;
      newEffect.label = addedItem.name;
      const newActorEffect = (await this.createEmbeddedDocuments("ActiveEffect", [newEffect]))[0];
      await newActorEffect?.setFlag('twodsix', 'sourceId', addedItem.effects.contents[0].id);
    }
    await addedItem.update({"system.equipped": "backpack"});

    //Link an actor skill with name defined by item.associatedSkillName
    let skillId = "";
    if (addedItem.system.associatedSkillName !== "") {
      skillId = this.items.getName(addedItem.system.associatedSkillName)?.id ?? "";
      //Try to link Untrained if no match
      if (skillId === "") {
        skillId = this.getUntrainedSkill()?.id ?? "";
      }
      await addedItem.update({"system.skill": skillId});
    }

    //Remove any attached consumables
    if (addedItem.system.consumables !== undefined) {
      if (addedItem.system.consumables.length > 0) {
        await addedItem.update({"system.consumables": []});
      }
    }

    console.log(`Twodsix | Added Item ${itemData.name} to character`);
    return (!!addedItem);
  }

  public async handleDroppedItem(itemData): Promise<boolean> {
    //handle drop from compendium
    //if (itemData?.pack) {
    //  const pack = game.packs.get(itemData.pack);
    //  itemData = await pack?.getDocument(itemData._id);
    //}

    if(!itemData) {
      return false;
    }

    switch (this.type) {
      case 'traveller':
        if (itemData.type === 'skills') {
          return this._addDroppedSkills(itemData);
        } else if (!["component", "junk", "storage", "ship_position"].includes(itemData.type)) {
          return this._addDroppedEquipment(itemData);
        }
        break;
      case 'animal':
        if (itemData.type === 'skills') {
          return this._addDroppedSkills(itemData);
        } else if (["weapon", "trait"].includes(itemData.type)) {
          return this._addDroppedEquipment(itemData);
        }
        break;
      case 'ship':
        if (!["augment", "skills", "trait", "spell"].includes(itemData.type)) {
          return this._addDroppedEquipment(itemData);
        }
        break;
      case 'vehicle':
        if (itemData.type === "component" && itemData.system.subtype === "armament") {
          return this._addDroppedEquipment(itemData);
        }
        break;
    }
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantDragOntoActor"));
    return false;
  }

  public async handleDamageData(damagePayload:any, showDamageDialog:boolean) {
    if (this.type === 'traveller' || this.type === 'animal') {
      await this.damageActor(damagePayload.damage, damagePayload.armorPiercingValue, showDamageDialog);
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantAutoDamage"));
    }
    return false;
  }

  public async _updateDerivedDataActiveEffects(): Promise<void> {
    const derivedData = [];
    //Add characteristics mods
    for (const char of Object.keys(this.system.characteristics)) {
      derivedData.push(`system.characteristics.${char}.mod`);
    }
    //Add skills
    for (const shortName of Object.keys(this.system.skills)) {
      derivedData.push(`system.skills.${shortName}`);
    }
    //Add other values
    derivedData.push("system.encumbrance.max", "system.encumbrance.value", "system.primaryArmor.value", "system.secondaryArmor.value", "system.radiationProtection.value");
    //console.log(derivedData);

    const overrides = {};

    // Apply all changes
    for (const effect of this.effects.filter( e => !e.disabled)) {
      for (const change of effect.changes) {
        if (derivedData.includes(change.key)) {
          const changes = await (<ActiveEffect>effect).apply(this, change);
          Object.assign(overrides, changes);
        }
      }
    }

    // Expand the set of final overrides
    this.overrides = await foundry.utils.expandObject({
      ...foundry.utils.flattenObject(this.overrides),
      ...overrides,
    });
    //console.log(this.overrides);
  }

  public deleteCustomAEs():void {
    const systemAEs = this.effects.filter(eff => !!eff.getFlag("twodsix", "sourceId"));
    const idsToDelete = [];
    for (const eff of systemAEs) {
      idsToDelete.push(eff.id);
    }
    this.deleteEmbeddedDocuments('ActiveEffect', idsToDelete);
  }

  public async fixItemAEs(): void {
    if (game.settings.get('twodsix', "useItemActiveEffects")) {
      const newEffects = [];
      const itemsWithEffects = this.items.filter(it => it.effects.size > 0);
      for (const item of itemsWithEffects) {
        const newEffect = item.effects.contents[0].toObject();
        Object.assign(newEffect, {
          disabled: item.system.equipped !== "equipped",
          _id: "",
          origin: item.uuid,
          //label: item.name,
          flags: {twodsix: {sourceId: item.effects.contents[0].id}}
        });
        newEffects.push(newEffect);
      }
      await this.createEmbeddedDocuments("ActiveEffect", newEffects);
    }
  }

  /**
   * Display changes to health as scrolling combat text.
   * Adapt the font size relative to the Actor's HP total to emphasize more significant blows.
   * @param {number} damageApplied     The change in hit points that was applied
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
  public async getSkilNameList(): any {
    const returnObject = {};
    for (const skill of this.itemTypes.skills) {
      if ((skill.system.value >= 0 || !game.settings.get('twodsix', 'hideUntrainedSkills')) || (skill.getFlag("twodsix", "untrainedSkill") === game.settings.get('twodsix', 'hideUntrainedSkills'))) {
        Object.assign(returnObject, {[skill.uuid]: `${skill.name} (${skill.system.value})`});
      }
    }
    return returnObject;
  }

}

export function getPower(item: Component): number{
  if ((item.status === "operational") || (item.status === "damaged")) {
    let q = item.quantity || 1;
    if (item.subtype === "armament"  && item.availableQuantity) {
      q = parseInt(item.availableQuantity);
    }
    const p = item.powerDraw || 0;
    return (q * p);
  } else {
    return 0;
  }
}

export function getWeight(item: Component, actorData): number{
  const q = item.quantity ?? 1;
  /*if (["armament", "fuel"].includes(item.subtype) && item.availableQuantity) {
    q = parseInt(item.availableQuantity);
  }  make true displacement and not mass*/
  let w = 0;
  if (item.weightIsPct) {
    w = (item.weight ?? 0) / 100 * actorData.system.shipStats.mass.max;
  } else {
    w = item.weight ?? 0;
  }
  return (w * q);
}

async function deleteIdFromShipPositions(actorId: string) {
  const allShips = (game.actors?.contents.filter(actor => actor.type === "ship") ?? []) as TwodsixActor[];

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor && !token.actorLink && token.actor.type === "ship") {  //token.data.actorLink becomes what?????
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

function getEquipmentWeight(item:TwodsixItem):number {
  if (["weapon", "armor", "equipment", "tool", "junk", "consumable"].includes(item.type)) {
    if (item.system.equipped !== "ship") {
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

async function getMoveNumber(itemData:TwodsixItem): Promise <number> {
  const returnNumber:number = await new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("TWODSIX.Actor.Items.QuantityToTransfer"),
      content:
        `<div style="display: flex; align-items: center; gap: 2ch; justify-content: center;"><img src="` + itemData.img + `" data-tooltip = "` + itemData.name +`" width="50" height="50"> ` + itemData.name + `</div>`+
        `<div><label>` + game.i18n.localize("TWODSIX.Actor.Items.Amount") + `</label><input type="number" name="amount" id="amount" value="` +
        itemData.system.quantity + `" max="` + itemData.system.quantity + `" min = "0"></input></div>`,
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

/*function isSameActor(actor: Actor, itemData: any): boolean {
  return (itemData.actor?.id === actor.id) || (actor.isToken && (itemData.actor?.id === actor.token?.id));
}*/

