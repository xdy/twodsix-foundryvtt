import { startCharacterGeneration } from '../chargen/CharacterGeneration.js';
import { CREW_SALARIES, DEFAULT_CREW } from './TraderConstants.js';
import { getTraderRuleset } from './TraderRulesetRegistry.js';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Ruleset-agnostic skill-name aliases.
 * Different rulesets name the same skill differently (e.g. Computer vs Computers,
 * Carouse vs Carousing). This map provides symmetric lookups so that actors from
 * any ruleset are matched against any ruleset's canonical skill names.
 * @type {Map<string, string>}
 */
const SKILL_NAME_ALIASES = new Map([
  ['computer', 'computers'],
  ['computers', 'computer'],
  ['carouse', 'carousing'],
  ['carousing', 'carouse'],
]);

/**
 * Check whether an actor's skill-item name matches a canonical skill name,
 * accounting for known cross-ruleset aliases (e.g. Computer ↔ Computers).
 * @param {string} itemName - The name of the actor's skill item
 * @param {string} canonicalName - The ruleset's canonical skill name
 * @returns {boolean}
 */
function matchSkillName(itemName, canonicalName) {
  const a = itemName.toLowerCase();
  const b = canonicalName.toLowerCase();
  return a === b || SKILL_NAME_ALIASES.get(a) === b;
}

/**
 * Compute the default window width based on the number of skill columns.
 * @param {string[]} skillNames
 * @returns {number}
 */
function computeDefaultWidth(skillNames) {
  // Position ~90 + Salary ~70 + Name ~190 + each skill ~80 + Clear ~38
  return Math.max(640, 90 + 70 + 190 + skillNames.length * 80 + 38);
}

/**
 * ApplicationV2 crew-setup dialog.
 * Stays open while the player generates actors via chargen in a separate window.
 * Resolves a promise with the final crew array when the player clicks Confirm.
 */
export class CrewSetupApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'trader-crew-setup',
    classes: ['twodsix', 'trader-crew'],
    window: { title: 'TWODSIX.Trader.Setup.CrewTitle', resizable: true },
    position: { width: 640, height: 'auto' },
  };

  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/trader/trader-crew-setup.hbs',
    },
  };

  _resolve = null;
  _reject = null;

  constructor(options = {}) {
    super(options);
    this._shipActorId = options.shipActorId || '';
    this._ruleset = options.ruleset || 'CE';
    this._rows = this._buildInitialRows();

    // Dynamically size the window based on skill count
    const ruleset = getTraderRuleset(this._ruleset);
    this.options.position.width = computeDefaultWidth(ruleset.getRelevantSkillNames());
  }

  /** Build the initial crew rows from the selected ship's positions, or fall back to DEFAULT_CREW. */
  _buildInitialRows() {
    const ruleset = getTraderRuleset(this._ruleset);
    const skillNames = ruleset.getRelevantSkillNames();

    const makeRow = (positionKey, label, salary, assignedActor = null) => {
      const skills = {};
      skillNames.forEach(s => {
        skills[s.toLowerCase()] = 0;
      });

      let actorId = '';
      let manualName = '';
      let locked = false;

      if (assignedActor) {
        actorId = assignedActor.id;
        manualName = assignedActor.name;
        locked = true;
        skillNames.forEach(sName => {
          const item = assignedActor.items?.find(i =>
            i.type === 'skills' && matchSkillName(i.name, sName)
          );
          skills[sName.toLowerCase()] = item?.system?.value ?? 0;
        });
      }

      return {
        position: positionKey,
        label,
        salary,
        manualName,
        actorId,
        skills,
        locked,
        // legacy fields
        brokerSkill: skills.broker ?? 0,
        streetwiseSkill: skills.streetwise ?? 0,
        computersSkill: skills.computers ?? 0,
      };
    };

    if (this._shipActorId) {
      const shipActor = game.actors?.get(this._shipActorId);
      const positions = shipActor?.itemTypes?.ship_position ?? [];
      if (positions.length > 0) {
        const seen = new Map();
        return positions.map(pos => {
          const baseKey = (pos.name || 'other').toLowerCase().trim() || 'other';
          const count = (seen.get(baseKey) ?? 0) + 1;
          seen.set(baseKey, count);
          const positionKey = count === 1 ? baseKey : `${baseKey}-${count}`;
          const salary = CREW_SALARIES[baseKey] ?? CREW_SALARIES.other;
          const assigned = pos.system?.actors?.[0];
          return makeRow(positionKey, pos.name, salary, assigned);
        });
      }
    }
    return DEFAULT_CREW.map(c =>
      makeRow(
        c.position,
        c.position.charAt(0).toUpperCase() + c.position.slice(1),
        c.salary
      )
    );
  }

  /** Return a promise that resolves to the crew array or null. */
  awaitResult() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  async _prepareContext(_options) {
    const ruleset = getTraderRuleset(this._ruleset);
    const skillNames = ruleset.getRelevantSkillNames();

    // Pre-resolve actor skill tooltips and relevancy once for all actors
    const actorCache = new Map();
    game.actors.filter(a => a.type === 'traveller')
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(a => {
        const skillLevels = {};
        let hasRelevantSkill = false;
        for (const sName of skillNames) {
          const item = a.items.find(i =>
            i.type === 'skills' && matchSkillName(i.name, sName)
          );
          const level = item?.system?.value ?? 0;
          skillLevels[sName.toLowerCase()] = level;
          if (level >= 1) {
            hasRelevantSkill = true;
          }
        }
        actorCache.set(a.id, {
          id: a.id,
          name: a.name,
          skillTooltip: skillNames.map(s => `${s}: ${skillLevels[s.toLowerCase()]}`).join(', '),
          hasRelevantSkill,
        });
      });

    return {
      skillNames: skillNames.map(s => ({ name: s, label: s })),
      positions: this._rows.map(r => ({
        ...r,
        hasClearableContent: r.locked || (r.manualName && r.manualName.trim() !== ''),
        actors: Array.from(actorCache.values()).map(a => ({
          ...a,
          selected: a.id === r.actorId,
        })),
        skillList: skillNames.map(sName => ({
          name: sName,
          key: sName.toLowerCase(),
          value: r.skills[sName.toLowerCase()] ?? 0,
        })),
      })),
    };
  }

  async _onRender(_ctx, _opts) {
    const el = this.element;

    // Actor dropdown -> auto-fill name and skills from actor, lock the row
    el.querySelectorAll('.st-actor-select').forEach(sel => {
      sel.addEventListener('change', e => {
        const pos = e.target.dataset.position;
        const row = this._rows.find(r => r.position === pos);
        if (!row) {
          return;
        }
        row.actorId = e.target.value;
        if (e.target.value) {
          const actor = game.actors.get(e.target.value);
          if (actor) {
            row.manualName = actor.name;
            row.locked = true;
            const ruleset = getTraderRuleset(this._ruleset);
            const skillNames = ruleset.getRelevantSkillNames();
            skillNames.forEach(sName => {
              const item = actor.items.find(i =>
                i.type === 'skills' && matchSkillName(i.name, sName)
              );
              row.skills[sName.toLowerCase()] = item?.system?.value ?? 0;
            });
            // legacy fields
            row.brokerSkill = row.skills.broker ?? 0;
            row.streetwiseSkill = row.skills.streetwise ?? 0;
            row.computersSkill = row.skills.computers ?? 0;
          }
        } else {
          // "Manual entry" selected — unlock
          this._clearRow(row);
        }
        this.render();
      });
    });

    // Manual name input (only used when not locked)
    el.querySelectorAll('.st-name-input').forEach(input => {
      input.addEventListener('change', e => {
        const pos = e.target.dataset.position;
        const row = this._rows.find(r => r.position === pos);
        if (row && !row.locked) {
          row.manualName = e.target.value;
        }
      });
    });

    // Skill input (only used when not locked)
    el.querySelectorAll('.st-skill-input').forEach(input => {
      input.addEventListener('change', e => {
        const pos = e.target.dataset.position;
        const skillKey = e.target.dataset.skill;
        const row = this._rows.find(r => r.position === pos);
        if (row && !row.locked && row.skills) {
          const val = parseInt(e.target.value) || 0;
          row.skills[skillKey] = val;
          // legacy sync
          if (skillKey === 'broker') {
            row.brokerSkill = val;
          }
          if (skillKey === 'streetwise') {
            row.streetwiseSkill = val;
          }
          if (skillKey === 'computers') {
            row.computersSkill = val;
          }
        }
      });
    });

    // Clear crewmember button
    el.querySelectorAll('.st-clear-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const pos = e.target.closest('button')?.dataset.position;
        const row = this._rows.find(r => r.position === pos);
        if (row && row.locked) {
          this._clearRow(row);
          this.render();
        }
      });
    });

    // Drag-and-drop: accept actor drops onto crew rows
    el.querySelectorAll('tr[data-position]').forEach(rowEl => {
      rowEl.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        rowEl.classList.add('st-drag-over');
      });
      rowEl.addEventListener('dragleave', () => {
        rowEl.classList.remove('st-drag-over');
      });
      rowEl.addEventListener('drop', async e => {
        e.preventDefault();
        rowEl.classList.remove('st-drag-over');
        let data;
        try {
          data = JSON.parse(e.dataTransfer.getData('text/plain'));
        } catch {
          return;
        }
        if (data.type !== 'Actor') {
          return;
        }
        const actor = await fromUuid(data.uuid);
        if (!actor) {
          return;
        }
        const pos = rowEl.dataset.position;
        const row = this._rows.find(r => r.position === pos);
        if (!row) {
          return;
        }
        row.actorId = actor.id;
        row.manualName = actor.name;
        row.locked = true;
        const ruleset = getTraderRuleset(this._ruleset);
        const skillNames = ruleset.getRelevantSkillNames();
        skillNames.forEach(sName => {
          const item = actor.items.find(i =>
            i.type === 'skills' && matchSkillName(i.name, sName)
          );
          row.skills[sName.toLowerCase()] = item?.system?.value ?? 0;
        });
        // legacy fields
        row.brokerSkill = row.skills.broker ?? 0;
        row.streetwiseSkill = row.skills.streetwise ?? 0;
        row.computersSkill = row.skills.computers ?? 0;
        this.render();
      });
    });

    // Open Character Generation (non-blocking — stays open alongside this dialog)
    el.querySelector('.st-chargen-btn')?.addEventListener('click', () => {
      startCharacterGeneration();
    });

    // Refresh — re-render to pick up any newly created actors
    el.querySelector('.st-refresh-btn')?.addEventListener('click', () => {
      this.render();
    });

    // Confirm
    el.querySelector('.st-confirm-btn')?.addEventListener('click', () => {
      this._confirm();
    });
  }

  /** Clear a crew row to its unassigned state. */
  _clearRow(row) {
    const ruleset = getTraderRuleset(this._ruleset);
    const skillNames = ruleset.getRelevantSkillNames();

    row.actorId = '';
    row.manualName = '';
    row.locked = false;
    skillNames.forEach(sName => {
      row.skills[sName.toLowerCase()] = 0;
    });
    row.brokerSkill = 0;
    row.streetwiseSkill = 0;
    row.computersSkill = 0;
  }

  _confirm() {
    const crew = this._rows.map(r => {
      const name = r.manualName.trim()
        || r.label
        || (r.position.charAt(0).toUpperCase() + r.position.slice(1));
      return {
        name,
        position: r.position,
        salary: r.salary,
        actorId: r.actorId || null,
        skills: r.skills,
        brokerSkill: r.brokerSkill,
        streetwiseSkill: r.streetwiseSkill,
        computersSkill: r.computersSkill,
      };
    });
    if (this._resolve) {
      this._resolve(crew);
      this._resolve = null;
    }
    this.close();
  }

  async close(options = {}) {
    // If closed without confirming, resolve null so setup can cancel cleanly
    if (this._resolve) {
      this._resolve(null);
      this._resolve = null;
    }
    return super.close(options);
  }
}
