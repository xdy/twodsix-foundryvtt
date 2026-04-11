/**
 * TradeGeneratorBroker.js
 * Broker selection and commission helpers for trade generation.
 *
 * @module TradeGeneratorBroker
 */

import { LOCAL_BROKER_COMMISSION, MAX_BROKER_SKILL, STARPORT_BROKER_MAX } from './TradeGeneratorConstants.js';

export function getBrokerInfo(useLocalBroker, traderSkill, localBrokerSkill, starport) {
  if (!useLocalBroker) {
    return {
      useLocalBroker: false,
      requestedSkill: traderSkill,
      effectiveSkill: traderSkill,
      commissionPercent: 0,
    };
  }

  const requestedSkill = Math.max(0, Math.min(MAX_BROKER_SKILL, localBrokerSkill));
  const starportCap = STARPORT_BROKER_MAX[starport] ?? 0;
  const effectiveSkill = Math.min(requestedSkill, starportCap);
  const commissionPercent = LOCAL_BROKER_COMMISSION[effectiveSkill] ?? 0;

  return {
    useLocalBroker: true,
    requestedSkill,
    effectiveSkill,
    commissionPercent,
  };
}

/**
 * Cepheus SRD: Commission is paid even if the merchant decides not to sell his goods.
 * The negotiated price is returned unchanged; commission is reported as an independent cost.
 */
export function applyBrokerCommission(basePrice, negotiatedPrice, commissionPercent) {
  return {
    price: negotiatedPrice,
    modPercent: Math.round((negotiatedPrice / basePrice) * 100),
    commission: Math.round(negotiatedPrice * (commissionPercent / 100))
  };
}
