/**
 * TraderApp.js
 * ApplicationV2 UI class for the trade journey, extending DecisionApp.
 */

import { appendJournalPageHtml } from '../../utils/appendJournalPageHtml.js';
import { createCoalescingTaskQueue, createSerializedAsyncQueue } from '../coalescingQueue.js';
import { DecisionApp, RESTART } from '../DecisionApp.js';
import { DecisionHistoryStore } from '../DecisionHistoryStore.js';
import { findReplayChoiceOption, isCoordinateLike } from '../decisionReplayChoiceMatch.js';
import { mergeLoadedSubsectorKeysFromActors } from './SubsectorLoader.js';
import { TRADER_RULESET_DEFINITIONS } from './TraderRulesetRegistry.js';
import {
  deserializeTraderState,
  formatGameDate,
  freshTraderState,
  getTotalPassengers,
  getUsedCargoSpace,
  serializeTraderState
} from './TraderState.js';
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
  /** Values never picked by Random / roll-till-bankruptcy. */
  static EXCLUDED_FROM_RANDOM_CHOICE = new Set(['otherActivities', 'other', 'privateMessages', 'charter']);
  static ROLL_TILL_BANKRUPTCY_STUCK_LIMIT = 100;
  static TRADER_SAVE_DEBOUNCE_MS = 450;
  state = null;
  decisionStore = new DecisionHistoryStore();
  pendingMaxValue = null;
  _initialStateSnapshot = null;
  _isReplaying = false;
  _saveCoalescer = createCoalescingTaskQueue(err => {
    console.error('Twodsix | TraderApp persistence failed:', err);
  });
  _journalHtmlQueue = createSerializedAsyncQueue(err => {
    console.error('Twodsix | TraderApp journal append failed:', err);
  });
  _saveQueue = Promise.resolve();
  /** @type {ReturnType<typeof setTimeout> | null} */
  _saveDebounceTimer = null;
  _rollTillBankruptcyActive = false;
  _stopRollBankruptcyRequested = false;
  _rollTillBankruptcyRunId = 0;
  _undoInProgress = false;
  _saveDirty = false;

  // ─── Rendering ──────────────────────────────────────────────

  _getScrollSelector() {
    return '.st-scroll';
  }

  async _prepareContext(_options) {
    try {
      const s = this.state || freshTraderState();
      const formatCr = num => (num ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0 });

      const rulesetDef = TRADER_RULESET_DEFINITIONS[s.ruleset];
      const rulesetLabel = rulesetDef ? game.i18n.localize(rulesetDef.label) : (s.ruleset || 'CE');

      const context = {
        ship: s.ship,
        currentWorldName: s.currentWorldName || game.i18n.localize('TWODSIX.Trader.App.Unknown'),
        currentWorldUwp: this._getCurrentWorldUwp(),
        dateStr: formatGameDate(s.gameDate),
        creditsStr: formatCr(s.credits),
        usedCargo: getUsedCargoSpace(s),
        totalPassengers: getTotalPassengers(s.passengers),
        freight: s.freight || 0,
        rulesetLabel,
        rows: this.rows,
        loading: this.rows.length === 0 && !s.gameOver,
        gameOver: s.gameOver,
        outcome: s.outcome,
        phase: s.phase,
        destinationName: s.destinationName,
        showUndo: this._canShowUndoControl(),
        showRandomRoll: this._canShowRandomRollControl(),
        rollTillBankruptcyActive: this._rollTillBankruptcyActive,
        undoInProgress: this._undoInProgress,
        canUndo: this.decisionStore.decisions.some(d => d?.type === 'choice'),
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

    el.querySelector('.st-undo')?.addEventListener('click', () => this._undo());
    el.querySelector('.st-rand')?.addEventListener('click', () => void this._resolveActiveRandomly());
    el.querySelector('.st-roll-till-bankrupt')?.addEventListener('click', () => this._startRollTillBankruptcy());
    const stopRollButton = el.querySelector('.st-stop-roll-till');
    const stopRoll = async event => {
      event?.preventDefault();
      event?.stopPropagation();
      await this.logEvent("Trader gave up the aleatoric arts and starts choosing carefully.");
      this._stopRollTillBankruptcy();
    };
    stopRollButton?.addEventListener('pointerdown', stopRoll);
    stopRollButton?.addEventListener('mousedown', stopRoll);
    stopRollButton?.addEventListener('click', stopRoll);
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

  _canShowUndoControl() {
    if (!game.settings.get('twodsix', 'traderEnableUndo')) {
      return false;
    }
    const minRole = Number(game.settings.get('twodsix', 'traderUndoMinRole') ?? CONST.USER_ROLES.PLAYER);
    return Number(game.user?.role ?? -1) >= minRole;
  }

  _canShowRandomRollControl() {
    if (!game.settings.get('twodsix', 'traderEnableRandomRoll')) {
      return false;
    }
    const minRole = Number(game.settings.get('twodsix', 'traderRandomRollMinRole') ?? CONST.USER_ROLES.PLAYER);
    return Number(game.user?.role ?? -1) >= minRole;
  }

  _rehydrateWorldActors() {
    // Re-hydrate worlds with actual Actor documents
    if (Array.isArray(this.state.worlds)) {
      this.state.worlds = this.state.worlds
        .map(w => game.actors.get(w.id || w._id))
        .filter(a => !!a);
      // Older saves pre-filled loadedSubsectorKeys for the full 3x3 grid; rebuild from actor flags
      // so ensureSubsectorNeighborsLoaded can still backfill missing subsectors.
      this.state.loadedSubsectorKeys = mergeLoadedSubsectorKeysFromActors([], this.state.worlds);
    }
  }

  isReplayingDecisions() {
    return this._isReplaying;
  }

  _stopReplayAt(index, reason) {
    this.decisionStore.truncate(index);
    this._isReplaying = false;
    this._undoInProgress = false;
    if (reason) {
      console.warn(`TraderApp | Stopped decision replay: ${reason}`);
    }
  }

  _cloneDecisionValue(value) {
    return foundry.utils.deepClone(value);
  }

  _shouldSkipStaleChoice(label, value) {
    const destinationPrompts = new Set([
      game.i18n.localize('TWODSIX.Trader.Prompts.ChooseDestination'),
      game.i18n.localize('TWODSIX.Trader.Prompts.Destination'),
    ]);
    if (value === 'change' && destinationPrompts.has(label)) {
      return true;
    }

    const atWorldPrompt = game.i18n.format('TWODSIX.Trader.Prompts.AtWorld', { world: this.state?.currentWorldName });
    if (label !== atWorldPrompt) {
      return false;
    }

    const cache = this.state?.worldVisitCache?.[this.state?.currentWorldHex];
    return (value === 'findSupplier' && !!cache?.foundSupplier)
      || (value === 'findBuyer' && !!cache?.foundBuyer);
  }

  _shouldSkipStaleChoiceBeforeRoll(formula, decision) {
    if (decision?.type !== 'choice' || formula !== '1d6' || this.state?.phase !== 'AT_WORLD') {
      return false;
    }
    const value = String(decision.value ?? '');
    return !!this.state?.destinationHex && (isCoordinateLike(value) || ['change', 'confirm'].includes(value));
  }

  _logInvalidReplayChoice({ label, value, index, replayOptions, choiceOptions }) {
    const optionSummary = replayOptions.map(option => ({
      value: option.value,
      label: option.label,
      aliases: option.aliases,
      replayOnly: !!option.replayOnly,
      matchCoordinateLike: !!option.matchCoordinateLike,
    }));
    const stateSummary = {
      phase: this.state?.phase,
      currentWorldHex: this.state?.currentWorldHex,
      currentWorldName: this.state?.currentWorldName,
      destinationHex: this.state?.destinationHex,
      destinationGlobalHex: this.state?.destinationGlobalHex,
      destinationName: this.state?.destinationName,
      isCoordinateLike: isCoordinateLike(value),
      replaying: this._isReplaying,
      undoInProgress: this._undoInProgress,
      cursor: this.decisionStore.cursor,
      decisionCount: this.decisionStore.decisions.length,
    };

    console.warn('TraderApp | Invalid replay choice diagnostics', {
      label,
      value,
      index,
      decision: this.decisionStore.decisions[index],
      previousDecision: this.decisionStore.decisions[index - 1],
      nextDecision: this.decisionStore.decisions[index + 1],
      visibleOptions: choiceOptions.map(option => option.value),
      replayOptions: optionSummary,
      state: stateSummary,
    });
  }

  rememberGeneratedValue(key, producer) {
    const index = this.decisionStore.cursor;
    const decision = this.decisionStore.decisions[index] ?? null;

    if (decision?.type === 'generated') {
      if (decision.key === key) {
        this.decisionStore.cursor++;
        return this._cloneDecisionValue(decision.value);
      }
      this._stopReplayAt(index, `expected generated value "${key}" but found "${decision.key}".`);
    }

    const value = producer();
    const storedDecision = {
      type: 'generated',
      key,
      value: this._cloneDecisionValue(value),
    };

    if (decision && this._isReplaying) {
      this.decisionStore.decisions.splice(index, 0, storedDecision);
    } else {
      this.decisionStore.push(storedDecision);
    }
    this.decisionStore.cursor++;
    return value;
  }

  async _roll(formula) {
    const { index, decision } = this.decisionStore.next();
    if (decision) {
      if (decision.type !== 'roll' || !Number.isFinite(Number(decision.value))) {
        if (this._shouldSkipStaleChoiceBeforeRoll(formula, decision)) {
          this.decisionStore.decisions.splice(index, 1);
          this.decisionStore.cursor = index;
          return this._roll(formula);
        }
        this._stopReplayAt(index, `expected roll for "${formula}" but found ${decision.type}.`);
      } else {
        return Number(decision.value);
      }
    }

    if (this._undoInProgress) {
      this._undoInProgress = false;
    }
    this._isReplaying = false;
    const value = await super._roll(formula);
    this.decisionStore.push({ type: 'roll', value });
    return value;
  }

  /**
   * Present a choice to the user with trader-specific maxValue and placeholder support.
   * @param {string} label - Display label for the choice
   * @param {Array<{value: string, label: string}>} options - Available options
   * @param {number|null} [maxValue=null] - Optional max value for "To capacity" button
   * @param {string} [placeholder='TWODSIX.Trader.Actions.ChooseAction'] - Optional i18n key for dropdown placeholder
   * @returns {Promise<string>} Selected value
   */
  async _choose(label, options, maxValue = null, placeholder = 'TWODSIX.Trader.Actions.ChooseAction') {
    const replayOptions = Array.isArray(options) ? options : [];
    const choiceOptions = replayOptions.filter(option => !option.replayOnly);
    const { index, decision } = this.decisionStore.next();

    if (!choiceOptions.length) {
      this.rows.push({ label, result: game.i18n.localize('TWODSIX.Trader.App.NoOptions'), active: false, options: [], maxValue: null, placeholder });
      this.render();
      return '';
    }

    if (decision) {
      if (decision.type !== 'choice') {
        this._stopReplayAt(index, `expected choice for "${label}" but found ${decision.type}.`);
      } else {
        const value = String(decision.value);
        const found = findReplayChoiceOption(replayOptions, value);
        if (found) {
          this.rows.push({ label, result: found.label ?? value, active: false, options: choiceOptions, maxValue, placeholder });
          if (!this._isReplaying) {
            this.render();
          }
          return found.value;
        }

        if (this._shouldSkipStaleChoice(label, value)) {
          this.decisionStore.decisions.splice(index, 1);
          this.decisionStore.cursor = index;
          return this._choose(label, choiceOptions, maxValue, placeholder);
        }

        this._logInvalidReplayChoice({ label, value, index, replayOptions, choiceOptions });
        this._stopReplayAt(index, `choice "${value}" is invalid for "${label}".`);
      }
    }

    this._isReplaying = false;
    if (this._undoInProgress) {
      this._undoInProgress = false;
    }
    this.rows.forEach(row => {
      row.active = false;
    });
    this.pendingMaxValue = maxValue;
    const value = await super._choose(label, choiceOptions, { maxValue, placeholder });
    this.decisionStore.push({ type: 'choice', value });
    return value;
  }

  _filterRandomChoiceOptions(options) {
    const list = Array.isArray(options) ? options : [];
    return list.filter(o => !TraderApp.EXCLUDED_FROM_RANDOM_CHOICE.has(String(o.value)));
  }

  /**
   * Random-choice pool for the active row (excludes charter/other; falls back to `continue` if needed).
   * @param {{ options?: Array<{ value: unknown }> }} row
   * @returns {Array<{ value: unknown }>|null} Null if no valid pool.
   */
  _randomChoicePoolFromRow(row) {
    if (!row?.options?.length) {
      return null;
    }
    let pool = this._filterRandomChoiceOptions(row.options);
    if (!pool.length) {
      const cont = row.options.find(o => String(o.value) === 'continue');
      pool = cont ? [cont] : [];
    }
    return pool.length ? pool : null;
  }

  /**
   * Pick a random option for the active row, never choosing Other Activities entries.
   */
  async _resolveActiveRandomly() {
    if (!this._canShowRandomRollControl()) {
      return;
    }
    await this.logEvent("Trader embraces Aleatoricism and rolls dice to select what to do.");
    const row = this.rows.find(r => r.active);
    if (!row || !this.pendingResolve) {
      return;
    }
    const pool = this._randomChoicePoolFromRow(row);
    if (!pool) {
      return;
    }
    const idx = (await new Roll(`1d${pool.length}`).roll()).total - 1;
    const value = String(pool[idx].value);
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    this.pendingMaxValue = null;
    resolve(value);
  }

  _startRollTillBankruptcy() {
    if (!this._canShowRandomRollControl()) {
      return;
    }
    if (this.state?.gameOver || this._rollTillBankruptcyActive) {
      return;
    }
    const runId = ++this._rollTillBankruptcyRunId;
    this._rollTillBankruptcyActive = true;
    this._stopRollBankruptcyRequested = false;
    this.render();
    void this._rollTillBankruptcyLoop(runId);
  }

  _cancelRollTillBankruptcy({ render = true } = {}) {
    this._rollTillBankruptcyRunId++;
    this._stopRollBankruptcyRequested = true;
    if (this._rollTillBankruptcyActive) {
      this._rollTillBankruptcyActive = false;
      if (render) {
        this.render();
      }
    }
  }

  _stopRollTillBankruptcy() {
    this._cancelRollTillBankruptcy();
  }

  _rollTillBankruptcyProgressKey() {
    const s = this.state;
    const world = s?.currentWorldHex || s?.currentWorldName || '';
    const year = Number(s?.gameDate?.year ?? 0);
    const day = Number(s?.gameDate?.day ?? 0);
    return `${world}|${year}|${day}`;
  }

  async _rollTillBankruptcyLoop(runId) {
    let lastProgressKey = null;
    let rollsAtSameWorldDay = 0;
    try {
      while (
        runId === this._rollTillBankruptcyRunId
        && this.state
        && !this.state.gameOver
        && !this._stopRollBankruptcyRequested
      ) {
        const row = this.rows.find(r => r.active);
        if (row && this.pendingResolve) {
          if (!this._canShowRandomRollControl()) {
            this._cancelRollTillBankruptcy();
            break;
          }
          const pool = this._randomChoicePoolFromRow(row);
          if (pool) {
            if (runId !== this._rollTillBankruptcyRunId || this._stopRollBankruptcyRequested) {
              break;
            }
            const progressKey = this._rollTillBankruptcyProgressKey();
            const sameWorldDay = progressKey === lastProgressKey;
            if (sameWorldDay) {
              rollsAtSameWorldDay += 1;
            } else {
              lastProgressKey = progressKey;
              rollsAtSameWorldDay = 1;
            }
            if (rollsAtSameWorldDay > TraderApp.ROLL_TILL_BANKRUPTCY_STUCK_LIMIT) {
              this._cancelRollTillBankruptcy();
              break;
            }
            // Only yield to the event loop when transitioning to a new world/day,
            // giving the render pipeline a chance to update the UI.
            if (!sameWorldDay) {
              await new Promise(r => setTimeout(r, 10));
            }
            if (runId !== this._rollTillBankruptcyRunId || this._stopRollBankruptcyRequested) {
              break;
            }
            const idx = (await new Roll(`1d${pool.length}`).roll()).total - 1;
            if (runId !== this._rollTillBankruptcyRunId || this._stopRollBankruptcyRequested) {
              break;
            }
            const value = String(pool[idx].value);
            const resolve = this.pendingResolve;
            this.pendingResolve = null;
            this.pendingMaxValue = null;
            resolve(value);
          }
        }
        await new Promise(r => setTimeout(r, 25));
      }
    } finally {
      if (runId === this._rollTillBankruptcyRunId) {
        this._rollTillBankruptcyActive = false;
        this._stopRollBankruptcyRequested = false;
        // Skip render when gameOver: runTradeLoop already rendered the outcome.
        if (!this.state?.gameOver) {
          this.render();
        }
      }
    }
  }

  /** @inheritdoc */
  async close(options = {}) {
    this._cancelRollTillBankruptcy({ render: false });
    await this.flushSave();
    return super.close(options);
  }

  async _undo() {
    if (!this._canShowUndoControl()) {
      return;
    }
    if (this._undoInProgress) {
      return;
    }
    await this.logEvent("Trader somehow turned back time.");
    this._cancelRollTillBankruptcy({ render: false });
    if (!this.decisionStore.undoLastChoice()) {
      return;
    }
    this._undoInProgress = true;
    this.rows.forEach(row => {
      row.active = false;
    });
    this.render();
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    this.pendingMaxValue = null;
    if (resolve) {
      resolve(RESTART);
      return;
    }
    void this.run();
  }

  // ─── State Persistence ──────────────────────────────────────

  /**
   * Enqueue a write of the current trader snapshot to the backing journal flag (coalesced).
   * @returns {Promise<void>}
   */
  _enqueuePersistTradeState() {
    if (!this._saveDirty) {
      return this._saveQueue;
    }
    const snapshot = serializeTraderState(this.state);
    snapshot.decisions = foundry.utils.deepClone(this.decisionStore.decisions);
    snapshot.initialState = this._initialStateSnapshot ? foundry.utils.deepClone(this._initialStateSnapshot) : null;
    const requestId = this._saveCoalescer.bumpRequestId();
    this._saveQueue = this._saveCoalescer.enqueue(requestId, async () => {
      if (!snapshot?.journalEntryId) {
        console.warn('Twodsix | TraderApp: No journalEntryId in state.');
        return;
      }

      const journal = game.journal.get(snapshot.journalEntryId);
      if (!journal) {
        console.warn('Twodsix | TraderApp: JournalEntry not found:', snapshot.journalEntryId);
        return;
      }

      if (this._isReplaying) {
        return;
      }

      await journal.setFlag('twodsix', 'tradeState', snapshot);
      this._saveDirty = false;
    });

    return this._saveQueue;
  }

  /** Debounced persist (same cadence as CharGen session saves). */
  scheduleSave() {
    this._saveDirty = true;
    clearTimeout(this._saveDebounceTimer);
    this._saveDebounceTimer = setTimeout(() => {
      this._saveDebounceTimer = null;
      void this._enqueuePersistTradeState();
    }, this.constructor.TRADER_SAVE_DEBOUNCE_MS);
  }

  /** Cancel debounce and await the latest persisted snapshot. */
  async flushSave() {
    this._saveDirty = true;
    clearTimeout(this._saveDebounceTimer);
    this._saveDebounceTimer = null;
    return this._enqueuePersistTradeState();
  }

  /**
   * Save current state to JournalEntry flags (immediate; clears debounce).
   * @returns {Promise<void>}
   */
  async _saveState() {
    return this.flushSave();
  }

  /**
   * Load state from a JournalEntry.
   * @param {JournalEntry} journalEntry
   */
  loadState(journalEntry) {
    const saved = journalEntry.getFlag('twodsix', 'tradeState');
    if (saved) {
      this.state = deserializeTraderState(saved);
      this.state.journalEntryId = journalEntry.id;
      this._initialStateSnapshot = saved.initialState ? foundry.utils.deepClone(saved.initialState) : serializeTraderState(this.state);
      this.decisionStore.decisions = Array.isArray(saved.decisions) ? foundry.utils.deepClone(saved.decisions) : [];
      this.decisionStore.resetCursor();
      this._isReplaying = this.decisionStore.decisions.length > 0;
      this._saveDirty = false;
      this._rehydrateWorldActors();
    }
  }

  /**
   * Append text to the journal entry page.
   * @param {string} html - HTML to append
   */
  async _appendToJournal(html) {
    return this._journalHtmlQueue.runSerialized(async () => {
      if (!this.state?.journalEntryId) {
        console.warn('Twodsix | TraderApp._appendToJournal: Missing journalEntryId.');
        return;
      }
      const resolved = await appendJournalPageHtml(
        this.state.journalEntryId,
        this.state.journalPageId ?? null,
        html,
        { logLabel: 'TraderApp._appendToJournal' },
      );
      if (resolved && !this.state.journalPageId) {
        this.state.journalPageId = resolved;
      }
    });
  }

  /**
   * Log a trader event to both the UI rows and the journal.
   * @param {string} text - Event description
   */
  async logEvent(text) {
    const dateStr = formatGameDate(this.state.gameDate);
    this._log(dateStr, text);
    if (!this._isReplaying) {
      await this._appendToJournal(`<p><strong>${dateStr}.</strong> ${text}</p>\n`);
      this.render();
    }
  }

  // ─── Trader Loop ──────────────────────────────────────────────

  /**
   * Start or resume the trader loop.
   */
  async run() {
    const { runTradeLoop } = await import('./TraderLogic.js');
    if (!this.state) {
      this.state = freshTraderState();
    }

    if (!this._initialStateSnapshot) {
      this._initialStateSnapshot = serializeTraderState(this.state);
    }

    while (true) {
      this.decisionStore.resetCursor();
      this.rows = [];
      this.state = deserializeTraderState(this._initialStateSnapshot);
      this._rehydrateWorldActors();
      this._isReplaying = this.decisionStore.decisions.length > 0;

      try {
        await runTradeLoop(this);
        await this.flushSave();
        return;
      } catch (err) {
        if (err === RESTART) {
          await this.flushSave();
          continue;
        }
        throw err;
      }
    }
  }
}
