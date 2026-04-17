/**
 * TraderConstants.js
 * CE SRD Book 2 numeric values for trading.
 */

// Passenger revenue per jump (Cr)
export const PASSENGER_REVENUE = {
  high: 10000,
  middle: 8000,
  low: 1000,
};

// Passenger availability by starport class (dice formulas)
export const PASSENGER_AVAILABILITY = {
  A: { high: '3D6', middle: '3D6', low: '3D6*3' },
  B: { high: '2D6', middle: '3D6', low: '3D6*3' },
  C: { high: '1D6-1', middle: '2D6', low: '3D6' },
  D: { high: '0', middle: '1D6-1', low: '2D6' },
  E: { high: '0', middle: '1D3-1', low: '1D6-1' },
  X: { high: '0', middle: '0', low: '0' },
};

// Freight rate per ton (Cr)
export const FREIGHT_RATE = 1000;

// Freight availability by starport class (dice formulas, result in tons)
export const FREIGHT_AVAILABILITY = {
  A: '3D6*10',
  B: '3D6*5',
  C: '3D6*2',
  D: '3D6',
  E: '1D6',
  X: '0',
};

// Mail payment per trip (Cr) — requires armed ship + 5 tons cargo space
export const MAIL_PAYMENT = 25000;

// Crew salaries per month (Cr)
export const CREW_SALARIES = {
  captain: 6000,
  pilot: 6000,
  navigator: 5000,
  engineer: 4000,
  steward: 3000,
  purser: 3000,
  medic: 2000,
  gunner: 1000,
  other: 1000,
};

//TODO Make dynamic, get crew positions from ship.
// Minimum crew positions for a merchant trader
export const DEFAULT_CREW = [
  { position: 'captain', salary: CREW_SALARIES.captain },
  { position: 'pilot', salary: CREW_SALARIES.pilot },
  { position: 'navigator', salary: CREW_SALARIES.navigator },
  { position: 'engineer', salary: CREW_SALARIES.engineer },
  { position: 'steward', salary: CREW_SALARIES.steward },
  { position: 'medic', salary: CREW_SALARIES.medic },
];

// Life support costs per month (Cr)
export const LIFE_SUPPORT = {
  stateroom: 2000,
  lowBerth: 100,
};

// Fuel costs per ton (Cr)
export const FUEL_COST = {
  refined: 500,
  unrefined: 100,
};

// Port fees: Cr100 per 6 days
export const PORT_FEE_BASE = 100;
export const PORT_FEE_DAYS = 6;

// Bulk Life Support (CE SRD: 1 ton per 20 people per month)
export const BULK_LS_NORMAL_COST = 54000;
export const BULK_LS_LUXURY_COST = 72000;
export const BULK_LS_CAPACITY = 20;
export const BULK_LS_CARGO_ID = {
  NORMAL: 'bulk_ls_normal',
  LUXURY: 'bulk_ls_luxury',
};

// Maintenance: 0.1% of ship cost per year
export const MAINTENANCE_RATE = 0.001;

// Mortgage: 1/240th of cash price per month, 480 months total, 220% total financing cost
export const MORTGAGE_DIVISOR = 240;
export const MORTGAGE_TOTAL_MONTHS = 480;
export const MORTGAGE_FINANCING_MULTIPLIER = 2.2;

// Default 200-ton Merchant Trader TL9
export const DEFAULT_MERCHANT_TRADER = {
  name: 'Free Trader',
  tonnage: 200,
  jumpRating: 1,
  maneuverRating: 1,
  cargoCapacity: 61,
  fuelCapacity: 30,    // 20 tons jump fuel + 10 tons power plant
  staterooms: 10,
  lowBerths: 20,
  armed: false,
  shipCostMcr: 37.08,
};

// Charter rates (CE SRD: 2-week block pricing)
export const CHARTER_RATE = {
  cargoPerTon: 900,    // Cr900 per ton of cargo hold
  highPassage: 9000,   // Cr9,000 per high passage berth (stateroom)
  lowPassage: 900,     // Cr900 per low passage berth
};

// Starport bonus for finding suppliers (CE SRD)
export const STARPORT_SUPPLIER_BONUS = {
  A: 6,
  B: 4,
  C: 2,
  D: 0,
  E: 0,
  X: 0,
};

// Days per month for cost accrual (simplified Imperial calendar)
export const DAYS_PER_MONTH = 30;
export const DAYS_PER_YEAR = 365;

// If you're in the hole, stop digging: bankruptcy threshold (Cr)
// I.e. if you owe this much when the bank checks, they take the ship.
// Set to 0 as I didn't find a hard number.
export const BANKRUPTCY_LIMIT = 0;

// Initial setup defaults for use with travellermap
export const MILIEUS = [
  { code: 'M1105', name: 'Golden Age (1105)' },
  { code: 'M1900', name: 'The Galaxiad (1900)' },
  { code: 'M1120', name: 'Rebellion (1120)' },
  { code: 'M1201', name: 'The New Era (1201)' },
  { code: 'M1248', name: 'The New Era (1248)' },
  { code: 'IW', name: 'Interstellar Wars' },
  { code: 'M0', name: 'Milieu 0 (0)' },
  { code: 'M600', name: 'Milieu 600' },
  { code: 'M990', name: 'Milieu 990' },
];
export const DEFAULT_MILIEU = 'M1105';
export const TRAVELLERMAP_ROOT_FOLDER_NAME = 'Travellermap Sectors';
export const DEFAULT_SECTOR = 'Spinward Marches';
export const DEFAULT_SUBSECTOR_LETTER = 'C';
export const DEFAULT_SUBSECTOR_NAME = 'Regina';
export const DEFAULT_WORLD_HEX = '1910';
export const DEFAULT_WORLD_NAME = 'Regina';

export const SUBSECTOR_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
  'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
];

// Sector/Subsector dimensions (TravellerMap standard)
export const SUBSECTOR_WIDTH = 8;
export const SUBSECTOR_HEIGHT = 10;
export const SECTOR_WIDTH_IN_SUBSECTORS = 4;
export const SECTOR_HEIGHT_IN_SUBSECTORS = 4;
export const SECTOR_WIDTH_IN_HEXES = 32;  // 8 * 4
export const SECTOR_HEIGHT_IN_HEXES = 40; // 10 * 4

// Trading mechanics
export const CARGO_SALE_PRICE_MULTIPLIER = 0.8;
export const FUEL_SKIM_RATE = 40; // tons per hour
export const FUEL_CHEAT_MULTIPLIER = 10;
export const MAINTENANCE_DAMAGE_THRESHOLD = 8;
export const TRANSIT_BASE_HOURS = 24;
export const HOURS_PER_DAY = 24;
export const MAIL_CONTRACT_THRESHOLD = 7;
export const CHEAT_FREE_FUEL_DAYS = 7;

export const UNSKILLED_PENALTY = -3;

// Base year per milieu — used to compute relative month/day offsets
export const MILIEU_BASE_YEAR = {
  'M1105': 1105,
  'M1900': 1900,
  'M1120': 1120,
  'M1201': 1201,
  'M1248': 1248,
  'IW': -2400,
  'M0': 0,
  'M600': 600,
  'M990': 990,
};

