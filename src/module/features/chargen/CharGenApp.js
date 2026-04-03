// CharGenApp.js — Character generation ApplicationV2 UI class
import { LanguageType, nameGenerator as nameGen } from '../../utils/nameGenerator.js';
import { toHex } from '../../utils/utils.js';
import { generateDetailedSummary } from './CharGenActorFactory.js';
import { CHARGEN_SUPPORTED_RULESETS, dispatchCharGen } from './CharGenRegistry.js';
import { CHARACTERISTIC_KEYS, CHARACTERISTIC_LABELS, CHARACTERISTICS_ROW_TYPE, freshState } from './CharGenState.js';

/**
 * Character generation Application class extending Foundry's ApplicationV2.
 * Handles the UI, user interactions, and decision tracking.
 */
export class CharGenApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'char-gen',
    classes: ['twodsix', 'char-gen'],
    window: { title: game.i18n.localize('TWODSIX.CharGen.App.Title'), resizable: true },
    position: { width: 900, height: 1024 },
  };

  static RESTART = Symbol('restart');

  decisions = [];
  decisionCursor = 0;
  rows = [];
  charState = null;
  pendingResolve = null;
  isDone = false;
  charName = game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
  autoAll = false;
  summaryHeight = 0;

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
   * Roll a random name based on language type and gender.
   */
  async _rollName() {
    try {
      this.charName = await nameGen.generateName(
        this.charState?.languageType,
        this.charState?.gender === 'Male' ? 'M' : 'F'
      );
    } catch (err) {
      console.warn('CharGenApp | Failed to generate name:', err);
      this.charName = game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
    }
    this.render();
  }

  /**
   * Roll a random language type.
   */
  async _rollLanguage() {
    const types = Object.values(LanguageType);
    const randomType = types[Math.floor(Math.random() * types.length)];
    if (this.charState) {
      this.charState.languageType = randomType;
    }
    await this._rollName();
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

  async _renderHTML(_ctx, _opts) {
    if (this.isDone && this.summaryHeight === 0) {
      const appHeight = this.position.height || 1024;
      this.summaryHeight = Math.floor(appHeight * 0.6);
    }
    const html = await foundry.applications.handlebars.renderTemplate(
      'systems/twodsix/templates/chargen/char-gen.hbs',
      this._buildContext()
    );
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  /**
   * Resolve the currently active row with a random choice.
   */
  _resolveActiveRandomly() {
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

    if (!row.options?.length) {
      return;
    }

    const idx = Math.floor(Math.random() * row.options.length);
    const value = String(row.options[idx].value);
    const r = this.pendingResolve;
    this.pendingResolve = null;
    r(value);
  }

  _replaceHTML(result, content, _opts) {
    content.innerHTML = result.innerHTML;
    const scr = content.querySelector('.cg-scroll');
    if (scr) {
      scr.scrollTop = scr.scrollHeight;
    }
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

    el.querySelector('.cg-name')?.addEventListener('input', e => {
      this.charName = e.target.value.trim() || game.i18n.localize('TWODSIX.CharGen.App.NewCharacter');
    });

    el.querySelector('.cg-lang-select')?.addEventListener('change', e => {
      if (this.charState) {
        this.charState.languageType = parseInt(e.target.value);
        this._rollName();
      }
    });
  }

  /**
   * Attach roll button event handlers.
   */
  _attachRollHandlers(el) {
    el.querySelector('.cg-roll-lang')?.addEventListener('click', () => this._rollLanguage());
    el.querySelector('.cg-roll-name')?.addEventListener('click', () => this._rollName());
    el.querySelector('.cg-roll-upp')?.addEventListener('click', () => this._resolveCharRoll());
    el.querySelector('.cg-char-done')?.addEventListener('click', () => this._resolveCharDone());
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

  async _onRender(_ctx, _opts) {
    const el = this.element;
    this._attachHeaderHandlers(el);
    this._attachRollHandlers(el);
    this._attachChoiceHandlers(el);
    this._attachActionHandlers(el);
    this._attachCharacteristicHandlers(el);
    this._attachResizeHandler(el);
    this._updateDoneButton();
  }

  _buildContext() {
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
      languages: Object.entries(LanguageType)
        .map(([label, value]) => ({ label, value, selected: s?.languageType === value }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      chars,
      upp,
      age: s?.age ?? 18,
      skls: s?.skills?.size ?? 0,
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

  /**
   * Roll dice and track the decision.
   * @param {string} formula - Dice formula to roll
   * @returns {Promise<number>} Roll result
   */
  async _roll(formula) {
    const cursor = this.decisionCursor++;
    if (cursor < this.decisions.length) {
      return this.decisions[cursor].value;
    }
    const v = (await new Roll(formula).evaluate()).total;
    this.decisions.push({ type: 'roll', value: v });
    return v;
  }

  /**
   * Present a choice to the user and track the decision.
   * @param {string} label - Choice label
   * @param {Array} options - Available options with value and label
   * @returns {Promise<string>} Selected value
   */
  async _choose(label, options) {
    const choiceOptions = Array.isArray(options) ? options : [];
    const cursor = this.decisionCursor++;
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

    if (this.autoAll && choiceOptions.length) {
      const idx = Math.floor(Math.random() * choiceOptions.length);
      const value = String(choiceOptions[idx].value);
      this.decisions.push({ type: 'choice', value });
      const found = choiceOptions[idx];
      this.rows.push({ label, result: found?.label ?? value, active: false, options: choiceOptions });
      this.render();
      return value;
    }

    this.rows.push({ label, result: null, active: true, options: choiceOptions });
    this.render();

    const value = await new Promise(res => {
      this.pendingResolve = res;
    });

    if (value === CharGenApp.RESTART) {
      throw CharGenApp.RESTART;
    }

    this.decisions.push({ type: 'choice', value });
    const row = this.rows.at(-1);
    row.result = choiceOptions.find(o => String(o.value) === String(value))?.label ?? value;
    row.active = false;
    this.render();
    return value;
  }

  /**
   * Handle characteristics choice with special UI handling.
   * @param {CharGenApp} app - Application instance
   * @returns {Promise<string>} 'rolled' or 'done'
   */
  async _chooseCharacteristics(app) {
    const cursor = this.decisionCursor++;
    if (cursor < this.decisions.length) {
      const v = String(this.decisions[cursor].value);
      const row = this.rows.at(-1);
      if (row) {
        row.active = false;
      }
      this.render();
      return v;
    }

    if (this.autoAll) {
      app._rollCharacteristics();
      const line = app._formatCharacteristicsLine();
      this.rows.push({ label: CHARACTERISTICS_ROW_TYPE, result: line, active: false, options: [] });
      this.decisions.push({ type: 'choice', value: 'rolled' });
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

    this.decisions.push({ type: 'choice', value });
    const line = app._formatCharacteristicsLine();
    const row = this.rows.at(-1);
    row.result = line;
    row.active = false;
    this.render();
    return value;
  }

  /**
   * Add a log entry to the UI.
   * @param {string} label - Row label
   * @param {string} result - Row result
   */
  _log(label, result) {
    this.rows.push({ label, result: String(result ?? ''), active: false, options: [] });
  }

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

  /**
   * Create the character actor and close the app.
   */
  async _onCreateActor() {
    if (!this.isDone || !this.charState) {
      return;
    }
    const { createCharacterActor } = await import('./CharGenActorFactory.js');
    await createCharacterActor(this.charState, this.charName);
    ui.notifications.info(game.i18n.format('TWODSIX.CharGen.Messages.CharacterCreated', { name: this.charName }));
    this.close();
  }

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
      this.window.title = `${rulesetName} Character Generation`;
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
        throw err;
      }
    }
  }
}
