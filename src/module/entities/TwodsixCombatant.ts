// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";

export default class TwodsixCombatant extends Combatant {
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

  protected _getInitiativeFormula():string {
    if ((<TwodsixActor>this.actor).type === "ship") {
      return <string>game.settings.get("twodsix", "shipInitiativeFormula");
    } else {
      return <string>game.settings.get("twodsix", "initiativeFormula");
    }
  }

  /**
   * Get the ruleset's space combat configuration
   */
  getRulesetSpaceCombatConfig() {
    const rulesetKey = game.settings.get('twodsix', 'activeRuleset');
    return TWODSIX.RULESETS?.[rulesetKey as keyof typeof TWODSIX.RULESETS]?.spaceCombat || {};
  }

  /**
   * Calculate available reactions based on initiative (Cepheus Engine default)
   * Overrideable per ruleset via spaceCombat.reactionFormula in config.ts
   */
  getAvailableReactions(): number {
    if (!['ship', 'space-object'].includes(this.actor?.type)) return 0;

    const combat = this.combat as any; // Could be TwodsixCombat
    const config = combat?.getRulesetSpaceCombatConfig?.();
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
   * Get action budget for this ruleset (from config or CE defaults)
   */
  getActionBudget() {
    const combat = this.combat as any; // Could be TwodsixCombat
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

    const combat = this.combat as any; // Could be TwodsixCombat
    if (!combat?.isSpaceCombat?.()) {
      return;
    }

    await this.update({
      'flags.twodsix.spacePhase': 'declaration',
      'flags.twodsix.minorActionsUsed': 0,
      'flags.twodsix.significantActionsUsed': 0,
      'flags.twodsix.reactionsUsed': 0,
      'flags.twodsix.reactionsAvailable': this.getAvailableReactions(),
      'flags.twodsix.hasty': false
    });
  }

  /**
   * Use a minor action
   * Returns true if successful, false if budget exceeded
   */
  async useMinorAction(): Promise<boolean> {
    const combat = this.combat as any;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    const used = this.flags.twodsix?.minorActionsUsed ?? 0;
    const sigUsed = this.flags.twodsix?.significantActionsUsed ?? 0;
    const budget = this.getActionBudget();

    const maxAllowed = sigUsed > 0 ? 1 : budget.minorActions;

    if (used < maxAllowed) {
      await this.update({
        'flags.twodsix.minorActionsUsed': used + 1
      });
      return true;
    }
    return false;
  }

  /**
   * Use a significant action
   * Returns true if successful, false if budget exceeded
   */
  async useSignificantAction(): Promise<boolean> {
    const combat = this.combat as any;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    const used = this.flags.twodsix?.significantActionsUsed ?? 0;
    const minorUsed = this.flags.twodsix?.minorActionsUsed ?? 0;
    const budget = this.getActionBudget();

    if (used < budget.significantActions && minorUsed === 0) {
      await this.update({
        'flags.twodsix.significantActionsUsed': 1
      });
      return true;
    }
    return false;
  }

  /**
   * Use a reaction
   * Returns true if successful, false if reactions exhausted
   */
  async useReaction(): Promise<boolean> {
    const combat = this.combat as any;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    const used = this.flags.twodsix?.reactionsUsed ?? 0;
    const available = this.flags.twodsix?.reactionsAvailable ?? 0;

    if (used < available) {
      await this.update({
        'flags.twodsix.reactionsUsed': used + 1
      });
      return true;
    }
    return false;
  }

  /**
   * Check if a minor action can be performed without actually performing it
   */
  canUseMinorAction(): boolean {
    const combat = this.combat as any;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    const used = this.flags.twodsix?.minorActionsUsed ?? 0;
    const sigUsed = this.flags.twodsix?.significantActionsUsed ?? 0;
    const budget = this.getActionBudget();

    const maxAllowed = sigUsed > 0 ? 1 : budget.minorActions;
    return used < maxAllowed;
  }

  /**
   * Check if a significant action can be performed without actually performing it
   */
  canUseSignificantAction(): boolean {
    const combat = this.combat as any;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    const used = this.flags.twodsix?.significantActionsUsed ?? 0;
    const minorUsed = this.flags.twodsix?.minorActionsUsed ?? 0;
    const budget = this.getActionBudget();

    return used < budget.significantActions && minorUsed === 0;
  }

  /**
   * Check if a reaction can be performed without actually performing it
   */
  canUseReaction(): boolean {
    const combat = this.combat as any;
    if (!combat?.isSpaceCombat?.()) {
      return true; // Allow in non-space combat
    }

    const used = this.flags.twodsix?.reactionsUsed ?? 0;
    const available = this.flags.twodsix?.reactionsAvailable ?? 0;

    return used < available;
  }
}
