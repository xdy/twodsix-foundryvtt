// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixCombat from "../../entities/TwodsixCombat";

/**
 * @import { TwodsixCombatant } from "../../entities/_module.mjs";
 */

/**
 * A custom combat tracker that extends Foundry's CombatTracker to support space combat phases
 * and action tracking for ship combat encounters.
 *
 * Features:
 * - Phase-based combat management with navigation controls
 * - Action economy tracking with clickable indicators
 * - Ship-specific initiative handling for space encounters
 * - Localized phase display and controls
 *
 * Provides phase-based combat management with action economy tracking and ship-specific
 * initiative handling for space encounters.
 *
 * Inspired by Draw Steel's CombatTracker extension pattern.
 *
 * @extends {foundry.applications.sidebar.tabs.CombatTracker}
 */
export default class TwodsixCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    actions: {
      advancePhase: TwodsixCombatTracker.#advancePhase,
      previousPhase: TwodsixCombatTracker.#previousPhase,
      resetPhase: TwodsixCombatTracker.#resetPhase,
      useAction: TwodsixCombatTracker.#useAction,
      undoAction: TwodsixCombatTracker.#undoAction,
      adjustThrust: TwodsixCombatTracker.#adjustThrust,
      increaseThrust: TwodsixCombatTracker.#increaseThrust,
      decreaseThrust: TwodsixCombatTracker.#decreaseThrust
    },
  };
  /**
   * Prepare the data for the combat tracker context
   * @inheritdoc
   */
  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options);

    const combat = this.viewed as TwodsixCombat;
    if (!combat?.isSpaceCombat?.()) return;

    // Delegate to combat for phase information - single source of truth
    context.spaceCombat = combat.getPhaseDisplayInfo();
  }

  /**
   * Render the combat tracker with space combat UI elements
   * @inheritdoc
   */
  async _onRender(context, options) {
    await super._onRender(context, options);

    const combat = this.viewed as TwodsixCombat;
    if (!combat?.usePhases?.()) return;

    // Add phase display section
    this._renderSpaceCombatPhaseDisplay();

    // Add action indicators to combatants
    this._renderCombatantActionIndicators(combat);
  }

  /**
   * Render the space combat phase display section
   * @private
   */
  _renderSpaceCombatPhaseDisplay() {
    const combat = this.viewed;

    // Only show phase display when using phase-based combat
    if (!combat?.usePhases?.()) return;

    try {
      const phaseInfo = combat.getPhaseDisplayInfo();
      if (!phaseInfo) {
        console.warn("TwodsixCombatTracker | Failed to get phase display info");
        return;
      }

      // Find the combat tracker header
      const header = this.element.querySelector('.combat-tracker-header');
      if (!header) {
        console.warn("TwodsixCombatTracker | Combat tracker header not found");
        return;
      }

      // Remove any existing phase display
      const existing = header.querySelector('.space-combat-phase');
      if (existing) existing.remove();

      // Create phase display element
      const phaseDisplay = this._createPhaseDisplayElement(phaseInfo, combat);

      // Insert phase display after combat round
      const roundDiv = header.querySelector('.combat-round');
      if (roundDiv) {
        roundDiv.after(phaseDisplay);
      } else {
        header.appendChild(phaseDisplay);
      }
    } catch (error) {
      console.error("TwodsixCombatTracker | Error rendering phase display:", error);
    }
  }

  /**
   * Create the phase display DOM element
   * @param {object} phaseInfo - Phase information object
   * @param {TwodsixCombat} combat - Combat instance
   * @returns {HTMLElement} Phase display element
   * @private
   */
  _createPhaseDisplayElement(phaseInfo, combat) {
    const phaseDisplay = document.createElement('div');
    phaseDisplay.classList.add('space-combat-phase');

    // Add phase name
    const phaseName = document.createElement('h4');
    phaseName.classList.add('phase-name');
    phaseName.textContent = `${game.i18n.localize("TWODSIX.Combat.Phase")}: ${phaseInfo.currentPhase || 'Unknown'}`;
    phaseDisplay.appendChild(phaseName);

    // Add phase controls for GM
    if (phaseInfo.canNavigatePhases) {
      const phaseControls = this._createPhaseControls(phaseInfo, combat);
      phaseDisplay.appendChild(phaseControls);
    }

    return phaseDisplay;
  }

  /**
   * Create phase control buttons
   * @param {object} phaseInfo - Phase information object
   * @param {TwodsixCombat} combat - Combat instance
   * @returns {HTMLElement} Phase controls element
   * @private
   */
  _createPhaseControls(phaseInfo, combat) {
    const phaseControls = document.createElement('div');
    phaseControls.classList.add('phase-controls');

    // Previous phase button
    const prevButton = document.createElement('a');
    prevButton.classList.add('phase-control');
    prevButton.title = game.i18n.localize("TWODSIX.Combat.PreviousPhase");
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.dataset.action = 'previousPhase';
    phaseControls.appendChild(prevButton);

    // Phase indicator (current/total)
    const phaseIndicator = document.createElement('span');
    phaseIndicator.classList.add('phase-indicator');
    phaseIndicator.textContent = phaseInfo.phaseIndicator;
    phaseControls.appendChild(phaseIndicator);

    // Next phase button
    const nextButton = document.createElement('a');
    nextButton.classList.add('phase-control');
    nextButton.title = game.i18n.localize("TWODSIX.Combat.NextPhase");
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.dataset.action = 'advancePhase';
    phaseControls.appendChild(nextButton);

    return phaseControls;
  }

  /**
   * Get action data for a combatant
   * @private
   */
  _getCombatantActionData(combatant, combat: TwodsixCombat) {
    const budget = combat.getActionBudget();
    const config = combat?.getSpaceCombatConfig?.();
    const isUsingThrustPoolForReactions = config?.actionBudget?.thrustPoolForReactions;

    return {
      minor: {
        used: combatant.flags?.twodsix?.minorActionsUsed ?? 0,
        available: budget.minorActions,
        canUse: combatant.canUseMinorAction?.() ?? false,
        useMethod: () => combatant.useMinorAction(),
        undoMethod: () => combatant.undoMinorAction(),
        icon: 'fa-walking',
        localizationKey: 'MinorActions'
      },
      significant: {
        used: combatant.flags?.twodsix?.significantActionsUsed ?? 0,
        available: budget.significantActions,
        canUse: combatant.canUseSignificantAction?.() ?? false,
        useMethod: () => combatant.useSignificantAction(),
        undoMethod: () => combatant.undoSignificantAction(),
        icon: 'fa-running',
        localizationKey: 'SignificantActions'
      },
      reaction: {
        used: combatant.flags?.twodsix?.reactionsUsed ?? 0,
        available: isUsingThrustPoolForReactions ?
          null : // No available count when using thrust pool - will show just reaction count
          (combatant.getAvailableReactions?.() ?? 0), // Show available reactions in normal mode
        canUse: combatant.canUseReaction?.() ?? false,
        useMethod: () => combatant.useReaction(),
        undoMethod: () => combatant.undoReaction(),
        icon: 'fa-shield-alt',
        localizationKey: 'Reactions'
      }
    };
  }

  /**
   * Render action indicators for each combatant
   * @private
   */
  _renderCombatantActionIndicators(combat: TwodsixCombat) {
    const combatantElements = this.element.querySelectorAll('.combatant');

    combatantElements.forEach((element) => {
      const combatantId = element.dataset.combatantId;
      const combatant = combat.combatants.get(combatantId);

      if (!combatant || !['ship', 'space-object'].includes(combatant.actor?.type)) {
        return;
      }

      // Remove any existing action indicators
      const existing = element.querySelector('.action-indicator-wrapper');
      if (existing) existing.remove();

      // Create action indicator wrapper
      const actionWrapper = document.createElement('div');
      actionWrapper.classList.add('action-indicator-wrapper');

      // Check if this combat uses thrust counter
      if (combatant.usesThrustCounter?.()) {
        // Add thrust counter control
        const thrustData = {
          used: combatant.flags?.twodsix?.thrustUsed ?? 0,
          available: combatant.getMaxThrustPoints?.() ?? 0,
          canUse: true, // Thrust can always be used/adjusted
          icon: 'fa-rocket',
          localizationKey: 'ThrustUsed'
        };
        actionWrapper.appendChild(
          this._createThrustControl(thrustData, combatantId)
        );

        // Also add reaction button even when using thrust counters
        const actionData = this._getCombatantActionData(combatant, combat);
        if (actionData.reaction) {
          actionWrapper.appendChild(
            this._createActionControl('reaction', actionData.reaction, combatantId)
          );
        }
      } else {
        // Get action data for traditional action buttons
        const actionData = this._getCombatantActionData(combatant, combat);

        // Add controls for each action type
        Object.entries(actionData).forEach(([actionType, data]) => {
          actionWrapper.appendChild(
            this._createActionControl(actionType as any, data, combatantId)
          );
        });
      }

      // Insert action indicators as a separate row after the entire combatant element
      // Insert after the combatant element as a sibling, not a child
      element.insertAdjacentElement('afterend', actionWrapper);
    });
  }

  /**
   * Create an action control element
   * @param {string} actionType - Type of action
   * @param {object} data - Action data object
   * @param {string} combatantId - ID of the combatant these actions belong to
   * @returns {HTMLElement} Action control element
   * @private
   */
  _createActionControl(actionType, data, combatantId) {
    const control = document.createElement('div');
    control.classList.add('action-control', `${actionType}-actions`);
    control.title = game.i18n.localize(`TWODSIX.Combat.${data.localizationKey}`);

    // Show just the count if available is null (thrust pool mode), otherwise show used/available
    const countDisplay = data.available === null ? `${data.used}` : `${data.used}/${data.available}`;
    control.innerHTML = `<i class="fas ${data.icon}"></i> <span class="action-count">${countDisplay}</span>`;

    // Add data attributes for action handling
    control.dataset.actionType = actionType;
    control.dataset.combatantId = combatantId;
    control.dataset.action = 'useAction';

    // Add clickable state if can use
    if (data.canUse && game.user.isGM) {
      control.classList.add('can-use');
    }

    // Add undo button if actions were used
    if (data.used > 0 && game.user.isGM) {
      const undoBtn = document.createElement('button');
      undoBtn.classList.add('undo-action');
      undoBtn.type = 'button';
      undoBtn.title = 'Undo';
      undoBtn.innerHTML = '<i class="fas fa-undo"></i>';
      undoBtn.dataset.action = 'undoAction';
      undoBtn.dataset.actionType = actionType;
      undoBtn.dataset.combatantId = combatantId;
      control.appendChild(undoBtn);
    }

    return control;
  }

  /**
   * Create a thrust control element
   * @private
   */
  _createThrustControl(thrustData, combatantId) {
    const control = document.createElement('div');
    control.classList.add('action-control', 'thrust-control');
    control.title = game.i18n.localize('TWODSIX.Combat.ThrustUsed') || 'Thrust Used';
    control.innerHTML = `<i class="fas ${thrustData.icon}"></i> <span class="action-count">${thrustData.used}/${thrustData.available}</span>`;

    // Add data attributes for action handling
    control.dataset.actionType = 'thrust';
    control.dataset.combatantId = combatantId;
    control.dataset.action = 'adjustThrust';

    // Add clickable state if GM
    if (game.user.isGM) {
      control.classList.add('can-use');
    }

    // Add increase/decrease buttons
    if (game.user.isGM) {
      const decreaseBtn = document.createElement('button');
      decreaseBtn.classList.add('thrust-decrease');
      decreaseBtn.type = 'button';
      decreaseBtn.title = 'Decrease Thrust';
      decreaseBtn.innerHTML = '<i class="fas fa-minus"></i>';
      decreaseBtn.dataset.action = 'decreaseThrust';
      decreaseBtn.dataset.combatantId = combatantId;
      control.appendChild(decreaseBtn);

      const increaseBtn = document.createElement('button');
      increaseBtn.classList.add('thrust-increase');
      increaseBtn.type = 'button';
      increaseBtn.title = 'Increase Thrust';
      increaseBtn.innerHTML = '<i class="fas fa-plus"></i>';
      increaseBtn.dataset.action = 'increaseThrust';
      increaseBtn.dataset.combatantId = combatantId;
      control.appendChild(increaseBtn);
    }

    return control;
  }

  /* -------------------------------------------------- */
  /*  Static Action Handlers                            */
  /* -------------------------------------------------- */

  /**
   * Advance to the next combat phase
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The action target element
   * @this {TwodsixCombatTracker}
   * @static
   */
  static async #advancePhase(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat?.usePhases?.()) return;

    try {
      await combat.advancePhaseWithRoundManagement();
      this.render();
    } catch (error) {
      console.error("TwodsixCombatTracker | Error advancing phase:", error);
      ui.notifications.error("Failed to advance combat phase");
    }
  }

  /**
   * Go to the previous combat phase
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The action target element
   * @this {TwodsixCombatTracker}
   * @static
   */
  static async #previousPhase(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat?.isSpaceCombat?.()) return;

    try {
      const success = await combat.previousPhase();
      if (!success) {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Combat.AlreadyFirstPhase"));
      }
      this.render();
    } catch (error) {
      console.error("TwodsixCombatTracker | Error going to previous phase:", error);
      ui.notifications.error("Failed to go to previous phase");
    }
  }

  /**
   * Reset combat phase to beginning
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The action target element
   * @this {TwodsixCombatTracker}
   * @static
   */
  static async #resetPhase(event, target) {
    event.preventDefault();
    const combat = this.viewed;
    if (!combat?.isSpaceCombat?.()) return;

    try {
      await combat.resetPhase();
      this.render();
    } catch (error) {
      console.error("TwodsixCombatTracker | Error resetting phase:", error);
      ui.notifications.error("Failed to reset combat phase");
    }
  }

  /**
   * Use a combatant action
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The action target element
   * @this {TwodsixCombatTracker}
   * @static
   */
  static async #useAction(event, target) {
    const { combatantId, actionType } = target.dataset ?? {};
    if (!combatantId || !actionType) {
      console.warn('TwodsixCombatTracker | useAction: Missing combatantId or actionType', { combatantId, actionType });
      return;
    }

    const combat = this.viewed;
    const combatant = combat?.combatants.get(combatantId);
    if (!combatant) {
      console.warn('TwodsixCombatTracker | useAction: Combatant not found', combatantId);
      return;
    }

    try {
      await combatant.toggleActionUsage(actionType, true);
      this.render();
    } catch (error) {
      console.error(`TwodsixCombatTracker | Error using ${actionType} action:`, error);
    }
  }

  /**
   * Undo a combatant action
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The action target element
   * @this {TwodsixCombatTracker}
   * @static
   */
  static async #undoAction(event, target) {
    event.stopPropagation();
    const { combatantId, actionType } = target.dataset ?? {};
    if (!combatantId || !actionType) {
      console.warn('TwodsixCombatTracker | undoAction: Missing combatantId or actionType', { combatantId, actionType });
      return;
    }

    const combat = this.viewed;
    const combatant = combat?.combatants.get(combatantId);
    if (!combatant) {
      console.warn('TwodsixCombatTracker | undoAction: Combatant not found', combatantId);
      return;
    }

    try {
      await combatant.toggleActionUsage(actionType, false);
      this.render();
    } catch (error) {
      console.error(`TwodsixCombatTracker | Error undoing ${actionType} action:`, error);
    }
  }

  /**
   * Handle thrust adjustment (click on thrust counter)
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The action target element
   * @this {TwodsixCombatTracker}
   * @static
   */
  static async #adjustThrust(event, target) {
    event.preventDefault();
    const combatantId = target.dataset.combatantId;
    const combat = this.viewed;
    const combatant = combat?.combatants.get(combatantId);
    if (!combatant) return;

    try {
      await combatant.toggleThrustUsage(1);
      this.render();
    } catch (error) {
      console.error('TwodsixCombatTracker | Error adjusting thrust:', error);
    }
  }

  /**
   * Handle thrust increase
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The action target element
   * @this {TwodsixCombatTracker}
   * @static
   */
  static async #increaseThrust(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const combatantId = target.dataset.combatantId;
    const combat = this.viewed;
    const combatant = combat?.combatants.get(combatantId);
    if (!combatant) return;

    try {
      await combatant.toggleThrustUsage(1);
      this.render();
    } catch (error) {
      console.error('TwodsixCombatTracker | Error increasing thrust:', error);
    }
  }

  /**
   * Handle thrust decrease
   * @param {PointerEvent} event - The triggering event
   * @param {HTMLElement} target - The action target element
   * @this {TwodsixCombatTracker}
   * @static
   */
  static async #decreaseThrust(event, target) {
    event.preventDefault();
    event.stopPropagation();
    const combatantId = target.dataset.combatantId;
    const combat = this.viewed;
    const combatant = combat?.combatants.get(combatantId);
    if (!combatant) return;

    try {
      await combatant.toggleThrustUsage(-1);
      this.render();
    } catch (error) {
      console.error('TwodsixCombatTracker | Error decreasing thrust:', error);
    }
  }


}
