import { CHARGEN_SUPPORTED_RULESETS } from '../features/chargen/CharGenRegistry.js';
import { getCharacteristicList } from '../utils/TwodsixRollSettings';
import { AbstractTwodsixItemSheet } from './AbstractTwodsixItemSheet';

export class SpeciesItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixItemSheet) {
  /** @override */
  static DEFAULT_OPTIONS = {
    sheetType: 'SpeciesItemSheet',
    classes: ['twodsix', 'sheet', 'item'],
    position: {
      width: 700,
      height: 900
    },
    window: {
      resizable: true,
      icon: 'fa-solid fa-dna'
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    tag: 'form'
  };

  /** @override */
  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/items/species-sheet.hbs',
      scrollable: ['']
    }
  };

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.isEditable) {
      return;
    }
    this._wireSpeciesArrayButtons(this.element);
  }

  /**
   * Wire Add/Remove buttons for grantedTraitNames, abilityLines, and allowedCareers arrays.
   * @param {HTMLElement} root
   */
  _wireSpeciesArrayButtons(root) {
    const ARRAYS = ['grantedTraitNames', 'abilityLines', 'allowedCareers'];

    // Add row handlers
    root.querySelectorAll('[data-species-add-row]').forEach(btn => {
      btn.addEventListener('click', async ev => {
        ev.preventDefault();
        const arrayKey = btn.dataset.speciesAddRow;
        if (!ARRAYS.includes(arrayKey)) {
          return;
        }
        const arr = foundry.utils.deepClone(this.item.system[arrayKey] ?? []);
        arr.push('');
        await this.item.update({ [`system.${arrayKey}`]: arr });
      });
    });

    // Remove row handlers
    root.querySelectorAll('[data-species-remove-row]').forEach(btn => {
      btn.addEventListener('click', async ev => {
        ev.preventDefault();
        const arrayKey = btn.dataset.speciesRemoveRow;
        const idx = Number(btn.dataset.index);
        if (!ARRAYS.includes(arrayKey) || !Number.isInteger(idx) || idx < 0) {
          return;
        }
        const arr = foundry.utils.deepClone(this.item.system[arrayKey] ?? []);
        arr.splice(idx, 1);
        await this.item.update({ [`system.${arrayKey}`]: arr });
      });
    });
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.settings = {
      usePDFPager: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      useItemAEs: game.settings.get('twodsix', 'useItemActiveEffects')
    };

    // Build deltaCharacteristics: map the six delta keys (str, dex, end, int, edu, soc)
    // to their full characteristic labels for display.
    const allCharacteristics = getCharacteristicList(this.item.actor);
    const DELTA_MAP = [
      { key: 'str', charKey: 'strength' },
      { key: 'dex', charKey: 'dexterity' },
      { key: 'end', charKey: 'endurance' },
      { key: 'int', charKey: 'intelligence' },
      { key: 'edu', charKey: 'education' },
      { key: 'soc', charKey: 'socialStanding' },
    ];
    context.deltaCharacteristics = {};
    for (const entry of DELTA_MAP) {
      context.deltaCharacteristics[entry.key] = {
        label: allCharacteristics[entry.charKey] ?? entry.key.toUpperCase(),
        value: this.item.system.deltas?.[entry.key] ?? 0
      };
    }

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item.system.description,
      {
        secrets: this.document.isOwner,
        relativeTo: this.item,
        rollData: this.item.getRollData(),
        async: true
      }
    );

    // Rulesets available for species items
    context.speciesRulesets = [...CHARGEN_SUPPORTED_RULESETS].map(key => ({
      key,
      name: CONFIG.TWODSIX.RULESETS[key]?.name ?? key,
      selected: this.item.system.ruleset === key
    }));

    return context;
  }
}
