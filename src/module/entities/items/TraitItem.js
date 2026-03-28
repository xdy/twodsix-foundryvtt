import { applyAllStatusEffects } from '../../utils/showStatusIcons';
import TwodsixItem from './item-base.js';

/**
 * Document class for trait item type.
 * Traits are weightless but carry ActiveEffects; changes to effects trigger encumbrance re-evaluation.
 * @extends {TwodsixItem}
 */
export class TraitItem extends TwodsixItem {

  /** @override */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
    if (game.user?.id === userId) {
      const owningActor = this.actor;
      if (owningActor && game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && owningActor.type === 'traveller' && !options?.dontSync) {
        if (changed.effects) {
          await applyAllStatusEffects(owningActor, {encumbrance: true, wounded: false});
        }
      }
    }
  }
}
