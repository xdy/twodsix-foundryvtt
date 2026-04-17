/**
 * Cepheus Light Upgraded (CLU) trader ruleset logic.
 */
import { CepheusLiaisonTraderRuleset } from '../../CepheusLiaisonTraderRuleset.js';
import {
  CLU_AVAILABLE_TRADE_GOODS_MODIFIER,
  CLU_BROKER_TABLE,
  CLU_BULK_LIFE_SUPPORT,
  CLU_CHARTER_RATE,
  CLU_COMMON_GOODS,
  CLU_FREIGHT_AVAILABILITY,
  CLU_LIFE_SUPPORT,
  CLU_PASSENGER_AVAILABILITY,
  CLU_PASSENGER_REVENUE,
  CLU_STARPORT_SUPPLIER_BONUS,
  CLU_TRADE_GOODS,
} from './CLUTraderConstants.js';

export class CLURuleset extends CepheusLiaisonTraderRuleset {
  /** @override */
  getSearchStarportBonus(starport) {
    return CLU_STARPORT_SUPPLIER_BONUS[starport] ?? 0;
  }

  /** @override */
  getPriceRulesetKey() {
    return 'CLU';
  }

  /** @override */
  getCommonGoods() {
    return CLU_COMMON_GOODS;
  }

  /** @override */
  getCommonGoodsDMs() {
    return Object.fromEntries(CLU_COMMON_GOODS.map(good => [good.name, {
      purchaseDM: good.purchaseDM,
      saleDM: good.saleDM,
    }]));
  }

  /** @override */
  getTradeGoods() {
    return CLU_TRADE_GOODS;
  }

  /** @override */
  getAvailableTradeGoodsModifier(starport) {
    return CLU_AVAILABLE_TRADE_GOODS_MODIFIER[starport] ?? 0;
  }

  /** @override */
  getBrokerMaxSkill(starport) {
    return CLU_BROKER_TABLE[starport] ?? 0;
  }

  /** @override */
  getBrokerCommission(skillLevel) {
    const commissions = { 0: 0, 1: 5, 2: 10, 3: 15, 4: 20 };
    return commissions[skillLevel] ?? (skillLevel * 5);
  }

  /** @override */
  getPassengerRevenue() {
    return CLU_PASSENGER_REVENUE;
  }

  /** @override */
  getPassengerAvailability() {
    return CLU_PASSENGER_AVAILABILITY;
  }

  /** @override */
  getFreightAvailability() {
    return CLU_FREIGHT_AVAILABILITY;
  }

  /** @override */
  getCharterRate() {
    return CLU_CHARTER_RATE;
  }

  /** @override */
  getLifeSupportCosts() {
    return CLU_LIFE_SUPPORT;
  }

  /** @override */
  getBulkLifeSupportCosts() {
    return CLU_BULK_LIFE_SUPPORT;
  }

  /** @override */
  getMortgageDivisor() {
    return 320;
  }
}
