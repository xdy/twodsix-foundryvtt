/**
 * Tables and constants specific to the Cepheus Light Upgraded (CLU) trader ruleset.
 */
import { CEL_BULK_LIFE_SUPPORT, CEL_COMMON_GOODS, CEL_LIFE_SUPPORT, CEL_TRADE_GOODS, } from '../cel/CELTraderConstants.js';

export const CLU_STARPORT_SUPPLIER_BONUS = {
  A: 6, B: 4, C: 2, D: -1, E: -2, X: 0
};

export const CLU_AVAILABLE_TRADE_GOODS_MODIFIER = {
  A: 4, B: 2, C: 1, D: 0, E: -2, X: 0
};

export const CLU_BROKER_TABLE = {
  A: 4, B: 3, C: 2, D: 1, E: 1, X: 0
};

export const CLU_COMMON_GOODS = CEL_COMMON_GOODS;

export const CLU_TRADE_GOODS = CEL_TRADE_GOODS.map((good, index) => {
  if (index === 1) {
    return {
      ...good,
      name: 'TWODSIX.Trade.TradeGoods.AdvancedManufacturedGoods',
    };
  }
  return good;
});

export const CLU_PASSENGER_REVENUE = {
  high: 10000,
  middle: 8000,
  steerage: 3000,
  low: 1000,
};

export const CLU_PASSENGER_AVAILABILITY = {
  A: { high: '3D6', middle: '3D6', steerage: '4D6', low: '3D6*3' },
  B: { high: '2D6', middle: '3D6', steerage: '4D6', low: '3D6*3' },
  C: { high: '1D6', middle: '2D6', steerage: '3D6', low: '3D6' },
  D: { high: '0', middle: '1D6', steerage: '2D6', low: '2D6' },
  E: { high: '0', middle: 'floor(1D6/2)', steerage: '1D6', low: '1D6' },
  X: { high: '0', middle: '0', steerage: '0', low: '0' },
};

export const CLU_FREIGHT_AVAILABILITY = {
  A: '3D6*10',
  B: '3D6*5',
  C: '3D6*2',
  D: '3D6',
  E: '1D6',
  X: '0',
};

export const CLU_CHARTER_RATE = {
  cargoPerTon: 3000,
  highPassage: 24000,
  lowPassage: 3000,
};

export const CLU_LIFE_SUPPORT = CEL_LIFE_SUPPORT;
export const CLU_BULK_LIFE_SUPPORT = CEL_BULK_LIFE_SUPPORT;
