// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixCombat from "./TwodsixCombat";

/**
 * @import { TwodsixActor } from "./_module.mjs";
 */

/**
 * Extended Combatant class for Twodsix system with support for space combat action tracking.
 * Manages initiative, actions, and reactions for ship-based encounters.
 *
 * Features:
 * - Ship initiative calculation with thrust and pilot skill bonuses
 * - Action economy management (minor, significant, reactions)
 * - Space combat phase tracking
 * - Automatic action budget enforcement
 *
 * Provides structured action economy management and ship-specific initiative calculations.
 *
 * @extends {foundry.documents.Combatant}
 */
export default class TwodsixCombatant extends foundry.documents.Combatant {
  declare data: Combatant.Data & {
    flags: {
      twodsix: {
        spacePhase?: 'declaration' | 'actions' | 'damage';
        minorActionsUsed?: number;
        significantActionsUsed?: number;
        reactionsUsed?: number;
        reactionsAvailable?: number;
        hasty?: boolean;
      }
    }
  };

  /**
   * Prepare derived data for this combatant
   * @inheritdoc
   */
  prepareDerivedData() {
    super.prepareDerivedData();
    Hooks.callAll("twodsix.prepareCombatantData", this);
  }

  /**
   * Pre-update validation and processing
   * @param {object} changes - Proposed changes
   * @param {object} options - Update options
   * @param {User} user - User performing update
   * @returns {Promise<boolean|void>} Whether update should proceed
   * @inheritdoc
   */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) {
      return false;
    }

    // If initiative is being increased, trigger start of turn for actor
    if (("initiative" in changes) && (changes.initiative > this.initiative)) {
      await this.actor?.system?._onStartTurn?.(this);
    }

    return true;
  }

  /**
   * Post-update processing
   * @inheritdoc
   */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    // Refresh combatant display when relevant data changes
    if ("initiative" in changed || changed.flags?.twodsix) {
      this.refreshCombatant();
    }
  }

  /**
   * Post-delete cleanup
   * @inheritdoc
   */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    this.refreshCombatant();
  }

  /**
   * Refresh combatant display elements (token bars, actor sheet)
   * Inspired by Draw Steel's refreshCombatant pattern
   */
  refreshCombatant() {
    // Refresh token resource bars
    this.token?.object?.renderFlags?.set({ refreshBars: true });

    // Refresh actor sheet if visible and user has permission
    if (this.actor?.sheet?.rendered && this.actor.testUserPermission(game.user, "OBSERVER")) {
      this.actor.sheet.render(false);
    }
  }

  protected _getInitiativeFormula():string {
    const actorType = (<TwodsixActor>this.actor).type;

    // Ships and space-objects use the ship initiative formula
    if (["ship", "space-object"].includes(actorType)) {
      const combat = this.combat as TwodsixCombat;
      const phaseConfig = combat?.getSpaceCombatConfig?.();
      return phaseConfig?.shipInitiativeFormula || <string>game.settings.get("twodsix", "shipInitiativeFormula");
    }

    // Personal combatants use the standard formula
    return <string>game.settings.get("twodsix", "initiativeFormula");
  }

  /**
   * Get roll data for initiative formula resolution
   * Adds ship-specific variables like @shipThrustRating and @skills.Pilot
   */
  getRollData() {
    const data = this.actor?.getRollData?.() || this.actor.system || {};

    // Only add space combat modifiers for ships and space-objects
    if (!['ship', 'space-object'].includes(this.actor?.type)) {
      return data;
    }

    // Get thrust and pilot skill based on actor type
    const thrustRating = this._getThrustRating(this.actor);
    const pilotSkill = this._getPilotSkill(this.actor);

    // Add space combat roll data
    data.shipThrustRating = thrustRating;
    if (!data.skills) {
      data.skills = {};
    }
    data.skills.Pilot = pilotSkill;
    data.skills.Piloting = pilotSkill;
    data.thrustBonus = this._calculateThrustBonus(thrustRating);

    return data;
  }

  /**
   * Get thrust rating from a ship or space-object actor
   * @param {object} actor - The actor to get thrust from
   * @returns {number} Thrust rating value
   * @private
   */
  _getThrustRating(actor) {
    if (!actor) {
      console.warn("TwodsixCombatant | _getThrustRating called with null actor");
      return 0;
    }

    if (actor.type === "ship") {
      // Try derived data first
      let thrust = actor.system.shipStats?.drives?.mDrive?.rating || 0;

      // Fall back to searching m-drive components
      if (!thrust && actor.items) {
        const mDriveComponents = actor.items.filter(item =>
          ["m-drive", "mdrive", "m drive"].includes(item.system.subtype?.toLowerCase())
        );
        for (const component of mDriveComponents) {
          const rating = component.system.rating || 0;
          if (rating > thrust) {
            thrust = rating;
          }
        }
      }

      return thrust;
    }

    if (actor.type === "space-object") {
      return actor.system.thrust || 0;
    }

    return 0;
  }

  /**
   * Get pilot skill from ship's crew
   * @private
   */
  _getPilotSkill(actor: any): number {
    // Only ships have pilots (not space-objects)
    if (actor.type !== "ship") {
      return 0;
    }

    let bestPilotSkill = 0;
    const crewActorIds = Object.keys(actor.system.shipPositionActorIds || {});

    for (const actorId of crewActorIds) {
      const crewActor = game.actors?.get(actorId);
      if (!crewActor) {
        continue;
      }

      const skills = crewActor.itemTypes?.skills || crewActor.items.filter(item => item.type === "skills");
      for (const skill of skills) {
        if (skill.name?.toLowerCase().includes("pilot")) {
          const skillValue = skill.system.value || 0;
          if (skillValue > bestPilotSkill) {
            bestPilotSkill = skillValue;
          }
        }
      }
    }

    return bestPilotSkill;
  }

  /**
   * Calculate thrust bonus (+1 for highest thrust in combat)
   * @private
   */
  _calculateThrustBonus(myThrust: number): number {
    if (myThrust === 0) {
      return 0;
    }

    const combat = this.combat as TwodsixCombat;
    if (!combat?.combatants) {
      return 0;
    }

    // Check if any other combatant has higher thrust (or equal with lower ID)
    for (const other of combat.combatants) {
      if (other.id === this.id) {
        continue;
      }
      if (!['ship', 'space-object'].includes(other.actor?.type)) {
        continue;
      }

      const otherThrust = this._getThrustRating(other.actor);

      // Higher thrust wins
      if (otherThrust > myThrust) {
        return 0;
      }

      // Tie-breaker: lower ID wins
      if (otherThrust === myThrust && other.id < this.id) {
        return 0;
      }
    }

    // This combatant has highest thrust (or wins tie-breaker)
    return 1;
  }

  /**
   * Get the initiative roll for this combatant
   * For ships in space combat, uses custom roll data with thrust and pilot skill bonuses
   * @inheritdoc
   */
  getInitiativeRoll(formula) {
    // For space combats, create roll with custom ship data
    const combat = this.combat as TwodsixCombat;
    if (combat?.isSpaceCombat?.()) {
      // _getInitiativeFormula already provides the right formula
      const rollFormula = formula || this._getInitiativeFormula();
      const rollData = this.getRollData();
      return new Roll(rollFormula, rollData);
    }

    // Fall back to standard behavior for non-space combats
    return super.getInitiativeRoll(formula);
  }

  /**
   * Calculate available reactions based on initiative
   */
  getAvailableReactions(): number {
    if (!['ship', 'space-object'].includes(this.actor?.type)) {
      return 0;
    }

    const combat = this.combat as TwodsixCombat;
    const config = combat?.getSpaceCombatConfig?.();

    // Check if this combat type uses thrust pool for reactions
    if (config?.actionBudget?.thrustPoolForReactions) {
      // Return available thrust instead of separate reactions
      return this.availableThrust;
    }

    const formula = config?.reactionFormula;

    if (formula && typeof formula === 'function') {
      return formula(this.initiative ?? 0);
    }

    // Default CE formula if not specified
    const initiative = this.initiative ?? 0;
    if (initiative <= 4) {
      return 1;
    } else if (initiative <= 8) {
      return 2;
    } else if (initiative <= 12) {
      return 3;
    } else {
      return 4;
    }
  }

  /**
   * Get available actions for this combatant from combat budget
   * @returns {object} Action budget with minor and significant action counts
   */
  getActionBudget(): { minorActions: number; significantActions: number } {
    const combat = this.combat as TwodsixCombat;
    return combat?.getActionBudget?.() ?? {
      minorActions: 3,
      significantActions: 1
    };
  }

  /**
   * Get current action usage counts
   * @private
   */
  _getActionCounts() {
    return {
      minorUsed: this.flags.twodsix?.minorActionsUsed ?? 0,
      significantUsed: this.flags.twodsix?.significantActionsUsed ?? 0,
      reactionsUsed: this.flags.twodsix?.reactionsUsed ?? 0,
      reactionsAvailable: this.getAvailableReactions(),
      thrustUsed: this.flags.twodsix?.thrustUsed ?? 0,
      thrustAvailable: this.getMaxThrustPoints()
    };
  }

  /**
   * Get the maximum thrust points available for this ship
   * @returns {number} Maximum thrust points based on ship's thrust rating
   */
  getMaxThrustPoints(): number {
    if (!['ship', 'space-object'].includes(this.actor?.type)) {
      return 0;
    }

    // Get thrust rating from ship actor
    const thrustRating = this._getThrustRating(this.actor);
    return thrustRating || 0;
  }

  /**
   * Check if the combat uses thrust counter instead of action buttons
   */
  usesThrustCounter(): boolean {
    const combat = this.combat as TwodsixCombat;
    const config = combat?.getSpaceCombatConfig?.();
    return config?.actionBudget?.useThrustCounter ?? false;
  }

  /**
   * Toggle thrust usage (increment/decrement thrust used counter)
   * @param {number} amount - Amount to change thrust by (positive or negative)
   */
  async toggleThrustUsage(amount: number = 1): Promise<void> {
    if (!this.usesThrustCounter()) {
      return;
    }

    const currentUsed = this.flags.twodsix?.thrustUsed ?? 0;
    const maxThrust = this.getMaxThrustPoints();
    const newUsed = Math.max(0, Math.min(maxThrust, currentUsed + amount));

    await this.setFlag('twodsix', 'thrustUsed', newUsed);
  }

  /**
   * Use one thrust point
   * @returns {Promise<boolean>} Whether thrust was successfully used
   */
  async useThrust(): Promise<boolean> {
    if (this.availableThrust <= 0) {
      return false;
    }
    await this.toggleThrustUsage(1);
    return true;
  }

  /**
   * Restore one thrust point (undo usage)
   * @returns {Promise<boolean>} Whether thrust was successfully restored
   */
  async undoThrust(): Promise<boolean> {
    const currentUsed = this.flags.twodsix?.thrustUsed ?? 0;
    if (currentUsed <= 0) {
      return false;
    }
    await this.toggleThrustUsage(-1);
    return true;
  }

  /**
   * Generic action usage handler with comprehensive validation
   * @param {string} actionType - Type of action ('minor', 'significant', 'reaction')
   * @param {Function} canUseCheck - Function to validate if action can be used
   * @param {string} flagKey - Flag key to update
   * @param {string} errorKey - Localization key for error messages
   * @param {object} options - Additional options
   * @returns {Promise<boolean>} Whether the action was successfully used
   * @private
   */
  async _useAction(
    actionType,
    canUseCheck,
    flagKey,
    errorKey,
    options = {}
  ) {
    if (!this.actor) {
      console.warn(`TwodsixCombatant | Attempted to use ${actionType} action on combatant without actor`);
      return false;
    }

    const combat = this.combat;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    if (!canUseCheck()) {
      if (game.user.isGM || this.isOwner) {
        ui.notifications.warn(game.i18n.localize(errorKey));
      }
      return false;
    }

    const currentUsed = this.flags.twodsix?.[flagKey] ?? 0;
    const updates = { [`flags.twodsix.${flagKey}`]: currentUsed + 1 };

    // Allow hook to override
    const hookName = `twodsix.use${actionType.charAt(0).toUpperCase() + actionType.slice(1)}Action`;
    const allowed = Hooks.call(hookName, this, updates, options);
    if (allowed === false) {
      return false;
    }

    try {
      await this.update(updates);
      return true;
    } catch (error) {
      console.error(`TwodsixCombatant | Failed to update ${actionType} action usage:`, error);
      return false;
    }
  }

  /**
   * Generic action undo handler
   * @private
   */
  async _undoAction(flagKey: string): Promise<boolean> {
    const currentUsed = this.flags.twodsix?.[flagKey] ?? 0;
    if (currentUsed <= 0) {
      return false;
    }

    const updates = { [`flags.twodsix.${flagKey}`]: Math.max(0, currentUsed - 1) };
    await this.update(updates);
    return true;
  }

  /**
   * Reset phase counters at start of phase (only actions, reactions persist across phases)
   */
  async resetPhaseCounters(): Promise<void> {
    // Only apply to space actors (ships and space-objects)
    if (!['ship', 'space-object'].includes(this.actor?.type)) {
      return;
    }

    const combat = this.combat as TwodsixCombat;
    if (!combat?.isSpaceCombat?.()) {
      return;
    }

    await this.update({
      'flags.twodsix.spacePhase': combat.getCurrentPhase() || 'declaration',
      'flags.twodsix.minorActionsUsed': 0,
      'flags.twodsix.significantActionsUsed': 0,
      'flags.twodsix.hasty': false
    });
  }

  /**
   * Reset round counters at start of new round (actions and reactions)
   */
  async resetRoundCounters(): Promise<void> {
    // Only apply to space actors (ships and space-objects)
    if (!['ship', 'space-object'].includes(this.actor?.type)) {
      return;
    }

    const combat = this.combat as TwodsixCombat;
    if (!combat?.isSpaceCombat?.()) {
      return;
    }

    await this.update({
      'flags.twodsix.spacePhase': combat.getCurrentPhase() || 'declaration',
      'flags.twodsix.minorActionsUsed': 0,
      'flags.twodsix.significantActionsUsed': 0,
      'flags.twodsix.reactionsUsed': 0,
      'flags.twodsix.reactionsAvailable': this.getAvailableReactions(),
      'flags.twodsix.thrustUsed': 0, // Reset thrust on new round
      'flags.twodsix.hasty': false
    });
  }

  /**
   * Check if combatant can use a minor action
   * @returns {boolean}
   */
  canUseMinorAction(): boolean {
    const budget = this.getActionBudget();
    const { minorUsed, significantUsed } = this._getActionCounts();

    // If a significant action was used, only 1 minor action is allowed
    const maxAllowed = significantUsed > 0 ? 1 : budget.minorActions;
    return minorUsed < maxAllowed;
  }

  /**
   * Check if combatant can use a significant action
   * @returns {boolean}
   */
  canUseSignificantAction(): boolean {
    const budget = this.getActionBudget();
    const { significantUsed, minorUsed } = this._getActionCounts();

    // Significant action requires no actions used yet
    return significantUsed < budget.significantActions && minorUsed === 0;
  }

  /**
   * Check if combatant can use a reaction
   * @returns {boolean}
   */
  canUseReaction(): boolean {
    const combat = this.combat as TwodsixCombat;
    const config = combat?.getSpaceCombatConfig?.();

    // If using thrust pool for reactions, check thrust availability
    if (config?.actionBudget?.thrustPoolForReactions) {
      return this.availableThrust > 0;
    }

    // Otherwise use normal reaction system
    const { reactionsUsed, reactionsAvailable } = this._getActionCounts();
    return reactionsUsed < reactionsAvailable;
  }

  /**
   * Use a minor action in space combat
   * @param {object} options - Optional configuration
   * @returns {Promise<boolean>} Whether the action was successfully used
   */
  async useMinorAction(options = {}): Promise<boolean> {
    return this._useAction(
      'minor',
      () => this.canUseMinorAction(),
      'minorActionsUsed',
      'TWODSIX.Combat.NoMinorActionsRemaining',
      options
    );
  }

  /**
   * Undo a minor action usage
   * @returns {Promise<boolean>} Whether the undo was successful
   */
  async undoMinorAction(): Promise<boolean> {
    return this._undoAction('minorActionsUsed');
  }

  /**
   * Use a significant action in space combat
   * @param {object} options - Optional configuration
   * @returns {Promise<boolean>} Whether the action was successfully used
   */
  async useSignificantAction(options = {}): Promise<boolean> {
    return this._useAction(
      'significant',
      () => this.canUseSignificantAction(),
      'significantActionsUsed',
      'TWODSIX.Combat.NoSignificantActionsRemaining',
      options
    );
  }

  /**
   * Undo a significant action usage
   * @returns {Promise<boolean>} Whether the undo was successful
   */
  async undoSignificantAction(): Promise<boolean> {
    return this._undoAction('significantActionsUsed');
  }

  /**
   * Use a reaction in space combat
   * @param {object} options - Optional configuration
   * @returns {Promise<boolean>} Whether the reaction was successfully used
   */
  async useReaction(options = {}): Promise<boolean> {
    const combat = this.combat as TwodsixCombat;
    const config = combat?.getSpaceCombatConfig?.();

    // If using thrust pool for reactions, use thrust and track reaction count
    if (config?.actionBudget?.thrustPoolForReactions) {
      const thrustSuccess = await this.useThrust();
      if (thrustSuccess) {
        // Also increment reaction counter for tracking
        const reactionsUsed = this.flags?.twodsix?.reactionsUsed ?? 0;
        await this.setFlag('twodsix', 'reactionsUsed', reactionsUsed + 1);
      }
      return thrustSuccess;
    }

    // Otherwise use normal reaction system
    return this._useAction(
      'reaction',
      () => this.canUseReaction(),
      'reactionsUsed',
      'TWODSIX.Combat.NoReactionsRemaining',
      options
    );
  }

  /**
   * Undo a reaction usage
   * @returns {Promise<boolean>} Whether the undo was successful
   */
  async undoReaction(): Promise<boolean> {
    const combat = this.combat as TwodsixCombat;
    const config = combat?.getSpaceCombatConfig?.();

    // If using thrust pool for reactions, undo thrust and decrement reaction count
    if (config?.actionBudget?.thrustPoolForReactions) {
      const reactionsUsed = this.flags?.twodsix?.reactionsUsed ?? 0;
      if (reactionsUsed > 0) {
        const thrustSuccess = await this.undoThrust();
        if (thrustSuccess) {
          // Also decrement reaction counter
          await this.setFlag('twodsix', 'reactionsUsed', reactionsUsed - 1);
        }
        return thrustSuccess;
      }
      return false;
    }

    // Otherwise use normal reaction system
    return this._undoAction('reactionsUsed');
  }

  /**
   * Toggle action usage state (used for quick GM controls)
   * @param {string} actionType - 'minor', 'significant', or 'reaction'
   * @param {boolean} use - True to use action, false to undo
   * @returns {Promise<boolean>}
   */
  async toggleActionUsage(
    actionType: "minor" | "significant" | "reaction",
    use: boolean = true
  ): Promise<boolean> {
    switch (actionType) {
      case "minor":
        return use ? this.useMinorAction() : this.undoMinorAction();
      case "significant":
        return use ? this.useSignificantAction() : this.undoSignificantAction();
      case "reaction":
        return use ? this.useReaction() : this.undoReaction();
      default:
        return false;
    }
  }
}
