/**
 * TradeGeneratorConstants.js
 * Static data tables for the trade generation system (Cepheus Engine SRD Chapter 7).
 * Split out from TradeGenerator.js so the logic file stays focused on behavior.
 *
 * @module TradeGeneratorConstants
 */

// Common Goods - available on any world
export const COMMON_GOODS = [
  { name: "TWODSIX.Trade.BasicGoods.ConsumableGoods", basePrice: 1000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.Electronics", basePrice: 25000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.MachineParts", basePrice: 10000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.ManufacturedGoods", basePrice: 20000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.RawMaterials", basePrice: 5000, quantity: "2D6*5" },
  { name: "TWODSIX.Trade.BasicGoods.UnrefinedOre", basePrice: 2000, quantity: "2D6*5" }
];

// Trade Goods - roll on D66 table
export const TRADE_GOODS = [
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
    quantity: "1D6",
    purchaseDM: {},
    saleDM: {},
    unusual: true
  }
];

// Price Modification Table - Cepheus Engine (higher sale multipliers at extreme rolls)
export const PRICE_MODIFIERS_CE = {
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

// Price Modification Table - CDEE/CEL/CLU/Alpha Cephei (more conservative sale multipliers)
export const PRICE_MODIFIERS_CDEE = {
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

// Starport bonuses for finding suppliers
export const STARPORT_BONUSES = {
  "A": 6,
  "B": 4,
  "C": 2,
  "D": 0,
  "E": 0,
  "X": 0
};

// Maximum broker skill level that can be requested
export const MAX_BROKER_SKILL = 4;

// Local broker caps by starport class (Cepheus SRD)
export const STARPORT_BROKER_MAX = {
  "A": 4,
  "B": 3,
  "C": 2,
  "D": 1,
  "E": 1,
  "X": 0
};

// Local broker commission by skill level (Cepheus SRD)
export const LOCAL_BROKER_COMMISSION = {
  0: 0,
  1: 5,
  2: 10,
  3: 15,
  4: 20
};

// Rulesets that use the CDEE-family price modifier table
export const CDEE_FAMILY_RULESETS = ['CDEE', 'CD', 'CEL', 'CLU', 'AC'];

// Rulesets that apply starport traffic and zone safety modifiers (subset of CDEE family, excludes CEL)
export const TRAFFIC_MOD_RULESETS = ['CDEE', 'CD', 'CLU', 'AC'];

// Starport traffic modifiers for purchase prices
export const STARPORT_PURCHASE_MODS = {
  'A': 2, 'B': 1, 'C': 0, 'D': -1, 'E': -2, 'X': -3
};

// Starport traffic modifiers for sale prices (general)
export const STARPORT_SALE_MODS = {
  'A': -1, 'B': -2, 'C': 0, 'D': 0, 'E': 0, 'X': 1
};

// Starport traffic modifiers for CLU ruleset (differs from general)
export const STARPORT_PURCHASE_MODS_CLU = {
  'A': 2, 'B': 1, 'C': 0, 'D': -1, 'E': -2, 'X': -2
};

export const STARPORT_SALE_MODS_CLU = {
  'A': -3, 'B': -2, 'C': -1, 'D': 0, 'E': 0, 'X': 1
};

// Zone safety modifiers
export const ZONE_PURCHASE_MODS = { 'green': 0, 'amber': 1, 'red': 3 };
export const ZONE_SALE_MODS = { 'green': 0, 'amber': 0, 'red': 2 };

// Skill check clamp range
export const CHECK_MIN = 2;
export const CHECK_MAX = 16;
