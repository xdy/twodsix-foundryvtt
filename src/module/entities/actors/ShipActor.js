import { COMPONENT_SUBTYPES, TWODSIX } from '../../config';
import { updateShipFinances } from '../../hooks/updateFinances';
import { generateShipDamageReport } from '../../utils/shipDamage';
import { TwodsixShipActions } from '../../utils/TwodsixShipActions';
import { roundToMaxDecimals } from '../../utils/utils';
import { getPower, getWeight } from './actor-base.js';
import { TwodsixVehicleBaseActor } from './TwodsixVehicleBaseActor.js';

/** @typedef {import("../TwodsixItem").default} TwodsixItem */

/**
 * Actor document class for ship-type actors.
 * @extends {TwodsixVehicleBaseActor}
 */
export class ShipActor extends TwodsixVehicleBaseActor {

  /** @override */
  async _preCreate(data, options, userId) {
    const allowed = await super._preCreate(data, options, userId);
    if (allowed === false) {
      return false;
    }

    const updates = {};

    // Set default display preferences
    const currentWeightDisplay = game.settings.get('twodsix', 'showWeightUsage');
    if (this.system.showWeightUsage !== currentWeightDisplay) {
      Object.assign(updates, {'system.showWeightUsage': currentWeightDisplay});
    }

    const currentMortgageTerm = game.settings.get('twodsix', 'mortgagePayment');
    if (this.system.financeValues.mortgagePaymentTerm !== currentMortgageTerm) {
      Object.assign(updates, {'system.financeValues.mortgagePaymentTerm': currentMortgageTerm});
    }

    const currentMassProductionDiscount = parseFloat(game.settings.get('twodsix', 'massProductionDiscount'));
    if (this.system.financeValues.massProductionDiscount !== currentMassProductionDiscount) {
      Object.assign(updates, {'system.financeValues.massProductionDiscount': currentMassProductionDiscount});
    }

    await this.updateSource(updates);

    return allowed;
  }

  /** @override */
  _getDefaultImage() {
    return 'systems/twodsix/assets/icons/default_ship.png';
  }

  /** @override */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);

    const financeDiff = {
      financesCash:
        data?.system?.financeValues?.cash !== this.system._source.financeValues?.cash
          ? data.system?.financeValues?.cash
          : undefined,
      commonFunds:
        data?.system?.commonFunds !== this.system._source.commonFunds
          ? data.system?.commonFunds
          : undefined,
    };
    if (financeDiff.financesCash !== undefined || financeDiff.commonFunds !== undefined) {
      updateShipFinances(this, data, financeDiff);
    }

    return allowed;
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    if (game.settings.get("twodsix", "useShipAutoCalcs")) {
      this._prepareShipDerivedData();
    }
    this._checkCrewTitles();
    this._prepareShipPositions();
  }

  /**
   * Check Crew Titles for missing and set to localized default
   * @returns {void}
   */
  _checkCrewTitles() {
    if (!this.system.crewLabel) {
      return;
    }
    for (const pos in this.system.crewLabel) {
      if (this.system.crewLabel[pos] === "") {
        this.system.crewLabel[pos] = game.i18n.localize("TWODSIX.Ship.Crew." + pos.toUpperCase());
      }
    }
  }

  /**
   * Enrich each ship_position item with transient derived fields:
   * - system.actors: resolved Actor objects for assigned crew
   * - system.sortedActions: actions object entries sorted by order
   * @returns {void}
   */
  _prepareShipPositions() {
    if (!this.system.shipPositionActorIds) {
      return;
    }
    for (const shipPosition of this.itemTypes.ship_position) {
      const assignedEntries = Object.entries(this.system.shipPositionActorIds)
        .filter(([, posId]) => posId === shipPosition.id);
      if (assignedEntries.length > 0) {
        shipPosition.system.actors = assignedEntries
          .map(([actorId]) => game.actors?.get(actorId))
          .filter(a => a !== undefined);
      } else {
        shipPosition.system.actors = [];
      }
      const actions = shipPosition.system.actions ?? {};
      shipPosition.system.sortedActions = Object.entries(actions)
        .map(([id, action]) => {
          action.id = id; return action;
        })
        .sort((a, b) => (a.order > b.order) ? 1 : -1);
    }
  }

  /**
   * @returns {void}
   */
  _prepareShipDerivedData() {
    if (!this.system.shipStats || !this.system.financeValues) {
      return;
    }

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
        percentHull: 0,
        componentValue: 0,
        total: 0
      },
      bandwidth: {
        used: 0,
        available: 0
      },
      mass: {
        max: 0
      },
      drives: {
        jDrive: {rating: 0},
        mDrive: {rating: 0}
      }
    };

    const calcDisplacement = Math.round(
      this.itemTypes.component
        .filter((item) => item.system.isBaseHull)
        .reduce((sum, item) => sum + getWeight(item), 0)
    );
    if (calcDisplacement && calcDisplacement > 0) {
      calcShipStats.mass.max = calcDisplacement;
    } else {
      calcShipStats.mass.max = this.system.shipStats.mass.max || 0;
    }

    this.system.calcShipStats = {mass: {max: calcShipStats.mass.max}};

    const {jump, thrust} = this._getDriveRatings();
    calcShipStats.drives.jDrive.rating = Number.isFinite(jump) ? jump : 0;
    calcShipStats.drives.mDrive.rating = Number.isFinite(thrust) ? thrust : 0;

    const massProducedMultiplier = this.system.isMassProduced ? (1 - this.system.financeValues.massProductionDiscount) : 1;

    this.itemTypes.component.forEach((item) => {
      const anComponent = item.system;

      const isExcludedFromCost = anComponent.isExcludedFromCost;
      const isOperational = ["operational", "damaged"].includes(anComponent.status);
      const isBaseHull = anComponent.subtype === COMPONENT_SUBTYPES.HULL && anComponent.isBaseHull;

      const powerForItem = getPower(item);
      item.system.componentPowerDisplay = (item.system.generatesPower ? "+" : "") + powerForItem.toLocaleString(game.i18n.lang, {maximumFractionDigits: 1});
      const weightForItem = getWeight(item);
      item.system.componentWeight = weightForItem;
      item.system.componentWeightDisplay = weightForItem.toLocaleString(game.i18n.lang, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      });

      allocatePower(anComponent, powerForItem, item);
      allocateWeight(anComponent, weightForItem);

      if (!isExcludedFromCost) {
        calculateComponentCost(anComponent, weightForItem, isBaseHull);
      }

      if (isOperational) {
        calculateBandwidth(anComponent);
      }
    });

    this.itemTypes.component
      .filter((it) => ["pctHull", "pctHullPerUnit"].includes(it.system.pricingBasis) && !it.system.isExcludedFromCost)
      .forEach((item) => {
        const multiplier = item.system.pricingBasis === "pctHullPerUnit" ? item.system.quantity : 1;
        item.system.installedCost = calcShipStats.cost.baseHullValue * Number(item.system.price) * multiplier / 100;
      });

    calcShipStats.power.used = calcShipStats.power.jDrive + calcShipStats.power.mDrive + calcShipStats.power.sensors + calcShipStats.power.weapons + calcShipStats.power.systems;
    calcShipStats.weight.available = calcShipStats.mass.max - (calcShipStats.weight.vehicles ?? 0) - (calcShipStats.weight.cargo ?? 0) - (calcShipStats.weight.fuel ?? 0) - (calcShipStats.weight.systems ?? 0);
    calcShipStats.cost.total = calcShipStats.cost.componentValue + calcShipStats.cost.baseHullValue * (1 + calcShipStats.cost.percentHull / 100);

    const totalCost = Number.isFinite(calcShipStats.cost.total) ? calcShipStats.cost.total : 0;
    const mortgageTerm = Number.isFinite(this.system.financeValues.mortgagePaymentTerm) && this.system.financeValues.mortgagePaymentTerm > 0
      ? this.system.financeValues.mortgagePaymentTerm
      : game.settings.get('twodsix', 'mortgageTerm');

    this.system.calcShipStats = {
      power: {
        value: roundToMaxDecimals(calcShipStats.power.used, 1),
        max: roundToMaxDecimals(calcShipStats.power.max, 1)
      },
      bandwidth: {
        value: Math.round(calcShipStats.bandwidth.used),
        max: Math.round(calcShipStats.bandwidth.available)
      },
      mass: {
        value: 0,
        max: calcShipStats.mass.max
      },
      drives: {
        jDrive: {rating: calcShipStats.drives.jDrive.rating},
        mDrive: {rating: calcShipStats.drives.mDrive.rating}
      },
      reqPower: formatPowerStats(calcShipStats.power),
      weightStats: formatWeightStats(calcShipStats.weight),
      cost: {
        total: totalCost,
        shipValue: totalCost.toLocaleString(game.i18n.lang, {minimumFractionDigits: 1, maximumFractionDigits: 1}),
        mortgageCost: formatMCrAsCredits(totalCost / mortgageTerm),
        maintenanceCost: formatMCrAsCredits(totalCost * 0.001 / 12)
      }
    };

    function calculateComponentCost(anComponent, weightForItem, isBaseHull) {
      const price = Number(anComponent.price);

      if (anComponent.pricingBasis === "pctHull") {
        calcShipStats.cost.percentHull += price;
        return;
      }
      if (anComponent.pricingBasis === "pctHullPerUnit") {
        calcShipStats.cost.percentHull += price * anComponent.quantity;
        return;
      }

      const hullMass = calcShipStats.mass.max || calcShipStats.weight.baseHull;

      let cost = 0;
      switch (anComponent.pricingBasis) {
        case "perUnit":
          cost = price * anComponent.quantity * massProducedMultiplier;
          break;
        case "perCompTon":
          cost = price * weightForItem * massProducedMultiplier;
          break;
        case "perHullTon":
          cost = hullMass * price * massProducedMultiplier;
          break;
        case "per100HullTon":
          cost = (hullMass * price / 100) * massProducedMultiplier;
          break;
      }

      anComponent.installedCost = cost;

      if (isBaseHull) {
        calcShipStats.cost.baseHullValue += cost;
      } else {
        calcShipStats.cost.componentValue += cost;
      }
    }

    function calculateBandwidth(anComponent) {
      if (game.settings.get("twodsix", "showBandwidth")) {
        if (anComponent.contributesBandwidth) {
          calcShipStats.bandwidth.available += anComponent.bandwidth;
        } else if (anComponent.consumesBandwidth) {
          calcShipStats.bandwidth.used += anComponent.bandwidth;
        }
      }
    }

    function allocateWeight(anComponent, weightForItem) {
      const category = anComponent.weightCategory;
      if (category === "hull") {
        if (anComponent.isBaseHull) {
          calcShipStats.weight.baseHull += weightForItem;
        } else {
          calcShipStats.weight.systems += weightForItem;
        }
      } else {
        calcShipStats.weight[category] += weightForItem;
      }
    }

    function allocatePower(anComponent, powerForItem, item) {
      if (anComponent.generatesPower) {
        calcShipStats.power.max += powerForItem;
      } else {
        const category = anComponent.powerCategory;
        if (category === "drive") {
          if (item.isJDriveComponent()) {
            calcShipStats.power.jDrive += powerForItem;
          } else if (item.isMDriveComponent()) {
            calcShipStats.power.mDrive += powerForItem;
          } else {
            calcShipStats.power.systems += powerForItem;
          }
        } else {
          calcShipStats.power[category] += powerForItem;
        }
      }
    }
  }

  /** @override */
  async handleDroppedItem(droppedItem) {
    if (!droppedItem) {
      return false;
    }
    // Check for cargo trade from world
    const cargoRowFromWorld = this.buildCargoRowFromItem(droppedItem);
    if (cargoRowFromWorld && droppedItem.actor?.type === "world") {
      return await this.handleDroppedCargo(cargoRowFromWorld, droppedItem.actor.uuid, droppedItem.id);
    }
    // Normal equipment
    if (!TWODSIX.WeightlessItems.includes(droppedItem.type)) {
      return await this._addDroppedEquipment(droppedItem);
    }
    ui.notifications.warn("TWODSIX.Warnings.CantDragOntoActor", {localize: true});
    return false;
  }

  /** @override */
  async handleDamageData(damagePayload, showDamageDialog) {
    if (!this.isOwner && !showDamageDialog) {
      ui.notifications.error("TWODSIX.Warnings.LackPermissionToDamage", {localize: true});
      return false;
    }
    generateShipDamageReport(this, damagePayload);
  }

  /** @override */
  doShipAction(action, extra) {
    TwodsixShipActions.availableMethods[action.type].action(action.command, extra);
  }

  /** @override */
  getRollData() {
    const data = super.getRollData();

    if (this.system.calcShipStats) {
      const useAutoCalcs = game.settings.get('twodsix', 'useShipAutoCalcs');
      if (useAutoCalcs) {
        data.shipStats = {
          ...this.system.shipStats,
          mass: this.system.calcShipStats.mass,
          drives: this.system.calcShipStats.drives,
          power: this.system.calcShipStats.power,
          bandwidth: this.system.calcShipStats.bandwidth
        };
      }
    }

    return data;
  }

  /** @override */
  async handleDroppedCargoToWorldFromItem(item) {
    const cargoRow = this.buildCargoRowFromItem(item);
    if (!cargoRow) {
      return false;
    }

    const maxQty = item.system.quantity || 0;
    if (maxQty <= 0) {
      ui.notifications.warn("TWODSIX.Trade.NoCargoToTransfer", {localize: true});
      return false;
    }

    const transferQty = await this._promptCargoQuantity(maxQty);
    if (!transferQty) {
      return false;
    }
    const sellPerTon = cargoRow.sellPricePerTon ?? 0;
    const totalProceeds = sellPerTon * transferQty;

    const remainingQty = maxQty - transferQty;
    if (remainingQty <= 0) {
      await item.delete();
    } else {
      await item.update({
        "system.quantity": remainingQty,
        "system.purchasePrice": item.system.buyPricePerTon * remainingQty
      });
    }

    await this.update({"system.financeValues.cash": this.system.financeValues.cash + totalProceeds});
    return true;
  }

  /** @override */
  async handleDroppedCargo(cargoRow, sourceActorUuid, sourceItemId) {
    let sourceActor = null;
    let sourceItem = null;
    if (sourceActorUuid && sourceItemId) {
      sourceActor = await fromUuid(sourceActorUuid);
      if (!sourceActor) {
        ui.notifications.error("TWODSIX.Errors.SourceActorNotFound", {localize: true});
        return false;
      }
      sourceItem = sourceActor.items.get(sourceItemId);
      if (!sourceItem) {
        ui.notifications.error("TWODSIX.Errors.SourceItemNotFound", {localize: true});
        return false;
      }
    }

    const maxQty = sourceItem
      ? (sourceItem.system.quantity || 0)
      : (cargoRow.quantity || 1);

    if (maxQty <= 0) {
      ui.notifications.warn("TWODSIX.Trade.NoCargoToTransfer", {localize: true});
      return false;
    }

    const transferQty = await this._promptCargoQuantity(maxQty);
    if (!transferQty) {
      return false;
    }

    const buyPerTon = cargoRow.buyPricePerTon ?? 0;
    const sellPerTon = cargoRow.sellPricePerTon ?? 0;
    const buyMod = cargoRow.buyPriceMod ?? 100;
    const sellMod = cargoRow.sellPriceMod ?? 100;
    const basePrice = buyPerTon > 0 ? Math.round(buyPerTon / (buyMod / 100)) : (sellPerTon > 0 ? Math.round(sellPerTon / (sellMod / 100)) : 0);
    const totalCost = buyPerTon * transferQty;
    const cargoName = game.i18n.localize(cargoRow.name) || 'Cargo';

    if (this.system.financeValues.cash < totalCost) {
      ui.notifications.warn("TWODSIX.Warnings.InsufficientFunds", {localize: true});
      return false;
    }

    const existingCargo = this.items.find(
      (i) => i.type === 'component' && i.system?.subtype === COMPONENT_SUBTYPES.CARGO && i.name === cargoName
    );

    if (existingCargo) {
      const newQty = existingCargo.system.quantity + transferQty;
      const newPurchasePrice = existingCargo.system.purchasePrice + totalCost;
      await existingCargo.update({
        'system.quantity': newQty,
        'system.purchasePrice': newPurchasePrice
      });
    } else {
      const itemData = {
        name: cargoName,
        img: "systems/twodsix/assets/icons/components/cargo.svg",
        type: 'component',
        system: {
          subtype: COMPONENT_SUBTYPES.CARGO,
          status: 'operational',
          price: basePrice,
          buyPricePerTon: buyPerTon,
          sellPricePerTon: sellPerTon,
          buyPriceMod: buyMod,
          sellPriceMod: sellMod,
          purchasePrice: totalCost,
          isIllegal: cargoRow.illegal || false,
          quantity: transferQty,
          weight: 1
        }
      };
      await this.createEmbeddedDocuments('Item', [itemData]);
    }

    if (sourceActor && sourceItem) {
      const remainingQty = (sourceItem.system.quantity || 0) - transferQty;
      if (remainingQty <= 0) {
        await sourceActor.deleteEmbeddedDocuments('Item', [sourceItem.id]);
      } else {
        await sourceItem.update({
          'system.quantity': remainingQty,
          'system.purchasePrice': sourceItem.system.buyPricePerTon * remainingQty
        });
      }
    }

    await this.update({'system.financeValues.cash': this.system.financeValues.cash - totalCost});

    ui.notifications.info(game.i18n.format('TWODSIX.Trade.CargoTransferred', {
      qty: transferQty,
      name: cargoName
    }));
    return true;
  }

  /** @override */
  async _promptCargoQuantity(maxQty) {
    const qtyHtml = `<label>${game.i18n.localize("TWODSIX.Actor.Items.QuantityToTransfer")} (max ${maxQty}):</label>
    <input type="number" name="qty" min="1" max="${maxQty}" value="${maxQty}" style="width:60px"/>`;

    const qty = await foundry.applications.api.DialogV2.prompt({
      window: {title: game.i18n.localize("TWODSIX.Trade.TransferCargo"), icon: "fa-solid fa-boxes-stacked"},
      content: qtyHtml,
      buttons: [
        {
          action: "ok",
          label: "OK",
          callback: (_event, target) => Number(target.form.elements.qty.value)
        }
      ]
    });

    if (!Number.isInteger(qty) || qty <= 0) {
      return null;
    }

    return Math.min(qty, maxQty);
  }
}

/**
 * @param {object} power
 * @returns {object}
 */
function formatPowerStats(power) {
  return {
    systems: roundToMaxDecimals(power.systems, 1),
    mDrive: roundToMaxDecimals(power.mDrive, 1),
    jDrive: roundToMaxDecimals(power.jDrive, 1),
    sensors: roundToMaxDecimals(power.sensors, 1),
    weapons: roundToMaxDecimals(power.weapons, 1)
  };
}

/**
 * @param {object} weight
 * @returns {object}
 */
function formatWeightStats(weight) {
  return {
    vehicles: roundToMaxDecimals(weight.vehicles, 2),
    cargo: roundToMaxDecimals(weight.cargo, 2),
    fuel: roundToMaxDecimals(weight.fuel, 2),
    systems: roundToMaxDecimals(weight.systems, 2),
    available: roundToMaxDecimals(weight.available, 2)
  };
}

/**
 * @param {number} mcr
 * @param {number} [decimals]
 * @returns {string}
 */
function formatMCrAsCredits(mcr, decimals = 0) {
  return (mcr * 1000000).toLocaleString(game.i18n.lang, {
    maximumFractionDigits: decimals,
    ...(decimals > 0 && {minimumFractionDigits: decimals})
  });
}
