/**
 * Shared trader rules for Cepheus-family rulesets that use Liaison / Streetwise / Carousing
 * search methods (CEL, CLU, CDEE). Characteristic DMs from actors are not yet wired (TODO).
 */
import { BaseTraderRuleset, SEARCH_METHOD } from './BaseTraderRuleset.js';

export class CepheusLiaisonTraderRuleset extends BaseTraderRuleset {
  /** @override */
  getSearchMethods(_worldTL, _starport) {
    return [SEARCH_METHOD.CORPORATE, SEARCH_METHOD.BLACK_MARKET, SEARCH_METHOD.PRIVATE];
  }

  /** @override */
  getSearchSkillLevel(crew, method) {
    switch (method) {
      case SEARCH_METHOD.CORPORATE: {
        const liaison = this.getCrewSkill(crew, 'Liaison');
        const intDM = 0; // TODO Get from actor
        const socDM = 0;
        return liaison + Math.max(intDM, socDM);
      }
      case SEARCH_METHOD.BLACK_MARKET: {
        const streetwise = this.getCrewSkill(crew, 'Streetwise');
        const intDM = 0; // TODO Get from actor
        return streetwise + intDM;
      }
      case SEARCH_METHOD.PRIVATE: {
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
      case SEARCH_METHOD.CORPORATE: return 'TWODSIX.Items.Skill.Liaison';
      case SEARCH_METHOD.BLACK_MARKET: return 'TWODSIX.Items.Skill.Streetwise';
      case SEARCH_METHOD.PRIVATE: return 'TWODSIX.Items.Skill.Carousing';
      default: return 'TWODSIX.Items.Skill.Unskilled';
    }
  }

  /** @override */
  getPriceRollSkill(crew) {
    const liaison = this.getCrewSkill(crew, 'Liaison');
    const intDM = 0; // TODO Get from actor
    const socDM = 0; // TODO Get from actor
    return liaison + Math.max(intDM, socDM);
  }

  /**
   * CEL/CLU-style smuggling: harassment blocks illegal sales on failure.
   * @override
   */
  shouldCheckSmuggling(cargo, world) {
    const lawLevel = parseInt(world?.system?.uwp?.substring(7, 8), 16) || 0;
    return lawLevel > 0 && cargo.some(c => c.isIllegal);
  }

  /** @override */
  async doSmugglingCheck(app, world) {
    const lawLevel = parseInt(world?.system?.uwp?.substring(7, 8), 16) || 0;
    const roll = await app._roll('2D6');
    const harassment = roll < lawLevel;

    if (harassment) {
      const cache = app.state?.worldVisitCache?.[app.state.currentWorldHex];
      if (cache) {
        cache.illegalSalesBlocked = true;
      }
      await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.SmugglingHarassment', { law: lawLevel }));
    } else {
      await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.SmugglingSuccess', { law: lawLevel }));
    }
  }

  /** @override */
  getRelevantSkillNames() {
    return ['Liaison', 'Streetwise', 'Carousing', 'Admin'];
  }
}
