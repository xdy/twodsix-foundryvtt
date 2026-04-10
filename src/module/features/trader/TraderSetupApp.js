/**
 * TraderSetupApp.js
 * ApplicationV2 for initial setup of a trading journey.
 */

import { loadSubsector } from './SubsectorLoader.js';
import {
  DEFAULT_CREW,
  DEFAULT_MERCHANT_TRADER,
  DEFAULT_MILIEU,
  DEFAULT_SECTOR,
  DEFAULT_SUBSECTOR_LETTER,
  DEFAULT_SUBSECTOR_NAME,
  DEFAULT_WORLD_HEX,
  DEFAULT_WORLD_NAME,
  MILIEUS,
  MORTGAGE_DIVISOR,
  SUBSECTOR_LETTERS
} from './TraderConstants.js';
import { getWorldCoordinate } from './TraderUtils.js';
import { fetchSectors, getSubsectorsForSector, loadSubsectorsWithCache } from './TravellerMapAPI.js';
import { getCachedSectors, getOrCreateCacheJournal, setCachedSectors } from './TravellerMapCache.js';

/**
 * ApplicationV2 for initial setup of a trading journey.
 */
export class TraderSetupApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'trader-setup',
    classes: ['twodsix', 'trader-setup'],
    window: { title: 'TWODSIX.Trader.Setup.Title', resizable: true },
    position: { width: 600, height: 600 },
  };

  constructor(options = {}) {
    super(options);
    this.options.window.title = game.i18n.localize(this.options.window.title);

    const monthlyPayment = Math.ceil(DEFAULT_MERCHANT_TRADER.shipCost / MORTGAGE_DIVISOR);
    const totalMonthlyCrew = DEFAULT_CREW.reduce((s, c) => s + c.salary, 0);
    this._defaultStartingCredits = (monthlyPayment + totalMonthlyCrew) * 2;
    this._defaultJournalName = `Trader journal start ${new Date().toLocaleDateString()}`;
    this._cacheJournalName = `TraderTravellermapCache`;

    this._journalName = this._defaultJournalName;
    this._shipActorId = '';
    this._milieu = DEFAULT_MILIEU;
    this._sectorName = DEFAULT_SECTOR;
    this._subsectorName = DEFAULT_SUBSECTOR_NAME;
    this._subsectorLetter = DEFAULT_SUBSECTOR_LETTER;
    this._startHex = DEFAULT_WORLD_HEX;
    this._startingCredits = this._defaultStartingCredits;

    this._sectors = [];
    this._subsectors = [];
    this._worlds = [];
    this._ships = [];

    this._loadingSectors = false;
    this._loadingSubsectors = false;
    this._loadingWorlds = false;
    this._isConfirming = false;

    this._resolve = null;
    this._reject = null;
  }

  async awaitResult() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  async _prepareContext(_options) {
    if (this._sectors.length === 0) {
      await this._initialLoad();
    }

    return {
      journalName: this._journalName,
      defaultJournalName: this._defaultJournalName,
      cacheJournalName: this._cacheJournalName,
      shipActorId: this._shipActorId,
      milieu: this._milieu,
      sectorName: this._sectorName,
      subsectorName: this._subsectorName,
      subsectorLetter: this._subsectorLetter,
      startHex: this._startHex,
      startingCredits: this._startingCredits,
      defaultStartingCredits: this._defaultStartingCredits,
      milieus: MILIEUS.map(m => ({ ...m, selected: m.code === this._milieu })),
      sectors: this._sectors.map(s => ({ ...s, encodedName: encodeURIComponent(s.name), selected: s.name === this._sectorName })),
      subsectors: this._subsectors.map(s => ({ ...s, selected: s.name === this._subsectorName })),
      worlds: this._worlds.map(w => {
        const hex = getWorldCoordinate(w);
        const uwp = w.system?.uwp || w.uwp;
        const tradeCodes = w.system?.tradeCodes || (Array.isArray(w.tradeCodes) ? w.tradeCodes.join(' ') : w.tradeCodes);
        return {
          ...w,
          hex,
          uwp,
          tradeCodes,
          selected: hex === this._startHex
        };
      }),
      ships: this._ships.map(s => ({ ...s, selected: s.id === this._shipActorId })),
      loadingSectors: this._loadingSectors,
      loadingSubsectors: this._loadingSubsectors,
      loadingWorlds: this._loadingWorlds,
      isConfirming: this._isConfirming,
      isConfirmDisabled: this._isConfirming || !this._startHex,
    };
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
      const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
      this._sectors = await getCachedSectors(cacheJournal, DEFAULT_MILIEU) || [];

      if (this._sectors.length === 0) {
        this._sectors = await fetchSectors(DEFAULT_MILIEU);
        if (cacheJournal && this._sectors.length > 0) {
          await setCachedSectors(cacheJournal, DEFAULT_MILIEU, this._sectors);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch sectors from TravellerMap API:', e);
      this._sectors = [{ name: DEFAULT_SECTOR }];
    }

    const defaultSector = this._sectors.find(s => s.name === DEFAULT_SECTOR) || this._sectors[0];
    this._sectorName = defaultSector?.name || DEFAULT_SECTOR;

    // Get subsectors for default sector
    try {
      const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
      this._subsectors = await loadSubsectorsWithCache(this._sectorName, cacheJournal, this._milieu);
      if (!this._subsectors || this._subsectors.length === 0) {
        this._subsectors = getSubsectorsForSector(this._sectors, this._sectorName) || [];
      }
    } catch (e) {
      console.warn('Failed to get subsectors:', e);
    }

    const defaultSubsector = this._subsectors.find(s => s.letter === DEFAULT_SUBSECTOR_LETTER && s.name === DEFAULT_SUBSECTOR_NAME) || this._subsectors[0];
    this._subsectorName = defaultSubsector?.name || DEFAULT_SUBSECTOR_NAME;
    this._subsectorLetter = defaultSubsector?.letter || DEFAULT_SUBSECTOR_LETTER;

    // Get worlds for default subsector
    try {
      const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
      const sector = defaultSector || { name: DEFAULT_SECTOR, x: 0, y: 0 };
      this._worlds = await loadSubsector(this._sectorName, this._subsectorLetter, this._milieu, cacheJournal, { x: sector.x, y: sector.y });
      this._worlds.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.warn('Failed to fetch worlds:', e);
    }

    const defaultWorld = this._worlds.find(w => w.hex === DEFAULT_WORLD_HEX && w.name === DEFAULT_WORLD_NAME) || this._worlds[0];
    this._startHex = defaultWorld?.hex || DEFAULT_WORLD_HEX;
  }

  async _renderHTML(ctx, _opts) {
    const html = await foundry.applications.handlebars.renderTemplate(
      'systems/twodsix/templates/trader/trader-setup.hbs',
      ctx
    );
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  _replaceHTML(result, content, _opts) {
    content.innerHTML = result.innerHTML;
  }

  async _onRender(_ctx, _opts) {
    const el = this.element;

    // Journal name change
    el.querySelector('[name=journalName]')?.addEventListener('input', (e) => {
      this._journalName = e.target.value.trim();
    });

    // Cache journal name change
    el.querySelector('[name=cacheJournalName]')?.addEventListener('input', (e) => {
      this._cacheJournalName = e.target.value.trim();
    });

    // Ship actor change
    el.querySelector('[name=shipActorId]')?.addEventListener('change', (e) => {
      this._shipActorId = e.target.value;
    });

    // Milieu change -> reload sectors
    el.querySelector('[name=milieu]')?.addEventListener('change', async (e) => {
      this._milieu = e.target.value;
      this._loadingSectors = true;
      this.render();

      try {
        const cacheJournal = await getOrCreateCacheJournal(this._cacheJournalName);
        this._sectors = await getCachedSectors(cacheJournal, this._milieu) || [];
        if (this._sectors.length === 0) {
          this._sectors = await fetchSectors(this._milieu);
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
        if (this._subsectors.length === 0) {
          this._subsectors = SUBSECTOR_LETTERS.map(l => ({ letter: l, name: `${this._sectorName} Subsector ${l}` }));
        }
        this._subsectorLetter = this._subsectors[0]?.letter || 'A';
        this._subsectorName = this._subsectors[0]?.name;

        await this._loadWorldsForSubsector();
        this._startHex = this._worlds[0]?.hex || '';
      } catch (err) {
        console.error('Failed to reload sectors for milieu:', err);
      } finally {
        this._loadingSectors = false;
        this._loadingSubsectors = false;
        this.render();
      }
    });

    // Sector change -> reload subsectors and worlds
    el.querySelector('[name=sectorName]')?.addEventListener('change', async (e) => {
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
          let newSubsectors = await loadSubsectorsWithCache(this._sectorName, cacheJournal, this._milieu);
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

          // Reset to first world
          if (this._worlds.length > 0) {
            this._startHex = this._worlds[0].hex;
          } else {
            this._startHex = '';
          }
        } catch (err) {
          console.error('Failed to reload subsectors for sector:', err);
        } finally {
          this._loadingSubsectors = false;
          this.render();
        }
      }
    });

    // Subsector name change (user can pick a different subsector by name)
    el.querySelector('[name=subsectorName]')?.addEventListener('change', async (e) => {
      this._subsectorName = e.target.value;
      // Find the letter for this subsector name
      const subsector = this._subsectors.find(s => s.name === this._subsectorName);
      if (subsector) {
        this._subsectorLetter = subsector.letter;
      }
      await this._loadWorldsForSubsector();

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
      this._startingCredits = parseInt(e.target.value) || this._defaultStartingCredits;
    });

    // Confirm button
    el.querySelector('.st-confirm-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (this._isConfirming) {
        return;
      }
      this._isConfirming = true;
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
      const worldDataArray = await loadSubsector(sectorName, subsectorLetter, milieu, cacheJournal, { x: sector.x, y: sector.y });
      this._worlds = worldDataArray;
      this._worlds.sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      console.error('Failed to fetch worlds:', e);
      ui.notifications.error(game.i18n.localize('TWODSIX.Trader.Setup.CacheError'));
      this._worlds = [];
    } finally {
      this._loadingWorlds = false;
      this.render();
    }
  }

  _confirm() {
    if (this._resolve) {
      this._resolve({
        journalName: this._journalName || this._defaultJournalName,
        cacheJournalName: this._cacheJournalName || '',
        shipActorId: this._shipActorId || '',
        milieu: this._milieu,
        sectorName: this._sectorName,
        subsectorLetter: this._subsectorLetter,
        subsectorName: this._subsectorName,
        startHex: this._startHex,
        startingCredits: this._startingCredits,
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
