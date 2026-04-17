/**
 * Broker hire and supplier/buyer search rolls.
 */

import { SEARCH_METHOD } from '../BaseTraderRuleset.js';
import { HOURS_PER_DAY } from '../TraderConstants.js';
import { getTraderRuleset } from '../TraderRulesetRegistry.js';
import {
  advanceDate,
  getCostPeriodNumber,
  getMonthNumber,
  getWorldCache,
  persistWorldHistory
} from '../TraderState.js';
import { accruePortFees } from './atWorldRefuelPort.js';
import { chooseIntOption, getEffectiveBrokerSkillForWorld } from './atWorldShared.js';

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 */
export async function findBuyer(app, world) {
  await searchForTrade(app, world, 'buyer');
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 */
export async function findSupplier(app, world) {
  await searchForTrade(app, world, 'supplier');
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 * @param {'buyer'|'supplier'} type
 */
async function searchForTrade(app, world, type) {
  const s = app.state;
  const ruleset = getTraderRuleset(s.ruleset);
  const cache = getWorldCache(s);
  const starport = world?.system?.starport || 'X';
  const worldTL = parseInt(world?.system?.uwp?.substring(8, 9), 16) || 0;

  const methods = ruleset.getSearchMethods(worldTL, starport)
    .filter(m => m !== SEARCH_METHOD.BLACK_MARKET || s.includeIllegalGoods);
  const options = methods.map(m => {
    const durationKey = m === SEARCH_METHOD.ONLINE
      ? 'TWODSIX.Trader.Search.MethodDuration1D6Hours'
      : 'TWODSIX.Trader.Search.MethodDuration1D6Days';
    const duration = game.i18n.localize(durationKey);
    return {
      value: m,
      label: `${m.charAt(0).toUpperCase() + m.slice(1)} (${game.i18n.localize(ruleset.getSearchSkillLabel(m))}, ${duration})`,
    };
  });

  const method = await app._choose(
    game.i18n.format('TWODSIX.Trader.Prompts.FindTradeMethod', {
      type: game.i18n.localize(`TWODSIX.Trader.Search.${type.charAt(0).toUpperCase() + type.slice(1)}`),
    }),
    options,
  );
  if (!method) {
    return;
  }

  // Defence in depth: even if a method was injected via replay/log, validate it
  // against ruleset-allowed methods at this world (e.g. ONLINE requires TL8+).
  if (!methods.includes(method)) {
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.SearchMethodNotAvailable', {
      method: game.i18n.localize(`TWODSIX.Trader.Search.Method.${method}`),
    }));
    return;
  }

  const penaltyPolicy = ruleset.getSearchPenaltyPolicy(s, world, type, method);
  const cadence = penaltyPolicy?.cadence || 'month';
  const currentBucket = cadence === 'costPeriod'
    ? getCostPeriodNumber(s)
    : getMonthNumber(s.gameDate, s.milieu);
  if (cadence !== 'none' && cache.lastSearchMonth !== currentBucket) {
    cache.searchAttempts = 0;
    cache.lastSearchMonth = currentBucket;
  }

  const penaltyPerAttempt = Math.max(0, Number(penaltyPolicy?.penaltyPerAttempt) || 1);
  const maxPenalty = Number.isFinite(penaltyPolicy?.maxPenalty)
    ? Math.max(0, Number(penaltyPolicy.maxPenalty))
    : null;
  const rawPenalty = cache.searchAttempts * penaltyPerAttempt;
  const appliedPenalty = maxPenalty === null ? rawPenalty : Math.min(rawPenalty, maxPenalty);
  const penalty = -appliedPenalty;
  cache.searchAttempts++;
  persistWorldHistory(s);

  let skill = 0;
  let timeHours = 0;
  let bonus = 0;
  const skillName = game.i18n.localize(ruleset.getSearchSkillLabel(method));

  if (method === SEARCH_METHOD.ONLINE) {
    skill = ruleset.getSearchSkillLevel(s.crew, method);
    bonus = 0;
    timeHours = await app._roll('1D6');
  } else {
    skill = ruleset.getSearchSkillLevel(s.crew, method);
    if (method === SEARCH_METHOD.STANDARD) {
      skill = getEffectiveBrokerSkillForWorld(s, starport);
    }
    bonus = ruleset.getSearchStarportBonus(starport);
    timeHours = (await app._roll('1D6')) * HOURS_PER_DAY;
  }

  advanceDate(s.gameDate, timeHours);
  await accruePortFees(app);
  const localizedType = game.i18n.localize(`TWODSIX.Trader.Search.${type.charAt(0).toUpperCase() + type.slice(1)}`);
  const localizedMethod = game.i18n.localize(`TWODSIX.Trader.Search.Method.${method}`);
  const timeStr = timeHours >= HOURS_PER_DAY
    ? game.i18n.format('TWODSIX.Trader.Time.Days', { days: Math.floor(timeHours / HOURS_PER_DAY) })
    : game.i18n.format('TWODSIX.Trader.Time.Hours', { hours: timeHours });
  await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.Searching', {
    type: localizedType,
    method: localizedMethod,
    timeStr,
  }));

  const checkRoll = await app._roll(`2D6+${skill}+${bonus}${penalty !== 0 ? penalty : ''}`);
  const success = checkRoll >= ruleset.getSearchThreshold();

  if (success) {
    if (type === 'supplier') {
      cache.foundSupplier = true;
      if (method === SEARCH_METHOD.BLACK_MARKET) {
        cache.foundBlackMarketSupplier = true;
      }
      if (method === SEARCH_METHOD.ONLINE) {
        cache.foundOnlineSupplier = true;
      }
      if (method === SEARCH_METHOD.PRIVATE) {
        cache.foundPrivateSupplier = true;
      }
    } else {
      cache.foundBuyer = true;
      if (method === SEARCH_METHOD.BLACK_MARKET) {
        cache.foundBlackMarketBuyer = true;
      }
      if (method === SEARCH_METHOD.PRIVATE) {
        cache.foundPrivateBuyer = true;
      }
    }

    const details = [];
    details.push(game.i18n.format('TWODSIX.Trader.Search.DetailSkill', { skillName, skill }));
    if (bonus !== 0) {
      details.push(game.i18n.format('TWODSIX.Trader.Search.DetailStarport', {
        starport,
        bonus: (bonus > 0 ? '+' : '') + bonus,
      }));
    }
    if (penalty < 0) {
      details.push(game.i18n.format('TWODSIX.Trader.Search.DetailPenalty', { penalty }));
    }

    const key = type === 'supplier' ? 'TWODSIX.Trader.Search.SuppliersFound' : 'TWODSIX.Trader.Search.BuyersFound';
    await app.logEvent(game.i18n.format(key, { details: details.join(', ') }));

    cache.tradeInfo = null;
  } else {
    const localizedTypeFail = game.i18n.localize(`TWODSIX.Trader.Search.${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const localizedMethodFail = game.i18n.localize(`TWODSIX.Trader.Search.Method.${method}`);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.SearchFailed', {
      type: localizedTypeFail,
      method: localizedMethodFail,
    }));
  }
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 * @param {{illegal?: boolean}} [opts]
 */
export async function hireBroker(app, world, opts = {}) {
  const s = app.state;
  const ruleset = getTraderRuleset(s.ruleset);
  const illegal = opts.illegal === true;
  const starport = world?.system?.starport || 'X';
  const maxSkill = ruleset.getBrokerMaxSkill(starport);

  if (maxSkill <= 0) {
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.NoBrokersAvailable', { starport }));
    return;
  }

  // Rulesets that roll broker skill bypass the picker.
  const cache = getWorldCache(s);
  const brokerRollCacheKey = illegal ? 'localBrokerRollIllegal' : 'localBrokerRollLegal';
  let normalizedRolled = cache[brokerRollCacheKey] ?? null;
  if (!normalizedRolled) {
    const rolled = await ruleset.rollLocalBrokerSkill(app, world, { illegal });
    normalizedRolled = ruleset.normalizeLocalBrokerResult(rolled, { maxSkill, illegal });
    if (normalizedRolled) {
      cache[brokerRollCacheKey] = normalizedRolled;
    }
  }
  if (normalizedRolled) {
    const skill = normalizedRolled.skill;
    if (skill <= 0) {
      if (!s.useLocalBroker && s.localBrokerSkill === 0) {
        // Already in "handle personally" state; suppress redundant log.
        cache.tradeInfo = null;
        return;
      }
      s.useLocalBroker = false;
      s.localBrokerSkill = 0;
      s.localBrokerIllegal = false;
      await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.HandlePersonally'));
    } else {
      const commission = normalizedRolled.commission;
      // Dedupe: re-rolling at the same world without departing returns the same hire silently.
      if (s.useLocalBroker && s.localBrokerSkill === skill && Boolean(s.localBrokerIllegal) === illegal) {
        cache.tradeInfo = null;
        return;
      }
      s.useLocalBroker = true;
      s.localBrokerSkill = skill;
      s.localBrokerIllegal = illegal;
      await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.HiredBroker', { skill, commission }));
      if (normalizedRolled.eventNote) {
        await app.logEvent(normalizedRolled.eventNote);
      }
    }
    cache.tradeInfo = null;
    return;
  }

  const options = [];
  for (let i = 1; i <= maxSkill; i++) {
    const commission = ruleset.getBrokerCommission(i, { illegal });
    options.push({
      value: String(i),
      label: game.i18n.format('TWODSIX.Trader.Actions.HireBrokerSkill', { skill: i, commission }),
    });
  }
  options.push({ value: '0', label: game.i18n.localize('TWODSIX.Trader.Actions.HireBrokerNone') });

  const prompt = game.i18n.format('TWODSIX.Trader.Prompts.HireBroker', { starport, maxSkill });
  const chosen = await chooseIntOption(app, prompt, options);

  if (chosen > 0) {
    if (s.useLocalBroker && s.localBrokerSkill === chosen && Boolean(s.localBrokerIllegal) === illegal) {
      cache.tradeInfo = null;
      return;
    }
    s.useLocalBroker = true;
    s.localBrokerSkill = chosen;
    s.localBrokerIllegal = illegal;
    const commission = ruleset.getBrokerCommission(chosen, { illegal });
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.HiredBroker', { skill: chosen, commission }));
    cache.tradeInfo = null;
  } else {
    if (!s.useLocalBroker && s.localBrokerSkill === 0) {
      cache.tradeInfo = null;
      return;
    }
    s.useLocalBroker = false;
    s.localBrokerSkill = 0;
    s.localBrokerIllegal = false;
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.HandlePersonally'));
    cache.tradeInfo = null;
  }
}
