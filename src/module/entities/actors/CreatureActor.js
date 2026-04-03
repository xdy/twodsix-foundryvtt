import { getDamageCharacteristics } from '../../utils/actorDamage';
import { applyAllStatusEffects } from '../../utils/showStatusIcons';
import { simplifySkillName } from '../../utils/utils';
import TwodsixActor, { isEncumbranceChange } from './actor-base.js';

/** @typedef {import("../TwodsixItem").default} TwodsixItem */

/**
 * Intermediate base class for independent actor types: traveller, animal, robot.
 * Holds shared logic for all three types.
 * @extends {TwodsixActor}
 */
export class CreatureActor extends TwodsixActor {

  async _preCreate(data, options, userId) {
    const allowed = await super._preCreate(data, options, userId);
    if (allowed === false) {
      return false;
    }

    const updates = {
      system: {
        movement: {
          walk: this.system.movement.walk || game.settings.get("twodsix", "defaultMovement"),
          units: this.system.movement.units || game.settings.get("twodsix", "defaultMovementUnits")
        }
      }
    };

    // Setup Hits
    const hitsCharacteristics = getDamageCharacteristics(this.type);
    const newHits = Object.entries(this.system.characteristics).reduce((hits, [key, chr]) => {
      if (hitsCharacteristics.includes(key)) {
        hits.value += chr.value - chr.damage;
        hits.max += chr.value;
      }
      return hits;
    }, {value: 0, max: 0, lastDelta: 0});

    foundry.utils.mergeObject(updates, {
      system: {
        hits: {
          value: newHits.value,
          max: newHits.max
        }
      }
    });

    // Allow subclasses to inject type-specific data into updates
    this._applyPreCreateTypeData(updates);

    // Add standard embedded items
    const items = [...(data.items || [])];
    const untrainedSkillData = this.createUntrainedSkillData();
    if (untrainedSkillData) {
      items.push(untrainedSkillData);
      foundry.utils.mergeObject(updates, {system: {untrainedSkill: untrainedSkillData._id}});
    }
    if (game.settings.get("twodsix", "autoAddUnarmed")) {
      const unarmedData = this.createUnarmedData();
      if (unarmedData) {
        unarmedData.system.skill = unarmedData.system.skill || untrainedSkillData?._id || "";
        items.push(unarmedData);
      }
    }

    if (items.length > 0) {
      Object.assign(updates, {items: items});
    }

    await this.updateSource(updates);

    return allowed;
  }

  /**
   * Returns the default image path for this actor type. Subclasses override this.
   * @returns {string}
   */
  _getDefaultImage() {
    return foundry.documents.BaseActor.DEFAULT_ICON;
  }

  /**
   * Hook for subclasses to inject type-specific data into _preCreate changeData.
   * @param {object} changeData
   * @returns {void}
   */
  _applyPreCreateTypeData(changeData) {
    // Base independent: no extra data. Subclasses override.
  }

  /** @override */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);

    if (data?.system?.characteristics) {
      const charDiff = foundry.utils.diffObject(this.system._source.characteristics, data.system.characteristics);
      if (!foundry.utils.isEmpty(charDiff)) {
        const deltaHits = this.getDeltaHits(charDiff);
        if (deltaHits !== 0) {
          Object.assign(options, {deltaHits: deltaHits});
          if (game.modules.get('splatter')?.active) {
            const newHits = Math.clamp((this.system.hits.value - deltaHits), 0, this.system.hits.max);
            foundry.utils.mergeObject(data, {'system.hits.value': newHits});
          }
        }
      }
    }

    return allowed;
  }

  /** @override */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);

    if (this._applyingStatusEffects) {
      return;
    }

    if (options.diff && game.user?.id === userId) {
      const needsEncumbranceCheck = game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && isEncumbranceChange(changed) && this._hasEncumbranceTracking();
      const needsWoundedCheck = !!options.deltaHits && game.settings.get('twodsix', 'useWoundedStatusIndicators');

      if (needsEncumbranceCheck || needsWoundedCheck) {
        await applyAllStatusEffects(this, {encumbrance: needsEncumbranceCheck, wounded: needsWoundedCheck});
      }
    }

    if (options.deltaHits && this.isOwner) {
      this.scrollDamage(options.deltaHits);
    }
  }

  /**
   * Whether this actor type tracks encumbrance status.
   * Reads the static `hasEncumbranceTracking` flag from the datamodel class.
   * @returns {boolean}
   */
  _hasEncumbranceTracking() {
    return this.system.constructor.hasEncumbranceTracking ?? false;
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    this._prepareActorDerivedData();
  }

  /** @override */
  async _prepareActorDerivedData() {
    const {system} = this;

    // Guard against missing system data during ActorDelta initialization
    if (!system.characteristics || !system.hits || !system.encumbrance) {
      return;
    }

    // Update hits
    const newHitsValue = this.getCurrentHits(system.characteristics);
    this.system.hits.value = newHitsValue.value;
    this.system.hits.max = newHitsValue.max;

    // Calculate encumbrance.value before AE passes (so AEs can modify it)
    system.encumbrance.value = this.getActorEncumbrance();

    // Second pass: apply non-CUSTOM effects to derived fields
    this.applyActiveEffects("derived");

    // Third pass: apply all CUSTOM mode effects
    this.applyActiveEffects("custom");

    // Clear any override for encumbrance.max from previous passes before recalculating
    if (this.overrides.system?.encumbrance?.max !== undefined) {
      delete this.overrides.system.encumbrance.max;
    }
    // Calculate encumbrance max
    system.encumbrance.max = this.getMaxEncumbrance(true);

    // Fourth pass: final override for encumbrance.max
    this.applyActiveEffects("encumbMax");
  }

  /** @override */
  async healActor(healing, dice) {
    if (!game.settings.get('twodsix', 'autoDamageTarget')) {
      const healingData = {};
      Object.assign(healingData, {
        healingId: "healing-" + foundry.utils.randomID(),
        actor: this,
        targetUuid: this.uuid,
        healingValue: healing,
        dice: dice
      });
      game.socket?.emit("system.twodsix", ["createHealingDialog", healingData]);
      Hooks.call('createHealingDialog', healingData);
    } else {
      let damageCharacteristics = [];
      if (game.settings.get('twodsix', 'reverseHealingOrder')) {
        damageCharacteristics = getDamageCharacteristics(this.type).reverse();
      } else {
        damageCharacteristics = getDamageCharacteristics(this.type);
      }
      const charArray = {};
      for (const characteristic of damageCharacteristics) {
        const cur_damage = this.system.characteristics[characteristic].damage;

        if (cur_damage > 0) {
          const new_damage = Math.max(0, cur_damage - healing);
          const char_id = 'system.characteristics.' + characteristic + '.damage';
          charArray[char_id] = new_damage;
          healing -= cur_damage - new_damage;
        }

        if (healing < 1) {
          break;
        }
      }
      await this.update(charArray);
    }
  }

  /** @override */
  async handleDamageData(damagePayload, showDamageDialog) {
    if (!this.isOwner && !showDamageDialog) {
      ui.notifications.error("TWODSIX.Warnings.LackPermissionToDamage", {localize: true});
      return false;
    }
    await this.damageActor(damagePayload, (this.isOwner ? showDamageDialog : true));
    return true;
  }

  /** @override */
  getDerivedDataKeys() {
    const derivedData = [];
    // Add characteristics mods
    for (const char of Object.keys(this.system.characteristics)) {
      derivedData.push(`characteristics.${char}.mod`);
    }
    // Add skills
    for (const skill of this.itemTypes.skills) {
      derivedData.push(`skills.${simplifySkillName(skill.name)}`);
    }
    return [...new Set(derivedData)];
  }

  /** @override */
  getSecondaryProtectionValue(damageType) {
    if (damageType !== "NONE" && damageType !== "" && damageType) {
      if (this.system.secondaryArmor?.protectionTypes?.includes(damageType)) {
        return this.system.secondaryArmor.value;
      }
    }
    return 0;
  }

  /** @override */
  async modifyTokenAttribute(attribute, value, isDelta, isBar) {
    if (attribute === "hits") {
      const hits = foundry.utils.getProperty(this.system, attribute);
      const delta = isDelta ? (-1 * value) : (hits.value - value);
      if (delta > 0) {
        this.damageActor({
          damageValue: delta,
          armorPiercingValue: 9999,
          damageType: "NONE",
          damageLabel: "NONE",
          canBeParried: false
        }, false);
        return;
      } else if (delta < 0) {
        this.healActor(-delta);
        return;
      }
    }
    return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
  }
}
