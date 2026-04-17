import { CHARGEN_SUPPORTED_RULESETS } from '../features/chargen/CharGenRegistry.js';
import { getCharacteristicList } from '../utils/TwodsixRollSettings.js';
import { AbstractTwodsixItemSheet } from './AbstractTwodsixItemSheet.js';

export class CareerItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixItemSheet) {
  /** @override */
  static DEFAULT_OPTIONS = {
    sheetType: "CareerItemSheet",
    classes: ["twodsix", "sheet", "item"],
    position: {
      width: 700,
      height: 900
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-briefcase"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    tag: "form"
  };
  static PARTS = {
    main: {
      template: "systems/twodsix/templates/items/career-sheet.hbs",
      scrollable: ['']
    }
  };
  static TABS = {
    primary: {
      tabs: [
        {id: "description", icon: "fa-solid fa-book", label: "TWODSIX.Items.Equipment.Description"},
        {id: "career", icon: "fa-solid fa-briefcase", label: "TWODSIX.Items.Career.Career"}
      ],
      initial: "description"
    }
  };
  /** @type {AbortController|null} */
  _chargenExtListeners = null;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.settings.characteristicsList = getCharacteristicList(this.item.actor);

    // Rulesets available for career items — driven by the chargen registry
    context.careerRulesets = [...CHARGEN_SUPPORTED_RULESETS].map(key => ({
      key,
      name: CONFIG.TWODSIX.RULESETS[key]?.name ?? key,
      selected: this.item.system.ruleset === key,
    }));

    // CU skill table options for the skillTable1/skillTable2 dropdowns.
    // Read from the CU chargen ruleset pack if available; fall back to config-defined names.
    const cuRulesetPack = game.packs.get('twodsix.cu-srd-chargen-ruleset');
    let cuSkillTableNames = [];
    if (cuRulesetPack) {
      try {
        const docs = await cuRulesetPack.getDocuments();
        const rulesetItem = docs[0];
        cuSkillTableNames = (rulesetItem?.system?.skillCategoryTables ?? []).map(t => t.name).filter(Boolean);
      } catch (e) {
        console.warn('twodsix | CareerItemSheet: failed to load CU skill table names from pack.', e);
      }
    }
    context.cuSkillTableOptions = cuSkillTableNames.map(name => ({ value: name, label: name }));

    const ext = this.item.system.chargenExtensions;
    context.chargenExtensionsText =
      ext && typeof ext === 'object' && !Array.isArray(ext) && Object.keys(ext).length > 0
        ? JSON.stringify(ext, null, 2)
        : '';
    context.eventTableText = Array.isArray(this.item.system.eventTable)
      ? JSON.stringify(this.item.system.eventTable, null, 2)
      : '[]';
    context.mishapTableText = Array.isArray(this.item.system.mishapTable)
      ? JSON.stringify(this.item.system.mishapTable, null, 2)
      : '[]';
    context.assignmentTableText =
      this.item.system.assignmentTable && typeof this.item.system.assignmentTable === 'object'
        ? JSON.stringify(this.item.system.assignmentTable, null, 2)
        : '{}';
    context.officerRanksText = Array.isArray(this.item.system.officerRanks)
      ? JSON.stringify(this.item.system.officerRanks, null, 2)
      : '[]';
    // Pre-fill assignment table to exactly 11 rows (rolls 2-12)
    const assignmentTable = this.item.system.assignmentTable ?? {};
    const assignmentRows = [];
    for (let i = 2; i <= 12; i++) {
      const data = assignmentTable[i] ?? {};
      assignmentRows.push({
        roll: i,
        name: data.name ?? '',
        survChar: data.surv?.char ?? '',
        survTarget: data.surv?.target ?? '',
        advChar: data.adv?.char ?? '',
        advTarget: data.adv?.target ?? '',
        specialistCsv: Array.isArray(data.specialist) ? data.specialist.join(', ') : '',
      });
    }
    context.assignmentRows = assignmentRows;

    // Pre-fill event table to exactly 11 rows (rolls 2-12)
    const eventTable = this._deepCloneOrDefault(this.item.system.eventTable, []);
    while (eventTable.length < 11) {
      eventTable.push({
        roll: eventTable.length + 2,
        description: '',
        checks: [],
        always: [],
        onSuccess: [],
        onFail: [],
        effects: [],
      });
    }
    eventTable.forEach((row, i) => {
      row.roll = i + 2;
    });
    context.eventTableRows = eventTable;

    // Pre-fill mishap table to exactly 6 rows (rolls 1-6)
    const mishapTable = this._deepCloneOrDefault(this.item.system.mishapTable, []);
    while (mishapTable.length < 6) {
      mishapTable.push({
        roll: mishapTable.length + 1,
        description: '',
        checks: [],
        always: [],
        onSuccess: [],
        onFail: [],
        effects: [],
      });
    }
    mishapTable.forEach((row, i) => {
      row.roll = i + 1;
    });
    context.mishapTableRows = mishapTable;


    return context;
  }

  /**
   * Deep-clone a system array value if it is an array; otherwise return the fallback.
   * @template T
   * @param {T|undefined|null} value
   * @param {T} fallback
   * @returns {T}
   */
  _deepCloneOrDefault(value, fallback) {
    return Array.isArray(value) ? foundry.utils.deepClone(value) : fallback;
  }

  /** @override */
  close(options) {
    this._chargenExtListeners?.abort();
    this._chargenExtListeners = null;
    return super.close(options);
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this._chargenExtListeners?.abort();
    this._chargenExtListeners = new AbortController();
    const { signal } = this._chargenExtListeners;
    const root = this.element;
    if (!root || !this.isEditable) {
      return;
    }
    this._wireJsonEditors(root, signal);
    this._wireOfficerRankButtons(root, signal);
    this._wireAssignmentTable(root, signal);
  }

  /**
   * Wire assignment table row inputs.
   * @param {HTMLElement} root
   * @param {AbortSignal} signal
   */
  _wireAssignmentTable(root, signal) {
    root.querySelectorAll('[data-career-assignment-row]').forEach(row => {
      const roll = row.dataset.roll;
      const getVal = selector => row.querySelector(selector)?.value;

      row.addEventListener('change', async () => {
        const name = getVal('[data-career-assignment="name"]');
        const survChar = getVal('[data-career-assignment="surv-char"]');
        const survTarget = Number(getVal('[data-career-assignment="surv-target"]'));
        const advChar = getVal('[data-career-assignment="adv-char"]');
        const advTarget = Number(getVal('[data-career-assignment="adv-target"]'));
        const specialistRaw = getVal('[data-career-assignment="specialist"]');
        const specialist = specialistRaw ? specialistRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

        const updateData = {
          name,
          surv: { char: survChar, target: survTarget },
          adv: { char: advChar, target: advTarget },
          specialist
        };

        await this.item.update({ [`system.assignmentTable.${roll}`]: updateData });
      }, { signal });
    });
  }

  /**
   * Wire textarea JSON editors: event table, mishap table, assignment table, officer ranks, chargen extensions.
   * @param {HTMLElement} root
   * @param {AbortSignal} signal
   */
  _wireJsonEditors(root, signal) {
    const registerJsonEditor = (selector, targetPath, fallback, validator, warningKey = null) => {
      const element = root.querySelector(selector);
      if (!element) {
        return;
      }
      element.addEventListener('change', async () => {
        const raw = element.value.trim();
        let parsed = fallback;
        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            const warning = warningKey ? game.i18n.localize(warningKey) : 'Invalid JSON';
            ui.notifications.warn(warning);
            return;
          }
        }
        if (validator && !validator(parsed)) {
          const warning = warningKey ? game.i18n.localize(warningKey) : 'Invalid JSON shape';
          ui.notifications.warn(warning);
          return;
        }
        await this.item.update({ [targetPath]: parsed });
      }, { signal });
    };

    registerJsonEditor(
      'textarea[data-career-event-table]',
      'system.eventTable',
      [],
      value => Array.isArray(value),
    );
    registerJsonEditor(
      'textarea[data-career-mishap-table]',
      'system.mishapTable',
      [],
      value => Array.isArray(value),
    );
    registerJsonEditor(
      'textarea[data-career-assignment-table]',
      'system.assignmentTable',
      {},
      value => value && typeof value === 'object' && !Array.isArray(value),
    );
    registerJsonEditor(
      'textarea[data-career-officer-ranks]',
      'system.officerRanks',
      [],
      value => Array.isArray(value),
    );
    registerJsonEditor(
      'textarea[data-career-chargen-extensions]',
      'system.chargenExtensions',
      {},
      value => value && typeof value === 'object' && !Array.isArray(value),
      'TWODSIX.Items.Career.ChargenExtensionsInvalidJson',
    );
  }
  /**
   * Wire add/remove handlers for officer ranks.
   * @param {HTMLElement} root
   * @param {AbortSignal} signal
   */
  _wireOfficerRankButtons(root, signal) {
    root.querySelector('[data-career-add-officer-rank]')?.addEventListener('click', async ev => {
      ev.preventDefault();
      const ranks = this._deepCloneOrDefault(this.item.system.officerRanks, []);
      ranks.push({ title: '', skill: '', level: 0 });
      await this.item.update({ 'system.officerRanks': ranks });
    }, { signal });

    root.querySelectorAll('[data-career-remove-officer-rank]')?.forEach(btn => btn.addEventListener('click', async ev => {
      ev.preventDefault();
      const idx = Number(btn.dataset.careerRemoveOfficerRank);
      if (!Number.isInteger(idx) || idx < 0) {
        return;
      }
      const ranks = this._deepCloneOrDefault(this.item.system.officerRanks, []);
      ranks.splice(idx, 1);
      await this.item.update({ 'system.officerRanks': ranks });
    }, { signal }));
  }


}
