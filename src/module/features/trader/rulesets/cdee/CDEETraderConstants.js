/**
 * CDEETraderConstants.js
 * Tables and constants specific to the Cepheus Deluxe Enhanced Edition (CDEE) ruleset.
 */

export const CDEE_STARPORT_SUPPLIER_BONUS = {
  A: 6, B: 4, C: 2, D: -1, E: -2, X: 0
};

export const CDEE_BROKER_TABLE = {
  A: 4, B: 3, C: 2, D: 1, E: 0, X: 0
};

/**
 * Purchase/sale DMs keyed by the same `name` strings as CE COMMON_GOODS (TradeGeneratorConstants),
 * so CDEE can override pricing without duplicating the common-goods item list on CDEERuleset.
 */
export const CDEE_COMMON_GOODS = {
  "TWODSIX.Trade.BasicGoods.ConsumableGoods": { purchaseDM: 0, saleDM: 0 },
  "TWODSIX.Trade.BasicGoods.Electronics": { purchaseDM: 2, saleDM: 0 },
  "TWODSIX.Trade.BasicGoods.MachineParts": { purchaseDM: 2, saleDM: 0 },
  "TWODSIX.Trade.BasicGoods.ManufacturedGoods": { purchaseDM: 2, saleDM: 0 },
  "TWODSIX.Trade.BasicGoods.RawMaterials": { purchaseDM: 0, saleDM: 2 },
  "TWODSIX.Trade.BasicGoods.UnrefinedOre": { purchaseDM: 0, saleDM: 2 }
};

export const CDEE_PROBLEM_TABLE = [
  { item: 'TWODSIX.Trader.CDEE.Problem.Item.Contaminated', supplier: 'TWODSIX.Trader.CDEE.Problem.Supplier.Fake', world: 'TWODSIX.Trader.CDEE.Problem.World.Bribe' },
  { item: 'TWODSIX.Trader.CDEE.Problem.Item.Damaged', supplier: 'TWODSIX.Trader.CDEE.Problem.Supplier.Late', world: 'TWODSIX.Trader.CDEE.Problem.World.Embargo' },
  { item: 'TWODSIX.Trader.CDEE.Problem.Item.Incorrect', supplier: 'TWODSIX.Trader.CDEE.Problem.Supplier.PriceChange', world: 'TWODSIX.Trader.CDEE.Problem.World.PortFee' },
  { item: 'TWODSIX.Trader.CDEE.Problem.Item.LowerQuality', supplier: 'TWODSIX.Trader.CDEE.Problem.Supplier.UnderStrength', world: 'TWODSIX.Trader.CDEE.Problem.World.Quarantine' },
  { item: 'TWODSIX.Trader.CDEE.Problem.Item.Mislabeled', supplier: 'TWODSIX.Trader.CDEE.Problem.Supplier.Unlicensed', world: 'TWODSIX.Trader.CDEE.Problem.World.SafetyViolation' },
  { item: 'TWODSIX.Trader.CDEE.Problem.Item.Stolen', supplier: 'TWODSIX.Trader.CDEE.Problem.Supplier.Wanted', world: 'TWODSIX.Trader.CDEE.Problem.World.UnionAction' }
];

export const CDEE_CARGO_TAGS = {
  11: "TWODSIX.Trader.CDEE.CargoTag.Fragile",
  12: "TWODSIX.Trader.CDEE.CargoTag.Perishable",
  13: "TWODSIX.Trader.CDEE.CargoTag.Flammable",
  14: "TWODSIX.Trader.CDEE.CargoTag.Explosive",
  15: "TWODSIX.Trader.CDEE.CargoTag.Radioactive",
  16: "TWODSIX.Trader.CDEE.CargoTag.Corrosive",
  21: "TWODSIX.Trader.CDEE.CargoTag.Biohazard",
  22: "TWODSIX.Trader.CDEE.CargoTag.IllegalSome",
  23: "TWODSIX.Trader.CDEE.CargoTag.HeavilyTaxed",
  24: "TWODSIX.Trader.CDEE.CargoTag.Restricted",
  25: "TWODSIX.Trader.CDEE.CargoTag.MilitaryGrade",
  26: "TWODSIX.Trader.CDEE.CargoTag.Luxury",
  31: "TWODSIX.Trader.CDEE.CargoTag.Bulky",
  32: "TWODSIX.Trader.CDEE.CargoTag.Heavy",
  33: "TWODSIX.Trader.CDEE.CargoTag.Magnetic",
  34: "TWODSIX.Trader.CDEE.CargoTag.Interference",
  35: "TWODSIX.Trader.CDEE.CargoTag.HighValue",
  36: "TWODSIX.Trader.CDEE.CargoTag.LowValue",
  41: "TWODSIX.Trader.CDEE.CargoTag.Preserved",
  42: "TWODSIX.Trader.CDEE.CargoTag.Live",
  43: "TWODSIX.Trader.CDEE.CargoTag.Cryogenic",
  44: "TWODSIX.Trader.CDEE.CargoTag.HeatingRequired",
  45: "TWODSIX.Trader.CDEE.CargoTag.VentilationRequired",
  46: "TWODSIX.Trader.CDEE.CargoTag.Hermetic",
  51: "TWODSIX.Trader.CDEE.CargoTag.Experimental",
  52: "TWODSIX.Trader.CDEE.CargoTag.Artisan",
  53: "TWODSIX.Trader.CDEE.CargoTag.Refurbished",
  54: "TWODSIX.Trader.CDEE.CargoTag.Ancient",
  55: "TWODSIX.Trader.CDEE.CargoTag.AlienOrigin",
  56: "TWODSIX.Trader.CDEE.CargoTag.Diplomatic",
  61: "TWODSIX.Trader.CDEE.CargoTag.Stolen",
  62: "TWODSIX.Trader.CDEE.CargoTag.Mislabeled",
  63: "TWODSIX.Trader.CDEE.CargoTag.Leaking",
  64: "TWODSIX.Trader.CDEE.CargoTag.DamagedPackaging",
  65: "TWODSIX.Trader.CDEE.CargoTag.Tracked",
  66: "TWODSIX.Trader.CDEE.CargoTag.Cursed"
};
