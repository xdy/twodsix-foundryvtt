// CharGenApp.js — Character generation UI class extending DecisionApp
import { LanguageType, nameGenerator as nameGen } from '../../utils/nameGenerator.js';
import { toHex } from '../../utils/utils.js';
import { DecisionApp } from '../DecisionApp.js';
import { DecisionHistoryStore } from '../DecisionHistoryStore.js';
import { findReplayChoiceOption } from '../decisionReplayChoiceMatch.js';
import {
  getCharacteristicsUiRules,
  rollPointBuyCharacteristics,
  rollRandomCharacteristics,
} from './characteristicsRules.js';
import { generateDetailedSummary } from './CharGenActorFactory.js';
import {
  dispatchCharGen,
  getChargenRulesetDisplayName,
  getChargenRulesetPickerItems,
  isChargenRulesetSupported,
  normalizeChargenRulesetOrCe,
} from './CharGenRegistry.js';
import { CharGenSessionJournal } from './CharGenSessionJournal.js';
import {
  CHARACTERISTIC_KEYS,
  CHARACTERISTIC_LABELS,
  CHARACTERISTICS_ROW_TYPE,
  CHARGEN_DIED,
  CHARGEN_ROW_TYPES,
  CHARGEN_SESSION_VERSION,
  deserializeCharGenState,
  freshState,
  NAME_ROW_LABEL,
} from './CharGenState.js';

/**
 * Validate characteristic input values against ruleset constraints.
 * Pure function — no DOM, no side effects.
 * @param {number[]} values - Parsed input values
 * @param {object} rules - Characteristic UI rules (inputMin, inputMax, isPointBuy, pointBuyTargetTotal)
 * @returns {{ allValid: boolean, total: number }}
 */
function validateCharacteristicValues(values, rules) {
  let allValid = true;
  let total = 0;
  for (const val of values) {
    if (isNaN(val) || val < rules.inputMin || val > rules.inputMax) {
      allValid = false;
    }
    total += val;
  }
  if (rules.isPointBuy && rules.pointBuyTargetTotal != null && total !== rules.pointBuyTargetTotal) {
    allValid = false;
  }
  return { allValid, total };
}

/**
 * Character generation Application class extending DecisionApp.
 * Handles the UI, user interactions, and decision tracking with undo/redo.
 */
export class CharGenApp extends DecisionApp {
  static DEFAULT_OPTIONS = {
    id: 'char-gen',
    classes: ['twodsix', 'char-gen'],
    window: { title: 'TWODSIX.CharGen.App.Title', resizable: true },
    position: { width: 900, height: 1024 },
  };

  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/chargen/char-gen.hbs',
    },
  };

  static DIED = CHARGEN_DIED;

  decisionStore = new DecisionHistoryStore();
  charState = null;
  isDone = false;
  charName = game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
  autoAll = false;
  summaryHeight = 0;
  _runPromise = null;

  /** Set when `createCharacterActor` succeeds this session (journal is kept on close). */
  _foundryActorCreated = false;
  /** Journal persistence, debounced saves, and human-readable log lines. */
  sessionJournal = new CharGenSessionJournal(this);

  constructor(...args) {
    super(...args);
    this.options.window.title = game.i18n.localize(this.options.window.title);
  }

  // ─── Rendering ──────────────────────────────────────────────

  /** @returns {ReturnType<typeof getCharacteristicsUiRules>} */
  _charUiRules() {
    return getCharacteristicsUiRules(this.charState?.ruleset ?? 'CE', this.charState?.creationMode ?? null);
  }

  _getScrollSelector() {
    return '.cg-scroll';
  }

  async _prepareContext(_options) {
    if (this.isDone && this.summaryHeight === 0) {
      const appHeight = this.position.height || 1024;
      this.summaryHeight = Math.floor(appHeight * 0.6);
    }

    const s = this.charState;
    const ruleset = s?.ruleset ?? 'CE';
    const charRules = this._charUiRules();
    const isPointBuy = charRules.isPointBuy;
    const totalChars = isPointBuy ? CHARACTERISTIC_KEYS.reduce((acc, k) => acc + (s?.chars[k] ?? 0), 0) : 0;

    const chars = CHARACTERISTIC_KEYS.map((k, i) => ({
      key: k,
      label: CHARACTERISTIC_LABELS[i],
      value: s?.chars[k] ?? 0,
    }));
    const upp = s ? CHARACTERISTIC_KEYS.map(k => toHex(s.chars[k] ?? 0)).join('') : '------';

    return {
      charName: this.charName,
      chars,
      upp,
      isPointBuy,
      remainingPoints: charRules.pointBuyTargetTotal != null ? charRules.pointBuyTargetTotal - totalChars : 0,
      charInputMin: charRules.inputMin,
      charInputMax: charRules.inputMax,
      pointBuyTotal: charRules.pointBuyTargetTotal ?? 0,
      age: s?.age ?? 18,
      skls: s?.skills?.size ?? 0,
      totalTerms: s?.totalTerms ?? 0,
      rulesets: getChargenRulesetPickerItems().map(r => ({
        key: r.key,
        name: r.name,
        selected: r.key === ruleset,
        disabled: r.disabled,
      })),
      rows: this.rows,
      isDone: this.isDone,
      autoAll: this.autoAll,
      died: s?.died ?? false,
      textSummary: this.isDone && s ? generateDetailedSummary(s) : '',
      summaryHeight: this.summaryHeight,
      scrollFlex: this.isDone ? '0 0 33%' : '1',
      showChargenUndo: this._canShowChargenUndo(),
      showChargenRandomRoll: this._canShowChargenRandomRoll(),
    };
  }

  _canShowChargenUndo() {
    if (!game.settings.get('twodsix', 'chargenEnableUndo')) {
      return false;
    }
    const minRole = Number(game.settings.get('twodsix', 'chargenUndoMinRole') ?? CONST.USER_ROLES.PLAYER);
    return Number(game.user?.role ?? -1) >= minRole;
  }

  _canShowChargenRandomRoll() {
    if (!game.settings.get('twodsix', 'chargenEnableRandomRoll')) {
      return false;
    }
    const minRole = Number(game.settings.get('twodsix', 'chargenRandomRollMinRole') ?? CONST.USER_ROLES.PLAYER);
    return Number(game.user?.role ?? -1) >= minRole;
  }

  // ─── Event Handlers ─────────────────────────────────────────

  _attachHandlers(el) {
    this._attachHeaderHandlers(el);
    this._attachRollHandlers(el);
    this._attachChoiceHandlers(el);
    this._attachActionHandlers(el);
    this._attachCharacteristicHandlers(el);
    this._attachNameHandlers(el);
    this._attachResizeHandler(el);
    this._updateDoneButton();
  }

  /**
   * Roll random characteristic values (2d6 for each).
   * @returns {Promise<void>}
   */
  async _rollCharacteristics() {
    if (!this.charState) {
      return;
    }
    const rules = this._charUiRules();
    if (rules.isPointBuy) {
      await rollPointBuyCharacteristics(this.charState.chars, CHARACTERISTIC_KEYS, {
        ruleset: this.charState.ruleset ?? 'CE',
        creationMode: this.charState.creationMode ?? null,
      });
    } else {
      await rollRandomCharacteristics(this.charState.chars, CHARACTERISTIC_KEYS);
    }
  }

  /**
   * Format characteristics as a display string (e.g., "STR:6 DEX:5 ...").
   * @returns {string} Formatted characteristic line
   */
  _formatCharacteristicsLine() {
    return CHARACTERISTIC_KEYS.map((k, i) => `${CHARACTERISTIC_LABELS[i]}:${this.charState.chars[k]}`).join(' ');
  }

  /**
   * Resolve characteristics as done (manual entry).
   */
  _resolveCharDone() {
    const r = this.pendingResolve;
    this.pendingResolve = null;
    if (r) {
      r('done');
    }
  }

  /**
   * Resolve characteristics by rolling random values.
   */
  async _resolveCharRoll() {
    await this._rollCharacteristics();
    const r = this.pendingResolve;
    this.pendingResolve = null;
    if (r) {
      r('rolled');
    }
  }

  /**
   * Resolve the currently active row with a random choice.
   */
  async _resolveActiveRandomly() {
    if (!this._canShowChargenRandomRoll()) {
      return;
    }
    const row = this.rows.find(r => r.active);
    if (!row || !this.pendingResolve) {
      return;
    }

    // Handle characteristics row specially (has empty options array)
    if (row.rowType === CHARGEN_ROW_TYPES.CHARACTERISTICS) {
      await this._rollCharacteristics();
      const r = this.pendingResolve;
      this.pendingResolve = null;
      r('rolled');
      return;
    }

    // Handle Name row: generate a fresh random name and continue
    if (row.rowType === CHARGEN_ROW_TYPES.NAME) {
      await this._resolveNameRoll();
      return;
    }

    if (!row.options?.length) {
      return;
    }

    const idx = (await new Roll(`1d${row.options.length}`).roll()).total - 1;
    const value = String(row.options[idx].value);
    const r = this.pendingResolve;
    this.pendingResolve = null;
    r(value);
  }

  _updateDoneButton() {
    const el = this.element;
    const doneBtn = el?.querySelector('.cg-char-done');
    if (!doneBtn) {
      return;
    }
    const inputs = el?.querySelectorAll('.cg-char-input');
    if (!inputs) {
      return;
    }

    const rules = this._charUiRules();
    const values = Array.from(inputs).map(input => parseInt(input.value) || 0);
    const { allValid, total } = validateCharacteristicValues(values, rules);
    doneBtn.disabled = !allValid;

    const pointsEl = el?.querySelector('.cg-point-buy-total');
    if (pointsEl && rules.isPointBuy && rules.pointBuyTargetTotal != null) {
      pointsEl.textContent = `${game.i18n.localize('TWODSIX.CharGen.App.Points')}: ${rules.pointBuyTargetTotal - total} / ${rules.pointBuyTargetTotal}`;
      pointsEl.style.color = total > rules.pointBuyTargetTotal ? 'red' : 'inherit';
    }
  }

  /**
   * Attach header event handlers (ruleset, name, language).
   */
  _attachHeaderHandlers(el) {
    el.querySelector('.cg-ruleset')?.addEventListener('change', e => {
      if (this.charState) {
        this.charState.ruleset = e.target.value;
        void this._redo();
      }
    });
  }

  /**
   * Attach roll button event handlers.
   */
  _attachRollHandlers(el) {
    el.querySelector('.cg-roll-upp')?.addEventListener('click', () => void this._resolveCharRoll());
    el.querySelector('.cg-char-done')?.addEventListener('click', () => this._resolveCharDone());
    el.querySelector('.cg-name-roll')?.addEventListener('click', () => this._resolveNameRoll());
    el.querySelector('.cg-name-done')?.addEventListener('click', () => this._resolveNameDone());
    el.querySelector('.cg-rand')?.addEventListener('click', () => void this._resolveActiveRandomly());
    el.querySelector('.cg-rand-all')?.addEventListener('click', async () => {
      if (this.isDone) {
        void this._redo();
        return;
      }
      this.autoAll = true;
      await this._resolveActiveRandomly();
    });
  }

  /**
   * Attach choice/decision event handlers.
   */
  _attachChoiceHandlers(el) {
    el.querySelector('.cg-select')?.addEventListener('change', e => {
      if (e.target.value && this.pendingResolve) {
        const r = this.pendingResolve;
        this.pendingResolve = null;
        r(e.target.value);
      }
    });
  }

  /**
   * Attach action button handlers (undo, redo, auto, create).
   */
  _attachActionHandlers(el) {
    el.querySelector('.cg-undo')?.addEventListener('click', () => void this._undo());
    el.querySelector('.cg-redo')?.addEventListener('click', () => void this._redo());
    el.querySelector('.cg-auto-from-here')?.addEventListener('click', () => {
      this.autoAll = true;
      this._resolveActiveRandomly();
    });
    el.querySelector('.cg-create')?.addEventListener('click', () => this._onCreateActor());
  }

  /**
   * Attach characteristic input handlers.
   */
  _attachCharacteristicHandlers(el) {
    const updateCharValue = e => {
      if (this.charState) {
        const key = e.target.dataset.charKey;
        const val = parseInt(e.target.value) || 0;
        const r = this._charUiRules();
        this.charState.chars[key] = Math.max(r.inputMin, Math.min(r.inputMax, val));
      }
    };

    el.querySelectorAll('.cg-char-input').forEach(input => {
      input.addEventListener('input', e => {
        updateCharValue(e);
        this._updateDoneButton();
      });
      input.addEventListener('change', updateCharValue);
    });
  }

  /**
   * Attach name handler to enable/disable the Done button.
   */
  _attachNameHandlers(el) {
    const nameInput = el.querySelector('.cg-name-input');
    const nameDone = el.querySelector('.cg-name-done');
    if (!nameInput || !nameDone) {
      return;
    }
    const update = () => {
      nameDone.disabled = !nameInput.value.trim();
    };
    nameInput.addEventListener('input', update);
    update();
  }

  /**
   * Attach resize handle drag handler for summary panel.
   */
  _attachResizeHandler(el) {
    const handle = el.querySelector('.cg-resize-handle');
    if (!handle) {
      return;
    }
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = this.summaryHeight;
      const move = ev => {
        const dy = startY - ev.clientY;
        this.summaryHeight = Math.max(100, startH + dy);
        const sumDiv = handle.nextElementSibling;
        if (sumDiv) {
          sumDiv.style.height = `${this.summaryHeight}px`;
        }
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        this.render();
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }

  // ─── Decision Tracking ──────────────────────────────────────

  /**
   * Roll dice and track the decision for replay.
   * @param {string} formula - Dice formula to roll
   * @returns {Promise<number>} Roll result
   */
  async _roll(formula) {
    const { index, decision } = this.decisionStore.next();
    if (decision) {
      if (decision.type === 'roll' && Number.isFinite(Number(decision.value))) {
        return Number(decision.value);
      }
      console.warn(
        `CharGenApp | Replay expected roll for "${formula}" but found ${decision.type}; truncating decision history at index ${index}.`,
      );
      this.decisionStore.truncate(index);
    }
    const v = await super._roll(formula);
    this.decisionStore.push({ type: 'roll', value: v, question: String(formula ?? '') });
    this.sessionJournal.scheduleSave();
    return v;
  }

  /**
   * Present a choice to the user with replay and auto-all support.
   * @param {string} label - Choice label
   * @param {Array} options - Available options with value and label
   * @param {Object} [rowExtras={}] - Additional row properties
   * @returns {Promise<string>} Selected value
   */
  async _choose(label, options, rowExtras = {}) {
    const { preserveOptionOrder = false, ...restRowExtras } = rowExtras;
    let choiceOptions = Array.isArray(options) ? options.map(o => ({ ...o })) : [];
    if (!preserveOptionOrder && choiceOptions.length > 1) {
      const lang = game.i18n?.lang ?? 'en';
      choiceOptions.sort((a, b) =>
        String(a.label ?? a.value).localeCompare(String(b.label ?? b.value), lang, { sensitivity: 'base' }),
      );
    }
    const { index, decision } = this.decisionStore.next();

    // Replay path: use stored decision
    if (decision) {
      const v = decision.value;
      const found =
        findReplayChoiceOption(choiceOptions, v) ?? choiceOptions.find(o => String(o.value) === String(v));
      if (found) {
        this.rows.push({
          label,
          rowType: CHARGEN_ROW_TYPES.CHOICE,
          result: found.label ?? String(v),
          active: false,
          options: choiceOptions,
        });
        return found.value;
      }

      if (choiceOptions.length) {
        const fallback = choiceOptions[0].value;
        this.decisionStore.replace(index, { type: 'choice', value: fallback, question: label });
        this.rows.push({
          label,
          rowType: CHARGEN_ROW_TYPES.CHOICE,
          result: choiceOptions[0].label ?? String(fallback),
          active: false,
          options: choiceOptions,
        });
        console.warn(`CharGenApp | Replayed choice "${v}" is no longer valid for "${label}". Falling back to "${fallback}".`);
        this.sessionJournal.scheduleSave();
        return fallback;
      }

      this.rows.push({ label, rowType: CHARGEN_ROW_TYPES.CHOICE, result: String(v), active: false, options: choiceOptions });
      console.warn(`CharGenApp | Replayed choice "${v}" is invalid for "${label}" and no options are available.`);
      return v;
    }

    // Auto-all path: pick randomly
    if (this.autoAll && this._canShowChargenRandomRoll() && choiceOptions.length) {
      const idx = (await new Roll(`1d${choiceOptions.length}`).roll()).total - 1;
      const value = choiceOptions[idx].value;
      this.decisionStore.push({ type: 'choice', value, question: label });
      const found = choiceOptions[idx];
      this.rows.push({
        label,
        rowType: CHARGEN_ROW_TYPES.CHOICE,
        result: found?.label ?? String(value),
        active: false,
        options: choiceOptions
      });
      this.render();
      this.sessionJournal.scheduleSave();
      return value;
    }

    // Interactive path: delegate to base class
    const value = await super._choose(label, choiceOptions, { rowType: CHARGEN_ROW_TYPES.CHOICE, ...restRowExtras });
    this.decisionStore.push({ type: 'choice', value, question: label });
    this.sessionJournal.scheduleSave();
    return value;
  }

  /**
   * Handle characteristics choice with special UI handling.
   * @returns {Promise<string>} 'rolled' or 'done'
   */
  async _chooseCharacteristics() {
    const { decision } = this.decisionStore.next();
    if (decision) {
      // Restore characteristic values from the stored decision
      if (decision.chars) {
        for (const k of CHARACTERISTIC_KEYS) {
          this.charState.chars[k] = decision.chars[k] ?? 0;
        }
      }
      const line = this._formatCharacteristicsLine();
      this.rows.push({
        label: CHARACTERISTICS_ROW_TYPE,
        rowType: CHARGEN_ROW_TYPES.CHARACTERISTICS,
        result: line,
        active: false,
        options: []
      });
      this.render();
      return String(decision.value);
    }

    if (this.autoAll && this._canShowChargenRandomRoll()) {
      await this._rollCharacteristics();
      const line = this._formatCharacteristicsLine();
      const chars = { ...this.charState.chars };
      this.rows.push({
        label: CHARACTERISTICS_ROW_TYPE,
        rowType: CHARGEN_ROW_TYPES.CHARACTERISTICS,
        result: line,
        active: false,
        options: []
      });
      this.decisionStore.push({
        type: 'choice',
        value: 'rolled',
        chars,
        question: game.i18n.localize('TWODSIX.CharGen.App.Characteristics'),
      });
      this.render();
      this.sessionJournal.scheduleSave();
      return 'rolled';
    }

    this.rows.push({
      label: CHARACTERISTICS_ROW_TYPE,
      rowType: CHARGEN_ROW_TYPES.CHARACTERISTICS,
      result: null,
      active: true,
      options: []
    });
    this.render();

    const value = await new Promise(res => {
      this.pendingResolve = res;
    });

    if (value === CharGenApp.RESTART) {
      throw CharGenApp.RESTART;
    }

    const chars = { ...this.charState.chars };
    this.decisionStore.push({
      type: 'choice',
      value,
      chars,
      question: game.i18n.localize('TWODSIX.CharGen.App.Characteristics'),
    });
    const line = this._formatCharacteristicsLine();
    const row = this.rows.at(-1);
    row.result = line;
    row.active = false;
    this.render();
    this.sessionJournal.scheduleSave();
    return value;
  }

  /**
   * Handle name choice with editable text field.
   * Dice button generates a random name and auto-continues.
   * @returns {Promise<string>} The chosen name
   */
  async _chooseName() {
    const { decision } = this.decisionStore.next();
    if (decision) {
      const v = String(decision.value);
      this.rows.push({
        label: NAME_ROW_LABEL,
        rowType: CHARGEN_ROW_TYPES.NAME,
        result: v,
        active: false,
        options: []
      });
      return v;
    }

    if (this.autoAll && this._canShowChargenRandomRoll()) {
      const name = await this._generateRandomName();
      this.rows.push({
        label: NAME_ROW_LABEL,
        rowType: CHARGEN_ROW_TYPES.NAME,
        result: name,
        active: false,
        options: []
      });
      this.decisionStore.push({
        type: 'choice',
        value: name,
        question: game.i18n.localize('TWODSIX.CharGen.Session.JournalNameQuestion'),
      });
      this._updateNameAndTitle(name);
      this.render();
      this.sessionJournal.scheduleSave();
      return name;
    }

    this.rows.push({
      label: NAME_ROW_LABEL,
      rowType: CHARGEN_ROW_TYPES.NAME,
      result: null,
      active: true,
      options: []
    });
    this.render();

    const value = await new Promise(res => {
      this.pendingResolve = res;
    });

    if (value === CharGenApp.RESTART) {
      throw CharGenApp.RESTART;
    }

    this.decisionStore.push({
      type: 'choice',
      value,
      question: game.i18n.localize('TWODSIX.CharGen.Session.JournalNameQuestion'),
    });
    const row = this.rows.at(-1);
    row.result = value;
    row.active = false;
    this._updateNameAndTitle(value);
    this.render();
    this.sessionJournal.scheduleSave();
    return value;
  }

  /**
   * Update the character name and window title.
   * @param {string} name - The new character name
   */
  _updateNameAndTitle(name) {
    this.charName = name;
    this._syncWindowTitleForRuleset();
    const title = this.options.window.title;
    const titleEl = this.element?.querySelector('.window-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Internal helper to generate a random name based on gender and language.
   * @returns {Promise<string>}
   * @private
   */
  async _generateRandomName() {
    const genderCode = this.charState?.gender === 'Male' ? 'M' : 'F';
    let name = 'Traveller';
    try {
      name = await nameGen.generateName(this.charState?.languageType, genderCode) || name;
    } catch { /* use fallback */ }
    return name;
  }

  /**
   * Resolve the name row by generating a random name and continuing.
   */
  async _resolveNameRoll() {
    if (!this.pendingResolve) {
      return;
    }
    const name = await this._generateRandomName();
    this._updateNameAndTitle(name);
    const r = this.pendingResolve;
    this.pendingResolve = null;
    r(name);
  }

  /**
   * Resolve the name row with the current text input value.
   */
  _resolveNameDone() {
    if (!this.pendingResolve) {
      return;
    }
    const input = this.element?.querySelector('.cg-name-input');
    const name = input?.value?.trim() || 'Traveller';
    this._updateNameAndTitle(name);
    const r = this.pendingResolve;
    this.pendingResolve = null;
    r(name);
  }

  // ─── Session persistence (journal) ────────────────────────
  // Implemented by this.sessionJournal (CharGenSessionJournal.js).

  _syncWindowTitleForRuleset() {
    const ruleset = this.charState?.ruleset ?? 'CE';
    const rulesetName = getChargenRulesetDisplayName(ruleset);
    this.options.window.title = game.i18n.format('TWODSIX.CharGen.WindowTitle', { ruleset: rulesetName });
  }

  /**
   * Restore persisted session from a journal entry.
   * @param {JournalEntry} journalEntry
   */
  loadState(journalEntry) {
    const j = this.sessionJournal;
    j.boundDisposable = false;
    const saved = journalEntry.getFlag('twodsix', 'charGenSession');
    j.entryId = journalEntry.id;
    j.pageId = saved?.journalPageId ?? null;

    if (!saved || typeof saved !== 'object') {
      this.charState = deserializeCharGenState(freshState());
      this.decisionStore.resetAll();
      this.charName = game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
      this.isDone = false;
      this.autoAll = false;
      j.loggedDecisionCount = 0;
      this._syncWindowTitleForRuleset();
      return;
    }
    if (saved._schemaVersion !== CHARGEN_SESSION_VERSION) {
      console.warn(
        `twodsix | CharGen session schema mismatch (${saved._schemaVersion ?? 'unknown'} -> ${CHARGEN_SESSION_VERSION}); loading best-effort.`,
      );
    }

    if (saved.checkpointState && (saved.isDone || saved.died)) {
      this.charState = deserializeCharGenState(saved.checkpointState);
      const rs = this.charState.ruleset;
      if (!isChargenRulesetSupported(rs)) {
        ui.notifications.warn(game.i18n.format('TWODSIX.CharGen.Errors.RulesetDowngraded', { ruleset: rs }));
        this.charState.ruleset = normalizeChargenRulesetOrCe(rs);
      }
      this.charName = saved.charName || game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
      this.isDone = !!(saved.isDone || saved.died);
      this.autoAll = !!saved.autoAll;
      this.decisionStore.decisions = Array.isArray(saved.decisions) ? foundry.utils.deepClone(saved.decisions) : [];
      this.decisionStore.resetCursor();
      j.loggedDecisionCount = this.decisionStore.decisions.length;
      this._syncWindowTitleForRuleset();
      return;
    }

    const base = deserializeCharGenState(freshState());
    const savedRs = saved.ruleset ?? 'CE';
    if (!isChargenRulesetSupported(savedRs)) {
      ui.notifications.warn(game.i18n.format('TWODSIX.CharGen.Errors.RulesetDowngraded', { ruleset: savedRs }));
    }
    base.ruleset = normalizeChargenRulesetOrCe(savedRs);
    base.languageType = saved.languageType ?? LanguageType.Humaniti;
    this.charState = base;
    this.charName = saved.charName || game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
    this.autoAll = !!saved.autoAll;
    this.isDone = false;
    this.decisionStore.decisions = Array.isArray(saved.decisions) ? foundry.utils.deepClone(saved.decisions) : [];
    this.decisionStore.resetCursor();
    j.loggedDecisionCount = this.decisionStore.decisions.length;
    this._syncWindowTitleForRuleset();
  }

  /** @inheritdoc */
  async close(options = {}) {
    await this.sessionJournal.flushSave();
    const journalId = this.sessionJournal.entryId;
    const actorCreated = this._foundryActorCreated;
    const disposableJournal = this.sessionJournal.boundDisposable;
    const result = await super.close(options);
    if (disposableJournal && !actorCreated && journalId) {
      await this.sessionJournal.deleteAbandoned(journalId);
    }
    this.sessionJournal.destroy();
    return result;
  }

  // ─── Undo / Redo ───────────────────────────────────────────

  /**
   * Undo the last choice decision.
   */
  async _undo() {
    if (!this._canShowChargenUndo()) {
      return;
    }
    if (!this.decisionStore.undoLastChoice()) {
      return;
    }
    this.sessionJournal.loggedDecisionCount = this.decisionStore.decisions.length;
    await this.sessionJournal.appendUndoLine();
    this.autoAll = false;
    this.sessionJournal.scheduleSave();
    const res = this.pendingResolve;
    this.pendingResolve = null;
    if (res) {
      res(CharGenApp.RESTART);
    } else {
      void this.run();
    }
  }

  /**
   * Redo (restart) the generation from the beginning, resetting to manual mode.
   */
  async _redo() {
    await this.sessionJournal.flushSave();
    const journalId = this.sessionJournal.entryId;
    if (this.sessionJournal.boundDisposable && !this._foundryActorCreated && journalId) {
      await this.sessionJournal.deleteAbandoned(journalId);
    }
    this.summaryHeight = 0;
    this.sessionJournal.clearBinding();
    this.decisionStore.resetAll();
    this.rows = [];
    this.autoAll = false;
    this.charName = game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
    const ruleset = this.charState.ruleset;
    this.charState = deserializeCharGenState(freshState());
    this.charState.ruleset = ruleset;
    this.isDone = false;
    const res = this.pendingResolve;
    this.pendingResolve = null;
    if (res) {
      res(CharGenApp.RESTART);
    } else {
      void this.run();
    }
  }

  // ─── Actor Creation ─────────────────────────────────────────

  async _onCreateActor() {
    if (!this.isDone || !this.charState) {
      return;
    }
    try {
      const { createCharacterActor } = await import('./CharGenActorFactory.js');
      await createCharacterActor(this.charState, this.charName);
      this._foundryActorCreated = true;
      ui.notifications.info(game.i18n.format('TWODSIX.CharGen.Messages.CharacterCreated', { name: this.charName }));
      this.close();
    } catch (err) {
      console.error('twodsix | CharGen actor creation failed', {
        error: err,
        ruleset: this.charState?.ruleset,
        terms: this.charState?.totalTerms,
        name: this.charName,
      });
      const msg = err?.message || String(err);
      ui.notifications.error(game.i18n.format('TWODSIX.CharGen.Errors.ActorCreateFailed', { error: msg }));
    }
  }

  // ─── Main Loop ──────────────────────────────────────────────

  /**
   * Main generation loop with restart handling.
   */
  async run() {
    if (this._runPromise) {
      return this._runPromise;
    }
    this._runPromise = this._runLoop();
    try {
      return await this._runPromise;
    } finally {
      this._runPromise = null;
    }
  }

  async _runLoop() {
    while (true) {
      this.decisionStore.resetCursor();
      this.rows = [];
      const ruleset = this.charState.ruleset;
      const languageType = this.charState.languageType;
      this.charState = deserializeCharGenState(freshState());
      this.charState.ruleset = ruleset;
      this.charState.languageType = languageType;
      this.isDone = false;
      this._syncWindowTitleForRuleset();
      await this.sessionJournal.ensureJournal();

      try {
        await dispatchCharGen(this, ruleset);
        this.isDone = true;
        await this.sessionJournal.flushSave();
        await this.sessionJournal.renameEntryToCharacterName(this.charName);
        await this.sessionJournal.appendCompletionMilestone({ died: false, charName: this.charName });
        this.render();
        return;
      } catch (err) {
        if (err === CharGenApp.RESTART) {
          await this.sessionJournal.flushSave();
          continue;
        }
        if (err === CharGenApp.DIED) {
          this.isDone = true;
          await this.sessionJournal.flushSave();
          await this.sessionJournal.renameEntryToCharacterName(this.charName);
          await this.sessionJournal.appendCompletionMilestone({ died: true, charName: this.charName });
          this.render();
          return;
        }
        throw err;
      }
    }
  }
}
