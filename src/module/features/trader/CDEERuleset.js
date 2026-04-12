/**
 * CDEERuleset.js
 * Cepheus Deluxe Enhanced Edition (CDEE) trader ruleset logic.
 */
import { BaseTraderRuleset } from './BaseTraderRuleset.js';
import {
  CDEE_BROKER_TABLE,
  CDEE_CARGO_TAGS,
  CDEE_COMMON_GOODS,
  CDEE_PROBLEM_TABLE,
  CDEE_STARPORT_SUPPLIER_BONUS
} from './CDEETraderConstants.js';

export class CDEERuleset extends BaseTraderRuleset {
  /** @override */
  getSearchMethods(worldTL, starport) {
    return ['corporate', 'blackMarket', 'private'];
  }

  /** @override */
  getSearchSkillLevel(crew, method) {
    switch (method) {
      case 'corporate': {
        const liaison = this.getCrewSkill(crew, 'Liaison');
        const intDM = 0; // TODO Get from actor
        const socDM = 0;
        return liaison + Math.max(intDM, socDM);
      }
      case 'blackMarket': {
        const streetwise = this.getCrewSkill(crew, 'Streetwise');
        const intDM = 0; // TODO Get from actor
        return streetwise + intDM;
      }
      case 'private': {
        const carousing = this.getCrewSkill(crew, 'Carousing');
        const socDM = 0; // TODO Get from actor
        return carousing + socDM;
      }
      default: return -3;
    }
  }

  /** @override */
  getSearchSkillLabel(method) {
    switch (method) {
      case 'corporate': return 'TWODSIX.Items.Skill.Liaison';
      case 'blackMarket': return 'TWODSIX.Items.Skill.Streetwise';
      case 'private': return 'TWODSIX.Items.Skill.Carousing';
      default: return 'TWODSIX.Items.Skill.Unskilled';
    }
  }

  /** @override */
  getSearchStarportBonus(starport) {
    return CDEE_STARPORT_SUPPLIER_BONUS[starport] ?? 0;
  }

  /** @override */
  getPriceRollSkill(crew) {
    const liaison = this.getCrewSkill(crew, 'Liaison');
    const intDM = 0; // TODO Get from actor
    const socDM = 0; // TODO Get from actor
    return liaison + Math.max(intDM, socDM);
  }

  /** @override */
  getCommonGoodsDMs() {
    return CDEE_COMMON_GOODS;
  }

  /** @override */
  getBrokerMaxSkill(starport) {
    return CDEE_BROKER_TABLE[starport] ?? 0;
  }

  /** @override */
  getBrokerCommission(skillLevel) {
    const commissions = { 0: 0, 1: 5, 2: 10, 3: 15, 4: 20 };
    return commissions[skillLevel] ?? (skillLevel * 5);
  }

  // ─── CDEE Hooks ──────────────────────────────────────────────────────────

  /** @override */
  shouldCheckSmuggling(cargo, world) {
    const lawLevel = parseInt(world?.system?.uwp?.substring(7, 8), 16) || 0;
    return lawLevel > 0 && cargo.some(c => c.isIllegal);
  }

  /** @override */
  async doSmugglingCheck(app, world) {
    const lawLevel = parseInt(world?.system?.uwp?.substring(7, 8), 16) || 0;
    const roll = await app._roll('2D6');
    const success = roll > lawLevel;

    if (!success) {
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.SmugglingFailure", { law: lawLevel }));
      // TODO Logic for confiscation/fine
    } else {
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.SmugglingSuccess", { law: lawLevel }));
    }
  }

  /** @override */
  shouldRollCargoTag() {
    return true;
  }

  /** @override */
  async rollCargoTag(app) {
    const roll1 = await app._roll('1D6');
    const roll2 = await app._roll('1D6');
    const d66 = roll1 * 10 + roll2;
    const tag = CDEE_CARGO_TAGS[d66] || 'Normal';
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CargoTag", { tag: game.i18n.localize(tag) }));
  }

  /** @override */
  shouldRollProblemWithDeal() {
    return true;
  }

  /** @override */
  async rollProblemWithDeal(app) {
    const roll = await app._roll('2D6');
    if (roll >= 10) { // Example threshold for "Problem with the deal"
      const pRoll = await app._roll('1D6') - 1;
      const colRoll = await app._roll('1D3');
      const row = CDEE_PROBLEM_TABLE[pRoll];
      let problem = '';
      if (colRoll === 1) {
        problem = row.item;
      } else if (colRoll === 2) {
        problem = row.supplier;
      } else {
        problem = row.world;
      }

      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.ProblemWithDeal", { problem: game.i18n.localize(problem) }));
    }
  }

  /** @override */
  getRelevantSkillNames() {
    return ['Liaison', 'Streetwise', 'Carousing', 'Admin'];
  }
}
