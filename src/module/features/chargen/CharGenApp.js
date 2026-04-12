// CharGenApp.js — Character generation UI class extending DecisionApp
import { nameGenerator as nameGen } from '../../utils/nameGenerator.js';
import { toHex } from '../../utils/utils.js';
import { generateDetailedSummary } from './CharGenActorFactory.js';
import { CHARGEN_SUPPORTED_RULESETS, dispatchCharGen } from './CharGenRegistry.js';
import {
  CHARACTERISTIC_KEYS,
  CHARACTERISTIC_LABELS,
  CHARACTERISTICS_ROW_TYPE,
  CHARGEN_DIED,
  freshState
} from './CharGenState.js';
import { DecisionApp } from '../DecisionApp.js';

const NAME_ROW_LABEL = 'Name';

/**
 * Character generation Application class extending DecisionApp.
 * Handles the UI, user interactions, and decision tracking with undo/redo.
 */
export class CharGenApp extends DecisionApp {
  static DEFAULT_OPTIONS = {
    id: 'char-gen',
    classes: ['twodsix', 'char-gen'],
    window: { title: game.i18n.localize('TWODSIX.CharGen.App.Title'), resizable: true },
    position: { width: 900, height: 1024 },
  };

  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/chargen/char-gen.hbs',
    },
  };

  static DIED = CHARGEN_DIED;

  decisions = [];
  decisionCursor = 0;
  charState = null;
  isDone = false;
  charName = game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
  autoAll = false;
  summaryHeight = 0;

  // ─── Rendering ──────────────────────────────────────────────

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
      age: s?.age ?? 18,
      skls: s?.skills?.size ?? 0,
      totalTerms: s?.totalTerms ?? 0,
      rulesets: Object.values(CONFIG.TWODSIX.RULESETS).map(r => ({
        key: r.key,
        name: r.name,
        selected: r.key === ruleset,
        disabled: !CHARGEN_SUPPORTED_RULESETS.has(r.key),
      })),
      rows: this.rows,
      isDone: this.isDone,
      autoAll: this.autoAll,
      died: s?.died ?? false,
      textSummary: this.isDone && s ? generateDetailedSummary(s) : '',
      summaryHeight: this.summaryHeight,
      scrollFlex: this.isDone ? '0 0 33%' : '1',
    };
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
   */
  _rollCharacteristics() {
    if (this.charState) {
      for (const k of CHARACTERISTIC_KEYS) {
        this.charState.chars[k] = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6) + 2;
      }
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
  _resolveCharRoll() {
    this._rollCharacteristics();
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
    const row = this.rows.find(r => r.active);
    if (!row || !this.pendingResolve) {
      return;
    }

    // Handle characteristics row specially (has empty options array)
    if (row.label === CHARACTERISTICS_ROW_TYPE) {
      this._rollCharacteristics();
      const r = this.pendingResolve;
      this.pendingResolve = null;
      r('rolled');
      return;
    }

    // Handle Name row: generate a fresh random name and continue
    if (row.label === NAME_ROW_LABEL) {
      await this._resolveNameRoll();
      return;
    }

    if (!row.options?.length) {
      return;
    }

    const idx = Math.floor(Math.random() * row.options.length);
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
    let allValid = true;
    inputs.forEach(input => {
      const val = parseInt(input.value);
      if (isNaN(val) || val < 1 || val > 15) {
        allValid = false;
      }
    });
    doneBtn.disabled = !allValid;
  }

  /**
   * Attach header event handlers (ruleset, name, language).
   */
  _attachHeaderHandlers(el) {
    el.querySelector('.cg-ruleset')?.addEventListener('change', e => {
      if (this.charState) {
        this.charState.ruleset = e.target.value;
        this._redo();
      }
    });
  }

  /**
   * Attach roll button event handlers.
   */
  _attachRollHandlers(el) {
    el.querySelector('.cg-roll-upp')?.addEventListener('click', () => this._resolveCharRoll());
    el.querySelector('.cg-char-done')?.addEventListener('click', () => this._resolveCharDone());
    el.querySelector('.cg-name-roll')?.addEventListener('click', () => this._resolveNameRoll());
    el.querySelector('.cg-name-done')?.addEventListener('click', () => this._resolveNameDone());
    el.querySelector('.cg-rand')?.addEventListener('click', () => this._resolveActiveRandomly());
    el.querySelector('.cg-rand-all')?.addEventListener('click', async () => {
      if (this.isDone) {
        this._redo();
        return;
      }
      this.autoAll = true;
      this._resolveActiveRandomly();
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
    el.querySelector('.cg-undo')?.addEventListener('click', () => this._undo());
    el.querySelector('.cg-redo')?.addEventListener('click', () => this._redo());
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
        this.charState.chars[key] = Math.max(0, Math.min(15, val));
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
    const cursor = this.decisionCursor++;
    if (cursor < this.decisions.length) {
      return this.decisions[cursor].value;
    }
    const v = await super._roll(formula);
    this.decisions.push({ type: 'roll', value: v });
    return v;
  }

  /**
   * Present a choice to the user with replay and auto-all support.
   * @param {string} label - Choice label
   * @param {Array} options - Available options with value and label
   * @returns {Promise<string>} Selected value
   */
  async _choose(label, options) {
    const choiceOptions = Array.isArray(options) ? options : [];
    const cursor = this.decisionCursor++;

    // Replay path: use stored decision
    if (cursor < this.decisions.length) {
      const v = String(this.decisions[cursor].value);
      const found = choiceOptions.find(o => String(o.value) === v);
      if (found) {
        this.rows.push({ label, result: found.label ?? v, active: false, options: choiceOptions });
        return v;
      }

      if (choiceOptions.length) {
        const fallback = String(choiceOptions[0].value);
        this.decisions[cursor] = { type: 'choice', value: fallback };
        this.rows.push({ label, result: choiceOptions[0].label ?? fallback, active: false, options: choiceOptions });
        console.warn(`CharGenApp | Replayed choice "${v}" is no longer valid for "${label}". Falling back to "${fallback}".`);
        return fallback;
      }

      this.rows.push({ label, result: v, active: false, options: choiceOptions });
      console.warn(`CharGenApp | Replayed choice "${v}" is invalid for "${label}" and no options are available.`);
      return v;
    }

    // Auto-all path: pick randomly
    if (this.autoAll && choiceOptions.length) {
      const idx = Math.floor(Math.random() * choiceOptions.length);
      const value = String(choiceOptions[idx].value);
      this.decisions.push({ type: 'choice', value });
      const found = choiceOptions[idx];
      this.rows.push({ label, result: found?.label ?? value, active: false, options: choiceOptions });
      this.render();
      return value;
    }

    // Interactive path: delegate to base class
    this.decisionCursor--; // base class doesn't use cursor; undo the increment
    const value = await super._choose(label, choiceOptions);
    this.decisions.push({ type: 'choice', value });
    return value;
  }

  /**
   * Handle characteristics choice with special UI handling.
   * @returns {Promise<string>} 'rolled' or 'done'
   */
  async _chooseCharacteristics() {
    const cursor = this.decisionCursor++;
    if (cursor < this.decisions.length) {
      const decision = this.decisions[cursor];
      // Restore characteristic values from the stored decision
      if (decision.chars) {
        for (const k of CHARACTERISTIC_KEYS) {
          this.charState.chars[k] = decision.chars[k] ?? 0;
        }
      }
      const line = this._formatCharacteristicsLine();
      this.rows.push({ label: CHARACTERISTICS_ROW_TYPE, result: line, active: false, options: [] });
      this.render();
      return String(decision.value);
    }

    if (this.autoAll) {
      this._rollCharacteristics();
      const line = this._formatCharacteristicsLine();
      const chars = { ...this.charState.chars };
      this.rows.push({ label: CHARACTERISTICS_ROW_TYPE, result: line, active: false, options: [] });
      this.decisions.push({ type: 'choice', value: 'rolled', chars });
      this.render();
      return 'rolled';
    }

    this.rows.push({ label: CHARACTERISTICS_ROW_TYPE, result: null, active: true, options: [] });
    this.render();

    const value = await new Promise(res => {
      this.pendingResolve = res;
    });

    if (value === CharGenApp.RESTART) {
      throw CharGenApp.RESTART;
    }

    const chars = { ...this.charState.chars };
    this.decisions.push({ type: 'choice', value, chars });
    const line = this._formatCharacteristicsLine();
    const row = this.rows.at(-1);
    row.result = line;
    row.active = false;
    this.render();
    return value;
  }

  /**
   * Handle name choice with editable text field.
   * Dice button generates a random name and auto-continues.
   * @returns {Promise<string>} The chosen name
   */
  async _chooseName() {
    const cursor = this.decisionCursor++;
    if (cursor < this.decisions.length) {
      const v = String(this.decisions[cursor].value);
      this.rows.push({ label: NAME_ROW_LABEL, result: v, active: false, options: [] });
      return v;
    }

    if (this.autoAll) {
      const genderCode = this.charState?.gender === 'Male' ? 'M' : 'F';
      let name = 'Traveller';
      try {
        name = await nameGen.generateName(this.charState?.languageType, genderCode) || name;
      } catch { /* use fallback */ }
      this.rows.push({ label: NAME_ROW_LABEL, result: name, active: false, options: [] });
      this.decisions.push({ type: 'choice', value: name });
      this._updateNameAndTitle(name);
      this.render();
      return name;
    }

    this.rows.push({ label: NAME_ROW_LABEL, result: null, active: true, options: [] });
    this.render();

    const value = await new Promise(res => {
      this.pendingResolve = res;
    });

    if (value === CharGenApp.RESTART) {
      throw CharGenApp.RESTART;
    }

    this.decisions.push({ type: 'choice', value });
    const row = this.rows.at(-1);
    row.result = value;
    row.active = false;
    this._updateNameAndTitle(value);
    this.render();
    return value;
  }

  /**
   * Update the character name and window title.
   * @param {string} name - The new character name
   */
  _updateNameAndTitle(name) {
    this.charName = name;
    const title = `Character Generation: ${name}`;
    this.options.window.title = title;
    const titleEl = this.element?.querySelector('.window-title');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  /**
   * Resolve the name row by generating a random name and continuing.
   */
  async _resolveNameRoll() {
    if (!this.pendingResolve) {
      return;
    }
    const genderCode = this.charState?.gender === 'Male' ? 'M' : 'F';
    let name;
    try {
      name = await nameGen.generateName(this.charState?.languageType, genderCode);
    } catch { /* ignore */ }
    if (!name) {
      name = 'Traveller';
    }
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

  // ─── Undo / Redo ───────────────────────────────────────────

  /**
   * Undo the last choice decision.
   */
  _undo() {
    let i = this.decisions.length - 1;
    while (i >= 0 && this.decisions[i].type !== 'choice') {
      i--;
    }
    if (i < 0) {
      return;
    }
    this.decisions = this.decisions.slice(0, i);
    this.autoAll = false;
    const res = this.pendingResolve;
    this.pendingResolve = null;
    if (res) {
      res(CharGenApp.RESTART);
    } else {
      this.run();
    }
  }

  /**
   * Redo (restart) the generation from the beginning, resetting to manual mode.
   */
  _redo() {
    this.summaryHeight = 0;
    this.decisions = [];
    this.rows = [];
    this.autoAll = false;
    this.charName = game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
    const ruleset = this.charState.ruleset;
    this.charState = freshState();
    this.charState.ruleset = ruleset;
    this.isDone = false;
    const res = this.pendingResolve;
    this.pendingResolve = null;
    if (res) {
      res(CharGenApp.RESTART);
    } else {
      this.run();
    }
  }

  // ─── Actor Creation ─────────────────────────────────────────

  async _onCreateActor() {
    if (!this.isDone || !this.charState) {
      return;
    }
    const { createCharacterActor } = await import('./CharGenActorFactory.js');
    await createCharacterActor(this.charState, this.charName);
    ui.notifications.info(game.i18n.format('TWODSIX.CharGen.Messages.CharacterCreated', { name: this.charName }));
    this.close();
  }

  // ─── Main Loop ──────────────────────────────────────────────

  /**
   * Main generation loop with restart handling.
   */
  async run() {
    while (true) {
      this.decisionCursor = 0;
      this.rows = [];
      const ruleset = this.charState.ruleset;
      const languageType = this.charState.languageType;
      const rulesetName = CONFIG.TWODSIX.RULESETS[ruleset]?.name || 'Cepheus Engine';
      this.options.window.title = `${rulesetName} Character Generation`;
      this.charState = freshState();
      this.charState.ruleset = ruleset;
      this.charState.languageType = languageType;
      this.isDone = false;

      try {
        await dispatchCharGen(this, ruleset);
        this.isDone = true;
        this.render();
        return;
      } catch (err) {
        if (err === CharGenApp.RESTART) {
          continue;
        }
        if (err === CharGenApp.DIED) {
          this.isDone = true;
          this.render();
          return;
        }
        throw err;
      }
    }
  }
}
