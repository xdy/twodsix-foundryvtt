/**
 * TraderApp.js
 * ApplicationV2 UI class for the trade journey, extending DecisionApp.
 */

import { DecisionApp, RESTART } from '../DecisionApp.js';
import { formatGameDate, freshTraderState, getUsedCargoSpace } from './TraderState.js';
import { getWorldCoordinate, traderDebug } from './TraderUtils.js';


export class TraderApp extends DecisionApp {
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
  pendingMaxValue = null;

  // ─── Rendering ──────────────────────────────────────────────

  _getScrollSelector() {
    return '.st-scroll';
  }

  async _prepareContext(_options) {
    try {
      const s = this.state || freshTraderState();
      const formatCr = num => (num ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 });

      const context = {
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
      traderDebug('TraderApp', ` context keys: ${Object.keys(context).length}, rows: ${context.rows.length}`);
      return context;
    } catch (err) {
      console.error('Twodsix | TraderApp._prepareContext failed:', err);
      return { loading: true, rows: [] };
    }
  }

  async _onRender(_ctx, _opts) {
    await super._onRender(_ctx, _opts);
    if (this.element) {
      traderDebug('TraderApp', ` _onRender: template: ${this.constructor.PARTS.main.template}, DOM nodes: ${this.element.querySelectorAll('*').length}`);
    }
  }

  _attachHandlers(el) {
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
   * Present a choice to the user with trader-specific maxValue and placeholder support.
   * @param {string} label - Display label for the choice
   * @param {Array<{value: string, label: string}>} options - Available options
   * @param {number|null} [maxValue=null] - Optional max value for "To capacity" button
   * @param {string} [placeholder='TWODSIX.Trader.Actions.ChooseAction'] - Optional i18n key for dropdown placeholder
   * @returns {Promise<string>} Selected value
   */
  async _choose(label, options, maxValue = null, placeholder = 'TWODSIX.Trader.Actions.ChooseAction') {
    const choiceOptions = Array.isArray(options) ? options : [];

    if (!choiceOptions.length) {
      this.rows.push({ label, result: game.i18n.localize('TWODSIX.Trader.App.NoOptions'), active: false, options: [], maxValue: null, placeholder });
      this.render();
      return '';
    }

    this.pendingMaxValue = maxValue;
    return super._choose(label, choiceOptions, { maxValue, placeholder });
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

      // Re-hydrate worlds with actual Actor documents
      if (Array.isArray(this.state.worlds)) {
        this.state.worlds = this.state.worlds
          .map(w => game.actors.get(w.id || w._id))
          .filter(a => !!a);
      }
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
