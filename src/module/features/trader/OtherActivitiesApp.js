/**
 * OtherActivitiesApp.js
 * Dialog for the AT_WORLD "Other activities" action — bulk-edits the trader
 * state (ship, crew, funds, goods, freight, bulk life support, passengers),
 * advances time, and produces a summary log entry.
 */

import { CREW_SALARIES } from './TraderConstants.js';
import { getFreeCargoSpace, getFreeLowBerths, getFreeStaterooms } from './TraderState.js';

/**
 * Build a ship state object from a ship Actor. Mirrors the inline logic in
 * TraderEntrypoint.initializeTraderState so the two stay in sync.
 * @param {Actor} shipActor
 * @param {object} baseShip - Existing state.ship to inherit fields from
 * @returns {object}
 */
export function buildShipFromActor(shipActor, baseShip) {
  const sys = shipActor.system;
  const components = shipActor.itemTypes?.component ?? [];
  const accommodations = components.filter(i => i.system?.subtype === 'accommodations');
  const staterooms = accommodations
    .filter(i => /stateroom/i.test(i.name))
    .reduce((sum, i) => sum + (i.system?.quantity ?? 0), 0);
  const lowBerths = accommodations
    .filter(i => /low berth|cryoberth/i.test(i.name))
    .reduce((sum, i) => sum + (i.system?.quantity ?? 0), 0);
  const armed = components.some(i => i.system?.subtype === 'armament');
  return {
    ...baseShip,
    name: shipActor.name,
    jumpRating: sys.shipStats?.drives?.jDrive?.rating ?? baseShip.jumpRating,
    maneuverRating: sys.shipStats?.drives?.mDrive?.rating ?? baseShip.maneuverRating,
    tonnage: sys.mass?.max ?? baseShip.tonnage,
    cargoCapacity: sys.weightStats?.cargo ?? baseShip.cargoCapacity,
    fuelCapacity: sys.shipStats?.fuel?.max ?? baseShip.fuelCapacity,
    shipCost: parseInt(sys.shipValue) || baseShip.shipCost,
    ...(staterooms > 0 && { staterooms }),
    ...(lowBerths > 0 && { lowBerths }),
    armed,
  };
}

export class OtherActivitiesApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'trader-other-activities',
    classes: ['twodsix', 'trader-other-activities'],
    window: { title: 'TWODSIX.Trader.OtherActivities.Title', resizable: true },
    position: { width: 760, height: 'auto' },
  };

  _resolve = null;

  constructor(options = {}) {
    super(options);
    this._state = options.state;
    this._crew = foundry.utils.deepClone(this._state.crew || []);
    this._removedCrew = [];
    this._addedCrew = [];
    this._cargo = foundry.utils.deepClone(this._state.cargo || []);
    this._removedCargo = [];
    this._addedCargo = [];
  }

  /** @returns {Promise<object|null>} Result object or null if cancelled. */
  awaitResult() {
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  async _renderHTML(_ctx, _opts) {
    const ships = game.actors.filter(a => a.type === 'ship')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(a => ({ id: a.id, name: a.name }));
    const travellerActors = game.actors.filter(a => a.type === 'traveller')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(a => ({ id: a.id, name: a.name }));
    const positions = Object.keys(CREW_SALARIES);

    const context = {
      ships,
      travellerActors,
      positions,
      crew: this._crew,
      cargo: this._cargo,
      currentCredits: (this._state.credits ?? 0).toLocaleString(),
      currentFreight: this._state.freight ?? 0,
      currentShipName: this._state.ship?.name || 'Ship',
      currentWorldName: this._state.currentWorldName || '',
      freeCargo: getFreeCargoSpace(this._state),
      freeStaterooms: getFreeStaterooms(this._state),
      freeLowBerths: getFreeLowBerths(this._state),
    };

    const html = await foundry.applications.handlebars.renderTemplate(
      'systems/twodsix/templates/trader/other-activities.hbs',
      context
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

    el.querySelectorAll('.oa-remove-crew').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const removed = this._crew.splice(idx, 1)[0];
        if (removed) {
          // If this row was added in this dialog session, just cancel the addition.
          const addedIdx = this._addedCrew.indexOf(removed);
          if (addedIdx >= 0) {
            this._addedCrew.splice(addedIdx, 1);
          } else {
            this._removedCrew.push(removed);
          }
        }
        this.render();
      });
    });

    el.querySelector('.oa-add-crew-btn')?.addEventListener('click', () => {
      const actorSel = el.querySelector('.oa-crew-actor');
      const posSel = el.querySelector('.oa-crew-position');
      const actorId = actorSel?.value;
      if (!actorId) {
        ui.notifications.warn(game.i18n.localize('TWODSIX.Trader.OtherActivities.SelectActor'));
        return;
      }
      const actor = game.actors.get(actorId);
      if (!actor) {
        return;
      }
      const position = posSel?.value || 'other';
      const salary = CREW_SALARIES[position] ?? CREW_SALARIES.other;
      const brokerItem = actor.items.find(i => i.type === 'skill' && i.name.toLowerCase() === 'broker');
      const newMember = {
        name: actor.name,
        position,
        salary,
        actorId: actor.id,
        brokerSkill: brokerItem?.system?.value ?? 0,
      };
      this._crew.push(newMember);
      this._addedCrew.push(newMember);
      this.render();
    });

    el.querySelectorAll('.oa-remove-cargo').forEach(btn => {
      btn.addEventListener('click', e => {
        const idx = parseInt(e.currentTarget.dataset.index);
        const removed = this._cargo.splice(idx, 1)[0];
        if (removed) {
          const addedIdx = this._addedCargo.indexOf(removed);
          if (addedIdx >= 0) {
            this._addedCargo.splice(addedIdx, 1);
          } else {
            this._removedCargo.push(removed);
          }
        }
        this.render();
      });
    });

    el.querySelector('.oa-add-goods-btn')?.addEventListener('click', () => {
      const name = el.querySelector('.oa-good-name').value.trim();
      const tons = parseInt(el.querySelector('.oa-good-tons').value) || 0;
      const price = parseInt(el.querySelector('.oa-good-price').value) || 0;
      const world = el.querySelector('.oa-good-world').value.trim() || this._state.currentWorldName;
      if (!name || tons <= 0) {
        ui.notifications.warn(game.i18n.localize('TWODSIX.Trader.OtherActivities.GoodsRequired'));
        return;
      }
      const cap = this._capacity();
      if (tons > cap.freeCargo) {
        ui.notifications.warn(game.i18n.format('TWODSIX.Trader.OtherActivities.NotEnoughCargoSpace', { free: cap.freeCargo }));
        return;
      }
      const item = { name, tons, purchasePricePerTon: price, purchaseWorld: world };
      this._cargo.push(item);
      this._addedCargo.push(item);
      this.render();
    });

    el.querySelector('.oa-cancel-btn')?.addEventListener('click', () => this.close());
    el.querySelector('.oa-done-btn')?.addEventListener('click', () => this._done());
  }

  _readDeltas() {
    const el = this.element;
    const num = n => parseInt(el.querySelector(`[name=${n}]`)?.value) || 0;
    return {
      freight: num('freightDelta'),
      bulkN: num('bulkNormalDelta'),
      bulkL: num('bulkLuxuryDelta'),
      high: num('paxHighDelta'),
      middle: num('paxMiddleDelta'),
      low: num('paxLowDelta'),
    };
  }

  _capacity() {
    const s = this._state;
    const ship = s.ship || {};
    const cargoCap = ship.cargoCapacity ?? 0;
    const staterooms = ship.staterooms ?? 0;
    const lowBerths = ship.lowBerths ?? 0;

    const baseUsedCargo = (s.hasMail ? 5 : 0) + (s.charterCargo || 0);
    const baseUsedStaterooms = (s.charterStaterooms || 0);
    const baseUsedLow = (s.charterLowBerths || 0);

    const d = this._readDeltas();
    const workingCargoTons = this._cargo.reduce((sum, c) => sum + (c.tons || 0), 0);
    const workingFreight = Math.max(0, (s.freight || 0) + d.freight);
    const workingBulk = Math.max(0, d.bulkN) + Math.max(0, d.bulkL);
    const usedCargo = baseUsedCargo + workingCargoTons + workingFreight + workingBulk;

    const workingHigh = Math.max(0, s.passengers.high + d.high);
    const workingMid = Math.max(0, s.passengers.middle + d.middle);
    const workingLow = Math.max(0, s.passengers.low + d.low);
    const usedStaterooms = baseUsedStaterooms + this._crew.length + workingHigh + workingMid;
    const usedLow = baseUsedLow + workingLow;

    return {
      cargoCap, staterooms, lowBerths,
      freeCargo: cargoCap - usedCargo,
      freeStaterooms: staterooms - usedStaterooms,
      freeLowBerths: lowBerths - usedLow,
    };
  }

  _done() {
    const el = this.element;
    const descEl = el.querySelector('[name=description]');
    const daysEl = el.querySelector('[name=days]');
    const description = (descEl?.value || '').trim();
    const days = parseInt(daysEl?.value) || 0;

    descEl?.classList.remove('invalid');
    daysEl?.classList.remove('invalid');

    if (!description) {
      descEl?.classList.add('invalid');
      ui.notifications.warn(game.i18n.localize('TWODSIX.Trader.OtherActivities.DescriptionRequired'));
      return;
    }
    if (days < 0) {
      daysEl?.classList.add('invalid');
      return;
    }

    const num = name => parseInt(el.querySelector(`[name=${name}]`)?.value) || 0;
    const creditsDelta = num('creditsDelta');
    const freightDelta = num('freightDelta');
    const bulkNormalDelta = num('bulkNormalDelta');
    const bulkLuxuryDelta = num('bulkLuxuryDelta');
    const paxHighDelta = num('paxHighDelta');
    const paxMiddleDelta = num('paxMiddleDelta');
    const paxLowDelta = num('paxLowDelta');
    const newShipActorId = el.querySelector('[name=shipActorId]')?.value || null;

    const cap = this._capacity();
    const errors = [];
    if (cap.freeCargo < 0) {
      errors.push(game.i18n.format('TWODSIX.Trader.OtherActivities.NotEnoughCargoSpace', { free: cap.freeCargo }));
    }
    if (cap.freeStaterooms < 0) {
      errors.push(game.i18n.localize('TWODSIX.Trader.OtherActivities.NotEnoughStaterooms'));
    }
    if (cap.freeLowBerths < 0) {
      errors.push(game.i18n.localize('TWODSIX.Trader.OtherActivities.NotEnoughLowBerths'));
    }
    if (errors.length) {
      ui.notifications.warn(`${game.i18n.localize('TWODSIX.Trader.OtherActivities.CapacityExceeded')} ${errors.join(' ')}`);
      return;
    }

    const parts = [];
    parts.push(`Spent ${days} day${days === 1 ? '' : 's'}.`);
    parts.push(description.endsWith('.') ? description : description + '.');

    if (newShipActorId) {
      const newShip = game.actors.get(newShipActorId);
      if (newShip) {
        parts.push(`Ship changed to ${newShip.name}.`);
      }
    }
    for (const r of this._removedCrew) {
      parts.push(`Crewmember ${r.name} removed.`);
    }
    for (const a of this._addedCrew) {
      parts.push(`Crewmember ${a.name} added.`);
    }
    if (creditsDelta !== 0) {
      parts.push(`${creditsDelta > 0 ? 'Added' : 'Removed'} ${Math.abs(creditsDelta).toLocaleString()} cr.`);
    }
    if (freightDelta !== 0) {
      parts.push(`${freightDelta > 0 ? 'Added' : 'Removed'} ${Math.abs(freightDelta)} tons of freight.`);
    }
    if (bulkNormalDelta !== 0) {
      parts.push(`${bulkNormalDelta > 0 ? 'Added' : 'Removed'} ${Math.abs(bulkNormalDelta)} tons of normal bulk life support.`);
    }
    if (bulkLuxuryDelta !== 0) {
      parts.push(`${bulkLuxuryDelta > 0 ? 'Added' : 'Removed'} ${Math.abs(bulkLuxuryDelta)} tons of luxury bulk life support.`);
    }
    for (const r of this._removedCargo) {
      parts.push(`Removed ${r.tons} tons of ${r.name} from goods.`);
    }
    for (const a of this._addedCargo) {
      parts.push(`Added ${a.tons} tons of ${a.name} to goods.`);
    }
    const paxLine = (delta, label) => {
      if (delta === 0) {
        return;
      }
      const verb = delta > 0 ? 'Took on' : 'Disembarked';
      const n = Math.abs(delta);
      parts.push(`${verb} ${n} ${label} berth passenger${n === 1 ? '' : 's'}.`);
    };
    paxLine(paxHighDelta, 'high');
    paxLine(paxMiddleDelta, 'middle');
    paxLine(paxLowDelta, 'low');

    const summary = `Other activity: ${parts.join(' ')}`;

    const result = {
      days,
      description,
      summary,
      newShipActorId,
      newCrew: this._crew,
      newCargo: this._cargo,
      creditsDelta,
      freightDelta,
      bulkNormalDelta,
      bulkLuxuryDelta,
      paxDelta: { high: paxHighDelta, middle: paxMiddleDelta, low: paxLowDelta },
    };
    if (this._resolve) {
      this._resolve(result);
      this._resolve = null;
    }
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
