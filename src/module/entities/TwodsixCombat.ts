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
   */
  _detectSpaceCombat(combatants = []) {
    // If no combatants array provided, use existing combatants
    let combatantList: TwodsixActor[] = [];
    if (!combatants || combatants.length === 0) {
      combatantList = this.combatants.contents;
    }

    // No combatants means not a space combat
    if (combatantList.length === 0) return false;

    // All combatants must be ships/space objects for space combat
    return combatantList.every(c => {
      const actor = c.actor || game.actors.get(c.actorId);
      return ['ship', 'space-object'].includes(actor?.type);
    });
  }

  /**
   * Check if this is a space combat encounter
   */
  isSpaceCombat(): boolean {
    return this.flags?.twodsix?.isSpaceCombat || this._detectSpaceCombat();
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
    if (!this.isSpaceCombat()) {
      return {
        minorActions: 3,
        significantActions: 1
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
   * Get the current phase name
   */
  getCurrentPhase(): string | null {
    if (!this.isSpaceCombat()) {
      return null;
    }

    const phaseIndex = this.flags.twodsix?.phaseIndex ?? 0;
    const config = this.getSpaceCombatConfig();
    return config.phases?.[phaseIndex] || null;
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
    if (!this.isSpaceCombat()) {
      return { nextIndex: 0, isNewRound: false };
    }

    const config = this.getSpaceCombatConfig();
    const phases = config?.phases || [];

    if (phases.length === 0) {
      console.warn("TwodsixCombat | No phases configured for space combat");
      return { nextIndex: 0, isNewRound: false };
    }

    let nextIndex = currentIndex + 1;
    let isNewRound = false;

    // Check if we've reached the end of phases
    if (nextIndex >= phases.length) {
      if (config.loopBackPhase) {
        const loopIndex = phases.indexOf(config.loopBackPhase);
        nextIndex = loopIndex !== -1 ? loopIndex : 0;
        // If we're looping back to an earlier phase, it's a new round
        isNewRound = nextIndex < currentIndex;
      } else {
        // End of phase sequence, reset to beginning and advance round
        nextIndex = 0;
        isNewRound = true;
      }
    }

    return { nextIndex, isNewRound };
  }

  /**
   * Update phase data consistently
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

    await this.update(updateData);
  }

  /**
   * Advance to the next phase
   * This handles phase transitions and creates event data for hooks
   * Returns the new phase index
   */
  async advancePhase(): Promise<number> {
    if (!this.isSpaceCombat()) {
      return 0;
    }

    const { nextIndex } = this._calculateNextPhaseIndex();
    await this._updatePhaseData(nextIndex);
    return nextIndex;
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
   * Advance phase with round management
   * This method handles advancing to the next phase and manages round transitions
   * when needed. It's used by the UI to advance phases manually.
   */
  async advancePhaseWithRoundManagement(): Promise<void> {
    if (!this.isSpaceCombat()) {
      return;
    }

    const { nextIndex, isNewRound } = this._calculateNextPhaseIndex();

    // If we need to advance the round, use nextRound which handles everything
    if (isNewRound) {
      await this.nextRound();
    } else {
      // Just advance the phase
      await this._updatePhaseData(nextIndex, { turn: 0 });
    }
  }

  /**
   * Go to the previous phase
   * This method handles going backwards through phases with proper boundary checking
   */
  async previousPhase(): Promise<boolean> {
    if (!this.isSpaceCombat()) {
      return false;
    }

    const config = this.getSpaceCombatConfig();
    const phases = config.phases || [];
    const currentIndex = this.getCurrentPhaseIndex();
    let prevIndex = currentIndex - 1;

    if (prevIndex < 0) {
      // Check for looping
      if (config.loopBackPhase) {
        prevIndex = phases.length - 1;
      } else {
        // Cannot go to previous phase, return false to indicate this
        return false;
      }
    }

    await this._updatePhaseData(prevIndex, { turn: 0 });
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
    // Delegate to actors for combat initialization
    for (const combatant of this.combatants) {
      await combatant.actor?.system?.startCombat?.(combatant);
    }

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

        // Reset ship combat state
        await actor.system?.endCombat?.(combatant);

        // Clean up temporary effects
        const effectUpdates = [];
        for (const effect of actor.effects) {
          if (effect.duration?.type === "combat" || effect.flags?.twodsix?.spaceCombat) {
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
   * Override nextRound to handle phase advancement and initiative rerolls
   */
  async nextRound(): Promise<this> {
    if (this.isSpaceCombat()) {
      const config = this.getSpaceCombatConfig();
      const { nextIndex, isNewRound } = this._calculateNextPhaseIndex();

      // Build update data for phase and round
      const additionalUpdates: any = { turn: 0 };

      // Only increment round if we're actually starting a new round
      if (isNewRound) {
        additionalUpdates.round = this.round + 1;
      }

      // Apply all updates atomically
      await this._updatePhaseData(nextIndex, additionalUpdates);

      // Reroll initiative if starting new round and configured to do so
      if (isNewRound && config.reRollInitiative) {
        // Clear initiative for all combatants and roll new initiatives
        const updates = this.combatants.map(c => ({
          _id: c.id,
          initiative: null
        }));

        await this.updateEmbeddedDocuments("Combatant", updates);

        // Roll initiative for all combatants
        await this.rollAll();
      }

      return this;
    }

    // Non-space combat: use default behavior
    return await super.nextRound();
  }

  /**
   * Override _onUpdate to handle phase-specific logic
   */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    // Only run for active GM
    if (!game.users.activeGM?.isSelf) return;

    // Handle phase change effects
    if (changed.flags?.twodsix?.phaseIndex !== undefined) {
      this._onPhaseChange();
    }
  }

  /**
   * Handle actions when phase changes
   */
  async _onPhaseChange(): Promise<void> {
    if (!this.isSpaceCombat()) return;

    // Reset action/reaction counters for all combatants at phase start
    for (const combatant of this.combatants) {
      if (['ship', 'space-object'].includes(combatant.actor?.type)) {
        await combatant.resetPhaseCounters?.();
      }
    }
  }

  /**
   * Override nextTurn - don't advance phases here
   * Phase advancement happens in nextRound when a full round completes
   */
  async nextTurn(): Promise<this> {
    return await super.nextTurn();
  }

  /**
   * End the current turn without starting a new one
   * Useful for space combat when ending a phase
   */
  async endTurn() {
    const updateData = { round: this.round, turn: null };
    const updateOptions = { direction: 1, endTurn: true };
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    await this.update(updateData, updateOptions);
    return this;
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
