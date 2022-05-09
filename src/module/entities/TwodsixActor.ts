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
    const actorData = <TwodsixActor><unknown>this.data;
    // const data = actorData.data;
    // const flags = actorData.flags;

    // Make separate methods for each Actor type (traveller, npc, etc.) to keep
    // things organized.
    switch (actorData.type) {
      case 'traveller':
        this._prepareTravellerData(actorData);
        break;
      case 'ship':
        if (game.settings.get("twodsix", "useShipAutoCalcs")) {
          this._prepareShipData(actorData);
        }
        this._checkCrewTitles(actorData);
        break;
      default:
        console.log(game.i18n.localize("Twodsix.Actor.UnknownActorType") + " " + actorData.type);
    }

  }
  /**
  * Check Crew Titles for missing and set to localized default
  */
  _checkCrewTitles(actorData): void {
    for (const pos in actorData.data.crewLabel) {
      if (actorData.data.crewLabel[pos] === "") {
        actorData.data.crewLabel[pos] = game.i18n.localize("TWODSIX.Ship.Crew." + pos.toUpperCase());
      }
    }
  }

  /**
   * Prepare Character type specific data
   */
  _prepareTravellerData(actorData): void {
    const {data} = actorData;

    for (const cha of Object.keys(data.characteristics)) {
      const characteristic: Characteristic = data.characteristics[cha];
      characteristic.current = characteristic.value - characteristic.damage;
      characteristic.mod = calcModFor(characteristic.current);
      if (characteristic.displayShortLabel === "") {
        characteristic.displayShortLabel = getCharShortName(characteristic.shortLabel);
      }
    }
    const actorSkills = actorData.items.filter(
      (item:TwodsixItem) => item.type === "skills"
    ).map(
      (skill:TwodsixItem) => [TwodsixItem.simplifySkillName(skill.name ?? ""), (skill.data.data as Skills).value]
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
          return property in target ? target[property] : (this.getUntrainedSkill().data.data as Skills).value;
        }
      }
    };

    data.skills = new Proxy(Object.fromEntries(actorSkills), handler);
  }

  _prepareShipData(actorData): void {
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
    if (!actorData.data.shipStats.mass.max || actorData.data.shipStats.mass.max <= 0) {
      const calcDisplacement = _estimateDisplacement();
      if (calcDisplacement && calcDisplacement > 0) {
        actorData.update({"data.shipStats.mass.max": calcDisplacement});
        /*actorData.data.shipStats.mass.max = calcDisplacement;*/
      }
    }

    actorData.items.filter((item: TwodsixItem) => item.type === "component").forEach((item: TwodsixItem) => {
      const anComponent = <Component>item.data.data;
      const powerForItem = getPower(anComponent);
      const weightForItem = getWeight(anComponent, actorData);

      /* Allocate Power */
      _allocatePower(anComponent, powerForItem, item);

      /* Allocate Weight*/
      _allocateWeight(anComponent, weightForItem);

      /*Calculate Cost*/
      _calculateComponentCost(anComponent, weightForItem);
    });

    /*Calculate implicit values*/
    calcShipStats.power.used = calcShipStats.power.jDrive + calcShipStats.power.mDrive + calcShipStats.power.sensors +
      calcShipStats.power.weapons + calcShipStats.power.systems;

    calcShipStats.weight.available = actorData.data.shipStats.mass.max - (calcShipStats.weight.vehicles ?? 0) - (calcShipStats.weight.cargo ?? 0)
      - (calcShipStats.weight.fuel ?? 0) - (calcShipStats.weight.systems ?? 0);

    calcShipStats.cost.total = calcShipStats.cost.componentValue + calcShipStats.cost.hullValue * ( 1 + calcShipStats.cost.percentHull / 100 ) * calcShipStats.cost.hullOffset
      + calcShipStats.cost.perHullTon * (actorData.data.shipStats.mass.max || calcShipStats.weight.baseHull);
    if(actorData.data.isMassProduced) {
      calcShipStats.cost.total *= (1 - game.settings.get("twodsix", "massProductionDiscount"));
    }
    /*Push values to ship actor*/
    _updateShipData();

    function _estimateDisplacement(): number {
      let returnValue = 0;
      actorData.items.filter((item: TwodsixItem) => item.type === "component" && (<Component>item.data.data).isBaseHull).forEach((item: TwodsixItem) => {
        const anComponent = <Component>item.data.data;
        returnValue += getWeight(anComponent, actorData);
      });
      return Math.round(returnValue);
    }

    function _calculateComponentCost(anComponent: Component, weightForItem: number): void {
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
              calcShipStats.cost.hullValue += (actorData.data.shipStats.mass.max || calcShipStats.weight.baseHull) * Number(anComponent.price);
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

    function _allocateWeight(anComponent: Component, weightForItem: number): void {
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

    function _allocatePower(anComponent: Component, powerForItem: number, item: TwodsixItem): void {
      if (anComponent.generatesPower) {
        calcShipStats.power.max += powerForItem;
      } else {
        switch (anComponent.subtype) {
          case 'drive':
            if (item.data.name.toLowerCase().includes('j-drive') || item.data.name.toLowerCase().includes('j drive')) {
              calcShipStats.power.jDrive += powerForItem;
            } else if (item.data.name.toLowerCase().includes('m-drive') || item.data.name.toLowerCase().includes('m drive')) {
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

    function _updateShipData(): void {
      actorData.data.shipStats.power.value = Math.round(calcShipStats.power.used);
      actorData.data.shipStats.power.max = Math.round(calcShipStats.power.max);
      actorData.data.reqPower.systems = Math.round(calcShipStats.power.systems);
      actorData.data.reqPower["m-drive"] = Math.round(calcShipStats.power.mDrive);
      actorData.data.reqPower["j-drive"] = Math.round(calcShipStats.power.jDrive);
      actorData.data.reqPower.sensors = Math.round(calcShipStats.power.sensors);
      actorData.data.reqPower.weapons = Math.round(calcShipStats.power.weapons);

      actorData.data.weightStats.vehicles = Math.round(calcShipStats.weight.vehicles);
      actorData.data.weightStats.cargo = Math.round(calcShipStats.weight.cargo);
      actorData.data.weightStats.fuel = Math.round(calcShipStats.weight.fuel);
      actorData.data.weightStats.systems = Math.round(calcShipStats.weight.systems);
      actorData.data.weightStats.available = Math.round(calcShipStats.weight.available);

      actorData.data.shipValue = Math.round(calcShipStats.cost.total * 10) / 10;
      actorData.data.mortgageCost = Math.round(calcShipStats.cost.total / game.settings.get("twodsix", "mortgagePayment") * 1000000);
      actorData.data.maintenanceCost = Math.round(calcShipStats.cost.total * 0.001 * 1000000 / 12);
    }
  }

  protected async _onCreate() {
    switch (this.data.type) {
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
            "data.movement.walk": game.settings.get("twodsix", "defaultMovement"),
            "data.movement.units": game.settings.get("twodsix", "defaultMovementUnits")
          });
        }
        await this.createUntrainedSkill();
        if (this.data.img === CONST.DEFAULT_TOKEN) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_actor.png'
          });
        }
        break;
      case "ship":
        if (this.data.img === CONST.DEFAULT_TOKEN) {
          await this.update({
            'img': 'systems/twodsix/assets/icons/default_ship.png'
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
    if (this.data.type === "traveller") {
      let damageCharacteristics: string[] = [];
      if (game.settings.get('twodsix', 'reverseHealingOrder')) {
        damageCharacteristics = getDamageCharacteristics().reverse();
      } else {
        damageCharacteristics = getDamageCharacteristics();
      }

      for (const characteristic of damageCharacteristics) {
        const cur_damage = this.data.data.characteristics[characteristic].damage;

        if (cur_damage > 0) {
          const new_damage = Math.max(0, cur_damage - healing);
          const char_id = 'data.characteristics.' + characteristic + '.damage';

          await this.update({
            [char_id]: new_damage
          });

          healing -= cur_damage - new_damage;
        }

        if (healing < 1) {
          break;
        }
      }
    }
  }

  public getCharacteristicModifier(characteristic: string): number {
    if (characteristic === 'NONE') {
      return 0;
    } else if (this.data.type === 'ship') {
      return 0;
    } else {
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      return calcModFor((<Traveller>this.data.data).characteristics[keyByValue].current);
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
      await diceRoll.sendToChat();
    }
    return diceRoll;
  }

  public getUntrainedSkill(): TwodsixItem {
    return <TwodsixItem>this.items.get((<Traveller>this.data.data).untrainedSkill);
  }

  public async createUntrainedSkill(): Promise<void> {
    const untrainedSkill = await this.buildUntrainedSkill();
    if (untrainedSkill) {
      await this.update({"data.untrainedSkill": untrainedSkill['id']});
    }
  }

  public async buildUntrainedSkill(): Promise<Skills | void> {
    if ((<Traveller>this.data.data).untrainedSkill) {
      return;
    }
    const data = {
      "name": game.i18n.localize("TWODSIX.Actor.Skills.Untrained"),
      "type": "skills",
      "data": {"characteristic": "NONE"},
      "flags": {'twodsix.untrainedSkill': true}
    };


    const data1: Skills = <Skills><unknown>await (this.createEmbeddedDocuments("Item", [data]));
    return data1[0];
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
      const skill = actor.items.get((<Gear>item.data.data).skill);
      if (skill && skill.getFlag("twodsix", "untrainedSkill")) {
        item.update({"data.skill": ""}, {}); //TODO Should have await?
      }
    });
  }

  public static setUntrainedSkillForWeapons(): void {
    //TODO Some risk of race condition here, should return list of updates to do, then do the update outside the loop
    TwodsixActor._applyToAllActorItems((actor: TwodsixActor, item: TwodsixItem) => {
      if (item.type === "weapon" && !(<Weapon>item.data.data).skill && actor.type === "traveller") {
        item.update({"data.skill": actor.getUntrainedSkill().id}, {}); //TODO Should have await?
      }
    });
  }

  public async modifyTokenAttribute(attribute, value, isDelta, isBar) {
    if ( attribute === "hits" && this.data.type === "traveller") {
      const hits = getProperty(this.data.data, attribute);
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
    w = (item.weight ?? 0) / 100 * actorData.data.shipStats.mass.max;
  } else {
    w = item.weight ?? 0;
  }
  return (w * q);
}

async function deleteIdFromShipPositions(actorId: string) {
  const allShips = (game.actors?.contents.filter(actor => actor.type === "ship") ?? []) as TwodsixActor[];

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor && !token.data.actorLink && token.actor.type === "ship") {
        allShips.push(token.actor as TwodsixActor);
      }
    }
  }

  for (const ship of allShips) {
    if ((<Ship>ship.data.data).shipPositionActorIds[actorId]) {
      await ship.update({[`data.shipPositionActorIds.-=${actorId}`]: null });
    }
  }
}

