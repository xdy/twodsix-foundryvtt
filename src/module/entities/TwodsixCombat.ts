// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";

/**
 * @import { TwodsixActor, TwodsixCombatant } from "./_module.mjs";
 */

/**
 * Extended Combat class for Twodsix system with support for space combat phases.
 * Provides structured phase-based combat for ship encounters with action tracking
 * and initiative management.
 *
 * Features:
 * - Space combat phase management (3-phase or 5-phase systems)
 * - Action budget tracking for ships and space objects
 * - Round management with phase progression
 * - Localized phase display
 *
 * Inspired by Starfinder RPG and Draw Steel system implementations.
 *
 * @extends {foundry.documents.Combat}
 */
export default class TwodsixCombat extends foundry.documents.Combat {
  declare data: Combat.Data & {
    flags: {
      twodsix: {
        currentPhase?: string;
        phaseIndex?: number;
        isSpaceCombat?: boolean;
      }
    }
  };

  /**
   * Prepare derived data for this combat
   * @inheritdoc
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    Hooks.callAll("twodsix.prepareCombatData", this);
  }

  /**
   * Initialize combat flags on creation
   * @param {object} data - The initial data
   * @param {object} options - Creation options
   * @param {User} user - The creating user
   * @returns {Promise<boolean|void>} Whether creation should proceed
   * @protected
   * @inheritdoc
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    const isSpaceCombat = this._detectSpaceCombat(data.combatants);
    const update = {
      "flags.twodsix.isSpaceCombat": isSpaceCombat,
      "flags.twodsix.phaseIndex": 0
    };

    if (isSpaceCombat) {
      const config = this.getSpaceCombatConfig();
      update["flags.twodsix.currentPhase"] = config.phases?.[0] || 'declaration';
    }

    this.updateSource(update);
    return true;
  }

  /**
   * Detect if this will be a space combat based on combatant types
   * Only returns true if ALL combatants are ships/space objects
   * @param {Array} combatants - Optional array of combatants to check
   * @returns {boolean} Whether this is a space combat
   * @private
   */
  _detectSpaceCombat(combatants = []) {
    // Use provided combatants or existing ones
    const combatantList = combatants.length > 0 ? combatants : this.combatants?.contents || [];

    // No combatants means not a space combat
    if (combatantList.length === 0) return false;

    // All combatants must be ships/space objects for space combat
    return combatantList.every(c => {
      // Use the combatant's method if available, otherwise check actor type directly
      if (c._isSpaceActor) {
        return c._isSpaceActor();
      }
      // Fallback for construction-time checks before combatant methods are available
      const actor = c.actor || game.actors?.get(c.actorId);
      return actor && ['ship', 'space-object'].includes(actor.type);
    });
  }

  /**
   * Check if this is a space combat encounter
   */
  isSpaceCombat(): boolean {
    return this.flags?.twodsix?.isSpaceCombat || this._detectSpaceCombat();
  }

  /**
   * Check if this combat should use phase-based mechanics
   */
  usePhases(): boolean {
    if (!this.isSpaceCombat()) {
      return false;
    }
    const config = this.getSpaceCombatConfig();
    return config.key !== 'none' && config.phases.length > 0;
  }

  /**
   * Get the space combat phase configuration based on the spaceCombatPhases setting
   */
  getSpaceCombatConfig() {
    const phaseKey = game.settings.get('twodsix', 'spaceCombatPhases');
    return TWODSIX.SPACE_COMBAT_PHASE_TYPES?.[phaseKey as keyof typeof TWODSIX.SPACE_COMBAT_PHASE_TYPES] || TWODSIX.SPACE_COMBAT_PHASE_TYPES.threePhase;
  }

  /**
   * Get the action budget for the current phase type
   */
  getActionBudget() {
    if (!this.usePhases()) {
      return {
        minorActions: 0,
        significantActions: 0
      };
    }

    const config = this.getSpaceCombatConfig();
    return config.actionBudget || {
      minorActions: 3,
      significantActions: 1
    };
  }

  /**
   * Roll initiative for combat
   * @inheritdoc
   */
  async rollInitiative(ids, {formula = null, updateTurn = true, messageOptions = {}} = {}) {
    // Use core behavior - TwodsixCombatant.getInitiativeRoll will handle ship modifiers
    return super.rollInitiative(ids, {formula, updateTurn, messageOptions});
  }

  /**
   * Get the current space combat phase name
   * @returns {string|null} Current phase name or null if not space combat
   */
  getCurrentPhase(): string | null {
    if (!this.usePhases()) {
      return null;
    }

    const phaseIndex = this.flags.twodsix?.phaseIndex ?? 0;
    const config = this.getSpaceCombatConfig();

    if (!config.phases || config.phases.length === 0) {
      console.warn("TwodsixCombat | No phases configured for space combat");
      return null;
    }

    return config.phases[phaseIndex] || config.phases[0];
  }

  /**
   * Get the localized current phase name
   */
  getCurrentPhaseLocalized(): string | null {
    const phaseName = this.getCurrentPhase();
    if (!phaseName) return null;

    // Try to localize the phase name, fallback to the raw name if no localization exists
    const localizedName = game.i18n.localize(`TWODSIX.Combat.Phases.${phaseName}`);
    return localizedName !== `TWODSIX.Combat.Phases.${phaseName}` ? localizedName : phaseName;
  }

  /**
   * Get the current phase index
   */
  getCurrentPhaseIndex(): number {
    return this.flags.twodsix?.phaseIndex ?? 0;
  }

  /**
   * Calculate the next phase index based on current configuration
   * @param {number} currentIndex - Current phase index (defaults to current)
   * @returns {{nextIndex: number, isNewRound: boolean}} Calculated phase transition
   * @private
   */
  _calculateNextPhaseIndex(currentIndex = this.getCurrentPhaseIndex()) {
    if (!this.usePhases()) {
      return { nextIndex: 0, isNewRound: false };
    }

    const config = this.getSpaceCombatConfig();
    const phases = config?.phases ?? [];

    if (!phases.length) {
      return { nextIndex: 0, isNewRound: true };
    }

    const loopStart = config.loopBackPhase
      ? Math.max(0, phases.indexOf(config.loopBackPhase))
      : 0;

    const rawNext = currentIndex + 1;
    const wrapped = rawNext >= phases.length ? loopStart : rawNext;
    const isNewRound = wrapped <= currentIndex;

    return { nextIndex: wrapped, isNewRound };
  }

  /**
   * Update phase data consistently and broadcast to all clients
   * @private
   */
  async _updatePhaseData(phaseIndex: number, additionalUpdates: Record<string, any> = {}): Promise<void> {
    const config = this.getSpaceCombatConfig();
    const phases = config.phases || [];

    const updateData = {
      'flags.twodsix.phaseIndex': phaseIndex,
      'flags.twodsix.currentPhase': phases[phaseIndex],
      ...additionalUpdates
    };

    // Use update() to broadcast to all clients
    // Permission check is bypassed because this is called from nextTurn flow
    await this.update(updateData, { diff: false });
  }

  /**
   * Reset phase to the beginning
   */
  async resetPhase(): Promise<void> {
    if (!this.isSpaceCombat()) {
      return;
    }

    await this._updatePhaseData(0);
  }

  /**
   * Reset counters for all space combatants
   * @param {boolean} isNewRound - Whether this is a new round (resets reactions/thrust) or just new phase
   * @private
   */
  async _resetCombatantCounters(isNewRound: boolean): Promise<void> {
    for (const combatant of this.combatants) {
      if (combatant._isSpaceActor?.()) {
        if (isNewRound) {
          await combatant.resetRoundCounters?.();
        } else {
          await combatant.resetPhaseCounters?.();
        }
      }
    }
  }

  /**
   * Advance to the next phase with round management
   * This method handles advancing to the next phase and manages round transitions
   * when needed. It's used by the UI to advance phases manually and by nextTurn.
   */
  async nextPhase(): Promise<void> {
    if (!this.isSpaceCombat()) return;

    const { nextIndex, isNewRound } = this._calculateNextPhaseIndex();

    if (isNewRound) {
      await this.nextRound();
    } else {
      await this._updatePhaseData(nextIndex, { turn: 0 });
      await this._resetCombatantCounters(false);
    }
  }

  /**
   * Go to the previous phase
   * This method handles going backwards through phases with proper boundary checking
   */
  async previousPhase(): Promise<boolean> {
    if (!this.isSpaceCombat()) return false;

    const config = this.getSpaceCombatConfig();
    const phases = config.phases ?? [];
    if (!phases.length) return false;

    const currentIndex = this.getCurrentPhaseIndex();
    const loopStart = config.loopBackPhase
      ? Math.max(0, phases.indexOf(config.loopBackPhase))
      : 0;

    let prevIndex = currentIndex - 1;
    const additionalUpdates: any = { turn: 0 };

    // If we've gone below the loop start
    if (prevIndex < loopStart) {
      // Can only wrap backwards if we're past round 1
      if (this.round <= 1) {
        return false; // First round or invalid state - can't go back to round 0
      }
      // Round 2+ - wrap to last phase and decrement round
      prevIndex = phases.length - 1;
      additionalUpdates.round = this.round - 1;
    }

    await this._updatePhaseData(prevIndex, additionalUpdates);
    return true;
  }

  /**
   * Get formatted phase display information for UI
   */
  getPhaseDisplayInfo() {
    if (!this.isSpaceCombat()) {
      return null;
    }

    const config = this.getSpaceCombatConfig();
    const currentPhaseIndex = this.getCurrentPhaseIndex();
    const currentPhaseName = this.getCurrentPhaseLocalized(); // Use localized name
    const phases = config?.phases || [];

    return {
      isSpaceCombat: true,
      currentPhase: currentPhaseName,
      currentPhaseIndex: currentPhaseIndex,
      phases: phases,
      phaseIndicator: `${currentPhaseIndex + 1} / ${phases.length}`,
      config: config,
      canNavigatePhases: game.user.isGM
    };
  }

  /**
   * Override startCombat to initialize space combat phases
   * @returns {Promise<this>} The combat instance
   * @inheritdoc
   */
  async startCombat() {
    // Extension point: Delegate to actors for combat initialization
    // Uncomment if ship/space-object data models need to initialize state
    // for (const combatant of this.combatants) {
    //   await combatant.actor?.system?.startCombat?.(combatant);
    // }

    // Initialize space combat if not already set
    if (this.isSpaceCombat() && !this.flags?.twodsix?.isSpaceCombat) {
      await this.update({
        'flags.twodsix.isSpaceCombat': true
      });
      await this.resetPhase();
    }

    return await super.startCombat();
  }

  /**
   * Handle combat cleanup and effect expiration
   * @param {object} options - Deletion options
   * @param {string} userId - User performing the deletion
   * @returns {Promise<void>}
   * @protected
   * @inheritdoc
   */
  async _onDelete(options, userId) {
    await super._onDelete(options, userId);

    if (!game.user.isActiveGM || !this.round) return;

    // Clean up space combat effects and reset ship systems
    if (this.isSpaceCombat()) {
      for (const combatant of this.combatants) {
        const actor = combatant.actor;
        if (!actor || !['ship', 'space-object'].includes(actor.type)) continue;

        // Extension point: Reset ship combat state
        // Uncomment if ship/space-object data models need to clean up state
        // await actor.system?.endCombat?.(combatant);

        // Clean up temporary effects
        const effectUpdates = [];
        for (const effect of actor.effects) {
          // Remove combat-duration effects (standard Foundry pattern)
          // and space combat specific effects (custom flag, currently unused)
          if (effect.duration?.type === "combat" /* || effect.flags?.twodsix?.spaceCombat */) {
            effectUpdates.push({ _id: effect.id, disabled: true });
          }
        }

        if (effectUpdates.length > 0) {
          await actor.updateEmbeddedDocuments("ActiveEffect", effectUpdates);
        }
      }
    }
  }

  /**
   * Override nextRound to reset phase to loop start
   * This is called by nextPhase when transitioning to a new round
   */
  async nextRound(): Promise<this> {
    if (this.isSpaceCombat() && this.usePhases()) {
      // Let parent handle round increment and lifecycle
      await super.nextRound();

      // Then reset phase to loop start
      const config = this.getSpaceCombatConfig();
      const loopStart = config.loopBackPhase
        ? Math.max(0, config.phases.indexOf(config.loopBackPhase))
        : 0;

      // Update phase data (round was already incremented by super)
      await this._updatePhaseData(loopStart, { turn: 0 });

      return this;
    }

    // Non-space combat or space combat without phases: use default behavior
    return await super.nextRound();
  }

  /**
   * Foundry lifecycle hook called when a new round starts
   * Handle counter resets and initiative rerolls here
   * @protected
   */
  protected async _onStartRound(): Promise<void> {
    // Call parent implementation first
    await super._onStartRound();

    // Only handle phase-based space combat initialization here
    if (!this.isSpaceCombat() || !this.usePhases()) {
      return;
    }

    const config = this.getSpaceCombatConfig();
    if (!config) {
      return;
    }

    // This hook only fires on actual round transitions, so always treat as new round
    await this._resetCombatantCounters(true);

    // Re-roll initiative if configured for this phase system
    if (config.reRollInitiative) {
      // Force re-roll for all combatants (not just null initiatives)
      const ids = this.combatants.map(c => c.id);
      await this.rollInitiative(ids);
    }
  }

  /**
   * Override nextTurn to advance phases when all combatants have acted
   * In phase-based combat, each phase cycles through all combatants once
   */
  async nextTurn(): Promise<this> {
    if (!this.usePhases()) {
      return await super.nextTurn();
    }

    // Check if we're at the last turn in this phase
    const nextTurnIndex = this.turn + 1;
    if (nextTurnIndex >= this.turns.length) {
      // End of turns - advance to next phase (and round if needed)
      await this.nextPhase();
      return this;
    }

    // Normal turn advancement within the phase - let core handle it
    return await super.nextTurn();
  }

  /**
   * Actions taken after combatants are added
   * @protected
   * @inheritdoc
   */
  _onCreateDescendantDocuments(_parent, collection, documents, data, options, userId) {
    super._onCreateDescendantDocuments(_parent, collection, documents, data, options, userId);

    // When combatants are added, recalculate space combat status
    if (collection === "combatants" && game.user.isGM) {
      const isSpaceCombat = this._detectSpaceCombat();
      const wasSpaceCombat = this.flags?.twodsix?.isSpaceCombat || false;

      // Update space combat flag if it changed
      if (isSpaceCombat !== wasSpaceCombat) {
        this.update({ 'flags.twodsix.isSpaceCombat': isSpaceCombat });

        // Reset phases if becoming space combat
        if (isSpaceCombat) {
          this.resetPhase();
        }
      }
    }
  }
}
