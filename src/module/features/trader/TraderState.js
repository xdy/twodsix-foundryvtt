/**
 * TraderState.js
 * State definition and factory for the trading journey.
 */

import {
  DAYS_PER_YEAR,
  DEFAULT_MERCHANT_TRADER,
  HOURS_PER_DAY,
  MILIEU_BASE_YEAR,
  UNSKILLED_PENALTY,
} from './TraderConstants.js';
import { getTraderRuleset } from './TraderRulesetRegistry.js';
import { getWorldCoordinate } from './TraderUtils.js';

// Journey phases
export const PHASE = {
  AT_WORLD: 'AT_WORLD',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVING: 'ARRIVING',
};

// Journey outcomes
export const OUTCOME = {
  PAID_OFF: 'PAID_OFF',
  BANKRUPT: 'BANKRUPT',
};

export const TRADER_STATE_VERSION = 1;

/**
 * @typedef {object} SectorCoordinates
 * @property {number} [x] - Sector X coordinate (alias of sx)
 * @property {number} [y] - Sector Y coordinate (alias of sy)
 * @property {number} [sx] - Sector X coordinate
 * @property {number} [sy] - Sector Y coordinate
 */

/**
 * @typedef {object} Sector
 * @property {string} name - Sector display name
 * @property {number} sx - Sector X coordinate
 * @property {number} sy - Sector Y coordinate
 * @property {number} [x] - Alias of sx
 * @property {number} [y] - Alias of sy
 * @property {string} [Milieu] - Milieu identifier from TravellerMap
 */

/**
 * @typedef {object} Subsector
 * @property {string} letter - Subsector letter A–P
 * @property {string} name - Subsector display name
 */

/**
 * @typedef {object} SubsectorSearchEntry
 * @property {string} sectorName - Sector containing the subsector
 * @property {number} sx - Sector X coordinate
 * @property {number} sy - Sector Y coordinate
 * @property {number} subX - Subsector X index 0–3 within the sector
 * @property {number} subY - Subsector Y index 0–3 within the sector
 */

/**
 * @typedef {object} WorldData
 * @property {string} name - World name
 * @property {string} hex - Local hex coordinate "XXYY"
 * @property {string} [globalHex] - Global hex coordinate "X,Y"
 * @property {string} sectorName - Sector containing this world
 * @property {string} uwp - Universal World Profile string
 * @property {string} starport - Starport class
 * @property {string} size - Size code
 * @property {string} atmosphere - Atmosphere code
 * @property {string} hydrographics - Hydrographics code
 * @property {string} population - Population code
 * @property {string} government - Government code
 * @property {string} lawLevel - Law level code
 * @property {string} techLevel - Tech level code
 * @property {string[]} tradeCodes - Trade code remarks
 * @property {string} travelZone - Travel zone (Green/Amber/Red)
 * @property {string} bases - Base codes string (e.g. "NS")
 * @property {number} populationModifier - PBG population multiplier digit
 * @property {number} numPlanetoidBelts - PBG belts digit
 * @property {number} numGasGiants - PBG gas giants digit
 * @property {string[]} features - Derived feature tags
 * @property {string} allegiance - Allegiance code
 * @property {string} [subsectorKey] - Cache key tag
 * @property {boolean} [isVisited] - Whether the trader has visited
 * @property {number} [maxJumpVisited] - Highest jump rating used to visit
 */

/**
 * @typedef {object} CargoItem
 * @property {string} [cargoId] - Stable cargo identifier for system-defined goods
 * @property {string} name - Trade good name
 * @property {number} tons - Tons of cargo
 * @property {number} purchasePricePerTon - Purchase price per ton in credits
 * @property {string} purchaseWorld - World where the cargo was purchased
 */

/**
 * @typedef {object} SetupResult
 * @property {string} sectorName - Selected sector name
 * @property {string} subsectorLetter - Selected subsector letter
 * @property {string} subsectorName - Selected subsector name
 * @property {string} startHex - Starting world hex
 * @property {string} milieu - Milieu identifier
 * @property {string} [ruleset] - Selected trader ruleset
 * @property {string} [shipActorId] - Optional ship Actor id
 * @property {string} [cacheJournalName] - Cache journal name
 * @property {number} [startingCredits] - Starting credits override
 * @property {string} [worldSource] - 'travellermap' or 'local'
 * @property {string} [rootFolderId] - Root folder ID for local mode
 * @property {string} [startWorldId] - Starting world actor ID for local mode
 */

/**
 * @typedef {object} GameDate
 * @property {number} year - Current game year
 * @property {number} day - Current game day (1-based within the year)
 * @property {number} [hour] - Fractional hour within the day (0-23.99); undefined treated as 0
 */

/**
 * @typedef {object} CrewMember
 * @property {string} name - Crew member name
 * @property {string} position - Crew member position
 * @property {number} salary - Monthly salary in credits
 * @property {string} [actorId] - Optional linked actor ID
 * @property {number} [brokerSkill] - Broker skill level
 * @property {number} [streetwiseSkill] - Streetwise skill level
 * @property {number} [computersSkill] - Computers skill level
 * @property {Object<string, number>} [skills] - Generic skills map
 */

/**
 * @typedef {object} WorldVisitCacheEntry
 * @property {number} arrivalDay - Absolute day number when the ship arrived at the world
 * @property {number} portFeesPaidDays - Number of days for which port fees have already been paid
 * @property {{high: number, middle: number, steerage?: number, low: number}|null} passengers - Booked passengers for the current visit (null = not yet rolled)
 * @property {number|null} freight - Tons of freight available for the current visit (null = not yet rolled)
 * @property {object|null} tradeInfo - Cache of available trade goods and their quantities
 * @property {boolean} mailChecked - Whether the trader has checked for mail at this port
 * @property {boolean} privateMessagesTaken - Whether private messages have been taken at this port
 * @property {boolean} privateMessageAccepted - Whether a private message delivery was accepted
 * @property {number} privateMessageCredits - Credits awarded for carrying a private message
 * @property {boolean} foundSupplier - Whether a standard supplier has been found
 * @property {boolean} foundBuyer - Whether a standard buyer has been found
 * @property {boolean} foundBlackMarketSupplier - Whether a black market supplier has been found
 * @property {boolean} foundBlackMarketBuyer - Whether a black market buyer has been found
 * @property {boolean} foundOnlineSupplier - Whether an online supplier has been found
 * @property {boolean} foundPrivateSupplier - Whether a private supplier has been found
 * @property {boolean} foundPrivateBuyer - Whether a private buyer has been found
 * @property {number} searchAttempts - Total number of search attempts made at this port
 * @property {number} lastSearchMonth - Month number of the last search attempt
 * @property {number} priceRejectedUntil - Absolute day number until which prices are frozen (price rejection cooldown)
 * @property {boolean} noGoodsAvailable - Whether the supplier has no goods available
 * @property {boolean} illegalSalesBlocked - Whether illegal cargo cannot be sold at this world
 */

/**
 * @typedef {object} TraderState
 * @property {string} currentWorldHex - Current world location hex string
 * @property {string} currentWorldName - Current world location name
 * @property {string} subsectorName - Current subsector name
 * @property {string} sectorName - Current sector name
 * @property {string} milieu - Milieu identifier (e.g. 'M1105')
 * @property {string} ruleset - Trader ruleset key (e.g. 'CE')
 * @property {string} worldSource - World data source ('travellermap' or 'local')
 * @property {string|null} rootFolderId - Root folder ID for local mode
 * @property {GameDate} gameDate - Current game date
 * @property {string} phase - Current journey phase (from PHASE enum)
 * @property {number} credits - Current cash on hand
 * @property {number} totalRevenue - Cumulative revenue earned
 * @property {number} totalExpenses - Cumulative expenses paid
 * @property {number} mortgageRemaining - Remaining mortgage balance
 * @property {number} monthlyPayment - Calculated monthly ship payment
 * @property {number} monthsPaid - Total number of mortgage payments made
 * @property {number} lastPaidMonth - Month number of last cost accrual
 * @property {number} lastRunwayWarningMonth - Last paid month that emitted runway warning
 * @property {{currentFuel: number, fuelIsRefined: boolean, fuelCapacity: number, shipCostMcr: number, staterooms: number, lowBerths: number, cargoCapacity: number}} ship - Ship stats and current state
 * @property {CrewMember[]} crew - Current crew list
 * @property {CargoItem[]} cargo - Current cargo inventory
 * @property {{high: number, middle: number, steerage: number, low: number}} passengers - Booked passengers for current trip
 * @property {number} freight - Tons of freight for current trip
 * @property {Array<{tons:number, rate:number, kind?:string}>} freightLots - Freight lots booked for current trip
 * @property {boolean} hasMail - Whether mail is being carried
 * @property {number} mailContainers - Number of mail containers accepted
 * @property {number} mailPaymentPerContainer - Payment per accepted mail container
 * @property {string} destinationHex - Destination hex string for current trip
 * @property {string} destinationGlobalHex - Destination global hex coordinate for current trip
 * @property {string} destinationName - Destination name for current trip
 * @property {import('../../entities/actors/WorldActor').default[]} worlds - Subsector world actors
 * @property {Object<string, WorldVisitCacheEntry>} worldVisitCache - Per-world visit state cache
 * @property {number} lastRollDay - Absolute day of last passenger/freight roll
 * @property {boolean} chartered - Whether ship is currently chartered
 * @property {number} charterCargo - Tons of cargo space used by charter
 * @property {number} charterStaterooms - Number of staterooms used by charter
 * @property {number} charterLowBerths - Number of low berths used by charter
 * @property {number|null} charterExpiryDay - Absolute day when charter expires
 * @property {boolean} useLocalBroker - Whether to use a local broker
 * @property {number} localBrokerSkill - Skill level of local broker
 * @property {boolean} localBrokerIllegal - Whether hired broker is the illegal/Streetwise broker
 * @property {string|null} journalEntryId - Linked journal entry ID
 * @property {string|null} journalPageId - Linked journal page ID
 * @property {string|null} cacheJournalName - Name of the TravellerMap cache journal
 * @property {Sector[]} sectors - Milieu sector list
 * @property {string[]} loadedSubsectorKeys - Keys of currently loaded subsectors
 * @property {number} maintenanceMonthsSkipped - Months since last maintenance
 * @property {boolean} includeIllegalGoods - Whether illegal goods are available
 * @property {boolean} gameOver - Whether journey has ended
 * @property {string|null} outcome - Final journey outcome (from OUTCOME enum)
 */

/**
 * Updates mortgage-related fields in the state based on current ship cost.
 * @param {TraderState} state - The trader state to update
 */
export function updateMortgageFromShip(state) {
  if (!state.ship) {
    return;
  }
  const cost = (Number(state.ship.shipCostMcr) || 0) * 1000000;
  const ruleset = getTraderRuleset(state.ruleset);
  state.monthlyPayment = Math.ceil(cost / ruleset.getMortgageDivisor());
  state.mortgageRemaining = cost * ruleset.getMortgageFinancingMultiplier();
}

/**
 * Create a fresh trading journey state.
 * @returns {TraderState} Initial trading journey state
 */
export function freshTraderState() {
  const ship = { ...DEFAULT_MERCHANT_TRADER };
  const ceRuleset = getTraderRuleset('CE');
  const monthlyPayment = Math.ceil(ship.shipCostMcr * 1000000 / ceRuleset.getMortgageDivisor());

  return {
    _schemaVersion: TRADER_STATE_VERSION,
    // Location & time
    currentWorldHex: '',
    currentWorldName: '',
    subsectorName: '',
    sectorName: '',
    milieu: 'M1105',
    ruleset: 'CE',
    gameDate: { year: 1105, day: 1, hour: 0 },
    phase: PHASE.AT_WORLD,
    worldSource: 'travellermap',
    rootFolderId: null,

    // Finances
    credits: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    mortgageRemaining: ship.shipCostMcr * 1000000 * ceRuleset.getMortgageFinancingMultiplier(),
    monthlyPayment,
    monthsPaid: 0,
    lastPaidMonth: 1, // month number of last cost accrual (start at month 1 to avoid charging immediately)
    lastRunwayWarningMonth: 0,

    // Ship
    ship: {
      ...ship,
      currentFuel: ship.fuelCapacity,
      fuelIsRefined: true,
    },

    // Crew: [{name, position, salary, actorId?, brokerSkill?}]
    crew: [],

    // Cargo: [{name, tons, purchasePricePerTon, purchaseWorld}]
    cargo: [],

    // Booked for current trip
    passengers: { high: 0, middle: 0, steerage: 0, low: 0 },
    freight: 0,
    freightLots: [],
    hasMail: false,
    mailContainers: 0,
    mailPaymentPerContainer: 0,

    // Destination for current trip (set when departing)
    destinationHex: '',
    destinationGlobalHex: '',
    destinationName: '',

    // Subsector worlds
    /** @type {Actor[]} */
    worlds: [],

    // Per-world-visit cache: keyed by hex.
    // Rolls are fixed for the duration of a visit and only cleared on arrival at a new world.
    // { [hex]: { passengers: {high,middle,steerage,low}|null, freight: number|null,
    //            tradeInfo: object|null, mailChecked: boolean, privateMessageAccepted: boolean,
    //            privateMessageCredits: number } }
    worldVisitCache: {},

    // Long-lived per-world history (survives leaving and returning).
    // { [hex]: { searchAttempts: number, lastSearchMonth: number } }
    worldHistory: {},

    // Day number when freight/passengers were last rolled (for reroll logic)
    lastRollDay: 1,

    // Charter state
    chartered: false,
    charterCargo: 0,           // tons of cargo occupied by charter
    charterStaterooms: 0,     // number of staterooms occupied by charter
    charterLowBerths: 0,      // number of low berths occupied by charter
    charterExpiryDay: null,    // absolute game day when charter ends (2 weeks after acceptance)

    // Broker state
    useLocalBroker: false,
    localBrokerSkill: 0,
    localBrokerIllegal: false,

    // Journal
    journalEntryId: null,
    journalPageId: null,
    cacheJournalName: null,

    // Loaded data cache
    sectors: [],               // list of all sectors in milieu
    // Subsector cache keys for which world data actually exists (central load, actor flags, background load).
    // Not the full 3x3 grid of interest — that list lives only during setup in getNeighboringSubsectors.
    loadedSubsectorKeys: [],   // e.g. ["M1105_Spinward Marches_C", ...]

    // Maintenance tracking
    maintenanceMonthsSkipped: 0,

    // Illegal goods
    includeIllegalGoods: false,

    // End conditions
    gameOver: false,
    outcome: null,
  };
}

/**
 * Serialize state for persistence in Journal flags.
 * Keeps references minimal and versioned.
 * @param {TraderState} state
 * @returns {object}
 */
export function serializeTraderState(state) {
  const snapshot = foundry.utils.deepClone(state ?? freshTraderState());
  snapshot._schemaVersion = TRADER_STATE_VERSION;
  snapshot.worlds = (snapshot.worlds ?? []).map(w => ({ id: w?.id ?? w?._id })).filter(w => !!w.id);
  return snapshot;
}

/**
 * Deserialize persisted state into a normalized runtime shape.
 * @param {object} saved
 * @returns {TraderState}
 */
export function deserializeTraderState(saved) {
  const base = freshTraderState();
  const merged = foundry.utils.mergeObject(base, foundry.utils.deepClone(saved ?? {}), {
    inplace: false,
    insertKeys: true,
    overwrite: true,
  });
  merged._schemaVersion = TRADER_STATE_VERSION;
  merged.passengers = normalizePassengers(merged.passengers);
  normalizeFreightState(merged);
  // Normalize cargo isIllegal to boolean for older serialized state.
  if (Array.isArray(merged.cargo)) {
    merged.cargo = merged.cargo.map(c => ({
      ...c,
      isIllegal: !!c.isIllegal,
    }));
  }
  return merged;
}

/**
 * Normalize a passenger count object to the current shape.
 * @param {object} passengers
 * @returns {{high: number, middle: number, steerage: number, low: number}}
 */
export function normalizePassengers(passengers = {}) {
  return {
    high: Math.max(0, passengers.high || 0),
    middle: Math.max(0, passengers.middle || 0),
    steerage: Math.max(0, passengers.steerage || 0),
    low: Math.max(0, passengers.low || 0),
  };
}

/**
 * Normalize freight lots to valid tonnage entries.
 * @param {Array<{tons:number, rate:number, kind?:string}>} freightLots
 * @returns {Array<{tons:number, rate:number, kind?:string}>}
 */
export function normalizeFreightLots(freightLots = []) {
  if (!Array.isArray(freightLots)) {
    return [];
  }
  return freightLots
    .map(lot => ({
      tons: Math.max(0, Number(lot?.tons) || 0),
      rate: Math.max(0, Number(lot?.rate) || 0),
      kind: lot?.kind,
    }))
    .filter(lot => lot.tons > 0);
}

/**
 * Keep scalar freight and lot freight in sync.
 * If lots exist, scalar reflects lot sum. If not, scalar is clamped.
 * @param {TraderState} state
 */
export function normalizeFreightState(state) {
  state.freightLots = normalizeFreightLots(state.freightLots);
  if (state.freightLots.length > 0) {
    state.freight = state.freightLots.reduce((sum, lot) => sum + lot.tons, 0);
    return;
  }
  state.freight = Math.max(0, Number(state.freight) || 0);
}

/**
 * Calculate how many staterooms are occupied by passengers.
 * Steerage travels double-occupancy under CEL.
 * @param {object} passengers
 * @returns {number}
 */
export function getPassengerStateroomUsage(passengers = {}) {
  const p = normalizePassengers(passengers);
  return p.high + p.middle + Math.ceil(p.steerage / 2);
}

/**
 * Calculate total passenger headcount.
 * @param {object} passengers
 * @returns {number}
 */
export function getTotalPassengers(passengers = {}) {
  const p = normalizePassengers(passengers);
  return p.high + p.middle + p.steerage + p.low;
}

/**
 * Get the current world data from state.
 * @param {TraderState} state - Trade state
 * @returns {import('../../../foundry/common/abstract/document.mjs').Actor|undefined} World Actor for current location
 */
export function getCurrentWorld(state) {
  return state.worlds.find(w => {
    const hex = getWorldCoordinate(w);
    return hex === state.currentWorldHex;
  });
}

/**
 * Calculate used cargo space from cargo + freight + mail + passenger overhead.
 * @param {TraderState} state - Trade state
 * @returns {number} Tons of cargo space in use
 */
export function getUsedCargoSpace(state) {
  const cargoTons = state.cargo.reduce((sum, c) => sum + c.tons, 0);
  const mailTons = (state.hasMail ? Math.max(1, Number(state.mailContainers) || 1) : 0) * 5;
  const passengerOverhead = getTraderRuleset(state.ruleset)
    .getPassengerCargoOverhead(state.passengers, state.ship);
  return cargoTons + state.freight + mailTons + (state.charterCargo || 0) + passengerOverhead;
}

/**
 * Calculate available cargo space.
 * @param {TraderState} state - Trade state
 * @returns {number} Tons of free cargo space
 */
export function getFreeCargoSpace(state) {
  return state.ship.cargoCapacity - getUsedCargoSpace(state);
}

/**
 * Calculate free staterooms (accounting for crew, passengers, and charter).
 * @param {TraderState} state - Trade state
 * @returns {number} Number of free staterooms
 */
export function getFreeStaterooms(state) {
  return Math.max(0, state.ship.staterooms - state.crew.length
    - getPassengerStateroomUsage(state.passengers) - (state.charterStaterooms || 0));
}

/**
 * Calculate free low berths (accounting for passengers and charter).
 * @param {TraderState} state - Trade state
 * @returns {number} Number of free low berths
 */
export function getFreeLowBerths(state) {
  return Math.max(0, state.ship.lowBerths - normalizePassengers(state.passengers).low - (state.charterLowBerths || 0));
}

/**
 * Get the base year for a milieu code.
 * @param {string} milieu - Milieu code (e.g. 'M1105')
 * @returns {number} Base year for the milieu
 */
export function getMilieuBaseYear(milieu) {
  return MILIEU_BASE_YEAR[milieu] ?? 1105;
}

/**
 * Calculate the game month number from a game date.
 * @param {GameDate} gameDate - The game date
 * @param {string} [milieu='M1105'] - Milieu code for base year lookup
 * @returns {number} Absolute month number (for cost accrual tracking)
 */
export function getMonthNumber(gameDate, milieu = 'M1105') {
  return (gameDate.year - getMilieuBaseYear(milieu)) * 12 + Math.ceil(gameDate.day / 30);
}

/**
 * Calculate the absolute day number from a game date.
 * @param {GameDate} gameDate - The game date
 * @param {string} [milieu='M1105'] - Milieu code for base year lookup
 * @returns {number} Absolute day number (for tracking days since last roll)
 */
export function getAbsoluteDay(gameDate, milieu = 'M1105') {
  return (gameDate.year - getMilieuBaseYear(milieu)) * DAYS_PER_YEAR + gameDate.day;
}

/**
 * Cost-accrual period number (mortgage/life-support/maintenance billing window).
 * Length of a period is ruleset-controlled (CE-family: 30 days)
 * Maintenance Period — see `BaseTraderRuleset.getCostPeriodDays`).
 * @param {TraderState} state
 * @returns {number} 1-based period count since the milieu's base year
 */
export function getCostPeriodNumber(state) {
  const periodDays = Math.max(1, getTraderRuleset(state.ruleset).getCostPeriodDays());
  const day = getAbsoluteDay(state.gameDate, state.milieu);
  return Math.ceil(day / periodDays);
}

/**
 * Calculate total monthly crew salaries.
 * @param {CrewMember[]} crew - Crew array from state
 * @returns {number} Total monthly salary cost
 */
export function getTotalCrewSalary(crew) {
  return crew.reduce((sum, c) => sum + (c.salary || 0), 0);
}

/**
 * Add revenue and update bookkeeping.
 * @param {TraderState} state - Trade state
 * @param {number} amount - Revenue amount in credits
 * @returns {number} Applied amount
 */
export function addRevenue(state, amount) {
  const applied = Math.max(0, Number(amount) || 0);
  state.credits += applied;
  state.totalRevenue += applied;
  return applied;
}

/**
 * Remove previously counted revenue and adjust credits/bookkeeping.
 * @param {TraderState} state - Trade state
 * @param {number} amount - Revenue amount to remove
 * @returns {number} Applied amount
 */
export function subtractRevenue(state, amount) {
  const applied = Math.max(0, Number(amount) || 0);
  state.credits -= applied;
  state.totalRevenue -= applied;
  return applied;
}

/**
 * Add expense and update bookkeeping.
 * @param {TraderState} state - Trade state
 * @param {number} amount - Expense amount in credits
 * @returns {number} Applied amount
 */
export function addExpense(state, amount) {
  const applied = Math.max(0, Number(amount) || 0);
  state.credits -= applied;
  state.totalExpenses += applied;
  return applied;
}

/**
 * Get the best broker skill among crew members.
 * @param {CrewMember[]} crew - Crew array from state
 * @returns {number} Highest broker skill level, or UNSKILLED_PENALTY if none
 */
export function getCrewBrokerSkill(crew) {
  return getCrewSkill(crew, 'Broker');
}


/**
 * Get the best streetwise skill among crew members.
 * @param {CrewMember[]} crew - Crew array from state
 * @returns {number} Highest streetwise skill level
 */
export function getCrewStreetwiseSkill(crew) {
  return getCrewSkill(crew, 'Streetwise');
}

/**
 * Get the best computers skill among crew members.
 * @param {CrewMember[]} crew - Crew array from state
 * @returns {number} Highest computers skill level
 */
export function getCrewComputersSkill(crew) {
  return getCrewSkill(crew, 'Computers');
}

/**
 * Get the best skill level for a named skill among crew members.
 * @param {CrewMember[]} crew - Crew array from state
 * @param {string} skillName - Skill name
 * @returns {number} Highest skill level, or UNSKILLED_PENALTY if none
 */
export function getCrewSkill(crew, skillName) {
  const skillKey = skillName.toLowerCase();
  return crew.reduce((best, c) => {
    const val = c.skills?.[skillKey] ?? _getLegacySkillValue(c, skillKey);
    return Math.max(best, val ?? UNSKILLED_PENALTY);
  }, UNSKILLED_PENALTY);
}

/** @private */
function _getLegacySkillValue(crewMember, skillKey) {
  switch (skillKey) {
    case 'broker': return crewMember.brokerSkill;
    case 'streetwise': return crewMember.streetwiseSkill;
    case 'computers': return crewMember.computersSkill;
    default: return undefined;
  }
}

/**
 * Get (or create) the cache entry for the current world hex.
 * @param {TraderState} state - Trade state
 * @returns {WorldVisitCacheEntry} Cache entry for current world
 */
export function getWorldCache(state) {
  const hex = state.currentWorldHex;
  if (!state.worldVisitCache[hex]) {
    const ruleset = getTraderRuleset(state.ruleset);
    state.worldVisitCache[hex] = {
      arrivalDay: getAbsoluteDay(state.gameDate, state.milieu),
      portFeesPaidDays: ruleset.getInitialPortFeeDaysPaid(),
      passengers: null,   // null = not yet rolled this visit
      freight: null,
      freightLots: null,
      tradeInfo: null,
      mailChecked: false,
      privateMessagesTaken: false,
      privateMessageAccepted: false,
      privateMessageCredits: 0,
      foundSupplier: false,
      foundBuyer: false,
      foundBlackMarketSupplier: false,
      foundBlackMarketBuyer: false,
      foundOnlineSupplier: false,
      foundPrivateSupplier: false,
      foundPrivateBuyer: false,
      searchAttempts: 0,
      lastSearchMonth: getMonthNumber(state.gameDate, state.milieu),
      priceRejectedUntil: 0,
      noGoodsAvailable: false,
      illegalSalesBlocked: false,
    };
    // Restore preserved per-world cumulative fields (search-attempt history, etc.)
    const history = state.worldHistory?.[hex];
    if (history) {
      const currentMonth = getMonthNumber(state.gameDate, state.milieu);
      if (history.lastSearchMonth === currentMonth) {
        state.worldVisitCache[hex].searchAttempts = Number(history.searchAttempts) || 0;
        state.worldVisitCache[hex].lastSearchMonth = history.lastSearchMonth;
      }
    }
  }
  return state.worldVisitCache[hex];
}

/**
 * Persist long-lived per-world fields (e.g. search-attempt history) so that
 * cumulative penalties survive leaving and returning to the same world in
 * the same month
 * @param {TraderState} state
 */
export function persistWorldHistory(state) {
  if (!state.worldHistory) {
    state.worldHistory = {};
  }
  const hex = state.currentWorldHex;
  const cache = state.worldVisitCache?.[hex];
  if (!hex || !cache) {
    return;
  }
  state.worldHistory[hex] = {
    searchAttempts: Number(cache.searchAttempts) || 0,
    lastSearchMonth: Number(cache.lastSearchMonth) || 0,
  };
}

/**
 * Format a game date as a string.
 * @param {GameDate} gameDate - The game date
 * @returns {string} e.g. "Day 45, 1105"
 */
export function formatGameDate(gameDate) {
  return `Day ${gameDate.day}, ${gameDate.year}`;
}

/**
 * Advance game date by a number of hours.
 * Accumulates fractional hours within the day (`gameDate.hour`) and only
 * carries to the day counter when the running total reaches a full 24h.
 * This avoids the historical drift caused by `Math.ceil` rounding every
 * sub-day advance up to a full day (which produced calendars several days
 * ahead of the displayed elapsed time after a jump + transit).
 * @param {GameDate} gameDate - The game date — mutated in place
 * @param {number} hours - Hours to advance (may be fractional)
 */
export function advanceDate(gameDate, hours) {
  const accumulated = (Number(gameDate.hour) || 0) + Math.max(0, Number(hours) || 0);
  const dayShift = Math.floor(accumulated / HOURS_PER_DAY);
  gameDate.hour = accumulated - dayShift * HOURS_PER_DAY;
  gameDate.day += dayShift;
  while (gameDate.day > DAYS_PER_YEAR) {
    gameDate.day -= DAYS_PER_YEAR;
    gameDate.year += 1;
  }
}
