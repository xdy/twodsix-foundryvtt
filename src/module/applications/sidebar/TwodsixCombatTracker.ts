// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixCombat from "../../entities/TwodsixCombat";

/**
 * A custom combat tracker that extends Foundry's CombatTracker to support space combat phases
 * and action tracking for ship combat encounters.
 *
 * Inspired by Draw Steel's CombatTracker extension pattern.
 */
export default class TwodsixCombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
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
    if (!combat?.isSpaceCombat?.()) return;

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
    const combat = this.viewed as TwodsixCombat;

    // Only show phase display for actual space combats
    if (!combat?.isSpaceCombat?.()) return;

    const phaseInfo = combat.getPhaseDisplayInfo();
    if (!phaseInfo) return;

    // Find the combat tracker header
    const header = this.element.querySelector('.combat-tracker-header');
    if (!header) return;

    // Remove any existing phase display
    const existing = header.querySelector('.space-combat-phase');
    if (existing) existing.remove();

    // Create phase display element
    const phaseDisplay = document.createElement('div');
    phaseDisplay.classList.add('space-combat-phase');

    // Add phase name
    const phaseName = document.createElement('h4');
    phaseName.classList.add('phase-name');
    phaseName.textContent = `${game.i18n.localize("TWODSIX.Combat.Phase")}: ${phaseInfo.currentPhase || 'Unknown'}`;
    phaseDisplay.appendChild(phaseName);

    // Add phase controls for GM
    if (phaseInfo.canNavigatePhases) {
      const phaseControls = document.createElement('div');
      phaseControls.classList.add('phase-controls');

      // Previous phase button
      const prevButton = document.createElement('a');
      prevButton.classList.add('phase-control');
      prevButton.title = game.i18n.localize("TWODSIX.Combat.PreviousPhase");
      prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
      prevButton.addEventListener('click', async (event) => {
        event.preventDefault();
        const success = await combat.previousPhase();
        if (!success) {
          ui.notifications.warn(game.i18n.localize("TWODSIX.Combat.AlreadyFirstPhase"));
        }
        this.render();
      });
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
      nextButton.addEventListener('click', async (event) => {
        event.preventDefault();
        await combat.advancePhaseWithRoundManagement();
        this.render();
      });
      phaseControls.appendChild(nextButton);

      phaseDisplay.appendChild(phaseControls);
    }

    // Insert phase display after combat round
    const roundDiv = header.querySelector('.combat-round');
    if (roundDiv) {
      roundDiv.after(phaseDisplay);
    } else {
      header.appendChild(phaseDisplay);
    }
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

      // Get action usage and budget
      const minorUsed = combatant.flags?.twodsix?.minorActionsUsed ?? 0;
      const sigUsed = combatant.flags?.twodsix?.significantActionsUsed ?? 0;
      const reactionsUsed = combatant.flags?.twodsix?.reactionsUsed ?? 0;
      const reactionsAvailable = combatant.getAvailableReactions?.() ?? 0;
      const budget = combat.getActionBudget();
      const minorCanUse = combatant.canUseMinorAction?.() ?? false;
      const sigCanUse = combatant.canUseSignificantAction?.() ?? false;
      const reactCanUse = combatant.canUseReaction?.() ?? false;

      // Create action indicator wrapper
      const actionWrapper = document.createElement('div');
      actionWrapper.classList.add('action-indicator-wrapper');

      // Add minor actions control
      actionWrapper.appendChild(
        this._createActionControl(
          'minor',
          'fa-walking',
          minorUsed,
          budget.minorActions,
          minorCanUse,
          () => combatant.useMinorAction(),
          () => combatant.undoMinorAction()
        )
      );

      // Add significant actions control
      actionWrapper.appendChild(
        this._createActionControl(
          'significant',
          'fa-running',
          sigUsed,
          budget.significantActions,
          sigCanUse,
          () => combatant.useSignificantAction(),
          () => combatant.undoSignificantAction()
        )
      );

      // Add reactions control
      actionWrapper.appendChild(
        this._createActionControl(
          'reaction',
          'fa-shield-alt',
          reactionsUsed,
          reactionsAvailable,
          reactCanUse,
          () => combatant.useReaction(),
          () => combatant.undoReaction()
        )
      );

      // Insert after token name
      const tokenName = element.querySelector('.token-name');
      if (tokenName) {
        tokenName.appendChild(actionWrapper);
      }
    });
  }

  /**
   * Create an action control element (minor, significant, or reaction)
   * @private
   */
  _createActionControl(
    actionType: 'minor' | 'significant' | 'reaction',
    icon: string,
    used: number,
    available: number,
    canUse: boolean,
    useMethod: () => Promise<boolean>,
    undoMethod: () => Promise<boolean>
  ): HTMLElement {
    const control = document.createElement('div');
    control.classList.add('action-control', `${actionType}-actions`);
    control.title = game.i18n.localize(
      `TWODSIX.Combat.${actionType === 'minor' ? 'MinorActions' : actionType === 'significant' ? 'SignificantActions' : 'Reactions'}`
    );
    control.innerHTML = `<i class="fas ${icon}"></i> <span class="action-count">${used}/${available}</span>`;

    // Add clickable state if can use
    if (canUse && game.user.isGM) {
      control.classList.add('can-use');
      control.addEventListener('click', async () => {
        await useMethod();
        this.render();
      });
    }

    // Add undo button if actions were used
    if (used > 0 && game.user.isGM) {
      const undoBtn = document.createElement('button');
      undoBtn.classList.add('undo-action');
      undoBtn.type = 'button';
      undoBtn.title = 'Undo';
      undoBtn.innerHTML = '<i class="fas fa-undo"></i>';
      undoBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await undoMethod();
        this.render();
      });
      control.appendChild(undoBtn);
    }

    return control;
  }


}
