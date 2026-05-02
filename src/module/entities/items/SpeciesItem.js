import TwodsixItem from './item-base.js';

/**
 * Document class for `species` item type. Represents an ancestry/alien species attached to an actor.
 *
 * Enforces single-species-per-actor on `_preCreate` and syncs `actor.system.species` to the item
 * name on create/delete (the string field already exists at `TravellerData.species`).
 *
 * @extends {TwodsixItem}
 */
export class SpeciesItem extends TwodsixItem {

  /** @override */
  _getDefaultIcon() {
    return 'icons/svg/mystery-man.svg';
  }

  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) {
      return false;
    }
    const owningActor = this.actor;
    if (owningActor && Array.isArray(owningActor.items?.contents)) {
      const existing = owningActor.items.find(i => i.type === 'species' && i !== this);
      if (existing) {
        ui.notifications?.warn(
          game.i18n.format('TWODSIX.Items.Species.AlreadyHasSpecies', { name: existing.name })
        );
        return false;
      }
    }
    return allowed;
  }

  /** @override */
  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);
    if (game.user?.id !== userId) {
      return;
    }
    const owningActor = this.actor;
    if (owningActor && owningActor.type === 'traveller') {
      try {
        await owningActor.update({ 'system.species': this.name ?? '' });
      } catch (err) {
        console.warn('twodsix | SpeciesItem _onCreate: failed to sync actor.system.species.', err);
      }
    }
  }

  /** @override */
  async _onDelete(options, userId) {
    // Capture owning actor BEFORE super._onDelete() detaches the item from its parent.
    // super._onDelete() must run for ALL clients (it handles the DB deletion);
    // only the originating client syncs `system.species` back to the actor.
    const owningActor = this.actor;
    await super._onDelete(options, userId);
    if (game.user?.id !== userId) {
      return;
    }
    if (owningActor && owningActor.type === 'traveller') {
      try {
        await owningActor.update({ 'system.species': '' });
      } catch (err) {
        console.warn('twodsix | SpeciesItem _onDelete: failed to clear actor.system.species.', err);
      }
    }
  }

  /** @override */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
    if (game.user?.id !== userId) {
      return;
    }
    const owningActor = this.actor;
    if (owningActor && owningActor.type === 'traveller' && changed.name !== undefined) {
      try {
        await owningActor.update({ 'system.species': this.name ?? '' });
      } catch (err) {
        console.warn('twodsix | SpeciesItem _onUpdate: failed to sync actor.system.species.', err);
      }
    }
  }
}
