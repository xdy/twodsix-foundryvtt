/**
 * TraderApp.js
 * ApplicationV2 UI class for the trade journey.
 * Follows the same pattern as CharGenApp for decision tracking, _choose/_roll/_log.
 */

import { DAYS_PER_MONTH, MARKET_REFRESH_DAYS } from './TraderConstants.js';
import { ACTION, RESTART } from './TraderLogic.js';
import { formatGameDate, freshTraderState, getUsedCargoSpace } from './TraderState.js';
import { getWorldCoordinate } from './TraderUtils.js';


export class TraderApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'trader',
    classes: ['twodsix', 'trade'],
    window: { title: 'TWODSIX.Trader.App.Title', resizable: true },
    position: { width: 960, height: 800 },
  };

  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/trader/trader-app.hbs',
    },
  };

  state = null;
  rows = [];
  pendingResolve = null;
  pendingMaxValue = null;

  // ─── Rendering ──────────────────────────────────────────────

  async _prepareContext(_options) {
    try {
      const s = this.state || freshTraderState();
      const formatCr = num => (num ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 });

      console.log('Twodsix | TraderApp._prepareContext:', {
        phase: s.phase,
        rows: this.rows.length,
        world: s.currentWorldName,
        hex: s.currentWorldHex,
        worldsCount: s.worlds?.length
      });

      return {
        ship: s.ship,
        currentWorldName: s.currentWorldName || game.i18n.localize('TWODSIX.Trader.App.Unknown'),
        currentWorldUwp: this._getCurrentWorldUwp(),
        dateStr: formatGameDate(s.gameDate),
        creditsStr: formatCr(s.credits),
        usedCargo: getUsedCargoSpace(s),
        totalPassengers: (s.passengers?.high || 0) + (s.passengers?.middle || 0) + (s.passengers?.low || 0),
        freight: s.freight || 0,
        rows: this.rows,
        loading: this.rows.length === 0 && !s.gameOver,
        gameOver: s.gameOver,
        outcome: s.outcome,
        phase: s.phase,
        destinationName: s.destinationName,
        // Charter state
        chartered: s.chartered || false,
        charterCargo: s.charterCargo || 0,
        charterStaterooms: s.charterStaterooms || 0,
        charterLowBerths: s.charterLowBerths || 0,
      };
    } catch (err) {
      console.error('Twodsix | TraderApp._prepareContext failed:', err);
      return { loading: true, rows: [] };
    }
  }

  async _onRender(_ctx, _opts) {
    if (!this.element) {
      return;
    }
    console.log('Twodsix | TraderApp._onRender starting', {
      elementExists: !!this.element,
      elementVisible: this.element?.offsetParent !== null,
      innerHTML_length: this.element?.innerHTML?.length,
      hasStatusBar: !!this.element?.querySelector('.st-status-bar'),
      hasScroll: !!this.element?.querySelector('.st-scroll'),
      hasTable: !!this.element?.querySelector('.st-table'),
      rowsCount: this.element?.querySelectorAll('.st-table tr').length
    });
    this._attachChoiceHandler(this.element);
    const scr = this.element.querySelector('.st-scroll');
    if (scr) {
      scr.scrollTop = scr.scrollHeight;
    }
  }

  _attachChoiceHandler(el) {
    // Handle dropdown selection
    el.querySelector('.st-select')?.addEventListener('change', e => {
      if (e.target.value && this.pendingResolve) {
        const r = this.pendingResolve;
        this.pendingResolve = null;
        this.pendingMaxValue = null;
        r(e.target.value);
      }
    }, { once: true });

    // Handle "To capacity" button click
    el.querySelector('.st-to-capacity-btn')?.addEventListener('click', _ => {
      if (this.pendingResolve && this.pendingMaxValue !== null) {
        const r = this.pendingResolve;
        this.pendingResolve = null;
        const maxVal = this.pendingMaxValue;
        this.pendingMaxValue = null;
        r(String(maxVal));
      }
    }, { once: true });

    // Handle remain-in-port UI
    this._attachRemainInPortHandler(el);
  }

  /**
   * Attach handlers for the remain-in-port UI.
   * The UI has +/- buttons and an execute button that can trigger remain-in-port action.
   */
  _attachRemainInPortHandler(el) {
    const remainSection = el.querySelector('.st-remain-port');
    if (!remainSection) {
      return;
    }

    const input = remainSection.querySelector('.st-remain-input');
    const minusBtn = remainSection.querySelector('.st-remain-minus');
    const plusBtn = remainSection.querySelector('.st-remain-plus');
    const executeBtn = remainSection.querySelector('.st-remain-execute');

    // Decrease days
    minusBtn?.addEventListener('click', () => {
      const current = parseInt(input.value) || 1;
      input.value = Math.max(1, current - 1);
    }, { once: true });

    // Increase days
    plusBtn?.addEventListener('click', () => {
      const current = parseInt(input.value) || 1;
      input.value = Math.min(DAYS_PER_MONTH, current + 1);
    }, { once: true });

    // Execute remain in port
    executeBtn?.addEventListener('click', async () => {
      const days = parseInt(input.value) || 1;
      if (days < 1 || days > DAYS_PER_MONTH) {
        return;
      }

      // Show confirmation dialog
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('TWODSIX.Trader.App.RemainInPortConfirmTitle') },
        content: game.i18n.format('TWODSIX.Trader.App.RemainInPortConfirmContent', {
          days: days,
          refresh: MARKET_REFRESH_DAYS,
        }),
        ok: { label: game.i18n.localize('TWODSIX.Trader.App.YesRemainInPort') },
        cancel: { label: game.i18n.localize('Cancel') },
      });

      if (!confirmed) {
        return;
      }

      // If there's a pending choice, resolve it with the remainInPort action
      if (this.pendingResolve) {
        this._pendingRemainInPortDays = days;
        const r = this.pendingResolve;
        this.pendingResolve = null;
        this.pendingMaxValue = null;
        r(ACTION.REMAIN_IN_PORT);
      }
    }, { once: true });
  }


  _getCurrentWorldUwp() {
    try {
      if (!this.state?.worlds || !this.state.currentWorldHex) {
        return '';
      }
      const w = this.state.worlds.find(w => {
        const hex = getWorldCoordinate(w);
        return hex === this.state.currentWorldHex;
      });
      return w?.system?.uwp || '';
    } catch (err) {
      console.error('Twodsix | TraderApp._getCurrentWorldUwp failed:', err);
      return '';
    }
  }

  // ─── Decision Tracking ──────────────────────────────────────

  /**
   * Present a choice to the user. Returns the selected value.
   * @param {string} label - Display label for the choice
   * @param {Array<{value: string, label: string}>} options - Available options
   * @param {number|null} [maxValue=null] - Optional max value for "To capacity" button
   * @returns {Promise<string>} Selected value
   */
  async _choose(label, options, maxValue = null) {
    const choiceOptions = Array.isArray(options) ? options : [];

    if (!choiceOptions.length) {
      this.rows.push({ label, result: game.i18n.localize('TWODSIX.Trader.App.NoOptions'), active: false, options: [], maxValue: null });
      this.render();
      return '';
    }

    const row = { label, result: null, active: true, options: choiceOptions, maxValue };
    this.rows.push(row);
    this.pendingMaxValue = maxValue;
    this.render();

    const value = await new Promise(res => {
      this.pendingResolve = res;
    });

    if (value === RESTART) {
      throw RESTART;
    }

    row.result = choiceOptions.find(o => String(o.value) === String(value))?.label ?? value;
    row.active = false;
    this.render();
    return value;
  }

  /**
   * Roll dice using Foundry's Roll API.
   * @param {string} formula - Dice formula (e.g. "2D6", "3D6*5")
   * @returns {Promise<number>} Roll result
   */
  async _roll(formula) {
    return (await new Roll(formula).evaluate()).total;
  }

  /**
   * Add a log entry (non-interactive row).
   * @param {string} label - Row label (e.g. date)
   * @param {string} result - Row content
   */
  _log(label, result) {
    this.rows.push({ label, result: String(result ?? ''), active: false, options: [] });
  }

  // ─── State Persistence ──────────────────────────────────────

  /**
   * Save current state to JournalEntry flags.
   */
  async _saveState() {
    if (!this.state?.journalEntryId) {
      console.warn('Twodsix | TraderApp._saveState: No journalEntryId in state.');
      return;
    }
    const journal = game.journal.get(this.state.journalEntryId);
    if (!journal) {
      console.warn('Twodsix | TraderApp._saveState: JournalEntry not found:', this.state.journalEntryId);
      return;
    }
    await journal.setFlag('twodsix', 'tradeState', foundry.utils.deepClone(this.state));
  }

  /**
   * Load state from a JournalEntry.
   * @param {JournalEntry} journalEntry
   */
  loadState(journalEntry) {
    const saved = journalEntry.getFlag('twodsix', 'tradeState');
    if (saved) {
      this.state = foundry.utils.deepClone(saved);
      this.state.journalEntryId = journalEntry.id;
    }
  }

  /**
   * Append text to the journal entry page.
   * @param {string} html - HTML to append
   */
  async _appendToJournal(html) {
    if (!this.state?.journalEntryId || !this.state?.journalPageId) {
      console.warn('Twodsix | TraderApp._appendToJournal: Missing journalEntryId or journalPageId.');
      return;
    }
    const journal = game.journal.get(this.state.journalEntryId);
    if (!journal) {
      console.warn('Twodsix | TraderApp._appendToJournal: JournalEntry not found:', this.state.journalEntryId);
      return;
    }
    const page = journal.pages.get(this.state.journalPageId);
    if (!page) {
      console.warn('Twodsix | TraderApp._appendToJournal: JournalPage not found:', this.state.journalPageId);
      return;
    }
    const existing = page.text?.content || '';
    await page.update({ 'text.content': existing + html });
  }

  /**
   * Log a trader event to both the UI rows and the journal.
   * @param {string} text - Event description
   */
  async logEvent(text) {
    const dateStr = formatGameDate(this.state.gameDate);
    this._log(dateStr, text);
    await this._appendToJournal(`<p><strong>${dateStr}.</strong> ${text}</p>\n`);
    this.render();
  }

  /**
   * Actions to take when the application is closed.
   */
  async close(options = {}) {
    if (this.pendingResolve) {
      const r = this.pendingResolve;
      this.pendingResolve = null;
      r(RESTART);
    }
    return super.close(options);
  }

  // ─── Trader Loop ──────────────────────────────────────────────

  /**
   * Start or resume the trader loop.
   */
  async run() {
    const { runTradeLoop } = await import('./TraderLogic.js');
    try {
      await runTradeLoop(this);
    } catch (err) {
      if (err === RESTART) {
        return;
      }
      throw err;
    }
  }
}
