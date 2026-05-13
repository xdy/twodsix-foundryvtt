/**
 * BaseTraderRuleset.js
 * Abstract base class for trader ruleset logic.
 * Default implementations are compatible with Cepheus Engine (CE).
 */
import { COMMON_GOODS, TRADE_GOODS } from '../../utils/trade/TradeGeneratorConstants.js';
import {
  BULK_LS_LUXURY_COST,
  BULK_LS_NORMAL_COST,
  CHARTER_RATE,
  FREIGHT_AVAILABILITY,
  FREIGHT_RATE,
  LIFE_SUPPORT,
  MAIL_PAYMENT,
  MORTGAGE_FINANCING_MULTIPLIER,
  PASSENGER_AVAILABILITY,
  PASSENGER_REVENUE,
  PORT_FEE_BASE,
  PORT_FEE_DAYS,
} from './TraderConstants.js';
import { getWorldCoordinate, hexDistance } from './TraderUtils.js';

export const SEARCH_METHOD = {
  STANDARD: 'standard',
  BLACK_MARKET: 'blackMarket',
  ONLINE: 'online',
  CORPORATE: 'corporate',
  PRIVATE: 'private',
};

export class BaseTraderRuleset {
  /**
   * Parse hexadecimal-like digit values used in UWP fields.
   * @param {unknown} value
   * @param {number} fallback
   * @returns {number}
   */
  parseHexDigit(value, fallback = 0) {
    const numeric = Number.parseInt(String(value ?? ''), 16);
    return Number.isNaN(numeric) ? fallback : numeric;
  }

  /**
   * @param {import('../entities/TwodsixActor').default} world
   * @returns {Record<string, unknown>}
   */
  getWorldData(world) {
    return world?.system ?? {};
  }

  /**
   * Resolve world TL from UWP or explicit techLevel.
   * @param {import('../entities/TwodsixActor').default} world
   * @param {number} fallback
   * @returns {number}
   */
  getWorldTechLevel(world, fallback = 0) {
    const worldData = this.getWorldData(world);
    const tlDigit = worldData?.uwp?.charAt?.(8) ?? worldData?.techLevel;
    return this.parseHexDigit(tlDigit, fallback);
  }

  /**
   * Get source/destination worlds for route-aware rulesets.
   * @param {import('./TraderState.js').TraderState} state
   * @param {import('../entities/TwodsixActor').default} world
   * @returns {{source: import('../entities/TwodsixActor').default, destination: import('../entities/TwodsixActor').default}}
   */
  getRouteWorlds(state, world) {
    const destinationAliases = new Set([state?.destinationHex, state?.destinationGlobalHex].filter(Boolean));
    const destination = state?.worlds?.find(candidate => {
      const candidateAliases = [
        getWorldCoordinate(candidate),
        candidate?.getFlag?.('twodsix', 'locationCoordinate'),
        candidate?.system?.coordinates,
        candidate?.globalHex,
        candidate?.hex,
      ].filter(Boolean);
      return candidateAliases.some(alias => destinationAliases.has(alias));
    }) || world;
    return { source: world, destination: destination || world };
  }

  /**
   * @param {import('./TraderState.js').TraderState} state
   * @returns {number}
   */
  getWorldRouteDistance(state) {
    const destination = state?.destinationHex || state?.destinationGlobalHex;
    if (!destination) {
      return 1;
    }
    return Math.max(1, Math.round(hexDistance(state.currentWorldHex, destination)));
  }

  /**
   * Roll 2D6 + DM and return check/effect.
   * @param {import('./TraderApp.js').TraderApp} app
   * @param {number} dm
   * @param {number} threshold
   * @returns {Promise<{check:number,effect:number}>}
   */
  async rollCheckWithEffect(app, dm = 0, threshold = 8) {
    const formula = `2D6${dm >= 0 ? '+' : ''}${dm}`;
    const check = await app._roll(formula);
    return { check, effect: Math.max(0, check - threshold) };
  }

  /**
   * Map modified 2D6 total to Nd6 traffic count by threshold table.
   * @param {Array<{min?: number, max?: number, dice: number}>} thresholds
   * @param {number} modifiedTotal
   * @returns {number}
   */
  trafficDiceFromThresholds(thresholds, modifiedTotal) {
    for (const band of thresholds || []) {
      if (typeof band.max === 'number' && modifiedTotal > band.max) {
        continue;
      }
      if (typeof band.min === 'number' && modifiedTotal < band.min) {
        continue;
      }
      return Number(band.dice) || 0;
    }
    return 0;
  }

  /**
   * Roll traffic quantity from 2D6+DM threshold bands.
   * @param {import('./TraderApp.js').TraderApp} app
   * @param {number} dm
   * @param {Array<{min?: number, max?: number, dice: number}>} thresholds
   * @returns {Promise<number>}
   */
  async rollTrafficFromThresholds(app, dm, thresholds) {
    const base = await app._roll('2D6');
    const diceCount = this.trafficDiceFromThresholds(thresholds, base + dm);
    if (diceCount <= 0) {
      return 0;
    }
    return await app._roll(`${diceCount}D6`);
  }

  /**
   * Get available search method options for finding suppliers/buyers.
   * @param {number} worldTL - World tech level
   * @param {string} starport - Starport class letter
   * @returns {string[]} List of search method keys
   */
  getSearchMethods(worldTL, starport) {
    const methods = [SEARCH_METHOD.STANDARD, SEARCH_METHOD.BLACK_MARKET];
    if (worldTL >= 8) {
      methods.push(SEARCH_METHOD.ONLINE);
    }
    return methods;
  }

  /**
   * Get the effective skill level for a search method.
   * @param {object} crew - Crew skills summary
   * @param {string} method - Search method key
   * @returns {number} Skill level or UNSKILLED_PENALTY
   */
  getSearchSkillLevel(crew, method) {
    switch (method) {
      case SEARCH_METHOD.STANDARD: return this.getCrewSkill(crew, 'Broker');
      case SEARCH_METHOD.BLACK_MARKET: return this.getCrewSkill(crew, 'Streetwise');
      case SEARCH_METHOD.ONLINE: return this.getCrewSkill(crew, 'Computers');
      default: return -3; // UNSKILLED_PENALTY
    }
  }

  /**
   * Get the localization label for the skill used by a search method.
   * @param {string} method - Search method key
   * @returns {string} i18n key for the skill name
   */
  getSearchSkillLabel(method) {
    switch (method) {
      case SEARCH_METHOD.STANDARD: return 'TWODSIX.Items.Skill.Broker';
      case SEARCH_METHOD.BLACK_MARKET: return 'TWODSIX.Items.Skill.Streetwise';
      case SEARCH_METHOD.ONLINE: return 'TWODSIX.Items.Skill.Computers';
      default: return 'TWODSIX.Items.Skill.Unskilled';
    }
  }

  /**
   * Get the starport DM for search rolls.
   * @param {string} starport - Starport class letter
   * @returns {number} DM bonus
   */
  getSearchStarportBonus(starport) {
    const bonuses = { A: 6, B: 4, C: 2, D: 0, E: 0, X: 0 };
    return bonuses[starport] ?? 0;
  }

  /**
   * Get the target number for search rolls.
   * @returns {number} Threshold (default 8)
   */
  getSearchThreshold() {
    return 8;
  }

  /**
   * Search-attempt penalty policy.
   * cadence:
   * - month: reset each 30-day month bucket
   * - costPeriod: reset each ruleset cost-period bucket
   * - none: never reset automatically
   * @param {import('./TraderState.js').TraderState} _state
   * @param {import('../entities/TwodsixActor').default} _world
   * @param {'buyer'|'supplier'} _type
   * @param {string} _method
   * @returns {{cadence: 'month'|'costPeriod'|'none', penaltyPerAttempt: number, maxPenalty: number|null}}
   */
  getSearchPenaltyPolicy(_state, _world, _type, _method) {
    return {
      cadence: 'month',
      penaltyPerAttempt: 1,
      maxPenalty: null,
    };
  }

  /**
   * Get the base skill modifier for price negotiation rolls.
   * @param {object} crew - Crew skills summary
   * @returns {number} Skill level
   */
  getPriceRollSkill(crew) {
    return this.getCrewSkill(crew, 'Broker');
  }

  /**
   * Get DM tables for common goods.
   * @returns {object|null} Map of good names to {purchaseDM, saleDM} or null
   */
  getCommonGoodsDMs() {
    return null;
  }

  /**
   * Get the common goods table for this ruleset.
   * @returns {Array<object>}
   */
  getCommonGoods() {
    return COMMON_GOODS;
  }

  /**
   * Get the trade goods table for this ruleset.
   * @returns {Array<object>}
   */
  getTradeGoods() {
    return TRADE_GOODS;
  }

  /**
   * Get the starport modifier for the number of random trade goods available.
   * @returns {number}
   */
  getAvailableTradeGoodsModifier() {
    return 0;
  }

  /**
   * Ruleset key used by the price modifier table.
   * @returns {string}
   */
  getPriceRulesetKey() {
    return 'CE';
  }

  /**
   * Optional custom price modifier table for trade generation.
   * Return null to use core CE/CDEE tables by price ruleset key.
   * @returns {Record<number, {purchase: number, sale: number}>|null}
   */
  getPriceModifierTable() {
    return null;
  }

  /**
   * Clamp range for broker and trade checks.
   * @returns {{min: number, max: number}}
   */
  getTradeCheckClampRange() {
    return { min: 2, max: 16 };
  }

  /**
   * Build the trade generation options for this ruleset.
   * @param {string} starport
   * @param {number} localBrokerSkill
   * @param {{world?: import('../entities/TwodsixActor').default, illegal?: boolean}} [context]
   * @returns {object}
   */
  getTradeGenerationOptions(starport, localBrokerSkill = 0, context = {}) {
    const brokerMaxSkill = this.getBrokerMaxSkill(starport);
    const world = context.world || null;
    return {
      commonGoods: this.getCommonGoods(),
      tradeGoods: this.getTradeGoods(),
      availableTradeGoodsModifier: this.getAvailableTradeGoodsModifier(starport),
      priceRuleset: this.getPriceRulesetKey(),
      priceModifierTable: this.getPriceModifierTable(),
      checkClampRange: this.getTradeCheckClampRange(),
      brokerMaxSkill,
      brokerCommission: this.getBrokerCommission(Math.min(localBrokerSkill, brokerMaxSkill), {
        illegal: context.illegal === true,
      }),
      priceRollDice: this.getPriceRollDice(),
      priceTableOffset: this.getPriceTableOffset(),
      supplierBrokerSkill: this.getSupplierBrokerSkill(world),
      buyerBrokerSkill: this.getBuyerBrokerSkill(world),
      localBrokerNegotiationBonus: this.getLocalBrokerNegotiationBonus(),
    };
  }

  /**
   * Get the maximum broker skill available at a starport.
   * @param {string} starport - Starport class letter
   * @returns {number} Max skill level
   */
  getBrokerMaxSkill(starport) {
    const maxSkills = { A: 4, B: 3, C: 2, D: 1, E: 0, X: 0 };
    return maxSkills[starport] ?? 0;
  }

  /**
   * Get the commission percentage for a broker's skill level.
   * @param {number} skillLevel - Broker skill level
   * @returns {number} Commission % (e.g. 5 for 5%)
   */
  getBrokerCommission(skillLevel) {
    return 5 * (skillLevel + 1);
  }

  /**
   * Resolve effective negotiation skill (crew vs hired broker).
   * @param {{crewSkill:number, hiredSkill:number, useLocalBroker:boolean, starport:string, illegal:boolean}} context
   * @returns {number}
   */
  resolveEffectiveNegotiatorSkill(context) {
    const crewSkill = Number(context?.crewSkill) || 0;
    if (!context?.useLocalBroker) {
      return crewSkill;
    }
    const hiredSkill = Number(context?.hiredSkill) || 0;
    return Math.max(crewSkill, hiredSkill);
  }

  /**
   * Normalize/validate rolled local broker result from ruleset hooks.
   * Return null to indicate fallback to picker.
   * @param {{skill:number, commission?:number, illegal?:boolean, eventNote?:string}|null} result
   * @param {{maxSkill:number, illegal:boolean}} context
   * @returns {{skill:number, commission:number, illegal:boolean, eventNote?:string}|null}
   */
  normalizeLocalBrokerResult(result, context) {
    if (!result || !Number.isFinite(result.skill)) {
      return null;
    }
    const maxSkill = Math.max(0, Number(context?.maxSkill) || 0);
    const illegal = context?.illegal === true;
    const skill = Math.max(0, Math.min(Number(result.skill) || 0, maxSkill));
    const commission = Number.isFinite(result.commission)
      ? Number(result.commission)
      : this.getBrokerCommission(skill, { illegal });
    return {
      skill,
      commission,
      illegal,
      eventNote: result.eventNote,
    };
  }

  /**
   * Whether local broker hire resets when arriving at a new world.
   * @returns {boolean}
   */
  shouldResetLocalBrokerOnArrival() {
    return true;
  }

  /**
   * Get passenger revenue by class.
   * @returns {Record<string, number>}
   */
  getPassengerRevenue() {
    return PASSENGER_REVENUE;
  }

  /**
   * Get passenger availability formulas by starport.
   * @returns {Record<string, Record<string, string>>}
   */
  getPassengerAvailability() {
    return PASSENGER_AVAILABILITY;
  }

  /**
   * Get the freight availability formulas by starport.
   * @returns {Record<string, string>}
   */
  getFreightAvailability() {
    return FREIGHT_AVAILABILITY;
  }

  /** @returns {number} */
  getFreightRate() {
    return FREIGHT_RATE;
  }

  /** @returns {number} */
  getMailPayment() {
    return MAIL_PAYMENT;
  }

  /**
   * Generate available passengers at this world.
   * @param {import('./TraderApp.js').TraderApp} app
   * @param {import('./TraderState.js').TraderState} _state
   * @param {import('../entities/TwodsixActor').default} world
   * @returns {Promise<{high:number,middle:number,steerage:number,low:number}>}
   */
  async generatePassengerMarket(app, _state, world) {
    const passengerAvailability = this.getPassengerAvailability();
    const starport = world?.system?.starport || 'X';
    const avail = passengerAvailability[starport] || passengerAvailability.X;
    return {
      high: Math.max(0, await app._roll(avail.high)),
      middle: Math.max(0, await app._roll(avail.middle)),
      steerage: Math.max(0, await app._roll(avail.steerage || '0')),
      low: Math.max(0, await app._roll(avail.low)),
    };
  }

  /**
   * Generate available freight at this world.
   * @param {import('./TraderApp.js').TraderApp} app
   * @param {import('./TraderState.js').TraderState} _state
   * @param {import('../entities/TwodsixActor').default} world
   * @returns {Promise<{tons:number, lots:Array<{kind:string, tons:number, rate:number}>}>}
   */
  async generateFreightMarket(app, _state, world) {
    const freightAvailability = this.getFreightAvailability();
    const freightRate = this.getFreightRate();
    const starport = world?.system?.starport || 'X';
    const formula = freightAvailability[starport] || '0';
    const tons = Math.max(0, await app._roll(formula));
    return {
      tons,
      lots: tons > 0 ? [{ kind: 'standard', tons, rate: freightRate }] : [],
    };
  }

  /**
   * Roll mail offer details.
   * @param {import('./TraderApp.js').TraderApp} app
   * @param {import('./TraderState.js').TraderState} _state
   * @param {import('../entities/TwodsixActor').default} _world
   * @returns {Promise<{available:boolean, containers:number, tonsPerContainer:number, paymentPerContainer:number}>}
   */
  async generateMailOffer(app, _state, _world) {
    const available = (await app._roll('2D6')) >= 7;
    const containers = available ? 1 : 0;
    return {
      available,
      containers,
      tonsPerContainer: 5,
      paymentPerContainer: this.getMailPayment(),
    };
  }

  /** @returns {Record<string, number>} */
  getCharterRate() {
    return CHARTER_RATE;
  }

  /** @returns {Record<string, number>} */
  getLifeSupportCosts() {
    return LIFE_SUPPORT;
  }

  /**
   * Cargo-hold tonnage occupied by booked passengers (luggage / spare room).
   * Default (CE-family): 0 — CE lumps allowances into the stateroom itself.
   * in a stateroom. Override on a ruleset basis.
   * @param {{high?: number, middle?: number, steerage?: number, low?: number}} _passengers
   * @param {{staterooms?: number, lowBerths?: number}} _ship
   * @returns {number}
   */
  getPassengerCargoOverhead(_passengers, _ship) {
    return 0;
  }

  /**
   * Compute total monthly life-support cost given current ship+passenger state.
   * Default (CE SRD): every stateroom + every low berth, regardless of occupancy.
   * @param {import('./TraderState.js').TraderState} state
   * @returns {number}
   */
  calculateLifeSupportCost(state) {
    const ls = this.getLifeSupportCosts(state);
    const ship = state?.ship || {};
    return (ship.staterooms || 0) * (ls.stateroom || 0) + (ship.lowBerths || 0) * (ls.lowBerth || 0);
  }

  /** @returns {{normal: number, luxury: number}} */
  getBulkLifeSupportCosts() {
    return {
      normal: BULK_LS_NORMAL_COST,
      luxury: BULK_LS_LUXURY_COST,
    };
  }

  /** @returns {number} */
  getMortgageDivisor() {
    return 240;
  }

  /**
   * Total financing multiplier for mortgages.
   * Default keeps historical CE-family value (2.2 = 220% paid back over 480 months).
   * @returns {number}
   */
  getMortgageFinancingMultiplier() {
    return MORTGAGE_FINANCING_MULTIPLIER;
  }

  /**
   * Period (in days) used for cost accrual: salaries, life support, mortgage,
   * maintenance. Default 30 (CE-family calendar month).
   * (the rulebook's "Maintenance Period").
   * @returns {number}
   */
  getCostPeriodDays() {
    return 30;
  }

  // ─── Pricing / Broker Hooks ───────────────────────────────────────────────

  /**
   * Dice expression used for purchase/sale price negotiation rolls.
   * CE-family rules default to 2D.
   * Recognised values: '2d6' or '3d6' (case-insensitive).
   * @returns {string}
   */
  getPriceRollDice() {
    return '2d6';
  }

  /**
   * Assumed counterparty Broker skill subtracted from the purchase roll.
   * Defaults to 0 for CE-family (already encoded into the price tables).
   * @param {import('../entities/TwodsixActor').default} _world
   * @returns {number}
   */
  getSupplierBrokerSkill(_world) {
    return 0;
  }

  /**
   * Assumed counterparty Broker skill subtracted from the sale roll.
   * @param {import('../entities/TwodsixActor').default} _world
   * @returns {number}
   */
  getBuyerBrokerSkill(_world) {
    return 0;
  }

  /**
   * DM applied to negotiation when using a hired local broker.
   * @returns {number}
   */
  getLocalBrokerNegotiationBonus() {
    return 0;
  }

  /**
   * Whether illegal cargo sales require a buyer found via BLACK_MARKET search.
   * Default false to preserve CE-family behavior
   * @returns {boolean}
   */
  requiresBlackMarketBuyerForIllegalSales() {
    return false;
  }

  /**
   * Roll a local broker's skill at the given world.
   * Return null to fall back to the player-picker dialog (default behaviour).
   * @param {import('./TraderApp.js').TraderApp} _app
   * @param {import('../entities/TwodsixActor').default} _world
   * @param {{illegal?: boolean}} [_opts]
   * @returns {Promise<{skill: number, commission: number, illegal?: boolean, eventNote?: string}|null>}
   */
  async rollLocalBrokerSkill(_app, _world, _opts = {}) {
    return null;
  }

  /**
   * Offset to add before looking up the price modifier table (key = result + offset).
   * Some rulesets key their tables on a shifted index.
   * @returns {number}
   */
  getPriceTableOffset() {
    return 0;
  }

  // ─── Berthing / Port Fees ─────────────────────────────────────────────────

  /**
   * Port fee charged on arrival at a starport.
   * Default behaviour matches CE SRD (Cr100 docking fee on arrival).
   * @param {import('../entities/TwodsixActor').default} _world
   * @returns {number}
   */
  getArrivalPortFee(_world) {
    return PORT_FEE_BASE;
  }

  /**
   * Daily berthing fee accrual model.
   * Returns the additional cost owed and the new "days already paid" tally
   * given how many days the ship has spent at port.
   * Default: free for `PORT_FEE_DAYS` days, then PORT_FEE_BASE per extra day.
   * @param {import('./TraderState.js').TraderState} _state
   * @param {import('../entities/TwodsixActor').default} _world
   * @param {number} daysSinceArrival - 1-based count of days at port (inclusive)
   * @param {number} daysAlreadyCharged - tally already accumulated by previous calls
   * @returns {{cost: number, newDaysCharged: number}}
   */
  getBerthingCost(_state, _world, daysSinceArrival, daysAlreadyCharged) {
    const startedFree = Math.max(daysAlreadyCharged, PORT_FEE_DAYS);
    if (daysSinceArrival <= startedFree) {
      return { cost: 0, newDaysCharged: startedFree };
    }
    const extraDays = daysSinceArrival - startedFree;
    return { cost: extraDays * PORT_FEE_BASE, newDaysCharged: daysSinceArrival };
  }

  /**
   * Initial value for `cache.portFeesPaidDays` when the ship arrives.
   * Allows rulesets that charge from day 1 to report "0".
   * @returns {number}
   */
  getInitialPortFeeDaysPaid() {
    return PORT_FEE_DAYS;
  }

  // ─── Bulk Life Support ────────────────────────────────────────────────────

  /**
   * Whether the system-wide Bulk Life Support consumable cargo is offered.
   * @returns {boolean}
   */
  isBulkLifeSupportEnabled() {
    return true;
  }

  /**
   * Resolve life-support payment for a cost period.
   * Default keeps existing behavior: choose credits or consume eligible bulk supplies.
   * @param {import('./TraderApp.js').TraderApp} app
   * @param {import('./TraderState.js').TraderState} state
   * @param {{lifeSupportCost:number, tonsNeeded:number, normalSupplies?:object, luxurySupplies?:object}} context
   * @returns {Promise<{actualLifeSupportCost:number}>}
   */
  async resolveLifeSupportPayment(app, state, context) {
    const lifeSupportCost = Number(context?.lifeSupportCost) || 0;
    const tonsNeeded = Number(context?.tonsNeeded) || 0;
    const normalSupplies = context?.normalSupplies;
    const luxurySupplies = context?.luxurySupplies;
    let actualLifeSupportCost = lifeSupportCost;

    if (tonsNeeded > 0 && (normalSupplies || luxurySupplies)) {
      const lsOptions = [
        { value: 'credits', label: game.i18n.format('TWODSIX.Trader.Prompts.LifeSupportPayCredits', { cost: lifeSupportCost.toLocaleString() }) },
      ];
      if (normalSupplies) {
        lsOptions.push({
          value: 'normal',
          label: game.i18n.format('TWODSIX.Trader.Prompts.LifeSupportUseNormalBulk', { tons: tonsNeeded, available: normalSupplies.tons }),
        });
      }
      if (luxurySupplies) {
        lsOptions.push({
          value: 'luxury',
          label: game.i18n.format('TWODSIX.Trader.Prompts.LifeSupportUseLuxuryBulk', { tons: tonsNeeded, available: luxurySupplies.tons }),
        });
      }

      const lsChoice = await app._choose(
        game.i18n.localize('TWODSIX.Trader.Prompts.LifeSupportOptions'),
        lsOptions,
      );

      if (lsChoice === 'normal' || lsChoice === 'luxury') {
        const supplies = lsChoice === 'normal' ? normalSupplies : luxurySupplies;
        supplies.tons = Math.max(0, supplies.tons - tonsNeeded);
        if (supplies.tons < 0.001) {
          state.cargo.splice(state.cargo.indexOf(supplies), 1);
        }
        actualLifeSupportCost = 0;
        await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.UsedBulkSupplies', {
          tons: tonsNeeded,
          type: lsChoice,
        }));
      }
    }
    return { actualLifeSupportCost };
  }

  /**
   * Insolvency handling policy.
   * @param {import('./TraderState.js').TraderState} _state
   * @returns {{forceFreightPayout: boolean, forceCargoLiquidation: boolean, requireDocked: boolean}}
   */
  getInsolvencyPolicy(_state) {
    return {
      forceFreightPayout: true,
      forceCargoLiquidation: true,
      requireDocked: true,
    };
  }

  // ─── CDEE Hooks (No-ops in base) ──────────────────────────────────────────

  /** @returns {boolean} */
  shouldCheckSmuggling(cargo, world) {
    return false;
  }

  /** @returns {Promise<void>} */
  async doSmugglingCheck(app, world) {
    // No-op
  }

  /** @returns {boolean} */
  shouldRollCargoTag() {
    return false;
  }

  /** @returns {Promise<void>} */
  async rollCargoTag(app) {
    // No-op
  }

  /** @returns {boolean} */
  shouldRollProblemWithDeal() {
    return false;
  }

  /** @returns {Promise<void>} */
  async rollProblemWithDeal(app) {
    // No-op
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  /**
   * Get the names of skills relevant to this ruleset.
   * @returns {string[]}
   */
  getRelevantSkillNames() {
    return ['Broker', 'Streetwise', 'Computers'];
  }

  /**
   * Get the best crew member for a named skill and their skill level.
   * @param {object[]} crew - Crew skills summary (from state.crew)
   * @param {string} skillName - Skill name
   * @returns {{member: object, skill: number}|null} Best crew member + skill, or null if crew is empty
   */
  getBestCrewMemberForSkill(crew, skillName) {
    if (!Array.isArray(crew) || crew.length === 0) {
      return null;
    }
    const skillKey = skillName.toLowerCase();
    let bestMember = null;
    let bestVal = -Infinity;
    for (const c of crew) {
      const val = c.skills?.[skillKey] ?? this._getLegacySkillValue(c, skillKey) ?? -3;
      if (val > bestVal) {
        bestVal = val;
        bestMember = c;
      }
    }
    return bestMember ? { member: bestMember, skill: bestVal } : null;
  }

  /**
   * Get the best crew skill level by name.
   * @param {object[]} crew - Crew skills summary (from state.crew)
   * @param {string} skillName - Skill name
   * @returns {number} Highest skill level or UNSKILLED_PENALTY
   */
  getCrewSkill(crew, skillName) {
    const result = this.getBestCrewMemberForSkill(crew, skillName);
    return result ? result.skill : -3;
  }

  /**
   * Resolve the linked actor for a crew member.
   * @param {object|undefined} crewMember - A single crew member object
   * @returns {import('../../entities/TwodsixActor').default|null}
   */
  _getCrewActor(crewMember) {
    if (!crewMember?.actorId) {
      return null;
    }
    return game.actors?.get(crewMember.actorId) ?? null;
  }

  /**
   * Resolve the characteristic modifier for a crew member from their linked actor.
   * Returns 0 if the crew member has no linked actor or the characteristic is unavailable.
   * @param {object|undefined} crewMember - A single crew member object
   * @param {string} charKey - The characteristic key (e.g. 'intelligence', 'socialStanding')
   * @returns {number}
   */
  _getCharacteristicDM(crewMember, charKey) {
    const actor = this._getCrewActor(crewMember);
    return actor?.system?.characteristics?.[charKey]?.mod ?? 0;
  }

  /** @private */
  _getLegacySkillValue(crewMember, skillKey) {
    switch (skillKey) {
      case 'broker': return crewMember.brokerSkill;
      case 'streetwise': return crewMember.streetwiseSkill;
      case 'computers': return crewMember.computersSkill;
      default: return undefined;
    }
  }
}
