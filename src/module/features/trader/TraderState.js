/**
 * TraderState.js
 * State definition and factory for the trading journey.
 */

import {
  DAYS_PER_YEAR,
  DEFAULT_MERCHANT_TRADER,
  HOURS_PER_DAY,
  MORTGAGE_DIVISOR,
  PORT_FEE_DAYS,
  UNSKILLED_PENALTY,
} from './TraderConstants.js';
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
 * @property {string} [shipActorId] - Optional ship Actor id
 * @property {string} [cacheJournalName] - Cache journal name
 * @property {string} [journalName] - Trade journal name
 * @property {number} [startingCredits] - Starting credits override
 */

/**
 * @typedef {object} GameDate
 * @property {number} year - Current game year
 * @property {number} day - Current game day
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
 */

/**
 * @typedef {object} WorldVisitCacheEntry
 * @property {number} arrivalDay - Absolute day number when the ship arrived at the world
 * @property {number} portFeesPaidDays - Number of days for which port fees have already been paid
 * @property {{high: number, middle: number, low: number}|null} passengers - Booked passengers for the current visit (null = not yet rolled)
 * @property {number|null} freight - Tons of freight available for the current visit (null = not yet rolled)
 * @property {object|null} tradeInfo - Cache of available trade goods and their quantities
 * @property {boolean} mailChecked - Whether the trader has checked for mail at this port
 * @property {boolean} privateMessagesTaken - Whether private messages have been taken at this port
 * @property {boolean} privateMessageAccepted - Whether a private message delivery was accepted
 * @property {number} privateMessageCredits - Credits awarded for carrying a private message
 * @property {boolean} foundSupplier - Whether a standard supplier has been found
 * @property {boolean} foundBuyer - Whether a standard buyer has been found
 * @property {boolean} foundBlackMarketSupplier - Whether a black market supplier has been found
 * @property {boolean} foundOnlineSupplier - Whether an online supplier has been found
 * @property {number} searchAttempts - Total number of search attempts made at this port
 * @property {number} lastSearchMonth - Month number of the last search attempt
 * @property {number} priceRejectedUntil - Absolute day number until which prices are frozen (price rejection cooldown)
 * @property {boolean} noGoodsAvailable - Whether the supplier has no goods available
 */

/**
 * @typedef {object} TraderState
 * @property {string} currentWorldHex - Current world location hex string
 * @property {string} currentWorldName - Current world location name
 * @property {string} subsectorName - Current subsector name
 * @property {string} sectorName - Current sector name
 * @property {GameDate} gameDate - Current game date
 * @property {string} phase - Current journey phase (from PHASE enum)
 * @property {number} credits - Current cash on hand
 * @property {number} totalRevenue - Cumulative revenue earned
 * @property {number} totalExpenses - Cumulative expenses paid
 * @property {number} mortgageRemaining - Remaining mortgage balance
 * @property {number} monthlyPayment - Calculated monthly ship payment
 * @property {number} monthsPaid - Total number of mortgage payments made
 * @property {number} lastPaidMonth - Month number of last cost accrual
 * @property {{currentFuel: number, fuelIsRefined: boolean, fuelCapacity: number, shipCost: number, staterooms: number, lowBerths: number, cargoCapacity: number}} ship - Ship stats and current state
 * @property {CrewMember[]} crew - Current crew list
 * @property {CargoItem[]} cargo - Current cargo inventory
 * @property {{high: number, middle: number, low: number}} passengers - Booked passengers for current trip
 * @property {number} freight - Tons of freight for current trip
 * @property {boolean} hasMail - Whether mail is being carried
 * @property {string} destinationHex - Destination hex string for current trip
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
 * @property {string|null} journalEntryId - Linked journal entry ID
 * @property {string|null} journalPageId - Linked journal page ID
 * @property {Sector[]} sectors - Milieu sector list
 * @property {string[]} loadedSubsectorKeys - Keys of currently loaded subsectors
 * @property {number} maintenanceMonthsSkipped - Months since last maintenance
 * @property {boolean} includeIllegalGoods - Whether illegal goods are available
 * @property {boolean} gameOver - Whether journey has ended
 * @property {string|null} outcome - Final journey outcome (from OUTCOME enum)
 */

/**
 * Create a fresh trading journey state.
 * @returns {TraderState} Initial trading journey state
 */
export function freshTraderState() {
  const ship = { ...DEFAULT_MERCHANT_TRADER };
  const monthlyPayment = Math.ceil(ship.shipCost / MORTGAGE_DIVISOR);

  return {
    // Location & time
    currentWorldHex: '',
    currentWorldName: '',
    subsectorName: '',
    sectorName: '',
    gameDate: { year: 1105, day: 1 },
    phase: PHASE.AT_WORLD,

    // Finances
    credits: 0,
    totalRevenue: 0,
    totalExpenses: 0,
    mortgageRemaining: ship.shipCost * 2.2, // 220% total financing cost
    monthlyPayment,
    monthsPaid: 0,
    lastPaidMonth: 1, // month number of last cost accrual (start at month 1 to avoid charging immediately)

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
    passengers: { high: 0, middle: 0, low: 0 },
    freight: 0,
    hasMail: false,

    // Destination for current trip (set when departing)
    destinationHex: '',
    destinationName: '',

    // Subsector worlds
    /** @type {Actor[]} */
    worlds: [],

    // Per-world-visit cache: keyed by hex.
    // Rolls are fixed for the duration of a visit and only cleared on arrival at a new world.
    // { [hex]: { passengers: {high,middle,low}|null, freight: number|null,
    //            tradeInfo: object|null, mailChecked: boolean, privateMessageAccepted: boolean,
    //            privateMessageCredits: number } }
    worldVisitCache: {},

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

    // Journal
    journalEntryId: null,
    journalPageId: null,

    // Loaded data cache
    sectors: [],               // list of all sectors in milieu
    loadedSubsectorKeys: [],   // e.g. ["Spinward Marches:C", ...]

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
 * Calculate used cargo space from cargo + freight + mail.
 * @param {TraderState} state - Trade state
 * @returns {number} Tons of cargo space in use
 */
export function getUsedCargoSpace(state) {
  const cargoTons = state.cargo.reduce((sum, c) => sum + c.tons, 0);
  return cargoTons + state.freight + (state.hasMail ? 5 : 0) + (state.charterCargo || 0);
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
    - state.passengers.high - state.passengers.middle - (state.charterStaterooms || 0));
}

/**
 * Calculate free low berths (accounting for passengers and charter).
 * @param {TraderState} state - Trade state
 * @returns {number} Number of free low berths
 */
export function getFreeLowBerths(state) {
  return Math.max(0, state.ship.lowBerths - state.passengers.low - (state.charterLowBerths || 0));
}

/**
 * Calculate the game month number from a game date.
 * @param {GameDate} gameDate - The game date
 * @returns {number} Absolute month number (for cost accrual tracking)
 */
export function getMonthNumber(gameDate) {
  return (gameDate.year - 1105) * 12 + Math.ceil(gameDate.day / 30);
}

/**
 * Calculate the absolute day number from a game date.
 * @param {GameDate} gameDate - The game date
 * @returns {number} Absolute day number (for tracking days since last roll)
 */
export function getAbsoluteDay(gameDate) {
  return (gameDate.year - 1105) * DAYS_PER_YEAR + gameDate.day;
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
 * Get the best broker skill among crew members.
 * @param {CrewMember[]} crew - Crew array from state
 * @returns {number} Highest broker skill level
 */
export function getCrewBrokerSkill(crew) {
  return crew.reduce((best, c) => Math.max(best, c.brokerSkill || 0), 0);
}


/**
 * Get the best streetwise skill among crew members.
 * @param {CrewMember[]} crew - Crew array from state
 * @returns {number} Highest streetwise skill level
 */
export function getCrewStreetwiseSkill(crew) {
  return crew.reduce((best, c) => Math.max(best, c.streetwiseSkill || UNSKILLED_PENALTY), UNSKILLED_PENALTY);
}

/**
 * Get the best computers skill among crew members.
 * @param {CrewMember[]} crew - Crew array from state
 * @returns {number} Highest computers skill level
 */
export function getCrewComputersSkill(crew) {
  return crew.reduce((best, c) => Math.max(best, c.computersSkill || UNSKILLED_PENALTY), UNSKILLED_PENALTY);
}

/**
 * Get (or create) the cache entry for the current world hex.
 * @param {TraderState} state - Trade state
 * @returns {WorldVisitCacheEntry} Cache entry for current world
 */
export function getWorldCache(state) {
  const hex = state.currentWorldHex;
  if (!state.worldVisitCache[hex]) {
    state.worldVisitCache[hex] = {
      arrivalDay: getAbsoluteDay(state.gameDate),
      portFeesPaidDays: PORT_FEE_DAYS,
      passengers: null,   // null = not yet rolled this visit
      freight: null,
      tradeInfo: null,
      mailChecked: false,
      privateMessagesTaken: false,
      privateMessageAccepted: false,
      privateMessageCredits: 0,
      foundSupplier: false,
      foundBuyer: false,
      foundBlackMarketSupplier: false,
      foundOnlineSupplier: false,
      searchAttempts: 0,
      lastSearchMonth: getMonthNumber(state.gameDate),
      priceRejectedUntil: 0,
      noGoodsAvailable: false,
    };
  }
  return state.worldVisitCache[hex];
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
 * @param {GameDate} gameDate - The game date — mutated in place
 * @param {number} hours - Hours to advance
 */
export function advanceDate(gameDate, hours) {
  const days = hours / HOURS_PER_DAY;
  gameDate.day += Math.ceil(days);
  while (gameDate.day > DAYS_PER_YEAR) {
    gameDate.day -= DAYS_PER_YEAR;
    gameDate.year += 1;
  }
}
