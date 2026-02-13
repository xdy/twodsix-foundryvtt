// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
/**
 * TradeGenerator.ts
 * Core trade generation logic for 2d6-based systems (Cepheus Engine, etc.)
 * Implements trade good selection, price calculation, and report formatting.
 *
 * @module TradeGenerator
 */


/**
 * Trade Generation System
 * Implements Cepheus Engine SRD Chapter 7: Trade and Commerce
 */

/**
 * Represents a trade good with rolled quantity and calculated prices for a specific trade generation instance.
 */
export interface TradeGoodWithRoll {
  name: string;
  basePrice: number;
  quantityFormula: string;
  rolledQuantity: number; // actual dice roll result
  purchasePriceModPercent: number; // e.g., 80
  purchasePrice: number; // basePrice * modifier%
  salePriceModPercent: number;
  salePrice: number;
  purchaseDM: Record<string, number>;
  saleDM: Record<string, number>;
  illegal?: boolean;
}

/**
 * The result of a trade generation operation, including all goods, prices, and summary info.
 */
export interface TradeGenerationResult {
  goods: TradeGoodWithRoll[];
  saleGoods: TradeGoodSalePrice[];
  commonGoods: CommonGood[];
  commonGoodsRolled: CommonGoodWithRoll[];
  supplierInfo: string;
  brokerInfo: LocalBrokerInfo;
  purchaseSkillCheck: {
    result: number;
    priceModifier: number;
    percentage: number;
  };
  saleSkillCheck: {
    result: number;
    priceModifier: number;
    percentage: number;
  };
}

/**
 * Information about the use of a local broker in trade, including effective skill and commission.
 */
export interface LocalBrokerInfo {
  useLocalBroker: boolean;
  requestedSkill: number;
  effectiveSkill: number;
  commissionPercent: number;
  starportCap: number;
}

/**
 * A trade good definition, including base price, quantity formula, and trade code modifiers.
 */
export interface TradeGood {
  name: string;
  basePrice: number;
  quantity: string; // e.g., "1D6*5", "2D6*5", "4D6"
  purchaseDM: Record<string, number>; // Trade codes and bonuses
  saleDM: Record<string, number>;
  illegal?: boolean;
  unusual?: boolean;
}

/**
 * A common good available on any world, with base price and quantity formula.
 */
export interface CommonGood {
  name: string;
  basePrice: number;
  quantity: string;
}

/**
 * A common good with rolled quantity and calculated prices for a specific trade generation instance.
 */
export interface CommonGoodWithRoll {
  good: CommonGood;
  rolledQuantity: number;
  purchasePrice: number;
  purchasePriceModPercent: number;
  salePrice: number;
  salePriceModPercent: number;
}

/**
 * Sale price information for a trade good, including percent modifier.
 */
export interface TradeGoodSalePrice {
  good: TradeGood;
  salePrice: number;
  salePriceModPercent: number;
}

/**
 * Starport class and its associated trade bonus.
 */
export interface StarportBonus {
  class: string;
  bonus: number;
}



// Common Goods - available on any world
const COMMON_GOODS: CommonGood[] = [
  { name: "TWODSIX.Trade.BasicGoods.ConsumableGoods", basePrice: 1000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.Electronics", basePrice: 25000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.MachineParts", basePrice: 10000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.ManufacturedGoods", basePrice: 20000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.RawMaterials", basePrice: 5000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.UnrefinedOre", basePrice: 2000, quantity: "2D6*5" }
];

// Trade Goods - roll on D66 table
const TRADE_GOODS: TradeGood[] = [
  {
    name: "TWODSIX.Trade.TradeGoods.AdvancedElectronics",
    basePrice: 100000,
    quantity: "1D6*5",
    purchaseDM: { "Ht": 2, "In": 3 },
    saleDM: { "Ni": 2, "Po": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.AdvancedManufacturedGoods",
    basePrice: 200000,
    quantity: "1D6*5",
    purchaseDM: { "In": 3, "Ri": 2 },
    saleDM: { "Ag": 1, "Ni": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.AgriculturalEquipment",
    basePrice: 150000,
    quantity: "1D6",
    purchaseDM: { "In": 3, "Ri": 2 },
    saleDM: { "Ag": 2, "Ga": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.AnimalProducts",
    basePrice: 1500,
    quantity: "4D6*5",
    purchaseDM: { "Ag": 2, "Ga": 3 },
    saleDM: { "Hi": 2, "Ri": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Collectibles",
    basePrice: 50000,
    quantity: "1D6",
    purchaseDM: { "In": 2, "Ri": 3 },
    saleDM: { "Hi": 2, "Ni": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.ComputersAndParts",
    basePrice: 150000,
    quantity: "2D6",
    purchaseDM: { "Ht": 3, "In": 2 },
    saleDM: { "Na": 1, "Ni": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.CrystalsAndGems",
    basePrice: 20000,
    quantity: "1D6*5",
    purchaseDM: { "Ni": 3, "Na": 2 },
    saleDM: { "In": 1, "Ri": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.CyberneticParts",
    basePrice: 250000,
    quantity: "1D6*5",
    purchaseDM: { "Ht": 3, "Ri": 2 },
    saleDM: { "Na": 1, "Ni": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.FoodServiceEquipment",
    basePrice: 4000,
    quantity: "2D6",
    purchaseDM: { "In": 3, "Na": 2 },
    saleDM: { "Ag": 1, "Ni": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Furniture",
    basePrice: 5000,
    quantity: "4D6",
    purchaseDM: { "Ag": 2, "Ga": 3 },
    saleDM: { "Hi": 1, "Ri": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.GamblingDevicesAndEquipment",
    basePrice: 4000,
    quantity: "1D6",
    purchaseDM: { "Hi": 2, "Ri": 3 },
    saleDM: { "Na": 2, "Ni": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.GravVehicles",
    basePrice: 160000,
    quantity: "1D6",
    purchaseDM: { "Ht": 3, "Ri": 2 },
    saleDM: { "Ni": 2, "Po": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.GroceryProducts",
    basePrice: 6000,
    quantity: "1D6*5",
    purchaseDM: { "Ag": 3, "Ga": 2 },
    saleDM: { "Hi": 1, "Ri": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.HouseholdAppliances",
    basePrice: 12000,
    quantity: "4D6",
    purchaseDM: { "Hi": 2, "In": 3 },
    saleDM: { "Na": 1, "Ni": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.IndustrialSupplies",
    basePrice: 75000,
    quantity: "2D6",
    purchaseDM: { "In": 3, "Ri": 2 },
    saleDM: { "Na": 1, "Ni": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.LiquorAndIntoxicants",
    basePrice: 15000,
    quantity: "1D6*5",
    purchaseDM: { "Ag": 3, "Ga": 2 },
    saleDM: { "In": 1, "Ri": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.LuxuryGoods",
    basePrice: 150000,
    quantity: "1D6",
    purchaseDM: { "Ag": 2, "Ga": 3 },
    saleDM: { "In": 1, "Ri": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.ManufacturingEquipment",
    basePrice: 750000,
    quantity: "1D6*5",
    purchaseDM: { "In": 3, "Ri": 2 },
    saleDM: { "Na": 1, "Ni": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.MedicalEquipment",
    basePrice: 50000,
    quantity: "1D6*5",
    purchaseDM: { "Ht": 2, "Ri": 3 },
    saleDM: { "Hi": 1, "In": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Petrochemicals",
    basePrice: 10000,
    quantity: "2D6*5",
    purchaseDM: { "Na": 2, "Ni": 3 },
    saleDM: { "Ag": 1, "In": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Pharmaceuticals",
    basePrice: 100000,
    quantity: "1D6",
    purchaseDM: { "Ht": 3, "Wa": 2 },
    saleDM: { "In": 2, "Ri": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Polymers",
    basePrice: 7000,
    quantity: "4D6*5",
    purchaseDM: { "In": 2, "Ri": 3 },
    saleDM: { "Ni": 2, "Va": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.PreciousMetals",
    basePrice: 50000,
    quantity: "1D6",
    purchaseDM: { "As": 3, "Ic": 2 },
    saleDM: { "In": 1, "Ri": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Radioactives",
    basePrice: 1000000,
    quantity: "1D6",
    purchaseDM: { "As": 2, "Ni": 3 },
    saleDM: { "In": 2, "Ht": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.RobotsAndDrones",
    basePrice: 500000,
    quantity: "1D6*5",
    purchaseDM: { "Ht": 3, "In": 2 },
    saleDM: { "Ni": 1, "Ri": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.ScientificEquipment",
    basePrice: 50000,
    quantity: "1D6*5",
    purchaseDM: { "Ht": 3, "Ri": 2 },
    saleDM: { "Hi": 2, "Ni": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.SurvivalGear",
    basePrice: 4000,
    quantity: "2D6",
    purchaseDM: { "Ga": 3, "Ri": 2 },
    saleDM: { "Fl": 2, "Va": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Textiles",
    basePrice: 3000,
    quantity: "3D6*5",
    purchaseDM: { "Ag": 3, "Ni": 2 },
    saleDM: { "Na": 1, "Ri": 2 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.UncommonRawMaterials",
    basePrice: 50000,
    quantity: "2D6*5",
    purchaseDM: { "Ag": 3, "Ni": 2 },
    saleDM: { "In": 2, "Na": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.UncommonUnrefinedOres",
    basePrice: 20000,
    quantity: "2D6*5",
    purchaseDM: { "As": 2, "Va": 1 },
    saleDM: { "In": 2, "Na": 1 }
  },
  {
    name: "TWODSIX.Trade.TradeGoods.IllicitLuxuryGoods",
    basePrice: 150000,
    quantity: "1D6",
    purchaseDM: { "Ag": 2, "Ga": 3 },
    saleDM: { "In": 4, "Ri": 6 },
    illegal: true
  },
  {
    name: "TWODSIX.Trade.TradeGoods.IllicitPharmaceuticals",
    basePrice: 100000,
    quantity: "1D6",
    purchaseDM: { "Ht": 3, "Wa": 2 },
    saleDM: { "In": 6, "Ri": 4 },
    illegal: true
  },
  {
    name: "TWODSIX.Trade.TradeGoods.MedicalResearchMaterial",
    basePrice: 50000,
    quantity: "1D6*5",
    purchaseDM: { "Ht": 2, "Ri": 3 },
    saleDM: { "In": 6, "Na": 4 },
    illegal: true
  },
  {
    name: "TWODSIX.Trade.TradeGoods.MilitaryEquipment",
    basePrice: 150000,
    quantity: "2D6",
    purchaseDM: { "Ht": 3, "In": 2 },
    saleDM: { "Hi": 6, "Ni": 4 },
    illegal: true
  },
  {
    name: "TWODSIX.Trade.TradeGoods.PersonalWeaponsAndArmor",
    basePrice: 30000,
    quantity: "2D6",
    purchaseDM: { "In": 3, "Ri": 2 },
    saleDM: { "Ni": 6, "Po": 4 },
    illegal: true
  },
  {
    name: "Unusual Cargo",
    basePrice: 0,
    quantity: "0",
    purchaseDM: {},
    saleDM: {},
    unusual: true
  }
];

// Price Modification Table - Cepheus Engine (higher sale multipliers at extreme rolls)
const PRICE_MODIFIERS_CE: Record<number, { purchase: number; sale: number }> = {
  2: { purchase: 200, sale: 40 },
  3: { purchase: 180, sale: 50 },
  4: { purchase: 160, sale: 60 },
  5: { purchase: 140, sale: 70 },
  6: { purchase: 120, sale: 80 },
  7: { purchase: 110, sale: 90 },
  8: { purchase: 100, sale: 100 },
  9: { purchase: 90, sale: 110 },
  10: { purchase: 80, sale: 120 },
  11: { purchase: 70, sale: 140 },
  12: { purchase: 60, sale: 160 },
  13: { purchase: 50, sale: 180 },
  14: { purchase: 40, sale: 200 },
  15: { purchase: 30, sale: 300 },
  16: { purchase: 20, sale: 400 }
};

// Price Modification Table - CDEE/CEL/CLU/Alpha Cephi (more conservative sale multipliers)
const PRICE_MODIFIERS_CDEE: Record<number, { purchase: number; sale: number }> = {
  2: { purchase: 200, sale: 40 },
  3: { purchase: 180, sale: 50 },
  4: { purchase: 160, sale: 60 },
  5: { purchase: 140, sale: 70 },
  6: { purchase: 120, sale: 80 },
  7: { purchase: 110, sale: 90 },
  8: { purchase: 100, sale: 100 },
  9: { purchase: 90, sale: 110 },
  10: { purchase: 80, sale: 120 },
  11: { purchase: 70, sale: 130 },
  12: { purchase: 60, sale: 140 },
  13: { purchase: 50, sale: 150 },
  14: { purchase: 40, sale: 160 },
  15: { purchase: 30, sale: 180 },
  16: { purchase: 20, sale: 200 }
};

/**
 * Get the appropriate price modifier table for the current ruleset
 * @param ruleset - The current game ruleset (CE, CDEE, CEL, CLU, etc.)
 * @returns The price modifier table to use
 */
function getPriceModifierTable(ruleset: string): Record<number, { purchase: number; sale: number }> {
  // CDEE, CD, CEL, CLU, and AC use the more conservative table (11-16 differ from CE)
  if (['CDEE', 'CD', 'CEL', 'CLU', 'AC'].includes(ruleset)) {
    return PRICE_MODIFIERS_CDEE;
  }
  // Default to CE for all other rulesets (CE, CT, CEATOM, etc.)
  return PRICE_MODIFIERS_CE;
}

/**
 * Calculate starport traffic modifier for purchase/sale prices
 * High traffic = more competition = different price dynamics
 * @param starport - Starport class (A, B, C, D, E, X)
 * @param isPurchase - true for purchase, false for sale
 * @param ruleset - Current game ruleset
 * @returns Modifier to apply to price roll
 */
function getStarportTrafficModifier(
  starport: string,
  isPurchase: boolean,
  ruleset: string
): number {
  // Only apply for rulesets with traffic system
  if (!['CDEE', 'CD', 'CLU', 'AC'].includes(ruleset)) {
    return 0;
  }

  const port = starport.toUpperCase();

  if (isPurchase) {
    // Purchase mods: high traffic = higher purchase prices (more demand)
    const purchaseMods: Record<string, number> = {
      'A': 2, 'B': 1, 'C': 0, 'D': -1, 'E': -2,
      'X': ruleset === 'CLU' ? -2 : -3  // CLU differs at X-port
    };
    return purchaseMods[port] || 0;
  } else {
    // Sale mods: high traffic = lower sale prices (more sellers)
    // CLU is more punishing at A/C ports
    const saleMods: Record<string, number> = ruleset === 'CLU' ? {
      'A': -3, 'B': -2, 'C': -1, 'D': 0, 'E': 0, 'X': 1  // CLU
    } : {
      'A': -1, 'B': -2, 'C': 0, 'D': 0, 'E': 0, 'X': 1   // CDEE/CD/AC
    };
    return saleMods[port] || 0;
  }
}

/**
 * Calculate zone/safety modifier for purchase/sale prices
 * Dangerous zones = risk premium = higher prices
 * @param zone - Travel zone (Green/Amber/Red)
 * @param isPurchase - true for purchase, false for sale
 * @param ruleset - Current game ruleset
 * @returns Modifier to apply to price roll
 */
function getZoneSafetyModifier(
  zone: string | undefined,
  isPurchase: boolean,
  ruleset: string
): number {
  // Only apply for rulesets with zone system
  if (!['CDEE', 'CD', 'CLU', 'AC'].includes(ruleset)) {
    return 0;
  }

  const safetyZone = (zone || 'Green').toLowerCase();

  if (isPurchase) {
    // Purchase: dangerous = higher prices (risk premium)
    const mods: Record<string, number> = {
      'green': 0, 'amber': 1, 'red': 3
    };
    return mods[safetyZone] || 0;
  } else {
    // Sale: dangerous = higher prices (fewer buyers, risk)
    const mods: Record<string, number> = {
      'green': 0, 'amber': 0, 'red': 2
    };
    return mods[safetyZone] || 0;
  }
}

/**
 * Calculate illegal goods sale bonus
 * Contraband sells for higher prices, especially in dangerous zones
 * @param isIllegal - Whether the good is illegal
 * @param zone - Travel zone (Green/Amber/Red)
 * @param ruleset - Current game ruleset
 * @returns Additional modifier for illegal goods sales
 */
function getIllegalGoodsSaleModifier(
  isIllegal: boolean,
  zone: string | undefined,
  ruleset: string
): number {
  // Only apply for rulesets with this rule
  if (!['CDEE', 'CD', 'CLU', 'AC'].includes(ruleset)) {
    return 0;
  }

  if (!isIllegal) {
    return 0;
  }

  const safetyZone = (zone || 'Green').toLowerCase();

  // Illegal goods get +1 baseline, +2 in dangerous zones
  // Per CDEE/CLU rules: "DM+1 or DM+2" for illegal sale
  return safetyZone === 'red' ? 2 : 1;
}

// Starport bonuses for finding suppliers
const STARPORT_BONUSES: Record<string, number> = {
  "A": 6,
  "B": 4,
  "C": 2,
  "D": 0,
  "E": 0,
  "X": 0
};

// Local broker caps by starport class (Cepheus SRD)
const STARPORT_BROKER_MAX: Record<string, number> = {
  "A": 4,
  "B": 3,
  "C": 2,
  "D": 1,
  "E": 1,
  "X": 0
};

// Local broker commission by skill level (Cepheus SRD)
const LOCAL_BROKER_COMMISSION: Record<number, number> = {
  0: 0,
  1: 5,
  2: 10,
  3: 15,
  4: 20
};

/**
 * Roll dice with a given formula like "2D6" or "1D6*5"
 */
function rollDice(formula: string): number {
  const match = formula.match(/^(\d+)D(\d+)(?:\*(\d+))?$/);
  if (!match) {
    return 0;
  }

  const numDice = parseInt(match[1]);
  const dieSize = parseInt(match[2]);
  const multiplier = match[3] ? parseInt(match[3]) : 1;

  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * dieSize) + 1;
  }
  return total * multiplier;
}

/**
 * Get the largest trade code modifier from a list of trade codes
 */
function getLargestTradeCodeModifier(
  codes: string[],
  modifiers: Record<string, number>
): number {
  let largest = 0;
  for (const code of codes) {
    if (modifiers[code] && modifiers[code] > largest) {
      largest = modifiers[code];
    }
  }
  return largest;
}

function clampCheck(value: number): number {
  return Math.max(2, Math.min(16, value));
}

/**
 * Simulate a Broker skill check result (2d6 + skill + modifiers)
 * Returns 2-16+ typically, based on actual skill roll
 */
function simulateBrokerCheck(
  traderSkill: number = 0,
  modifier: number = 0,
  trafficMod: number = 0,
  zoneMod: number = 0
): number {
  // Roll 2D6
  const dice = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;

  // Apply all modifiers: 2d6 + trader skill + situational + traffic + zone
  const result = dice + traderSkill + modifier + trafficMod + zoneMod;
  return clampCheck(result); // Clamp to 2-16
}

/**
 * Calculate purchase and sale prices for a good given base checks
 */
function calculateGoodPricing(
  good: TradeGood,
  tradeCodes: string[],
  basePurchaseCheck: number,
  baseSaleCheck: number,
  ruleset: string
): {
  purchaseCheck: number;
  saleCheck: number;
  purchasePriceData: { purchase: number; sale: number };
  salePriceData: { purchase: number; sale: number };
  purchasePrice: number;
  salePrice: number;
  salePriceModPercent: number;
} {
  const purchaseDM = getLargestTradeCodeModifier(tradeCodes, good.purchaseDM);
  const saleDM = getLargestTradeCodeModifier(tradeCodes, good.saleDM);
  const purchaseCheck = clampCheck(basePurchaseCheck + purchaseDM - saleDM);
  const saleCheck = clampCheck(baseSaleCheck + saleDM - purchaseDM);
  return calculatePricesFromChecks(good.basePrice, purchaseCheck, saleCheck, ruleset);
}

/**
 * Calculate purchase and sale prices from skill check results
 * Used for both trade goods (with DMs) and common goods (no DMs)
 */
function calculatePricesFromChecks(
  basePrice: number,
  purchaseCheck: number,
  saleCheck: number,
  ruleset: string
): {
  purchaseCheck: number;
  saleCheck: number;
  purchasePriceData: { purchase: number; sale: number };
  salePriceData: { purchase: number; sale: number };
  purchasePrice: number;
  salePrice: number;
  salePriceModPercent: number;
} {
  const priceModifiers = getPriceModifierTable(ruleset);
  const purchasePriceData = priceModifiers[purchaseCheck] || priceModifiers[8];
  const salePriceData = priceModifiers[saleCheck] || priceModifiers[8];
  const purchasePrice = calculatePrice(basePrice, purchasePriceData.purchase);
  const salePrice = calculatePrice(basePrice, salePriceData.sale);

  return {
    purchaseCheck,
    saleCheck,
    purchasePriceData,
    salePriceData,
    purchasePrice,
    salePrice,
    salePriceModPercent: salePriceData.sale
  };
}

function getBrokerInfo(
  useLocalBroker: boolean,
  traderSkill: number,
  localBrokerSkill: number,
  starport: string
): LocalBrokerInfo {
  if (!useLocalBroker) {
    return {
      useLocalBroker: false,
      requestedSkill: traderSkill,
      effectiveSkill: traderSkill,
      commissionPercent: 0,
      starportCap: STARPORT_BROKER_MAX[starport] ?? 0
    };
  }

  const requestedSkill = Math.max(0, Math.min(4, localBrokerSkill));
  const starportCap = STARPORT_BROKER_MAX[starport] ?? 0;
  const effectiveSkill = Math.min(requestedSkill, starportCap);
  const commissionPercent = LOCAL_BROKER_COMMISSION[effectiveSkill] ?? 0;

  return {
    useLocalBroker: true,
    requestedSkill,
    effectiveSkill,
    commissionPercent,
    starportCap
  };
}

function applyBrokerCommission(
  basePrice: number,
  negotiatedPrice: number,
  commissionPercent: number,
  isPurchase: boolean
): { price: number; modPercent: number } {
  if (commissionPercent <= 0) {
    return {
      price: negotiatedPrice,
      modPercent: Math.round((negotiatedPrice / basePrice) * 100)
    };
  }

  const multiplier = isPurchase ? 1 + commissionPercent / 100 : 1 - commissionPercent / 100;
  const adjustedPrice = Math.max(0, Math.round(negotiatedPrice * multiplier));
  return {
    price: adjustedPrice,
    modPercent: Math.round((adjustedPrice / basePrice) * 100)
  };
}

/**
 * Generate trade information for a world, including available goods, prices, and summary info.
 * @param worldData - Data about the world and trade context (trade codes, starport, modifiers, etc.)
 * @returns TradeGenerationResult with all generated trade data for the world.
 */
export function generateTradeInformation(worldData: {
  name: string;
  tradeCodes: string[];
  starport: string;
  zone?: string; // Travel zone (Green/Amber/Red) - from world data
  lawLevel?: number; // For future smuggling checks
  includeIllegalGoods?: boolean; // From dialog checkbox
  capSameWorld?: boolean;
  restrictTradeGoodsToCodes?: boolean;
  traderSkill?: number; // Trader's Broker skill level (0-15)
  useLocalBroker?: boolean;
  localBrokerSkill?: number; // Local broker skill level (0-4)
  supplierModifier?: number; // Modifier from supplier leverage or skill
  buyerModifier?: number; // Modifier for sale price (negative means harder to sell)
}): TradeGenerationResult {
  const tradeCodes = worldData.tradeCodes || [];
  const starportBonus = STARPORT_BONUSES[worldData.starport] || 0;
  const traderSkill = worldData.traderSkill ?? 0;
  const useLocalBroker = worldData.useLocalBroker ?? false;
  const localBrokerSkill = worldData.localBrokerSkill ?? 0;
  const supplierModifier = worldData.supplierModifier ?? 0;
  const buyerMod = worldData.buyerModifier ?? 0;
  const capSameWorld = worldData.capSameWorld ?? false;
  const restrictTradeGoodsToCodes = worldData.restrictTradeGoodsToCodes ?? false;
  const includeIllegalGoods = worldData.includeIllegalGoods ?? false;
  // Normalize zone: treat 'none', empty, or undefined as 'Green'
  const zone = (worldData.zone && worldData.zone.toLowerCase() !== 'none') ? worldData.zone : 'Green';

  // Get current ruleset from game settings to determine which price table to use
  const ruleset = (game.settings?.get('twodsix', 'ruleset') as string) || 'CE';
  const priceTable = getPriceModifierTable(ruleset);

  const brokerInfo = getBrokerInfo(useLocalBroker, traderSkill, localBrokerSkill, worldData.starport);
  const effectiveBrokerSkill = brokerInfo.effectiveSkill;

  // Calculate traffic and zone modifiers for this world
  const purchaseTrafficMod = getStarportTrafficModifier(worldData.starport, true, ruleset);
  const saleTrafficMod = getStarportTrafficModifier(worldData.starport, false, ruleset);
  const purchaseZoneMod = getZoneSafetyModifier(zone, true, ruleset);
  const saleZoneMod = getZoneSafetyModifier(zone, false, ruleset);

  // DEBUG: Log trade generation parameters (useful for testing/debugging)
  /*console.log('🔍 Trade Generation:', {
    world: worldData.name,
    ruleset,
    zone: `${worldData.zone || '(default)'} → ${zone}`,
    starport: worldData.starport,
    modifiers: {
      purchaseTraffic: purchaseTrafficMod,
      saleTraffic: saleTrafficMod,
      purchaseZone: purchaseZoneMod,
      saleZone: saleZoneMod
    }
  });*/

  const tradeCodeSet = new Set(tradeCodes);
  const isTradeCodeMatched = (good: TradeGood): boolean => {
    const purchaseMatch = Object.keys(good.purchaseDM).some((code) => tradeCodeSet.has(code));
    const saleMatch = Object.keys(good.saleDM).some((code) => tradeCodeSet.has(code));
    return purchaseMatch || saleMatch;
  };

  // Simulate supplier finding (good supply situation bonus is 0-2)
  const supplierBonus = Math.floor(Math.random() * 3); // 0, 1, or 2

  // Select which goods are available to buy (1D6 random unique indices)
  const numGoods = Math.floor(Math.random() * 6) + 1; // 1-6
  const availableIndices = new Set<number>();
  const goodsIndices = TRADE_GOODS
    .map((_, i) => i)
    .filter((index) => {
      const good = TRADE_GOODS[index];
      if (!includeIllegalGoods && good.illegal) {
        return false;
      }
      if (restrictTradeGoodsToCodes && !isTradeCodeMatched(good)) {
        return false;
      }
      return true;
    });

  // Fisher-Yates shuffle to pick numGoods without replacement
  for (let i = 0; i < numGoods && goodsIndices.length > 0; i++) {
    const randomIdx = Math.floor(Math.random() * goodsIndices.length);
    availableIndices.add(goodsIndices[randomIdx]);
    goodsIndices.splice(randomIdx, 1);
  }

  // Base price checks with traffic and zone modifiers
  const basePurchaseCheck = simulateBrokerCheck(
    effectiveBrokerSkill,
    -supplierModifier,
    purchaseTrafficMod,
    purchaseZoneMod
  );
  const baseSaleCheck = simulateBrokerCheck(
    effectiveBrokerSkill,
    buyerMod,
    saleTrafficMod,
    saleZoneMod
  );

  // Single pass through all goods to build both lists
  const rolledGoods: TradeGoodWithRoll[] = [];
  const saleGoods: TradeGoodSalePrice[] = [];
  const purchasePriceByName = new Map<string, number>();
  const purchasePriceByNamePreCommission = new Map<string, number>();
  let unusualFound = false;

  TRADE_GOODS.forEach((good, index) => {
    const isAvailable = availableIndices.has(index);
    if (good.unusual) {
      if (isAvailable) {
        unusualFound = true;
      }
      return;
    }

    // For illegal goods, add bonus to sale check
    const illegalSaleMod = good.illegal ? getIllegalGoodsSaleModifier(good.illegal, zone, ruleset) : 0;
    const adjustedSaleCheck = clampCheck(baseSaleCheck + illegalSaleMod);

    // Calculate pricing for this good (using adjusted sale check for illegal goods)
    const pricing = calculateGoodPricing(good, tradeCodes, basePurchaseCheck, adjustedSaleCheck, ruleset);

    const cappedSalePrice =
      capSameWorld && pricing.salePrice > pricing.purchasePrice
        ? pricing.purchasePrice
        : pricing.salePrice;
    const purchaseAdjusted = applyBrokerCommission(
      good.basePrice,
      pricing.purchasePrice,
      brokerInfo.commissionPercent,
      true
    );
    const saleAdjusted = applyBrokerCommission(
      good.basePrice,
      cappedSalePrice,
      brokerInfo.commissionPercent,
      false
    );

    // Add to purchase list if available
    if (isAvailable) {
      const rolledQty = rollDice(good.quantity);
      rolledGoods.push({
        name: good.name,
        basePrice: good.basePrice,
        quantityFormula: good.quantity,
        rolledQuantity: rolledQty,
        purchasePriceModPercent: purchaseAdjusted.modPercent,
        purchasePrice: purchaseAdjusted.price,
        salePriceModPercent: saleAdjusted.modPercent,
        salePrice: saleAdjusted.price,
        purchaseDM: good.purchaseDM,
        saleDM: good.saleDM,
        illegal: good.illegal
      });

      purchasePriceByName.set(good.name, purchaseAdjusted.price);
      purchasePriceByNamePreCommission.set(good.name, pricing.purchasePrice);
    }

    // Add to sale list if not illegal (or if illegal goods are included)
    if (!good.illegal || includeIllegalGoods) {
      const purchasePrice = purchasePriceByName.get(good.name);
      const purchasePricePreCommission = purchasePriceByNamePreCommission.get(good.name);
      const cappedSalePriceForList =
        capSameWorld && purchasePricePreCommission !== undefined && pricing.salePrice > purchasePricePreCommission
          ? purchasePricePreCommission
          : pricing.salePrice;
      let salePriceAdjusted = applyBrokerCommission(
        good.basePrice,
        cappedSalePriceForList,
        brokerInfo.commissionPercent,
        false
      ).price;
      let salePriceModPercentAdjusted = Math.round((salePriceAdjusted / good.basePrice) * 100);

      if (capSameWorld && purchasePrice !== undefined && salePriceAdjusted > purchasePrice) {
        salePriceAdjusted = purchasePrice;
        salePriceModPercentAdjusted = Math.round((salePriceAdjusted / good.basePrice) * 100);
      }

      saleGoods.push({
        good,
        salePrice: salePriceAdjusted,
        salePriceModPercent: salePriceModPercentAdjusted
      });
    }
  });

  // Supplier/port bonuses are reported for future supplier-finding rules.
  const availableGoodsCount = [...availableIndices].filter((index) => !TRADE_GOODS[index]?.unusual).length;
  let supplierInfo = game.i18n.format("TWODSIX.Trade.SupplierInfoSummary", {
    count: availableGoodsCount,
    starportBonus,
    supplierBonus
  });
  if (unusualFound) {
    supplierInfo += ` ${game.i18n.localize("TWODSIX.Trade.SupplierInfoUnusual")}`;
  }

  // Also roll for common goods (no trade-code DMs, just base checks)
  const commonGoodsRolled = COMMON_GOODS.map((good) => {
    const rolledQuantity = rollDice(good.quantity);
    const pricing = calculatePricesFromChecks(good.basePrice, basePurchaseCheck, baseSaleCheck, ruleset);

    const cappedSalePrice =
      capSameWorld && pricing.salePrice > pricing.purchasePrice
        ? pricing.purchasePrice
        : pricing.salePrice;
    const purchaseAdjusted = applyBrokerCommission(
      good.basePrice,
      pricing.purchasePrice,
      brokerInfo.commissionPercent,
      true
    );
    const saleAdjusted = applyBrokerCommission(
      good.basePrice,
      cappedSalePrice,
      brokerInfo.commissionPercent,
      false
    );

    return {
      good,
      rolledQuantity,
      purchasePrice: purchaseAdjusted.price,
      purchasePriceModPercent: purchaseAdjusted.modPercent,
      salePrice: saleAdjusted.price,
      salePriceModPercent: saleAdjusted.modPercent
    };
  });

  return {
    goods: rolledGoods,
    saleGoods,
    commonGoods: COMMON_GOODS,
    commonGoodsRolled,
    supplierInfo,
    brokerInfo,
    purchaseSkillCheck: {
      result: basePurchaseCheck,
      priceModifier: 0, // Per-good DMs applied individually, not factored into base check
      percentage: priceTable[basePurchaseCheck]?.purchase || priceTable[8].purchase
    },
    saleSkillCheck: {
      result: baseSaleCheck,
      priceModifier: 0, // No trade-code DMs for sale base check (applied per good)
      percentage: priceTable[baseSaleCheck]?.sale || priceTable[8].sale
    }
  };
}

/**
 * Calculate the final price of goods given base price and modifier percentage.
 * @param basePrice - The base price in credits
 * @param modifierPercent - The percentage modifier (e.g., 80 for 80%, 150 for 150%)
 * @returns The calculated price in credits
 */
export function calculatePrice(basePrice: number, modifierPercent: number): number {
  return Math.round(basePrice * (modifierPercent / 100));
}

/**
 * Get a random trade good from the table.
 * @returns A randomly selected TradeGood
 */
export function getRandomTradeGood(): TradeGood {
  return TRADE_GOODS[Math.floor(Math.random() * TRADE_GOODS.length)];
}

/**
 * Get all trade goods (for reference or display).
 * @returns Array of all TradeGood objects
 */
export function getAllTradeGoods(): TradeGood[] {
  return [...TRADE_GOODS];
}

/**
 * Get all common goods (for reference or display).
 * @returns Array of all CommonGood objects
 */
export function getAllCommonGoods(): CommonGood[] {
  return [...COMMON_GOODS];
}

/**
 * Build and format trade report rows for display, given a TradeGenerationResult.
 * Handles price formatting, illegal marks, and percent formatting for UI.
 * @param tradeInfo - TradeGenerationResult or compatible object
 * @returns Array of row objects for report rendering
 */
export function buildTradeReportRows(tradeInfo: any): Array<any> {
  const formatCr = (num: number): string => {
    return num.toLocaleString(game.i18n.lang, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  const availableByName = new Map(tradeInfo.goods.map((good) => [good.name, good]));
  const rows: Array<any> = [];
  tradeInfo.commonGoodsRolled.forEach((item: any) => {
    rows.push({
      name: item.good.name,
      illegal: false,
      buyPrice: item.purchasePrice,
      buyMod: item.purchasePriceModPercent,
      sellPrice: item.salePrice,
      sellMod: item.salePriceModPercent
    });
  });
  tradeInfo.saleGoods.forEach((item: any) => {
    const available = availableByName.get(item.good.name);
    rows.push({
      name: item.good.name,
      illegal: item.good.illegal,
      buyPrice: available?.purchasePrice,
      buyMod: available?.purchasePriceModPercent,
      sellPrice: item.salePrice,
      sellMod: item.salePriceModPercent
    });
  });
  rows.forEach((row) => {
    row.illegalMark = row.illegal ? "*" : "";
    row.buyPrice = row.buyPrice !== undefined ? `${formatCr(row.buyPrice)} ${game.i18n.localize("TWODSIX.Trade.CrPerTon")}` : "";
    row.buyMod = row.buyMod !== undefined ? `${row.buyMod}%` : "";
    row.sellPrice = row.sellPrice !== undefined ? `${formatCr(row.sellPrice)} ${game.i18n.localize("TWODSIX.Trade.CrPerTon")}` : "";
    row.sellMod = row.sellMod !== undefined ? `${row.sellMod}%` : "";
  });
  return rows;
}
