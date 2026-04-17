/**
 * Cepheus Light (CEL) trader ruleset logic.
 */
import {
  CEL_AVAILABLE_TRADE_GOODS_MODIFIER,
  CEL_BROKER_TABLE,
  CEL_BULK_LIFE_SUPPORT,
  CEL_CHARTER_RATE,
  CEL_COMMON_GOODS,
  CEL_LIFE_SUPPORT,
  CEL_PASSENGER_AVAILABILITY,
  CEL_PASSENGER_REVENUE,
  CEL_STARPORT_SUPPLIER_BONUS,
  CEL_TRADE_GOODS,
} from './CELTraderConstants.js';
import { CepheusLiaisonTraderRuleset } from '../../CepheusLiaisonTraderRuleset.js';

export class CELRuleset extends CepheusLiaisonTraderRuleset {
  /** @override */
  getSearchStarportBonus(starport) {
    return CEL_STARPORT_SUPPLIER_BONUS[starport] ?? 0;
  }

  /** @override */
  getSearchThreshold() {
    return 6;
  }

  /** @override */
  getPriceRulesetKey() {
    return 'CEL';
  }

  /** @override */
  getCommonGoods() {
    return CEL_COMMON_GOODS;
  }

  /** @override */
  getCommonGoodsDMs() {
    return Object.fromEntries(CEL_COMMON_GOODS.map(good => [good.name, {
      purchaseDM: good.purchaseDM,
      saleDM: good.saleDM,
    }]));
  }

  /** @override */
  getTradeGoods() {
    return CEL_TRADE_GOODS;
  }

  /** @override */
  getAvailableTradeGoodsModifier(starport) {
    return CEL_AVAILABLE_TRADE_GOODS_MODIFIER[starport] ?? 0;
  }

  /** @override */
  getBrokerMaxSkill(starport) {
    return CEL_BROKER_TABLE[starport] ?? 0;
  }

  /** @override */
  getBrokerCommission(skillLevel) {
    const commissions = { 0: 0, 1: 5, 2: 10, 3: 15, 4: 20 };
    return commissions[skillLevel] ?? (skillLevel * 5);
  }

  /** @override */
  getPassengerRevenue() {
    return CEL_PASSENGER_REVENUE;
  }

  /** @override */
  getPassengerAvailability() {
    return CEL_PASSENGER_AVAILABILITY;
  }

  /** @override */
  getCharterRate() {
    return CEL_CHARTER_RATE;
  }

  /** @override */
  getLifeSupportCosts() {
    return CEL_LIFE_SUPPORT;
  }

  /** @override */
  getBulkLifeSupportCosts() {
    return CEL_BULK_LIFE_SUPPORT;
  }
}
