/**
 * BaseTraderRuleset.js
 * Abstract base class for trader ruleset logic.
 * Default implementations are compatible with Cepheus Engine (CE).
 */
export class BaseTraderRuleset {
  /**
   * Get available search method options for finding suppliers/buyers.
   * @param {number} worldTL - World tech level
   * @param {string} starport - Starport class letter
   * @returns {string[]} List of search method keys
   */
  getSearchMethods(worldTL, starport) {
    const methods = ['standard', 'blackMarket'];
    if (worldTL >= 8) {
      methods.push('online');
    }
    return methods;
  }

  /**
   * Get the effective skill level for a search method.
   * @param {object} crew - Crew skills summary
   * @param {string} method - Search method key
   * @returns {number} Skill level or UNSKILLED_PENALTY
   */
  getSearchSkillLevel(crew, method) {
    switch (method) {
      case 'standard': return this.getCrewSkill(crew, 'Broker');
      case 'blackMarket': return this.getCrewSkill(crew, 'Streetwise');
      case 'online': return this.getCrewSkill(crew, 'Computers');
      default: return -3; // UNSKILLED_PENALTY
    }
  }

  /**
   * Get the localization label for the skill used by a search method.
   * @param {string} method - Search method key
   * @returns {string} i18n key for the skill name
   */
  getSearchSkillLabel(method) {
    switch (method) {
      case 'standard': return 'TWODSIX.Items.Skill.Broker';
      case 'blackMarket': return 'TWODSIX.Items.Skill.Streetwise';
      case 'online': return 'TWODSIX.Items.Skill.Computers';
      default: return 'TWODSIX.Items.Skill.Unskilled';
    }
  }

  /**
   * Get the starport DM for search rolls.
   * @param {string} starport - Starport class letter
   * @returns {number} DM bonus
   */
  getSearchStarportBonus(starport) {
    const bonuses = { A: 6, B: 4, C: 2, D: 0, E: 0, X: 0 };
    return bonuses[starport] ?? 0;
  }

  /**
   * Get the target number for search rolls.
   * @returns {number} Threshold (default 8)
   */
  getSearchThreshold() {
    return 8;
  }

  /**
   * Get the base skill modifier for price negotiation rolls.
   * @param {object} crew - Crew skills summary
   * @returns {number} Skill level
   */
  getPriceRollSkill(crew) {
    return this.getCrewSkill(crew, 'Broker');
  }

  /**
   * Get DM tables for common goods.
   * @returns {object|null} Map of good names to {purchaseDM, saleDM} or null
   */
  getCommonGoodsDMs() {
    return null;
  }

  /**
   * Get the maximum broker skill available at a starport.
   * @param {string} starport - Starport class letter
   * @returns {number} Max skill level
   */
  getBrokerMaxSkill(starport) {
    const maxSkills = { A: 4, B: 3, C: 2, D: 1, E: 0, X: 0 };
    return maxSkills[starport] ?? 0;
  }

  /**
   * Get the commission percentage for a broker's skill level.
   * @param {number} skillLevel - Broker skill level
   * @returns {number} Commission % (e.g. 5 for 5%)
   */
  getBrokerCommission(skillLevel) {
    return 5 * (skillLevel + 1);
  }

  // ─── CDEE Hooks (No-ops in base) ──────────────────────────────────────────

  /** @returns {boolean} */
  shouldCheckSmuggling(cargo, world) {
    return false;
  }

  /** @returns {Promise<void>} */
  async doSmugglingCheck(app, world) {
    // No-op
  }

  /** @returns {boolean} */
  shouldRollCargoTag() {
    return false;
  }

  /** @returns {Promise<void>} */
  async rollCargoTag(app) {
    // No-op
  }

  /** @returns {boolean} */
  shouldRollProblemWithDeal() {
    return false;
  }

  /** @returns {Promise<void>} */
  async rollProblemWithDeal(app) {
    // No-op
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  /**
   * Get the names of skills relevant to this ruleset.
   * @returns {string[]}
   */
  getRelevantSkillNames() {
    return ['Broker', 'Streetwise', 'Computers'];
  }

  /**
   * Get the best crew skill level by name.
   * @param {object} crew - Crew skills summary (from state.crew)
   * @param {string} skillName - Skill name
   * @returns {number} Highest skill level or UNSKILLED_PENALTY
   */
  getCrewSkill(crew, skillName) {
    if (!Array.isArray(crew)) {
      return -3;
    }
    const skillKey = skillName.toLowerCase();
    // Helper to check both the new generic skills map and old specific fields
    return crew.reduce((best, c) => {
      const val = c.skills?.[skillKey] ?? this._getLegacySkillValue(c, skillKey);
      return Math.max(best, val ?? -3);
    }, -3);
  }

  /** @private */
  _getLegacySkillValue(crewMember, skillKey) {
    switch (skillKey) {
      case 'broker': return crewMember.brokerSkill;
      case 'streetwise': return crewMember.streetwiseSkill;
      case 'computers': return crewMember.computersSkill;
      default: return undefined;
    }
  }
}
