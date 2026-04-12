import { startCharacterGeneration } from '../chargen/CharacterGeneration.js';
import { CREW_SALARIES, DEFAULT_CREW } from './TraderConstants.js';
import { getTraderRuleset } from './TraderRulesetRegistry.js';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * ApplicationV2 crew-setup dialog.
 * Stays open while the player generates actors via chargen in a separate window.
 * Resolves a promise with the final crew array when the player clicks Confirm.
 */
export class CrewSetupApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'trader-crew-setup',
    classes: ['twodsix', 'trader-crew'],
    window: { title: 'Crew Setup', resizable: false },
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
  }

  /** Build the initial crew rows from the selected ship's positions, or fall back to DEFAULT_CREW. */
  _buildInitialRows() {
    const ruleset = getTraderRuleset(this._ruleset);
    const skillNames = ruleset.getRelevantSkillNames();

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
          let manualName = '';
          let actorId = '';
          const skills = {};
          skillNames.forEach(s => {
            skills[s.toLowerCase()] = 0;
          });

          if (assigned) {
            actorId = assigned.id;
            manualName = assigned.name;
            skillNames.forEach(sName => {
              const item = assigned.items?.find(i =>
                i.type === 'skill' && i.name.toLowerCase() === sName.toLowerCase()
              );
              skills[sName.toLowerCase()] = item?.system?.value ?? 0;
            });
          }
          return {
            position: positionKey,
            label: pos.name,
            salary,
            manualName,
            actorId,
            skills,
            // legacy fields
            brokerSkill: skills.broker ?? 0,
            streetwiseSkill: skills.streetwise ?? 0,
            computersSkill: skills.computers ?? 0,
          };
        });
      }
    }
    return DEFAULT_CREW.map(c => {
      const skills = {};
      skillNames.forEach(s => {
        skills[s.toLowerCase()] = 0;
      });
      return {
        position: c.position,
        label: c.position.charAt(0).toUpperCase() + c.position.slice(1),
        salary: c.salary,
        manualName: '',
        actorId: '',
        skills,
        // legacy fields
        brokerSkill: 0,
        streetwiseSkill: 0,
        computersSkill: 0,
      };
    });
  }

  /** Return a promise that resolves to the crew array or null. */
  awaitResult() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  async _prepareContext(_options) {
    const actors = game.actors.filter(a => a.type === 'traveller')
      .sort((a, b) => a.name.localeCompare(b.name));

    const ruleset = getTraderRuleset(this._ruleset);
    const skillNames = ruleset.getRelevantSkillNames();

    return {
      skillNames: skillNames.map(s => ({ name: s, label: s })),
      positions: this._rows.map(r => ({
        ...r,
        actors: actors.map(a => ({ id: a.id, name: a.name, selected: a.id === r.actorId })),
        skillList: skillNames.map(sName => ({
          name: sName,
          key: sName.toLowerCase(),
          value: r.skills[sName.toLowerCase()] ?? 0
        }))
      })),
    };
  }

  async _onRender(_ctx, _opts) {
    const el = this.element;

    // Actor dropdown -> auto-fill name and skills from actor
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
            // Read skills from actor items
            const ruleset = getTraderRuleset(this._ruleset);
            const skillNames = ruleset.getRelevantSkillNames();
            skillNames.forEach(sName => {
              const item = actor.items.find(i =>
                i.type === 'skill' && i.name.toLowerCase() === sName.toLowerCase()
              );
              row.skills[sName.toLowerCase()] = item?.system?.value ?? 0;
            });
            // legacy fields
            row.brokerSkill = row.skills.broker ?? 0;
            row.streetwiseSkill = row.skills.streetwise ?? 0;
            row.computersSkill = row.skills.computers ?? 0;
          }
        } else {
          row.manualName = '';
          Object.keys(row.skills).forEach(k => {
            row.skills[k] = 0;
          });
          row.brokerSkill = 0;
          row.streetwiseSkill = 0;
          row.computersSkill = 0;
        }
        this.render();
      });
    });

    // Manual name input
    el.querySelectorAll('.st-name-input').forEach(input => {
      input.addEventListener('change', e => {
        const pos = e.target.dataset.position;
        const row = this._rows.find(r => r.position === pos);
        if (row) {
          row.manualName = e.target.value;
        }
      });
    });

    // Skill input
    el.querySelectorAll('.st-skill-input').forEach(input => {
      input.addEventListener('change', e => {
        const pos = e.target.dataset.position;
        const skillKey = e.target.dataset.skill;
        const row = this._rows.find(r => r.position === pos);
        if (row && row.skills) {
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
        const ruleset = getTraderRuleset(this._ruleset);
        const skillNames = ruleset.getRelevantSkillNames();
        skillNames.forEach(sName => {
          const item = actor.items.find(i =>
            i.type === 'skill' && i.name.toLowerCase() === sName.toLowerCase()
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
