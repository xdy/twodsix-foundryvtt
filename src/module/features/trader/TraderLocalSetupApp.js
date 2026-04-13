/**
 * TraderLocalSetupApp.js
 * ApplicationV2 for initial setup of a local trading journey (no Travellermap).
 */

import {
  DEFAULT_CREW,
  DEFAULT_MERCHANT_TRADER,
  MORTGAGE_DIVISOR
} from './TraderConstants.js';
import { TRADER_SUPPORTED_RULESETS } from './TraderRulesetRegistry.js';
import { collectWorldsFromFolder } from './TraderUtils.js';

/**
 * ApplicationV2 for initial setup of a local trading journey.
 */
export class TraderLocalSetupApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'trader-local-setup',
    tag: 'form',
    classes: ['twodsix', 'trader-setup'],
    window: { title: 'TWODSIX.Trader.LocalSetup.Title', resizable: true },
    position: { width: 600, height: 500 },
  };

  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/trader/trader-local-setup.hbs',
    },
  };

  constructor(options = {}) {
    super(options);
    this.options.window.title = game.i18n.localize(this.options.window.title);

    const monthlyPayment = Math.ceil(DEFAULT_MERCHANT_TRADER.shipCost / MORTGAGE_DIVISOR);
    const totalMonthlyCrew = DEFAULT_CREW.reduce((s, c) => s + c.salary, 0);
    this._defaultStartingCredits = (monthlyPayment + totalMonthlyCrew) * 2;
    this._defaultJournalName = `Trader journal local ${new Date().toLocaleDateString()}`;

    this._journalName = this._defaultJournalName;
    this._shipActorId = '';
    this._rootFolderId = '';
    this._startWorldId = '';
    this._startingCredits = this._defaultStartingCredits;

    this._ruleset = game.settings.get('twodsix', 'ruleset') || 'CE';
    if (!TRADER_SUPPORTED_RULESETS.includes(this._ruleset)) {
      this._ruleset = 'CE';
    }

    this._folders = [];
    this._worlds = [];
    this._ships = [];

    this._resolve = null;
    this._isConfirming = false;
  }

  async awaitResult() {
    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  async _prepareContext(_options) {
    if (this._folders.length === 0) {
      this._loadFolders();
    }
    if (this._ships.length === 0) {
      this._loadShips();
    }

    return {
      journalName: this._journalName,
      defaultJournalName: this._defaultJournalName,
      shipActorId: this._shipActorId,
      rootFolderId: this._rootFolderId,
      startWorldId: this._startWorldId,
      ruleset: this._ruleset,
      supportedRulesets: TRADER_SUPPORTED_RULESETS.map(r => ({ key: r, selected: r === this._ruleset })),
      startingCredits: this._startingCredits,
      defaultStartingCredits: this._defaultStartingCredits,
      folders: this._folders.map(f => ({ ...f, selected: f.id === this._rootFolderId })),
      worlds: this._worlds.map(w => ({ ...w, selected: w.id === this._startWorldId })),
      ships: this._ships.map(s => ({ ...s, selected: s.id === this._shipActorId })),
      isConfirmDisabled: !this._rootFolderId || !this._startWorldId
    };
  }

  _loadFolders() {
    this._folders = game.folders
      .filter(f => f.type === 'Actor')
      .map(f => ({
        id: f.id,
        name: f.name
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _loadShips() {
    this._ships = game.actors
      .filter(a => a.type === 'ship')
      .map(a => {
        let jumpRating = a.system.shipStats?.drives?.jDrive?.rating ?? 1;
        return {
          id: a.id,
          name: a.name,
          jumpRating
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async _loadWorlds() {
    if (!this._rootFolderId) {
      this._worlds = [];
      return;
    }

    const rootFolder = game.folders.get(this._rootFolderId);
    if (!rootFolder) {
      this._worlds = [];
      return;
    }

    const worlds = collectWorldsFromFolder(rootFolder);

    this._worlds = worlds
      .map(w => ({
        id: w.id,
        name: w.name,
        system: w.system
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (this._worlds.length > 0 && !this._worlds.find(w => w.id === this._startWorldId)) {
      this._startWorldId = this._worlds[0].id;
    }
  }

  _onRender(_context, _options) {
    const el = this.element;

    el.querySelector('[name=rootFolderId]')?.addEventListener('change', async (e) => {
      this._rootFolderId = e.target.value;
      this._startWorldId = '';
      await this._loadWorlds();
      this.render();
    });

    el.querySelector('[name=startWorldId]')?.addEventListener('change', (e) => {
      this._startWorldId = e.target.value;
    });

    el.querySelector('[name=shipActorId]')?.addEventListener('change', (e) => {
      this._shipActorId = e.target.value;
    });

    el.querySelector('[name=ruleset]')?.addEventListener('change', (e) => {
      this._ruleset = e.target.value;
      this.render();
    });

    el.querySelector('[name=journalName]')?.addEventListener('input', (e) => {
      this._journalName = e.target.value.trim();
    });

    el.querySelector('[name=startingCredits]')?.addEventListener('input', (e) => {
      this._startingCredits = parseInt(e.target.value) || this._defaultStartingCredits;
    });

    el.querySelector('.st-confirm-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this._isConfirming) {
        return;
      }
      this._isConfirming = true;
      this._confirm();
    });
  }

  _confirm() {
    if (this._resolve) {
      this._resolve({
        journalName: this._journalName || this._defaultJournalName,
        shipActorId: this._shipActorId || '',
        rootFolderId: this._rootFolderId,
        startWorldId: this._startWorldId,
        ruleset: this._ruleset,
        startingCredits: this._startingCredits,
        worldSource: 'local'
      });
    }
    this._resolve = null;
    this.close();
  }

  async close(options = {}) {
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
    return super.close(options);
  }
}
