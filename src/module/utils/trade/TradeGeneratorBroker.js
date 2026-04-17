/**
 * TradeGeneratorBroker.js
 * Broker selection and commission helpers for trade generation.
 *
 * @module TradeGeneratorBroker
 */

import { LOCAL_BROKER_COMMISSION, MAX_BROKER_SKILL, STARPORT_BROKER_MAX } from './TradeGeneratorConstants.js';

/**
 * Determine broker information for trade generation.
 *
 * When `useLocalBroker` is true the effective broker skill is the minimum of:
 * 1. The requested local broker skill, clamped to `maxSkill`.
 * 2. The starport's broker cap.
 *
 * The `maxSkill` value is ruleset-controlled (defaults to {@link MAX_BROKER_SKILL}).
 * A ruleset-provided `brokerRules.maxSkill` caps the requested broker skill;
 * the starport cap is always derived from the starport's quality, clamped at `maxSkill`.
 *
 * @param {boolean} useLocalBroker
 * @param {number} traderSkill
 * @param {number} localBrokerSkill
 * @param {string} starport
 * @param {object} [brokerRules={}]
 * @param {number} [brokerRules.maxSkill] - Ruleset-specific maximum broker skill (overrides {@link MAX_BROKER_SKILL})
 * @param {number} [brokerRules.commissionPercent] - Ruleset-specific commission (overrides {@link LOCAL_BROKER_COMMISSION})
 * @returns {{useLocalBroker: boolean, requestedSkill: number, effectiveSkill: number, commissionPercent: number, starportCap?: number}}
 */
export function getBrokerInfo(useLocalBroker, traderSkill, localBrokerSkill, starport, brokerRules = {}) {
  if (!useLocalBroker) {
    return {
      useLocalBroker: false,
      requestedSkill: traderSkill,
      effectiveSkill: traderSkill,
      commissionPercent: 0,
    };
  }

  const maxSkill = brokerRules.maxSkill ?? MAX_BROKER_SKILL;
  const requestedSkill = Math.max(0, Math.min(maxSkill, localBrokerSkill));
  const starportCap = Math.min(STARPORT_BROKER_MAX[starport] ?? 0, maxSkill);
  const effectiveSkill = Math.min(requestedSkill, starportCap);
  const commissionPercent = brokerRules.commissionPercent ?? LOCAL_BROKER_COMMISSION[effectiveSkill] ?? 0;

  return {
    useLocalBroker: true,
    requestedSkill,
    starportCap,
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
