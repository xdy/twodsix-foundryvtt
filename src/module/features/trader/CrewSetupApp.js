import { startCharacterGeneration } from '../chargen/CharacterGeneration.js';
import { CREW_SALARIES, DEFAULT_CREW } from './TraderConstants.js';

/**
 * ApplicationV2 crew-setup dialog.
 * Stays open while the player generates actors via chargen in a separate window.
 * Resolves a promise with the final crew array when the player clicks Confirm.
 */
export class CrewSetupApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'trader-crew-setup',
    classes: ['twodsix', 'trader-crew'],
    window: { title: 'Crew Setup', resizable: false },
    position: { width: 640, height: 'auto' },
  };

  _resolve = null;
  _reject = null;

  constructor(options = {}) {
    super(options);
    this._shipActorId = options.shipActorId || '';
    this._rows = this._buildInitialRows();
  }

  /** Build the initial crew rows from the selected ship's positions, or fall back to DEFAULT_CREW. */
  _buildInitialRows() {
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
          let brokerSkill = 0;
          if (assigned) {
            actorId = assigned.id;
            manualName = assigned.name;
            const brokerItem = assigned.items?.find(i =>
              i.type === 'skill' && i.name.toLowerCase() === 'broker'
            );
            brokerSkill = brokerItem?.system?.value ?? 0;
          }
          return {
            position: positionKey,
            label: pos.name,
            salary,
            manualName,
            actorId,
            brokerSkill,
          };
        });
      }
    }
    return DEFAULT_CREW.map(c => ({
      position: c.position,
      label: c.position.charAt(0).toUpperCase() + c.position.slice(1),
      salary: c.salary,
      manualName: '',
      actorId: '',
      brokerSkill: 0,
    }));
  }

  /** Return a promise that resolves to the crew array or null. */
  awaitResult() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  async _renderHTML(_ctx, _opts) {
    const actors = game.actors.filter(a => a.type === 'traveller')
      .sort((a, b) => a.name.localeCompare(b.name));

    const context = {
      positions: this._rows.map(r => ({
        ...r,
        actors: actors.map(a => ({ id: a.id, name: a.name, selected: a.id === r.actorId })),
      })),
    };

    const html = await foundry.applications.handlebars.renderTemplate(
      'systems/twodsix/templates/trader/trader-crew-setup.hbs',
      context
    );
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
  }

  _replaceHTML(result, content, _opts) {
    content.innerHTML = result.innerHTML;
    // Note: ApplicationV2 handles standard replacement, but this custom override
    // is kept if specific DOM preservation/transition logic is needed later.
  }

  async _onRender(_ctx, _opts) {
    const el = this.element;

    // Actor dropdown -> auto-fill name and broker skill from actor
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
            // Read broker skill from actor items
            const brokerItem = actor.items.find(i =>
              i.type === 'skill' && i.name.toLowerCase() === 'broker'
            );
            row.brokerSkill = brokerItem?.system?.value ?? 0;
          }
        } else {
          row.manualName = '';
          row.brokerSkill = 0;
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

    // Broker skill input
    el.querySelectorAll('.st-broker-input').forEach(input => {
      input.addEventListener('change', e => {
        const pos = e.target.dataset.position;
        const row = this._rows.find(r => r.position === pos);
        if (row) {
          row.brokerSkill = parseInt(e.target.value) || 0;
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
        const brokerItem = actor.items.find(i =>
          i.type === 'skill' && i.name.toLowerCase() === 'broker'
        );
        row.brokerSkill = brokerItem?.system?.value ?? 0;
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
        brokerSkill: r.brokerSkill,
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
