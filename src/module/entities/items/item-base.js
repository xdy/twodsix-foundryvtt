import { TWODSIX } from '../../config';
import ItemTemplate from '../../utils/ItemTemplate';
import { confirmRollFormula, getDamageTypes } from '../../utils/sheetUtils';
import { applyAllStatusEffects, checkForDamageStat } from '../../utils/showStatusIcons';
import { TwodsixDiceRoll } from '../../utils/TwodsixDiceRoll';
import { TwodsixRollSettings } from '../../utils/TwodsixRollSettings';
import { assignDefaultImage } from '../../utils/utils';

/** @typedef {import("@common/documents/user.mjs").BaseUser} BaseUser */
/** @typedef {import("../../utils/TwodsixDiceRoll").TwodsixDiceRoll} TwodsixDiceRoll */
/** @typedef {import("../TwodsixActor").default} TwodsixActor */

/**
 * Extend the base Item entity
 * @extends {Item}
 */
export default class TwodsixItem extends Item {

  /**
   * Helper to centralize logic for triggering batched encumbrance/wounded status checks
   * when items are created or deleted.
   * @param {TwodsixActor} owningActor
   * @param {boolean} hasEffects
   * @param {string} itemType
   */
  static async _maybeTriggerItemStatusChecks(owningActor, hasEffects, itemType) {
    if (!owningActor || owningActor._applyingStatusEffects) {
      return;
    }
    const encumbranceCheck = game.settings.get('twodsix', 'useEncumbranceStatusIndicators') && owningActor.type === 'traveller';
    const woundedCheck = game.settings.get('twodsix', 'useWoundedStatusIndicators') && ["traveller", "animal", "robot"].includes(owningActor.type);
    const isRelevantItem = ![...TWODSIX.WeightlessItems, 'ship_position'].includes(itemType);
    if ((hasEffects || isRelevantItem) && (encumbranceCheck || woundedCheck)) {
      await applyAllStatusEffects(owningActor, {encumbrance: encumbranceCheck, wounded: woundedCheck});
    }
  }

  /**
   * @param {object} data
   * @param {object} options
   * @returns {Promise<TwodsixItem>}
   */
  static async create(data, options) {
    return await super.create(data, options);
  }

  /**
   * Returns the default icon path for this item type, or null for no override.
   * Subclasses override to provide a type-specific icon.
   * @returns {string|null}
   */
  _getDefaultIcon() {
    const cls = CONFIG.Item.documentClasses[this.type];
    if (cls && cls.prototype._getDefaultIcon !== TwodsixItem.prototype._getDefaultIcon) {
      return cls.prototype._getDefaultIcon.call(this);
    }
    return null;
  }

  /**
   * Resolves the skill, item, and working actor to use for a skill roll.
   * Subclasses override to provide type-specific resolution.
   * @param {object} [tmpSettings]
   * @returns {Promise<{skill: TwodsixItem|null, item: TwodsixItem|undefined, workingActor: TwodsixActor}>}
   */
  async _resolveSkillAndItem(tmpSettings) {
    const skill = this.system?.skill ? this.actor?.items.get(this.system.skill) ?? null : null;
    return { skill, item: this, workingActor: this.actor };
  }

  /**
   * Builds the roll settings object for a skill roll.
   * Subclasses override to inject type-specific difficulties.
   * @param {boolean} showThrowDialog
   * @param {TwodsixItem} skill
   * @param {TwodsixItem|undefined} item
   * @param {TwodsixActor} workingActor
   * @returns {Promise<TwodsixRollSettings>}
   */
  async _buildRollSettings(showThrowDialog, skill, item, workingActor) {
    return TwodsixRollSettings.create(showThrowDialog, {}, skill, item, workingActor);
  }

  /**
   * Perform preliminary operations before a Document of this type is created.
   * Pre-creation operations only occur for the client which requested the operation.
   * Modifications to the pending document before it is persisted should be performed with this.updateSource().
   * @param {object} data               The initial data object provided to the document creation request
   * @param {object} options            Additional options which modify the creation request
   * @param {BaseUser} user   The User requesting the document creation
   * @returns {Promise<boolean|void>}   A return value of false indicates the creation operation should be cancelled.
   */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) {
      return false;
    }

    const updates = {};
    assignDefaultImage(this, updates, data, this._getDefaultIcon());
    Object.assign(updates, {"system.type": this.type});
    await this.updateSource(updates);

    return allowed;
  }

  /**
   * Perform follow-up operations after an Item of this type is created.
   * If a `trait` with ActiveEffects is added to a traveller, ensure encumbrance is re-evaluated.
   * @param {object} data
   * @param {object} options
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async _onCreate(data, options, userId) {
    await super._onCreate(data, options, userId);
    if (game.user?.id === userId) {
      const owningActor = this.actor;
      if (owningActor) {
        const createdHasEffects = !!(data.effects && data.effects.length > 0);
        const createdType = data.type;
        await TwodsixItem._maybeTriggerItemStatusChecks(owningActor, createdHasEffects, createdType);
      }
    }
  }

  /**
   * Perform follow-up operations after a Document of this type is deleted.
   * If a `trait` with ActiveEffects is removed from a traveller, ensure encumbrance is re-evaluated.
   * @param {object} options
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async _onDelete(options, userId) {
    await super._onDelete(options, userId);
    if (game.user?.id === userId) {
      const owningActor = this.actor;
      if (owningActor) {
        const deletedHasEffects = !!(this.effects?.contents?.length > 0);
        const deletedType = this.type;
        await TwodsixItem._maybeTriggerItemStatusChecks(owningActor, deletedHasEffects, deletedType);
      }
    }
  }

  /**
   * Perform follow-up operations after a Document of this type is updated.
   * Post-update operations occur for all clients after the update is broadcast.
   * @param {object} changed            The differential data that was changed relative to the documents prior values
   * @param {object} options            Additional options which modify the update request
   * @param {string} userId             The id of the User requesting the document update
   * @see {Document#_onUpdate}
   */
  async _onUpdate(changed, options, userId) {
    await super._onUpdate(changed, options, userId);
    if (game.user?.id === userId) {
      const owningActor = this.actor;
      if (owningActor && game.settings.get('twodsix', 'useWoundedStatusIndicators')) {
        if (checkForDamageStat(changed, owningActor.type) && ["traveller", "animal", "robot"].includes(owningActor.type)) {
          await applyAllStatusEffects(owningActor, {encumbrance: false, wounded: true});
        }
      }
    }

    //Update item tab list if TL Changed
    if (game.settings.get('twodsix', 'showTLonItemsTab')) {
      if (this.isEmbedded || this.inCompendium) {
        return;
      } else if (changed.system?.techLevel) {
        ui.items.render();
      }
    }
  }

  /**
   * Augment the basic Item data model with additional dynamic data.
   * @returns {void}
   */
  prepareData() {
    super.prepareData();
    if (this.getFlag("twodsix", "untrainedSkill")) {
      this.name = game.i18n.localize("TWODSIX.Actor.Skills.Untrained");
    }
  }

  /**
   * Augment the basic item data with additional dynamic data.
   * @returns {void}
   */
  prepareDerivedData() {
    super.prepareDerivedData();
  }

  /**
   * @param {{name: string}} a
   * @param {{name: string}} b
   * @returns {number}
   */
  sortByName(a, b) {
    return a.name.localeCompare(b.name, game.i18n.lang, {sensitivity: 'base'});
  }

  /**
   * Prepares consumable and attachment item data linked to gear items.
   *
   * This method processes the consumables array associated with an item,
   * retrieving the actual item instances from the parent actor and separating
   * them into consumables and attachments based on their isAttachment flag.
   * Both arrays are sorted alphabetically by name.
   *
   * @function prepareConsumableData
   * @memberof TwodsixItem
   * @returns {void}
   */
  prepareConsumableData() {
    const gear = this.system;
    if (gear.consumables?.length > 0 && this.actor) {
      const allConsumables = gear.consumables
        .map(id => this.actor.items.get(id))
        .filter(item => item != null);
      gear.consumableData = allConsumables.filter((item) => !item?.system.isAttachment) ?? [];
      if (gear.consumableData.length > 0) {
        gear.consumableData.sort(this.sortByName);
      }
      gear.attachmentData = allConsumables.filter((item) => item?.system.isAttachment) ?? [];
      if (gear.attachmentData.length > 0) {
        gear.attachmentData.sort(this.sortByName);
      }
    } else {
      gear.consumableData = [];
      gear.attachmentData = [];
    }
  }

  /**
   * @param {string} consumableId
   * @param {object} [gear]
   * @returns {Promise<void>}
   */
  async addConsumable(consumableId, gear = this.system) {
    if (gear.consumables !== undefined) {
      if (gear.consumables.includes(consumableId)) {
        console.log(`Twodsix | Consumable already exists for item ${this.id}`);
      } else {
        await this.update({"system.consumables": gear.consumables.concat(consumableId)}, {});
      }
    } else {
      ui.notifications.error(`Twodsix | Consumable can't be added to item ${this.id}`);
    }
  }

  /**
   * @param {string} consumableId
   * @param {object} [gear]
   * @returns {Promise<void>}
   */
  async removeConsumable(consumableId, gear = this.system) {
    const updatedConsumables = gear.consumables.filter((cId) => {
      return (cId !== consumableId && cId !== null && this.actor?.items.get(cId) !== undefined);
    });
    const updateData = {"system.consumables": updatedConsumables};
    if (gear.useConsumableForAttack === consumableId) {
      updateData["system.useConsumableForAttack"] = "";
    }
    await this.update(updateData, {});
  }

  /**
   * Consumes ammunition for a weapon attack.
   * @param {TwodsixItem} itemUsed The item being used system data.
   * @param {number} usedAmmo The amount of ammunition to consume.
   * @returns {Promise<boolean>} Whether the ammunition was successfully consumed.
   */
  async consumeAmmo(itemUsed, usedAmmo) {
    const magazine = itemUsed.system.useConsumableForAttack ? this.actor?.items.get(itemUsed.system.useConsumableForAttack) : undefined;
    if (magazine) {
      try {
        await magazine.consume(usedAmmo);
      } catch (err) {
        if (err.name === "NoAmmoError") {
          ui.notifications.error("TWODSIX.Errors.NoAmmo", {localize: true});
        } else {
          console.error(`Error consuming ammo for weapon ${this.name}:`, err);
          throw err;
        }
        return false;
      }
    }
    return true;
  }

  /**
   * Perform a skill roll / check based on input settings.
   * @param {boolean} showThrowDialog  Whether to show roll/through dialog
   * @param {TwodsixRollSettings|undefined} tmpSettings Roll settings to use
   * @param {boolean} showInChat Whether to show attack in chat
   * @returns {TwodsixDiceRoll | void} Results of dice roll, if made
   */
  async skillRoll(showThrowDialog, tmpSettings, showInChat = true) {
    const { skill: resolvedSkill, item, workingActor } = await this._resolveSkillAndItem(tmpSettings);
    let skill = resolvedSkill;

    if (!skill) {
      if (!workingActor) {
        ui.notifications.error("TWODSIX.Errors.NoActorForSkillRoll", {localize: true});
        return;
      }
      skill = workingActor.getUntrainedSkill();
      if (!skill) {
        ui.notifications.error("TWODSIX.Errors.NoSkillForSkillRoll", {localize: true});
        return;
      }
    }

    if (!workingActor) {
      ui.notifications.error("TWODSIX.Errors.NoActorForSkillRoll", {localize: true});
      return;
    }

    //TODO Refactor. This is an ugly fix for weapon attacks, when settings are first created, then skill rolls are made, creating new settings, so multiplying bonuses.
    if (!tmpSettings) {
      tmpSettings = await this._buildRollSettings(showThrowDialog, skill, item, workingActor);
      if (!tmpSettings.shouldRoll) {
        return;
      }
    }

    /* Decrement the item's consumable by one if present and not a weapon (attack role handled separately)*/
    if (this.system.useConsumableForAttack && item?.type !== "weapon") {
      // Update consumables for use
      if (!(await this.consumeAmmo(item, 1))) {
        return;
      }
    }

    const diceRoll = new TwodsixDiceRoll(tmpSettings, workingActor, skill, item);
    await diceRoll.evaluateRoll();

    if (showInChat) {
      await diceRoll.sendToChat(tmpSettings.difficulties);
    }

    return diceRoll;
  }

  /**
   * Dialog to determine number of psi points used for action. Returns either a number or undefined (canceled points)
   * @param {number} diceRollEffect Results effect of psionic skill check
   * @returns {number|undefined} The number of psi points used or undefined if selection cancelled
   */
  async processPsiPoints(diceRollEffect) {
    let psiCost;
    if (diceRollEffect < 0) {
      psiCost = Math.min(1, this.system.psiCost);
    } else {
      try {
        psiCost = await foundry.applications.api.DialogV2.prompt({
          window: {title: "TWODSIX.Items.Psionics.PsiCost"},
          content: `<input name="psiCost" value="${this.system.psiCost}" type="number" min="1" max="10" step="1" autofocus>`,
          ok: {
            label: "TWODSIX.Items.Psionics.UsePoints",
            callback: (event, button /*, dialog*/) => Math.round(button.form.elements.psiCost.valueAsNumber)
          }
        });
      } catch {
        console.log("No psionic points selected");
        return;
      }

      if (isNaN(psiCost) || psiCost <= 0) {
        ui.notifications.warn("TWODSIX.Warnings.PsiUsageGTZero", {localize: true});
        return;
      }
    }
    await (this.actor).removePsiPoints(psiCost);
    return psiCost;
  }

  /**
   * Send item description to chat.
   * @returns {void}
   */
  sendDescriptionToChat() {
    const picture = this.img;
    const capType = game.i18n.localize(`TYPES.Item.${this.type}`).capitalize();
    let msg = `<div style="display: inline-flex;"><img src="${picture}" alt="" class="chat-image"></img><span style="align-self: center; text-align: center; padding-left: 1ch;"><strong>${capType}: ${this.name}</strong></span></div><div>${this.system["description"]}</div>`;
    if (this.system.features) {
      msg += `<div>${game.i18n.localize("TWODSIX.Items.Component.Features")}: ${this.system.features}</div>`;
    }
    ChatMessage.create({content: msg, speaker: ChatMessage.getSpeaker({actor: this.actor})});
  }

  /**
   * Send message to chat when using a psionic action.
   * @param {number} pointsUsed The number of psi points used for action
   * @param {string} messageMode The roll mode used, if any
   * @param {number} [rollEffect=0] the effect of the skill roll,used for damage calcs if necessary
   * @returns {Promise<void>}
   */
  async sendPsiUseToChat(pointsUsed, messageMode, rollEffect = 0) {
    const picture = this.img;
    const capType = game.i18n.localize(`TYPES.Item.${this.type}`).capitalize();
    let msg = `<div style="display: inline-flex;"><img src="${picture}" alt="" class="chat-image"></img><span style="padding-left: 1ch;">`
      + `${game.i18n.localize('TWODSIX.Items.Psionics.Used')} ${capType}: ${this.name}, ${pointsUsed} ${game.i18n.localize('TWODSIX.Items.Psionics.Pts')}</span></div>`;
    if (!game.settings.get("twodsix", "automateDamageRollOnHit") && this.system.damage !== "" && this.system.damage !== "0" && pointsUsed > 0 && rollEffect >= 0) {
      msg += `<section class="card-buttons"><button type="button" data-action="damage" data-tooltip="${game.i18n.localize("TWODSIX.Rolls.RollDamage")}"><i class="fa-solid fa-person-burst" style="margin-left: 3px;"></i></button></section>`;
    }

    const flags = {
      "core.canPopout": true,
      "twodsix.itemUUID": this.uuid ?? "",
      "twodsix.tokenUUID": this.actor?.token?.uuid ?? "",
      "twodsix.actorUUID": this.actor?.uuid ?? "",
      "twodsix.bonusDamage": "",
      "twodsix.effect": rollEffect
    };

    const messageContent = {
      content: msg,
      flags: flags,
      speaker: ChatMessage.getSpeaker({actor: this.actor})
    };

    if (messageMode !== 'public') {
      const showToUsers = game.users.filter((user) => user.isGM || (game.userId === user.id));
      Object.assign(messageContent, {whisper: showToUsers});
    }

    await ChatMessage.create(messageContent);
  }

  /**
   * Handle skill and talent rolls.
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @param {object} [tmpSettings]
   * @returns {Promise<void>}
   */
  async doSkillTalentRoll(showThrowDiag, tmpSettings) {
    await this.skillRoll(showThrowDiag, tmpSettings);
  }

  /**
   * Handle psionic ability / talent.
   * @param {boolean} showThrowDiag  Whether to show the throw dialog or not
   * @returns {Promise<void>}
   */
  async doPsiAction(showThrowDiag) {
    let psiCost;
    let rollEffect = 0;
    let messageMode = "gm";
    if ((this.actor).system.characteristics.psionicStrength.current <= 0) {
      ui.notifications.warn("TWODSIX.Warnings.NoPsiPoints", {localize: true});
    } else {
      await this.drawItemTemplate();
      if (!game.settings.get('twodsix', 'psiTalentsRequireRoll')) {
        psiCost = await this.processPsiPoints(0);
      } else {
        const diceRoll = await this.skillRoll(showThrowDiag);
        if (diceRoll) {
          messageMode = diceRoll.rollSettings.messageMode;
          rollEffect = diceRoll.effect;
          psiCost = await this.processPsiPoints(rollEffect);
        } else {
          return;
        }
      }

      if (psiCost !== undefined) {
        await this.sendPsiUseToChat(psiCost, messageMode, rollEffect);

        // Roll damage and post, if necessary
        if (this.system.damage !== "" && this.system.damage !== "0" && game.settings.get("twodsix", "automateDamageRollOnHit") && rollEffect >= 0) {
          const bonusDamage = game.settings.get("twodsix", "addEffectToDamage") && rollEffect !== 0 ? ` ${rollEffect}` : ``;
          const damagePayload = await this.rollDamage(messageMode || game.settings.get('core', 'messageMode'), bonusDamage, true, showThrowDiag, rollEffect);
          if (damagePayload?.damageValue > 0) {
            const targetTokens = Array.from(game.user.targets);
            if (targetTokens.length > 0) {
              await (targetTokens[0].actor).handleDamageData(damagePayload, !game.settings.get('twodsix', 'autoDamageTarget'));
            }
          }
        }
      }
    }
  }

  /**
   * @param {string} messageMode
   * @param {string} [bonusDamage=""]
   * @param {boolean} [showInChat=true]
   * @param {boolean} [confirmFormula=false]
   * @param {number} [effect=0]
   * @returns {Promise<object | undefined>}
   */
  async rollDamage(
    messageMode,
    bonusDamage = "",
    showInChat = true,
    confirmFormula = false,
    effect = 0
  ) {
    const consumableDamage = this.getConsumableBonusDamage();
    if (!this.system.damage && !consumableDamage) {
      ui.notifications.warn("TWODSIX.Warnings.NoDamageForWeapon", {localize: true});
      return;
    } else {
      //Calc regular damage
      let rollFormula = this.system.damage + ((bonusDamage !== "0" && bonusDamage !== "") ? " + " + bonusDamage : "") + (consumableDamage != "" ? " + " + consumableDamage : "");
      //console.log(rollFormula);
      if (confirmFormula) {
        rollFormula = await confirmRollFormula(rollFormula, game.i18n.localize("TWODSIX.Damage.DamageFormula"));
      }
      rollFormula = rollFormula.replace(/dd/ig, "d6*10"); //Parse for a destructive damage roll DD = d6*10
      //rollFormula = simplifyRollFormula(rollFormula, { preserveFlavor: true });

      let damage = {};
      let apValue = 0;
      if (Roll.validate(rollFormula)) {
        damage = new Roll(rollFormula, this.actor?.getRollData());
        await damage.evaluate();
        apValue += this.getValueFromRollFormula("armorPiercing");
        apValue += this.getConsumableBonus("armorPiercing");
      } else {
        ui.notifications.error("TWODSIX.Errors.InvalidRollFormula", {localize: true});
        return;
      }

      //Calc radiation damage
      let radDamage = {};
      if (this.type === "component") {
        if (Roll.validate(this.system.radDamage)) {
          const radFormula = this.system.radDamage.replace(/dd/ig, "d6*10"); //Parse for a destructive damage roll DD = d6*10
          //radFormula = simplifyRollFormula(radFormula);
          radDamage = new Roll(radFormula, this.actor?.getRollData());
          await radDamage.evaluate();
        }
      }

      //Determine Damage type
      let damageType = this.getConsumableDamageType();
      if (damageType === '' || damageType === "NONE") {
        damageType = this.system.damageType ?? "NONE"; //component doesn't have a specified damage type
      }
      const damageLabels = getDamageTypes(true);

      //Determine Ship Weapon Label
      let shipWeaponType = "";
      let shipWeaponLabel = "";
      const isArmament = (this.type === 'component' && this.system?.isWeapon);
      if (isArmament) {
        shipWeaponType = this.system.shipWeaponType || "";
        shipWeaponLabel = TWODSIX.ShipWeaponTypes[game.settings.get('twodsix', 'shipWeaponType')][this.system.shipWeaponType] || "unknown";
      }

      const contentData = {};
      const flavor = `${game.i18n.localize("TWODSIX.Rolls.DamageUsing")} ${this.name}`;
      const canBeBlocked = game.settings.get('twodsix', 'ruleset') === 'CU' && damageType === 'melee';
      const canBeParried = canBeBlocked && ['personal', 'close'].includes(this.system.rangeBand);
      Object.assign(contentData, {
        flavor: flavor,
        roll: damage,
        dice: getDiceResults(damage), //damage.terms[0]["results"]
        armorPiercingValue: apValue,
        damageValue: (damage.total && damage.total > 0) ? damage.total : 0,
        damageType: damageType,
        damageLabel: damageLabels[damageType] || "",
        canBeParried: canBeParried,
        canBeBlocked: canBeBlocked,
        shipWeaponType: shipWeaponType,
        shipWeaponTypeLabel: shipWeaponLabel,
        isArmament: isArmament,
        effect: effect
      });

      if (radDamage.total) {
        Object.assign(contentData, {
          radDamage: radDamage.total,
          radRoll: radDamage,
          radDice: getDiceResults(radDamage)
        });
      }
      if (showInChat) {
        const html = await foundry.applications.handlebars.renderTemplate('systems/twodsix/templates/chat/damage-message.hbs', contentData);
        const transfer = JSON.stringify(
          {
            type: 'damageItem',
            payload: contentData
          }
        );
        await damage.toMessage({
          title: game.i18n.localize("TWODSIX.Damage.DamageCard"),
          speaker: this.actor ? ChatMessage.getSpeaker({actor: this.actor}) : null,
          content: html,
          style: CONST.CHAT_MESSAGE_STYLES.OTHER,
          flags: {
            "core.canPopout": true,
            "twodsix.transfer": transfer,
            "twodsix.itemUUID": this.uuid,
            "twodsix.rollClass": "Damage",
            "twodsix.tokenUUID": (this.actor)?.getActiveTokens()[0]?.document.uuid ?? "",
            "twodsix.actorUUID": (this.actor)?.uuid ?? ""
          }
        }, {messageMode: messageMode});
      }
      return contentData;
    }
  }

  /**
   * @returns {string}
   */
  getConsumableBonusDamage() {
    let returnValue = "";
    if (this.system.useConsumableForAttack && this.actor) {
      const magazine = this.actor.items.get(this.system.useConsumableForAttack);
      if (magazine?.type === "consumable") {
        returnValue = (magazine.system)?.bonusDamage;
      }
    }
    return returnValue;
  }

  /**
   * @param {string} key
   * @returns {number}
   */
  getConsumableBonus(key) {
    let returnValue = 0;
    if (this.system.attachmentData) {
      for (const attach of this.system.attachmentData) {
        if (!attach.system.isSoftware || attach.system.softwareActive) {
          if (foundry.utils.hasProperty(attach.system, key)) {
            if (typeof attach.system[key] === 'number') {
              returnValue += attach.system[key];
            } else {
              returnValue += (attach).getValueFromRollFormula(key);
            }
          }
        }
      }
    }
    if (this.system.useConsumableForAttack && this.actor) {
      const magazine = this.actor.items.get(this.system.useConsumableForAttack);
      if (magazine?.type === "consumable") {
        if (foundry.utils.hasProperty(magazine.system, key)) {
          if (typeof magazine.system[key] === 'number') {
            returnValue += magazine.system[key];
          } else {
            returnValue += (magazine).getValueFromRollFormula(key);
          }
        }
      }
    }
    return returnValue;
  }

  /**
   * @returns {string}
   */
  getConsumableDamageType() {
    let returnValue = "";
    if (this.system.useConsumableForAttack && this.actor) {
      const magazine = this.actor.items.get(this.system.useConsumableForAttack);
      returnValue = magazine ? magazine.system.damageType : "NONE";
    }
    return returnValue;
  }

  /**
   * A method for drawing a measured template for an item action - accounting for consumables
   * having attachements with AOE's
   * @returns {Promise<boolean>}
   */
  async drawItemTemplate() {
    let returnValue = false;
    const magazine = this.system.useConsumableForAttack ? this.actor?.items.get(this.system.useConsumableForAttack) : undefined;
    const itemForAOE = (magazine?.system.target.type !== "none" && magazine) ? magazine : this;
    if (itemForAOE.system.target?.type !== "none") {
      returnValue = true;
      try {
        const itemTemplate = await ItemTemplate.fromItem(itemForAOE);
        if (itemTemplate) {
          const regionDoc = await itemTemplate.drawPreview();
          if (regionDoc && game.settings.get('twodsix', 'autoTargetAOE')) {
            ItemTemplate.targetTokensForPlacedRegion(regionDoc);
          }
        } else {
          console.error("Failed to create ItemTemplate from item:", itemForAOE);
        }
      } catch (err) {
        ui.notifications.error("TWODSIX.Errors.CantPlaceTemplate", {localize: true});
        console.log("Template error: ", err);
      }
    }
    return returnValue;
  }

  /**
   * A method for getting a value from an item's roll formula
   * @param {string} key The item.system object key for the formula
   * @returns {number} The deterministic value as a number from a roll formula
   */
  getValueFromRollFormula(key) {
    let returnValue = 0;
    if (foundry.utils.hasProperty(this.system, key)) {
      if (Roll.validate(this.system[key])) {
        try {
          const replacedFormula = Roll.replaceFormulaData(this.system[key], this.actor?.getRollData(), {
            missing: "0",
            warn: true
          });
          returnValue += replacedFormula ? Roll.safeEval(replacedFormula) : 0;
        } catch (error) {
          console.log('Invalid formula', error);
          ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.InvalidFormula") + this.name);
        }
      }
    }
    return returnValue;
  }

  /**
   * Checks if this component is a J-Drive (Jump Drive) based on name and label settings.
   * @returns {boolean}
   */
  isJDriveComponent() {
    return false;
  }

  /**
   * Checks if this component is an M-Drive (Maneuver Drive) based on name and label settings.
   * @returns {boolean}
   */
  isMDriveComponent() {
    return false;
  }
}

/**
 * Handle clickable damage rolls.
 * @param {Event} ev   The originating click event
 * @param {HTMLElement} target The clicked html element
 * @returns {Promise<void>}
 */
export async function onRollDamage(ev, target) {
  ev.preventDefault();
  ev.stopPropagation();
  if (!this.actor.isOwner) {
    ui.notifications.warn("TWODSIX.Warnings.LackPermissionToRoll", {localize: true});
    return;
  }
  const itemId = target.closest('.item').dataset.itemId;
  let item = this.actor.items.get(itemId);

  //Replace damage item for linked ammo on a ship component
  if (item.system.isArmament && item.system.ammoLink && item.system.ammoLink !== "none") {
    const linkedAmmo = this.actor.items.get(item.system.ammoLink);
    if (linkedAmmo) {
      item = linkedAmmo;
    }
  }

  const bonusDamageFormula = target.closest('.item').dataset.bonusDamage ?? "";

  const useInvertedShiftClick = (game.settings.get('twodsix', 'invertSkillRollShiftClick'));
  const showFormulaDialog = useInvertedShiftClick ? ev["shiftKey"] : !ev["shiftKey"];

  await item.rollDamage(item.type === 'psiAbility' ? "gmroll" : game.settings.get('core', 'messageMode'), bonusDamageFormula, true, showFormulaDialog);

}

/**
 * A function for simplifying the dice results of a multipart roll formula.
 *
 * @param {Roll} inputRoll    The original roll.
 * @returns {object[]}        The resulting simplified dice terms.
 */
export function getDiceResults(inputRoll) {
  const returnValue = [];
  for (const die of inputRoll.dice) {
    returnValue.push(die.results);
  }
  return returnValue.flat(2);
}

/**
 * A function for getting a value from a roll string.
 *
 * @param {string} rollFormula    The original roll. It must be deterministic
 * @param {TwodsixItem } item     Item making the roll
 * @returns {number}              The resulting roll value.
 */
export function getValueFromRollFormula(rollFormula, item) {
  let returnValue = 0;
  if (Roll.validate(rollFormula)) {
    try {
      returnValue = Roll.safeEval(Roll.replaceFormulaData(rollFormula, item.actor?.getRollData(), {
        missing: "0",
        warn: true
      })) ?? 0;
    } catch (error) {
      console.log('Invalid formula', error);
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.InvalidFormula") + item.name);
    }
  }
  return returnValue;
}
