/**
 * Tables and constants specific to the Cepheus Light (CEL) trader ruleset.
 */

export const CEL_STARPORT_SUPPLIER_BONUS = {
  A: 6, B: 4, C: 2, D: -1, E: -2, X: 0
};

export const CEL_AVAILABLE_TRADE_GOODS_MODIFIER = {
  A: 4, B: 2, C: 1, D: 0, E: -2, X: 0
};

export const CEL_BROKER_TABLE = {
  A: 4, B: 3, C: 2, D: 0, E: 1, X: 0
};

export const CEL_COMMON_GOODS = [
  {
    name: "TWODSIX.Trade.BasicGoods.ConsumableGoods",
    basePrice: 1000,
    quantity: "2D6*5",
    purchaseDM: { Ag: 3, Ga: 2 },
    saleDM: { Hi: 1, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.BasicGoods.Electronics",
    basePrice: 25000,
    quantity: "2D6*5",
    purchaseDM: { Ht: 2, In: 4 },
    saleDM: { Ni: 2, Po: 1 },
  },
  {
    name: "TWODSIX.Trade.BasicGoods.MachineParts",
    basePrice: 1000,
    quantity: "2D6*5",
    purchaseDM: { In: 3, Ri: 2 },
    saleDM: { Na: 1, Ni: 2 },
  },
  {
    name: "TWODSIX.Trade.BasicGoods.ManufacturedGoods",
    basePrice: 20000,
    quantity: "2D6*5",
    purchaseDM: { In: 3, Ri: 2 },
    saleDM: { Ag: 1, Ni: 2 },
  },
  {
    name: "TWODSIX.Trade.BasicGoods.RawMaterials",
    basePrice: 5000,
    quantity: "2D6*5",
    purchaseDM: { As: 3, Ni: 1 },
    saleDM: { In: 2, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.BasicGoods.UnrefinedOre",
    basePrice: 2000,
    quantity: "2D6*5",
    purchaseDM: { As: 2, Va: 1 },
    saleDM: { In: 2, Na: 1 },
  },
];

export const CEL_TRADE_GOODS = [
  {
    name: "TWODSIX.Trade.TradeGoods.AdvancedElectronics",
    basePrice: 100000,
    quantity: "1D6*5",
    purchaseDM: { Ht: 2, In: 4 },
    saleDM: { Ni: 2, Po: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.AdvancedRawMaterials",
    basePrice: 200000,
    quantity: "1D6*5",
    purchaseDM: { In: 3, Ri: 2 },
    saleDM: { Lo: 1, Ni: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.AgriculturalEquipment",
    basePrice: 150000,
    quantity: "1D6",
    purchaseDM: { In: 3, Ri: 2 },
    saleDM: { Ag: 2, Ga: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.AnimalProducts",
    basePrice: 1500,
    quantity: "4D6*5",
    purchaseDM: { Ag: 2, Ga: 3 },
    saleDM: { Hi: 2, Ri: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Collectibles",
    basePrice: 50000,
    quantity: "1D6",
    purchaseDM: { In: 2, Hi: 3 },
    saleDM: { Hi: 2, Ni: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.ComputersAndParts",
    basePrice: 150000,
    quantity: "2D6",
    purchaseDM: { Ht: 3, In: 2 },
    saleDM: { Na: 1, Ni: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.CrystalsAndGems",
    basePrice: 20000,
    quantity: "1D6*5",
    purchaseDM: { Ni: 3, Ic: 2 },
    saleDM: { In: 1, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.CyberneticParts",
    basePrice: 250000,
    quantity: "1D6*5",
    purchaseDM: { Bt: 3, Ri: 2 },
    saleDM: { Na: 1, Ni: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.FoodServiceEquipment",
    basePrice: 4000,
    quantity: "2D6",
    purchaseDM: { In: 3, Na: 2 },
    saleDM: { Ag: 1, Ni: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Furniture",
    basePrice: 5000,
    quantity: "4D6",
    purchaseDM: { Ag: 2, Ga: 3 },
    saleDM: { Hu: 1, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.GamblingDevicesAndEquipment",
    basePrice: 4000,
    quantity: "1D6",
    purchaseDM: { Hi: 2, Ri: 3 },
    saleDM: { Na: 2, Ni: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.GravVehicles",
    basePrice: 160000,
    quantity: "1D6",
    purchaseDM: { Ht: 3, Ri: 2 },
    saleDM: { Ni: 2, Po: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.GroceryProducts",
    basePrice: 6000,
    quantity: "1D6*5",
    purchaseDM: { Ag: 3, Ga: 2 },
    saleDM: { Lo: 1, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.HouseholdAppliances",
    basePrice: 12000,
    quantity: "4D6",
    purchaseDM: { Hi: 2, In: 3 },
    saleDM: { Na: 1, Ni: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.IndustrialSupplies",
    basePrice: 75000,
    quantity: "2D6",
    purchaseDM: { In: 3, Ri: 2 },
    saleDM: { Na: 1, Ni: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.LiquorAndIntoxicants",
    basePrice: 15000,
    quantity: "1D6*5",
    purchaseDM: { Ag: 3, Ga: 2 },
    saleDM: { In: 1, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.LuxuryGoods",
    basePrice: 150000,
    quantity: "1D6",
    purchaseDM: { Ag: 2, Ga: 3 },
    saleDM: { In: 1, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.ManufacturingEquipment",
    basePrice: 750000,
    quantity: "1D6*5",
    purchaseDM: { In: 3, Ri: 2 },
    saleDM: { Na: 1, Ni: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.MedicalEquipment",
    basePrice: 50000,
    quantity: "1D6*5",
    purchaseDM: { Ht: 2, Ri: 3 },
    saleDM: { Hi: 1, In: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Petrochemicals",
    basePrice: 10000,
    quantity: "2D6*5",
    purchaseDM: { Na: 2, Fl: 3 },
    saleDM: { Ag: 1, In: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Pharmaceuticals",
    basePrice: 100000,
    quantity: "1D6",
    purchaseDM: { Ht: 3, Wa: 2 },
    saleDM: { Lo: 1, Ri: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Polymers",
    basePrice: 7000,
    quantity: "4D6*5",
    purchaseDM: { In: 2, Ri: 3 },
    saleDM: { Ni: 2, Va: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.PreciousMetals",
    basePrice: 50000,
    quantity: "1D6",
    purchaseDM: { As: 3, Ic: 2 },
    saleDM: { In: 1, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Radioactives",
    basePrice: 1000000,
    quantity: "1D6",
    purchaseDM: { As: 2, Ni: 3 },
    saleDM: { In: 2, Ht: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.RobotsAndDrones",
    basePrice: 500000,
    quantity: "1D6*5",
    purchaseDM: { Ht: 3, Ri: 2 },
    saleDM: { Ni: 1, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.ScientificEquipment",
    basePrice: 50000,
    quantity: "1D6*5",
    purchaseDM: { Ht: 3, Ri: 2 },
    saleDM: { Hi: 2, Ni: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.SurvivalGear",
    basePrice: 4000,
    quantity: "2D6",
    purchaseDM: { Ga: 1, Ri: 2 },
    saleDM: { Fl: 2, Va: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.Textiles",
    basePrice: 3000,
    quantity: "3D6*5",
    purchaseDM: { Ag: 3, Ni: 2 },
    saleDM: { Na: 1, Ri: 2 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.UncommonRawMaterials",
    basePrice: 50000,
    quantity: "2D6*5",
    purchaseDM: { Ag: 3, Ni: 2 },
    saleDM: { In: 2, Na: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.UncommonUnrefinedOres",
    basePrice: 20000,
    quantity: "2D6*5",
    purchaseDM: { As: 2, Va: 1 },
    saleDM: { In: 2, Na: 1 },
  },
  {
    name: "TWODSIX.Trade.TradeGoods.IllicitLuxuryGoods",
    basePrice: 150000,
    quantity: "1D6",
    purchaseDM: { Ag: 2, Ga: 3 },
    saleDM: { In: 4, Ri: 6 },
    illegal: true,
  },
  {
    name: "TWODSIX.Trade.TradeGoods.IllicitPharmaceuticals",
    basePrice: 100000,
    quantity: "1D6",
    purchaseDM: { Ht: 3, Wa: 2 },
    saleDM: { In: 6, Ri: 4 },
    illegal: true,
  },
  {
    name: "TWODSIX.Trade.TradeGoods.MedicalResearchMaterial",
    basePrice: 50000,
    quantity: "1D6*5",
    purchaseDM: { Ht: 2, Ri: 3 },
    saleDM: { In: 6, Na: 4 },
    illegal: true,
  },
  {
    name: "TWODSIX.Trade.TradeGoods.MilitaryEquipment",
    basePrice: 150000,
    quantity: "2D6",
    purchaseDM: { Ht: 3, In: 2 },
    saleDM: { Hi: 6, Ni: 4 },
    illegal: true,
  },
  {
    name: "TWODSIX.Trade.TradeGoods.PersonalWeaponsAndArmor",
    basePrice: 30000,
    quantity: "2D6",
    purchaseDM: { In: 3, Ri: 2 },
    saleDM: { Ni: 6, Po: 4 },
    illegal: true,
  },
  {
    name: "TWODSIX.Trade.TradeGoods.UnusualCargo",
    basePrice: 0,
    quantity: "1D6",
    purchaseDM: {},
    saleDM: {},
    unusual: true,
  },
];

export const CEL_PASSENGER_REVENUE = {
  high: 10000,
  middle: 8000,
  steerage: 5000,
  low: 1000,
};

export const CEL_PASSENGER_AVAILABILITY = {
  A: { high: '3D6', middle: '3D6', steerage: '3D6', low: '3D6*3' },
  B: { high: '2D6', middle: '3D6', steerage: '3D6', low: '3D6*3' },
  C: { high: '1D6', middle: '2D6', steerage: '2D6', low: '3D6' },
  D: { high: '0', middle: '1D6', steerage: '1D6', low: '2D6' },
  E: { high: '0', middle: '1D3', steerage: '1D3', low: '1D6' },
  X: { high: '0', middle: '0', steerage: '0', low: '0' },
};

export const CEL_CHARTER_RATE = {
  cargoPerTon: 1500,
  highPassage: 12000,
  lowPassage: 1500,
};

export const CEL_LIFE_SUPPORT = {
  stateroom: 2000,
  lowBerth: 100,
};

export const CEL_BULK_LIFE_SUPPORT = {
  normal: 34000,
  luxury: 68000,
};
