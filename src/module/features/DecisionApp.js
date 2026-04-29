/**
 * DecisionApp.js
 * Base class for long-running decision-loop UIs (CharGen, Trader).
 * Provides shared rows, _choose/_roll/_log, RESTART handling, and auto-scroll.
 * Subclasses must define static PARTS, static DEFAULT_OPTIONS, and _prepareContext().
 */

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export const RESTART = Symbol('restart');

export class DecisionApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static RESTART = RESTART;

  rows = [];
  pendingResolve = null;

  /**
   * Add a non-interactive log row.
   * @param {string} label - Row label
   * @param {string} result - Row content
   */
  _log(label, result) {
    this.rows.push({ label, result: String(result ?? ''), active: false, options: [] });
  }

  /**
   * Roll dice using Foundry's Roll API. Subclasses can override for decision tracking.
   * @param {string} formula - Dice formula (e.g. "2D6")
   * @returns {Promise<number>} Roll result
   */
  async _roll(formula) {
    return (await new Roll(formula).evaluate()).total;
  }

  /**
   * Present a choice to the user. Returns the selected value.
   * @param {string} label - Display label for the choice
   * @param {Array<{value: string, label: string}>} options - Available options
   * @param {object} [rowExtras={}] - Additional fields to merge into the row object
   * @returns {Promise<string>} Selected value
   */
  async _choose(label, options, rowExtras = {}) {
    const choiceOptions = Array.isArray(options) ? options : [];
    const row = { label, result: null, active: true, options: choiceOptions, ...rowExtras };
    this.rows.push(row);
    this.render();

    const value = await new Promise(res => {
      this.pendingResolve = res;
    });

    if (value === RESTART) {
      throw RESTART;
    }

    const found = choiceOptions.find(o => String(o.value) === String(value));
    row.result = found?.label ?? value;
    row.active = false;
    this.render();
    return found ? found.value : value;
  }

  /**
   * Close the app. Resolves any pending choice with RESTART so the loop exits cleanly.
   */
  async close(options = {}) {
    if (this.pendingResolve) {
      const r = this.pendingResolve;
      this.pendingResolve = null;
      r(RESTART);
    }
    return super.close(options);
  }

  /**
   * After render: auto-scroll and call subclass handler hook.
   */
  async _onRender(_ctx, _opts) {
    if (!this.element) {
      return;
    }
    const selector = this._getScrollSelector();
    if (selector) {
      const scr = this.element.querySelector(selector);
      if (scr) {
        scr.scrollTop = scr.scrollHeight;
      }
    }
    this._attachHandlers(this.element);
  }

  /**
   * Return the CSS selector for the scrollable log container.
   * Subclasses must override.
   * @returns {string|null}
   */
  _getScrollSelector() {
    return null;
  }

  /**
   * Hook for subclasses to attach event listeners after render.
   * Called by _onRender after auto-scroll.
   * @param {HTMLElement} _el - The application element
   */
  _attachHandlers(_el) {
    // Override in subclass
  }
}
