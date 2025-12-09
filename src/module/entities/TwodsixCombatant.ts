// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";
import TwodsixCombat from "./TwodsixCombat";

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
   * @inheritdoc
   */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;

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
    if ((<TwodsixActor>this.actor).type === "ship") {
      // For ships, use the initiative formula from the selected space combat phase type
      const combat = this.combat as TwodsixCombat;
      const phaseConfig = combat?.getSpaceCombatConfig?.();
      return phaseConfig?.shipInitiativeFormula || <string>game.settings.get("twodsix", "shipInitiativeFormula");
    } else {
      return <string>game.settings.get("twodsix", "initiativeFormula");
    }
  }

  /**
   * Get roll data for initiative formula resolution
   * Adds ship-specific variables like @shipThrustRating and @skills.Pilot
   */
  getRollData() {
    console.log(`[TwodsixCombatant] getRollData for ${this.actor?.name ?? this.name}`);
    // Use actor's roll data as the base
    const data = this.actor?.getRollData?.() || {};

    // Add ship-specific data if this is a ship combatant
    if (this.actor?.type === "ship") {
      // Get thrust rating from ship's derived data first
      let thrustRating = this.actor.system.shipStats?.drives?.mDrive?.rating || 0;

      // If not found in derived data, search components as backup
      if (!thrustRating) {
        const components = this.actor.items.filter(item => ["m-drive", "mdrive", "m drive"].includes((item.system.subtype).toLowerCase()));
        components.forEach((component: any) => {
          const rating = component.system.rating || 0;
          if (rating > thrustRating) {
            thrustRating = rating;
          }
        });
      }

      data.shipThrustRating = thrustRating;

      // Look for pilot skill from crew actors assigned to ship positions
      let pilotSkill = 0;

      // Get all actor IDs assigned to ship positions
      const shipPositionActorIds = Object.keys(this.actor.system.shipPositionActorIds || {});

      for (const actorId of shipPositionActorIds) {
        const crewActor = game.actors?.get(actorId);
        if (!crewActor) continue;

        // Look through the crew member's skills for pilot/piloting
        const skills = crewActor.itemTypes?.skills || crewActor.items.filter(item => item.type === "skills");
        for (const skill of skills) {
          const skillName = skill.name?.toLowerCase() || "";
          if (skillName.includes("pilot")) {
            const skillValue = skill.system.value || 0;
            if (skillValue > pilotSkill) {
              pilotSkill = skillValue;
            }
          }
        }
      }

      // Create skill data structure for formula compatibility
      if (!data.skills) data.skills = {};
      data.skills.Pilot = pilotSkill;
      data.skills.Piloting = pilotSkill;

      // Calculate thrust bonus - compare with all other ships in combat
      // Only the ship with the highest thrust gets +1, others get 0
      data.thrustBonus = 0;
      const combat = this.combat as TwodsixCombat;
      if (combat?.combatants) {
        let hasHigherThrust = false;

        // Check all other combatants to see if any have higher thrust
        for (const other of combat.combatants) {
          if (other.id === this.id) continue; // Skip self
          if (other.actor?.type !== "ship") continue; // Skip non-ships

          let otherThrust = other.actor.system.shipStats?.drives?.mDrive?.rating || 0;
          if (!otherThrust) {
            const otherComponents = other.actor.items.filter(item => ["m-drive", "mdrive", "m drive"].includes((item.system.subtype).toLowerCase()));
            for (const component of otherComponents) {
              const rating = component.system.rating || 0;
              if (rating > otherThrust) {
                otherThrust = rating;
              }
            }
          }

          if (otherThrust > thrustRating) {
            hasHigherThrust = true;
            break;
          } else if (otherThrust === thrustRating && other.id < this.id) {
            // Tie-breaker: if equal thrust, lower ID wins to ensure only one gets the bonus
            hasHigherThrust = true;
            break;
          }
        }

        // Only grant +1 if this ship has the highest thrust (or wins tie-breaker)
        if (!hasHigherThrust && thrustRating > 0) {
          data.thrustBonus = 1;
        }
      }

      // Debug logging for ship initiative data
      console.log(`[TwodsixCombatant] Initiative Roll Data for ${this.actor.name}:`, {
        shipThrustRating: data.shipThrustRating,
        pilotSkill: data.skills?.Pilot,
        thrustBonus: data.thrustBonus,
        formula: this._getInitiativeFormula()
      });
    }

    return data;
  }

  /**
   * Get the initiative roll for this combatant
   * For ships in space combat, uses custom roll data with thrust and pilot skill bonuses
   * @inheritdoc
   */
  getInitiativeRoll(formula) {
    // If this is a space combat with a space-specific formula, use it with custom roll data
    const combat = this.combat as TwodsixCombat;
    if (combat?.isSpaceCombat?.()) {
      const spaceCombatFormula = this._getInitiativeFormula?.();
      if (spaceCombatFormula) {
        const rollData = this.getRollData();
        return new Roll(spaceCombatFormula, rollData);
      }
    }

    // Fall back to standard behavior
    return super.getInitiativeRoll(formula);
  }

  /**
   * Calculate available reactions based on initiative
   */
  getAvailableReactions(): number {
    if (!['ship', 'space-object'].includes(this.actor?.type)) return 0;

    const combat = this.combat as TwodsixCombat;
    const config = combat?.getSpaceCombatConfig?.();
    const formula = config?.reactionFormula;

    if (formula && typeof formula === 'function') {
      return formula(this.initiative ?? 0);
    }

    // Default CE formula if not specified
    const initiative = this.initiative ?? 0;
    if (initiative <= 4) return 1;
    if (initiative <= 8) return 2;
    if (initiative <= 12) return 3;
    return 4;
  }

  /**
   * Get action budget from the combat encounter
   */
  getActionBudget() {
    const combat = this.combat as TwodsixCombat;
    return combat?.getActionBudget?.() ?? {
      minorActions: 3,
      significantActions: 1
    };
  }

  /**
   * Reset phase counters at start of turn (only for space actors in space combat)
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
      'flags.twodsix.reactionsUsed': 0,
      'flags.twodsix.reactionsAvailable': this.getAvailableReactions(),
      'flags.twodsix.hasty': false
    });
  }

  /**
   * Use a minor action in space combat
   * @param {object} options - Optional configuration
   * @returns {Promise<boolean>} Whether the action was successfully used
   */
  async useMinorAction(options = {}): Promise<boolean> {
    const combat = this.combat as TwodsixCombat;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    if (!this.canUseMinorAction()) {
      ui.notifications.warn(
        game.i18n.localize("TWODSIX.Combat.NoMinorActionsRemaining")
      );
      return false;
    }

    const used = this.flags.twodsix?.minorActionsUsed ?? 0;
    const updates = {
      "flags.twodsix.minorActionsUsed": used + 1,
    };

    // Allow hook to override
    const allowed = Hooks.call("twodsix.useMinorAction", this, updates, options);
    if (allowed === false) return false;

    await this.update(updates);
    return true;
  }

  /**
   * Undo a minor action usage
   * @returns {Promise<boolean>} Whether the undo was successful
   */
  async undoMinorAction(): Promise<boolean> {
    const used = this.flags.twodsix?.minorActionsUsed ?? 0;
    if (used <= 0) return false;

    const updates = {
      "flags.twodsix.minorActionsUsed": Math.max(0, used - 1),
    };

    await this.update(updates);
    return true;
  }

  /**
   * Use a significant action in space combat
   * @param {object} options - Optional configuration
   * @returns {Promise<boolean>} Whether the action was successfully used
   */
  async useSignificantAction(options = {}): Promise<boolean> {
    const combat = this.combat as TwodsixCombat;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    if (!this.canUseSignificantAction()) {
      ui.notifications.warn(
        game.i18n.localize("TWODSIX.Combat.NoSignificantActionsRemaining")
      );
      return false;
    }

    const used = this.flags.twodsix?.significantActionsUsed ?? 0;
    const updates = {
      "flags.twodsix.significantActionsUsed": used + 1,
    };

    // Allow hook to override
    const allowed = Hooks.call("twodsix.useSignificantAction", this, updates, options);
    if (allowed === false) return false;

    await this.update(updates);
    return true;
  }

  /**
   * Undo a significant action usage
   * @returns {Promise<boolean>} Whether the undo was successful
   */
  async undoSignificantAction(): Promise<boolean> {
    const used = this.flags.twodsix?.significantActionsUsed ?? 0;
    if (used <= 0) return false;

    const updates = {
      "flags.twodsix.significantActionsUsed": Math.max(0, used - 1),
    };

    await this.update(updates);
    return true;
  }

  /**
   * Use a reaction in space combat
   * @param {object} options - Optional configuration
   * @returns {Promise<boolean>} Whether the reaction was successfully used
   */
  async useReaction(options = {}): Promise<boolean> {
    const combat = this.combat as TwodsixCombat;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    if (!this.canUseReaction()) {
      ui.notifications.warn(
        game.i18n.localize("TWODSIX.Combat.NoReactionsRemaining")
      );
      return false;
    }

    const used = this.flags.twodsix?.reactionsUsed ?? 0;
    const updates = {
      "flags.twodsix.reactionsUsed": used + 1,
    };

    // Allow hook to override
    const allowed = Hooks.call("twodsix.useReaction", this, updates, options);
    if (allowed === false) return false;

    await this.update(updates);
    return true;
  }

  /**
   * Undo a reaction usage
   * @returns {Promise<boolean>} Whether the undo was successful
   */
  async undoReaction(): Promise<boolean> {
    const used = this.flags.twodsix?.reactionsUsed ?? 0;
    if (used <= 0) return false;

    const updates = {
      "flags.twodsix.reactionsUsed": Math.max(0, used - 1),
    };

    await this.update(updates);
    return true;
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
