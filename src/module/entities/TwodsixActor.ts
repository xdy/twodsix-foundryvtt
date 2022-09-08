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
        this._prepareTravellerData();
        break;
      case 'ship':
        if (game.settings.get("twodsix", "useShipAutoCalcs")) {
          this._prepareShipData();
        }
        this._checkCrewTitles();
        break;
      case 'vehicle':
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
    const actorSkills = this.items.filter(
      (item:TwodsixItem) => item.type === "skills"
    ).map(
      (skill:TwodsixItem) => [TwodsixItem.simplifySkillName(skill.name ?? ""), (skill.system as Skills).value]
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

    this.items.filter((item: TwodsixItem) => item.type === "component").forEach((item: TwodsixItem) => {
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
      shipActor.items.filter((item: TwodsixItem) => item.type === "component" && (<Component>item.system).isBaseHull).forEach((item: TwodsixItem) => {
        const anComponent = <Component>item.system;
        returnValue += getWeight(anComponent, shipActor);
      });
      return Math.round(returnValue);
    }

    function calculateComponentCost(anComponent: Component, weightForItem: number, shipActor): void {
      if (anComponent.subtype !== "fuel" && anComponent.subtype !== "cargo") {
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

      shipActor.system.shipValue = Math.round(calcShipStats.cost.total * 10) / 10;
      shipActor.system.mortgageCost = Math.round(calcShipStats.cost.total / game.settings.get("twodsix", "mortgagePayment") * 1000000);
      shipActor.system.maintenanceCost = Math.round(calcShipStats.cost.total * 0.001 * 1000000 / 12);
    }
  }

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
            },
            "system.movement.walk": game.settings.get("twodsix", "defaultMovement"),
            "system.movement.units": game.settings.get("twodsix", "defaultMovementUnits")
          });
        }
        await this.createUntrainedSkill();
        // may need to change CONST.DEFAULT_TOKEN to foundry.documents.BaseActor.DEFAULT_ICON ***
        if (this.img === CONST.DEFAULT_TOKEN) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_actor.png'
          });
        }

        if (game.settings.get("twodsix", "autoAddUnarmed")) {
          await this.createUnarmedSkill();
        }
        break;
      case "ship":
        if (this.img === CONST.DEFAULT_TOKEN) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_ship.png'
          });
        }
        break;
      case "vehicle":
        if (this.img === CONST.DEFAULT_TOKEN) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_vehicle.png'
          });
        }
        break;
    }
    if (game.settings.get("twodsix", "useSystemDefaultTokenIcon")) {
      await this.update({
        'token.img': CONST.DEFAULT_TOKEN //'icons/svg/mystery-man.svg'
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
      stats.applyDamage(); //TODO Should have await?
    }
  }

  public async healActor(healing: number): Promise<void> {
    if (this.type === "traveller") {
      let damageCharacteristics: string[] = [];
      if (game.settings.get('twodsix', 'reverseHealingOrder')) {
        damageCharacteristics = getDamageCharacteristics().reverse();
      } else {
        damageCharacteristics = getDamageCharacteristics();
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
      let override = 0;
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      if (this.overrides?.system?.characteristics) {
        if (keyByValue in this.overrides.system.characteristics) {
          override = this.overrides.system.characteristics[keyByValue].mod ?? 0;
        }
      }
      return calcModFor((<Traveller>this.system).characteristics[keyByValue].current) + override;
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async characteristicRoll(tmpSettings: any, showThrowDialog: boolean, showInChat = true): Promise<TwodsixDiceRoll | void> {
    if (!tmpSettings.characteristic) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoCharacteristicForRoll"));
      return;
    }
    const settings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings);
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
      "flags": {'twodsix.untrainedSkill': true}
    };


    const data1: Skills = <Skills><unknown>await (this.createEmbeddedDocuments("Item", [data]));
    return data1[0];
  }

  public async createUnarmedSkill(): Promise<Skills | void> {
    if (this.items?.getName(game.i18n.localize("TWODSIX.Item.Weapon.Unarmed"))) {
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
      if (item.type === "weapon" && !(<Weapon>item.system).skill && actor.type === "traveller") {
        item.update({"system.skill": actor.getUntrainedSkill().id}, {}); //TODO Should have await?
      }
    });
  }

  public async modifyTokenAttribute(attribute, value, isDelta, isBar) {
    if ( attribute === "hits" && this.type === "traveller") {
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
  let q = item.quantity ?? 1;
  if (["armament", "fuel"].includes(item.subtype) && item.availableQuantity) {
    q = parseInt(item.availableQuantity);
  }
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

