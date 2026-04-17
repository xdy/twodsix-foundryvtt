/**
 * TraderSetupApp.js
 * ApplicationV2 for initial setup of a trading journey.
 */

import { loadSubsector } from './SubsectorLoader.js';
import {
  DEFAULT_MILIEU,
  DEFAULT_SECTOR,
  DEFAULT_SUBSECTOR_LETTER,
  DEFAULT_SUBSECTOR_NAME,
  DEFAULT_WORLD_HEX,
  DEFAULT_WORLD_NAME,
  MILIEUS,
  SUBSECTOR_LETTERS
} from './TraderConstants.js';
import { getDefaultTraderRulesetKey, getTraderPresetOptions, } from './TraderRulesetRegistry.js';
import { computeTraderDefaultStartingCredits, resolveTraderSetupRulesetKey } from './traderSetupDefaults.js';
import { deduplicateWorlds, getWorldCoordinate, traderDebug } from './TraderUtils.js';
import { fetchSectors, getSubsectorsForSector, loadSubsectorsWithCache } from './TravellerMapAPI.js';
import { getCachedSectors, getOrCreateCacheJournal, setCachedSectors } from './TravellerMapCache.js';

/**
 * ApplicationV2 for initial setup of a trading journey.
 */
export class TraderSetupApp extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: 'trader-setup',
    tag: 'form',
    classes: ['twodsix', 'trader-setup'],
    window: { title: 'TWODSIX.Trader.Setup.Title', resizable: true },
    position: { width: 600, height: 620 },
  };

  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/trader/trader-setup.hbs',
    },
  };

  constructor(options = {}) {
    super(options);
    this.options.window.title = game.i18n.localize(this.options.window.title);

    this._cacheJournalName = `TraderTravellermapCache`;

    this._shipActorId = '';
    this._milieu = DEFAULT_MILIEU;
    this._sectorName = DEFAULT_SECTOR;
    this._subsectorName = DEFAULT_SUBSECTOR_NAME;
    this._subsectorLetter = DEFAULT_SUBSECTOR_LETTER;
    this._startHex = DEFAULT_WORLD_HEX;

    this._ruleset = resolveTraderSetupRulesetKey(getDefaultTraderRulesetKey());
    this._defaultStartingCredits = computeTraderDefaultStartingCredits(this._ruleset);
    this._startingCredits = this._defaultStartingCredits;

    this._sectors = [];
    this._subsectors = [];
    this._worlds = [];
    this._ships = [];

    this._loadingSectors = false;
    this._loadingSubsectors = false;
    this._loadingWorlds = false;
    this._isConfirming = false;
    this._activeRequestToken = 0;
    this._isClosed = false;

    this._resolve = null;
  }

  async awaitResult() {
    return new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  async _prepareContext(_options) {
    if (this._sectors.length === 0) {
      traderDebug('TraderSetupApp', ` Initial sectors not loaded, starting _initialLoad...`);
      await this._initialLoad();
      traderDebug('TraderSetupApp', ` _initialLoad complete. Sectors: ${this._sectors.length}, Subsectors: ${this._subsectors.length}, Worlds: ${this._worlds.length}`);
    }

    const context = {
      cacheJournalName: this._cacheJournalName,
      shipActorId: this._shipActorId,
      milieu: this._milieu,
      sectorName: this._sectorName,
      subsectorName: this._subsectorName,
      subsectorLetter: this._subsectorLetter,
      startHex: this._startHex,
      ruleset: this._ruleset,
      supportedRulesets: getTraderPresetOptions().map(r => ({ ...r, selected: r.key === this._ruleset })),
      startingCredits: this._startingCredits,
      defaultStartingCredits: this._defaultStartingCredits,
      milieus: MILIEUS.map(m => ({ ...m, selected: m.code === this._milieu })),
      sectors: this._sectors.map(s => ({ ...s, encodedName: encodeURIComponent(s.name), selected: s.name === this._sectorName })),
      subsectors: this._subsectors.map(s => ({ ...s, selected: s.name === this._subsectorName })),
      worlds: this._worlds.map(w => {
        const coord = getWorldCoordinate(w);
        const uwp = w.system?.uwp || w.uwp;
        const tradeCodes = w.system?.tradeCodes || (Array.isArray(w.tradeCodes) ? w.tradeCodes.join(' ') : w.tradeCodes);
        const hex = w.hex; // Always use local hex for the option value
        return {
          ...w,
          hex,
          uwp,
          tradeCodes,
          selected: hex === this._startHex || coord === this._startHex
        };
      }),
      ships: this._ships.map(s => ({ ...s, selected: s.id === this._shipActorId })),
      loadingSectors: this._loadingSectors,
      loadingSubsectors: this._loadingSubsectors,
      loadingWorlds: this._loadingWorlds,
      isConfirming: this._isConfirming,
      isConfirmDisabled: this._isConfirming || !this._startHex,
    };
    traderDebug('TraderSetupApp', ` context keys: ${Object.keys(context).length}, worlds: ${context.worlds.length}, ships: ${context.ships.length}`);
    return context;
  }

  async _initialLoad() {
    // List available ship actors
    this._ships = game.actors.filter(a => a.type === 'ship').map(s => ({
      id: s.id,
      name: s.name,
      jumpRating: s.system.shipStats?.drives?.jDrive?.rating || 0
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Fetch or load sectors
    try {
      traderDebug('TraderSetupApp', ` Fetching sectors...`);
      const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
      traderDebug('TraderSetupApp', ` Cache journal obtained: ${cacheJournal?.id}`);
      this._sectors = await getCachedSectors(cacheJournal, DEFAULT_MILIEU) || [];
      traderDebug('TraderSetupApp', ` Cached sectors: ${this._sectors.length}`);

      if (this._sectors.length === 0) {
        traderDebug('TraderSetupApp', ` Cache miss for sectors (${DEFAULT_MILIEU}), fetching from API...`);
        this._sectors = await fetchSectors(DEFAULT_MILIEU);
        if (cacheJournal && this._sectors.length > 0) {
          await setCachedSectors(cacheJournal, DEFAULT_MILIEU, this._sectors);
        }
      }
      traderDebug('TraderSetupApp', ` Received/loaded ${this._sectors.length} sectors.`);
    } catch (e) {
      console.warn('Failed to fetch sectors from TravellerMap API:', e);
      this._sectors = [{ name: DEFAULT_SECTOR }];
    }

    const defaultSector = this._sectors.find(s => s.name === DEFAULT_SECTOR) || this._sectors[0];
    this._sectorName = defaultSector?.name || DEFAULT_SECTOR;

    // Get subsectors for default sector
    try {
      traderDebug('TraderSetupApp', ` Loading subsectors for ${this._sectorName}...`);
      const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
      traderDebug('TraderSetupApp', ` Cache journal for subsectors obtained: ${cacheJournal?.id}`);
      this._subsectors = await loadSubsectorsWithCache(this._sectorName, cacheJournal, this._milieu);
      traderDebug('TraderSetupApp', ` Subsectors from loadSubsectorsWithCache: ${this._subsectors?.length}`);
      if (!this._subsectors || this._subsectors.length === 0) {
        this._subsectors = getSubsectorsForSector(this._sectors, this._sectorName) || [];
      }
      traderDebug('TraderSetupApp', ` Loaded ${this._subsectors.length} subsectors.`);
    } catch (e) {
      console.warn('Failed to get subsectors:', e);
    }

    const defaultSubsector = this._subsectors.find(s => s.letter === DEFAULT_SUBSECTOR_LETTER && s.name === DEFAULT_SUBSECTOR_NAME) || this._subsectors[0];
    this._subsectorName = defaultSubsector?.name || DEFAULT_SUBSECTOR_NAME;
    this._subsectorLetter = defaultSubsector?.letter || DEFAULT_SUBSECTOR_LETTER;

    // Get worlds for default subsector
    try {
      traderDebug('TraderSetupApp', ` Loading worlds for ${this._sectorName} ${this._subsectorLetter}...`);
      const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
      traderDebug('TraderSetupApp', ` Cache journal for worlds obtained: ${cacheJournal?.id}`);
      const sector = defaultSector || { name: DEFAULT_SECTOR, x: 0, y: 0 };
      traderDebug('TraderSetupApp', ` Calling loadSubsector...`);
      const worldDataArray = await loadSubsector(this._sectorName, this._subsectorLetter, this._milieu, cacheJournal, { x: sector.x, y: sector.y }) || [];
      this._worlds = deduplicateWorlds(worldDataArray);
      traderDebug('TraderSetupApp', ` loadSubsector returned ${this._worlds.length} worlds.`);
      this._worlds.sort((a, b) => a.name.localeCompare(b.name));
      traderDebug('TraderSetupApp', ` Worlds sorted.`);
      traderDebug('TraderSetupApp', ` Loaded ${this._worlds.length} worlds.`);
    } catch (e) {
      console.warn('Failed to fetch worlds:', e);
    }

    const defaultWorld = this._worlds.find(w => w.hex === DEFAULT_WORLD_HEX && w.name === DEFAULT_WORLD_NAME) || this._worlds[0];
    this._startHex = defaultWorld?.hex || DEFAULT_WORLD_HEX;
  }


  async _onRender(_ctx, _opts) {
    const el = this.element;
    traderDebug('TraderSetupApp', ` _onRender: template: ${this.constructor.PARTS.main.template}, DOM nodes: ${el.querySelectorAll('*').length}`);

    // Cache journal name change
    el.querySelector('[name=cacheJournalName]')?.addEventListener('input', (e) => {
      this._cacheJournalName = e.target.value.trim();
    });

    // Ship actor change
    el.querySelector('[name=shipActorId]')?.addEventListener('change', (e) => {
      this._shipActorId = e.target.value;
    });

    // Ruleset change
    el.querySelector('[name=ruleset]')?.addEventListener('change', (e) => {
      this._ruleset = e.target.value;
      this.render();
    });

    // Milieu change -> reload sectors
    el.querySelector('[name=milieu]')?.addEventListener('change', async (e) => {
      const requestToken = ++this._activeRequestToken;
      this._milieu = e.target.value;
      this._loadingSectors = true;
      this.render();

      try {
        const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
        if (this._isClosed || requestToken !== this._activeRequestToken) {
          return;
        }
        this._sectors = await getCachedSectors(cacheJournal, this._milieu) || [];
        if (this._isClosed || requestToken !== this._activeRequestToken) {
          return;
        }
        if (this._sectors.length === 0) {
          this._sectors = await fetchSectors(this._milieu);
          if (this._isClosed || requestToken !== this._activeRequestToken) {
            return;
          }
          if (cacheJournal && this._sectors.length > 0) {
            await setCachedSectors(cacheJournal, this._milieu, this._sectors);
          }
        }

        // Update default sector for this milieu
        const defaultSector = this._sectors.find(s => s.name === this._sectorName) || this._sectors[0];
        this._sectorName = defaultSector?.name;

        // Trigger subsector reload
        this._loadingSubsectors = true;
        this.render();

        this._subsectors = await loadSubsectorsWithCache(this._sectorName, cacheJournal, this._milieu) || getSubsectorsForSector(this._sectors, this._sectorName) || [];
        if (this._isClosed || requestToken !== this._activeRequestToken) {
          return;
        }
        if (this._subsectors.length === 0) {
          this._subsectors = SUBSECTOR_LETTERS.map(l => ({ letter: l, name: `${this._sectorName} Subsector ${l}` }));
        }
        this._subsectorLetter = this._subsectors[0]?.letter || 'A';
        this._subsectorName = this._subsectors[0]?.name;

        await this._loadWorldsForSubsector();
        if (this._isClosed || requestToken !== this._activeRequestToken) {
          return;
        }
        this._startHex = this._worlds[0]?.hex || '';
      } catch (err) {
        console.error('Failed to reload sectors for milieu:', err);
      } finally {
        if (requestToken === this._activeRequestToken) {
          this._loadingSectors = false;
          this._loadingSubsectors = false;
          this.render();
        }
      }
    });

    // Sector change -> reload subsectors and worlds
    el.querySelector('[name=sectorName]')?.addEventListener('change', async (e) => {
      const requestToken = ++this._activeRequestToken;
      const sectorVal = e.target.value;
      const decoded = decodeURIComponent(sectorVal);
      this._sectorName = decoded;
      const sector = this._sectors.find(s => s.name === decoded);

      if (sector) {
        // Show loading indicator
        this._loadingSubsectors = true;
        this.render();

        try {
          // Fetch subsectors from TravellerMap metadata
          const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
          if (this._isClosed || requestToken !== this._activeRequestToken) {
            return;
          }
          let newSubsectors = await loadSubsectorsWithCache(this._sectorName, cacheJournal, this._milieu);
          if (this._isClosed || requestToken !== this._activeRequestToken) {
            return;
          }
          if (!newSubsectors || newSubsectors.length === 0) {
            // Get subsectors from cached data or compute
            newSubsectors = getSubsectorsForSector(this._sectors, this._sectorName);
            if (!newSubsectors || newSubsectors.length === 0) {
              // Fallback: generate all letters with generic names
              newSubsectors = SUBSECTOR_LETTERS.map(l => ({ letter: l, name: `${this._sectorName} Subsector ${l}` }));
            }
          }
          this._subsectors = newSubsectors;

          // Select first subsector by default
          this._subsectorLetter = this._subsectors[0]?.letter || 'A';
          this._subsectorName = this._subsectors[0]?.name;

          // Load worlds for the first subsector
          await this._loadWorldsForSubsector();
          if (this._isClosed || requestToken !== this._activeRequestToken) {
            return;
          }

          // Reset to first world
          if (this._worlds.length > 0) {
            this._startHex = this._worlds[0].hex;
          } else {
            this._startHex = '';
          }
        } catch (err) {
          console.error('Failed to reload subsectors for sector:', err);
        } finally {
          if (requestToken === this._activeRequestToken) {
            this._loadingSubsectors = false;
            this.render();
          }
        }
      }
    });

    // Subsector name change (user can pick a different subsector by name)
    el.querySelector('[name=subsectorName]')?.addEventListener('change', async (e) => {
      const requestToken = ++this._activeRequestToken;
      this._subsectorName = e.target.value;
      // Find the letter for this subsector name
      const subsector = this._subsectors.find(s => s.name === this._subsectorName);
      if (subsector) {
        this._subsectorLetter = subsector.letter;
      }
      await this._loadWorldsForSubsector();
      if (this._isClosed || requestToken !== this._activeRequestToken) {
        return;
      }

      // Reset to first world
      if (this._worlds.length > 0) {
        this._startHex = this._worlds[0].hex;
      } else {
        this._startHex = '';
      }
      this.render();
    });

    // World change
    el.querySelector('[name=startHex]')?.addEventListener('change', (e) => {
      this._startHex = e.target.value;
    });

    // Credits change
    el.querySelector('[name=startingCredits]')?.addEventListener('input', (e) => {
      const parsed = Number.parseInt(e.target.value, 10);
      this._startingCredits = Number.isFinite(parsed) ? Math.max(0, parsed) : this._defaultStartingCredits;
    });

    // Confirm button
    el.querySelector('.st-confirm-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (this._isConfirming) {
        return;
      }
      this._isConfirming = true;
      traderDebug('TraderSetupApp', ` Confirming setup...`, {
        shipActorId: this._shipActorId,
        milieu: this._milieu,
        sectorName: this._sectorName,
        subsectorName: this._subsectorName,
        ruleset: this._ruleset,
        startHex: this._startHex,
        startingCredits: this._startingCredits
      });
      this.render();
      try {
        this._confirm();
      } finally {
        this._isConfirming = false;
        if (this.element) {
          this.render();
        }
      }
    });
  }

  async _loadWorldsForSubsector() {
    const requestToken = this._activeRequestToken;
    const sectorName = this._sectorName;
    const subsectorLetter = this._subsectorLetter;
    const milieu = this._milieu;
    const sector = this._sectors.find(s => s.name === sectorName) || { x: 0, y: 0 };

    // Show loading indicator
    this._loadingWorlds = true;
    this.render();

    // Try cache first and load through loadSubsector for unified logic
    try {
      const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
      if (this._isClosed || requestToken !== this._activeRequestToken) {
        return;
      }
      const worldDataArray = await loadSubsector(sectorName, subsectorLetter, milieu, cacheJournal, { x: sector.x, y: sector.y });
      if (this._isClosed || requestToken !== this._activeRequestToken) {
        return;
      }
      this._worlds = deduplicateWorlds(worldDataArray);
      this._worlds.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error('Failed to fetch worlds:', e);
      ui.notifications.error(game.i18n.localize('TWODSIX.Trader.Setup.CacheError'));
      this._worlds = [];
    } finally {
      if (requestToken === this._activeRequestToken) {
        this._loadingWorlds = false;
        this.render();
      }
    }
  }

  _confirm() {
    if (this._resolve) {
      this._resolve({
        cacheJournalName: this._cacheJournalName || '',
        shipActorId: this._shipActorId || '',
        milieu: this._milieu,
        sectorName: this._sectorName,
        subsectorLetter: this._subsectorLetter,
        subsectorName: this._subsectorName,
        ruleset: this._ruleset,
        startHex: this._startHex,
        startingCredits: this._startingCredits,
      });
    }
    this._resolve = null;
    this.close();
  }

  async close(options = {}) {
    this._isClosed = true;
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
    return super.close(options);
  }
}
