// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";

/**
 * Extended Combat class for Twodsix system with support for space combat phases
 * Inspired by Starfinder RPG and Draw Steel system implementations
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
   */
  _preCreate(data, options, user) {
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
    return super._preCreate(data, options, user);
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
   * Get the current phase index
   */
  getCurrentPhaseIndex(): number {
    return this.flags.twodsix?.phaseIndex ?? 0;
  }

  /**
   * Advance to the next phase
   * This handles phase transitions and creates event data for hooks
   */
  async advancePhase(): Promise<void> {
    if (!this.isSpaceCombat()) {
      return;
    }

    const config = this.getSpaceCombatConfig();
    const phases = config.phases || [];
    const currentIndex = this.getCurrentPhaseIndex();
    let nextIndex = currentIndex + 1;

    // Check if we've reached the end of phases
    if (nextIndex >= phases.length) {
      // Check for looping phases (e.g., Cepheus Universal)
      if (config.loopBackPhase) {
        const loopIndex = phases.indexOf(config.loopBackPhase);
        if (loopIndex !== -1) {
          nextIndex = loopIndex;
          // Just advance phase, not round
          await this.update({
            'flags.twodsix.phaseIndex': nextIndex,
            'flags.twodsix.currentPhase': phases[nextIndex]
          });
        } else {
          // Fallback to start and advance round
          await this.nextRound();
        }
      } else {
        // End of phase sequence, call nextRound which handles initiative reroll
        await this.nextRound();
      }
    } else {
      // Just advance phase, stay in same round
      await this.update({
        'flags.twodsix.phaseIndex': nextIndex,
        'flags.twodsix.currentPhase': phases[nextIndex]
      });
    }
  }

  /**
   * Reset phase to the beginning
   */
  async resetPhase(): Promise<void> {
    if (!this.isSpaceCombat()) {
      return;
    }

    const config = this.getSpaceCombatConfig();
    const phases = config.phases || [];

    await this.update({
      'flags.twodsix.phaseIndex': 0,
      'flags.twodsix.currentPhase': phases[0] || 'declaration'
    });
  }

  /**
   * Override startCombat to initialize space combat phases
   * @inheritdoc
   */
  async startCombat(): Promise<this> {
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
   * Override nextRound to handle initiative rerolls and phase reset
   */
  async nextRound(): Promise<this> {
    if (this.isSpaceCombat()) {
      const config = this.getSpaceCombatConfig();

      // Reset to first phase at the start of new round
      await this.resetPhase();

      // Check if we need to reroll initiative each round
      if (config.reRollInitiative) {
        // Clear initiative for all combatants and roll new initiatives
        const updates = this.combatants.map(c => ({
          _id: c.id,
          initiative: null
        }));

        await this.updateEmbeddedDocuments("Combatant", updates);

        // Roll initiative for all combatants
        await this.rollAll();
      }
    }

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
   * Override nextTurn - phase advancement is manual via advancePhase()
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
