/** @typedef {import("../entities/TwodsixActor").default} TwodsixActor */

import { CONSUMABLE_SUBTYPES, TWODSIX } from '../config';
import { ConsumableData } from '../data/items/consumableData.js';
import { TwodsixActiveEffect } from '../entities/TwodsixActiveEffect';
import TwodsixItem from '../entities/TwodsixItem';
import {
  addPDFLink,
  changeReference,
  deletePDFLink,
  deleteReference,
  getConsumableOptions,
  getDamageTypes,
  getDifficultiesSelectObject,
  getRangeTypes,
  getRollTypeSelectObject,
  openJournalEntry,
  openPDFLink
} from '../utils/sheetUtils';
import { AbstractTwodsixItemSheet, onPasteStripFormatting } from './AbstractTwodsixItemSheet';

/**
 * Extend the basic AbstractTwodsixItemSheet
 * @extends {AbstractTwodsixItemSheet}
 */
export class TwodsixItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixItemSheet) {

  /** @override */
  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixItemSheet",
    classes: ["twodsix", "sheet", "item"],
    dragDrop: [{dropSelector: null, dragSelector: ".consumable"}],
    position: {
      width: 700,
      height: 900
    },
    window: {
      resizable: true
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      createConsumable: this._onCreateConsumable,
      createAttachment: this._onCreateAttachment,
      editConsumable: this._onEditConsumable,
      deleteConsumable: this._onDeleteConsumable,
      editActiveEffect: this._onEditEffect,
      createActiveEffect: this._onCreateEffect,
      deleteActiveEffect: this._onDeleteEffect,
      openPDFLink: openPDFLink,
      deletePDFLink: deletePDFLink,
      addPDFLink: addPDFLink,
      openJournalEntry: openJournalEntry,
      deleteReference: deleteReference
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "", //systems/twodsix/templates/items/item-sheet.hbs
      scrollable: ['']
    }
  };

  static TABS = {
    primary: {
      tabs: [
        {id: "description", icon: "fa-solid fa-book", label: "TWODSIX.Items.Equipment.Description"},
        {id: "modifiers", icon: "fa-solid fa-dice", label: "TWODSIX.Items.Weapon.Modifiers"},
        {id: "attack", icon: "fa-solid fa-burst", label: "TWODSIX.Items.Weapon.Attack"},
        {id: "magazine", icon: "fa-solid fa-battery-full", label: "TWODSIX.Items.Weapon.Consumables"},
        {id: "displacement", icon: "fa-solid fa-weight-hanging", label: "TWODSIX.Items.Component.Displacement"},
        {id: "power", icon: "fa-solid fa-bolt", label: "TWODSIX.Items.Component.Power"},
        {id: "price", icon: "fa-solid fa-coins", label: "TWODSIX.Items.Component.Price"},
        {id: "career", icon: "fa-solid fa-briefcase", label: "TWODSIX.Items.Career.Career"},
        {id: "chargenRuleset", icon: "fa-solid fa-table-list", label: "TWODSIX.Items.ChargenRuleset.ChargenRuleset"}
      ],
      initial: "description"
    }
  };

  /**
   * @returns {Promise<void>}
   */
  static async _onCreateEffect() {
    if (this.actor?.type === "ship" || this.actor?.type === "vehicle") {
      ui.notifications.warn("TWODSIX.Warnings.CantEditCreateInCargo", {localize: true});
    } else {
      const newId = foundry.utils.randomID();
      if (game.settings.get('twodsix', 'useItemActiveEffects')) {
        if (await fromUuid(this.item.uuid)) {
          TwodsixActiveEffect.create({
            icon: this.item.img,
            tint: "#ffffff",
            name: this.item.name,
            description: "",
            transfer: game.settings.get('twodsix', "useItemActiveEffects"),
            disabled: false,
            _id: newId
          }, {renderSheet: true, parent: this.item});
        } else {
          ui.notifications.warn("TWODSIX.Warnings.CantCreateEffect", {localize: true});
        }
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  static async _onEditEffect() {
    if (this.actor?.type === "ship" || this.actor?.type === "vehicle") {
      ui.notifications.warn("TWODSIX.Warnings.CantEditCreateInCargo", {localize: true});
    } else if (await fromUuid(this.item.uuid)) {
      const editSheet = await this.item.effects.contents[0].sheet?.render({force: true});
      try {
        editSheet?.bringToFront();
      } catch (err) {
        console.log(err);
      }
    } else {
      ui.notifications.warn("TWODSIX.Warnings.CantEditEffect", {localize: true});
    }
  }

  /**
   * @returns {Promise<void>}
   */
  static async _onDeleteEffect() {
    if (await foundry.applications.api.DialogV2.confirm({
      window: {title: game.i18n.localize("TWODSIX.ActiveEffects.DeleteEffect")},
      content: game.i18n.localize("TWODSIX.ActiveEffects.ConfirmDelete")
    })) {
      if (await fromUuid(this.item.uuid)) {
        await this.item.deleteEmbeddedDocuments('ActiveEffect', [], {deleteAll: true});
        if (this.item.actor) {
          this.item.actor.sheet.render(false);
        }
      } else {
        ui.notifications.warn("TWODSIX.Warnings.CantDeleteEffect", {localize: true});
      }
    }
  }

  /**
   * @param {Event} event
   * @param {HTMLElement} target
   * @returns {void}
   */
  static _onEditConsumable(event, target) {
    this.getConsumable(target)?.sheet?.render({force: true});
  }

  /**
   * @param {Event} event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async _onDeleteConsumable(event, target) {
    const consumable = this.getConsumable(target);
    if (!consumable) {
      await (this.item).removeConsumable("");
    } else {
      const body = game.i18n.localize("TWODSIX.Items.Consumable.RemoveConsumableFrom").replace("_CONSUMABLE_NAME_", consumable.name).replace("_ITEM_NAME_", this.item.name);

      if (await foundry.applications.api.DialogV2.confirm({
        window: {title: game.i18n.localize("TWODSIX.Items.Consumable.RemoveConsumable")},
        content: body,
      })) {
        if (consumable && consumable.id) {
          await (this.item).removeConsumable(consumable.id);
          this.render();
        }
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  static async _onCreateConsumable/*event, target*/() {
    if (!this.item.isOwned) {
      console.error(`Twodsix | Consumables can only be created for owned items`);
      return;
    }
    const template = 'systems/twodsix/templates/items/dialogs/create-consumable.hbs';
    const consumablesList = foundry.utils.duplicate(TWODSIX.CONSUMABLES);
    if (this.item.type === "computer" || (this.item.type === "consumable" && this.item.system.isAttachmentType)) {
      delete consumablesList[CONSUMABLE_SUBTYPES.PROCESSOR];
      delete consumablesList[CONSUMABLE_SUBTYPES.SUITE];
    }
    const html = await foundry.applications.handlebars.renderTemplate(template, {
      consumables: consumablesList
    });
    new foundry.applications.api.DialogV2({
      window: {title: `${game.i18n.localize("TWODSIX.Items.Items.New")} ${game.i18n.localize("TWODSIX.itemTypes.consumable")}`},
      content: html,
      buttons: [
        {
          action: "ok",
          label: "TWODSIX.Create",
          default: true,
          callback: async (event, button, dialog) => {
            const dialogElement = dialog.element;
            const max = parseInt(dialogElement.querySelector('.consumable-max')?.value, 10) || 0;
            let equippedState = "";
            if (this.item.type !== "skills" && this.item.type !== "trait" && this.item.type !== "ship_position") {
              equippedState = this.item.system.equipped ?? "backpack";
            }
            const newConsumableData = {
              name: dialogElement.querySelector('.consumable-name')?.value || game.i18n.localize("TYPES.Item.consumable"),
              type: "consumable",
              system: {
                subtype: dialogElement.querySelector('.consumable-subtype')?.value,
                quantity: parseInt(dialogElement.querySelector('.consumable-quantity')?.value, 10) || 0,
                currentCount: max,
                max: max,
                equipped: equippedState,
                isAttachment: ConsumableData.constraintsForSubtype(dialogElement.querySelector('.consumable-subtype')?.value).isAttachmentType && this.item.type !== "consumable",
                parentName: this.item.name,
                parentType: this.item.type
              }
            };
            const newConsumable = await this.item.actor?.createEmbeddedDocuments("Item", [newConsumableData]);
            if (newConsumable) {
              await (this.item).addConsumable(newConsumable[0].id);
              this.render();
            }
          }
        },
        {
          action: "cancel",
          label: "Cancel"
        }
      ]
    }).render({force: true});
  }

  /**
   * @returns {Promise<void>}
   */
  static async _onCreateAttachment() {
    const newConsumableData = {
      name: game.i18n.localize("TWODSIX.Items.Equipment.NewAttachment"),
      type: "consumable",
      system: {
        subtype: "other",
        quantity: 1,
        isAttachment: true,
        parentName: this.item.name,
        parentType: this.item.type
      }
    };
    const newConsumable = (await this.item.actor?.createEmbeddedDocuments("Item", [newConsumableData])) || {};
    await (this.item).addConsumable(newConsumable[0].id);
    this.render();
  }

  /* -------------------------------------------- */
  /**
   * @inheritDoc
   * @param {object} options
   * @returns {object}
   */
  _configureRenderParts(options) {
    let parts = super._configureRenderParts(options);
    const path = "systems/twodsix/templates/items";
    parts = foundry.utils.mergeObject(parts, {"main.template": `${path}/${this.item.type}-sheet.hbs`});
    return parts;
  }

  /**
   * @inheritDoc
   * @param {object} options
   * @returns {object}
   */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    applicationOptions.window.icon = getItemIcon(applicationOptions.document.type);
    return applicationOptions;
  }

  /* -------------------------------------------- */

  /**
   * @override
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Add relevant data from system settings
    context.settings = {
      ShowLawLevel: game.settings.get('twodsix', 'ShowLawLevel'),
      ShowRangeBandAndHideRange: ['CE_Bands', 'CT_Bands', 'CU_Bands'].includes(game.settings.get('twodsix', 'rangeModifierType')),
      ShowWeaponType: game.settings.get('twodsix', 'ShowWeaponType'),
      ShowDamageType: game.settings.get('twodsix', 'ShowDamageType'),
      ShowRateOfFire: game.settings.get('twodsix', 'ShowRateOfFire'),
      ShowRecoil: game.settings.get('twodsix', 'ShowRecoil'),
      ShowDoubleTap: game.settings.get('twodsix', 'ShowDoubleTap'),
      ShowSingleAction: game.settings.get('twodsix', 'ruleset') === 'RIDER',
      usePDFPager: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      showComponentRating: game.settings.get('twodsix', 'showComponentRating'),
      showComponentDM: game.settings.get('twodsix', 'showComponentDM'),
      difficultyList: getDifficultiesSelectObject(),
      useItemAEs: game.settings.get('twodsix', 'useItemActiveEffects'),
      useTabbedViews: game.settings.get('twodsix', 'useTabbedViews'),
      damageTypes: getDamageTypes(["weapon", "consumable"].includes(this.item.type)),
      rangeTypes: getRangeTypes('long'),
      useCTData: game.settings.get('twodsix', 'ruleset') === 'CT',
      useCUData: game.settings.get('twodsix', 'ruleset') === 'CU',
      rollTypes: getRollTypeSelectObject(),
      augLocations: TWODSIX.AUG_LOCATIONS,
      consumableOptions: getConsumableOptions(this.item),
      itemTypes: TWODSIX.ITEM_TYPE_SELECT,
      psiTalentsRequireRoll: game.settings.get('twodsix', 'psiTalentsRequireRoll'),
      ShipWeaponTypes: TWODSIX.ShipWeaponTypes[game.settings.get('twodsix', 'shipWeaponType')] ?? {},
      useRiderData: game.settings.get('twodsix', 'ruleset') === 'RIDER',
      maxComponentHits: game.settings.get('twodsix', 'maxComponentHits')
    };

    context.config = foundry.utils.duplicate(TWODSIX);

    context.isStoredInCargo = this.item.system.isStoredInCargo;
    context.isWeapon = this.item.system.isWeapon;

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.item.system.description, {
      secrets: this.document.isOwner,
      relativeTo: this.item,
      rollData: this.item.getRollData(),
      async: true
    });

    context.tabs = this.getApplicableTabs(context.tabs);

    return context;
  }

  /**
   * Adjusts the TABS constant based on the item type.
   * @param {object} tabs
   * @returns {object}
   */
  getApplicableTabs(tabs) {
    if (["armor", "equipment", "tool", "storage", "junk", "trait", "spell", "psiAbility"].includes(this.item.type)) {
      delete tabs.attack;
      delete tabs.magazine;
      delete tabs.displacement;
      delete tabs.power;
      delete tabs.price;
      delete tabs.career;
      delete tabs.chargenRuleset;
    } else {
      // augment, computer, unknown types
      delete tabs.career;
      delete tabs.chargenRuleset;
    }
    return tabs;
  }

  /**
   * @override
   * @param {object} context
   * @param {object} options
   * @returns {Promise<void>}
   */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // Everything below here is only needed if the sheet is editable
    if (!context.editable) {
      return;
    }
    //Not strictly necessary
    this.handleContentEditable(this.element);

    this.element.querySelector('.consumable-use-consumable-for-attack')?.addEventListener('change', this._onChangeUseConsumableForAttack.bind(this));
    this.element.querySelector(`[name="system.subtype"]`)?.addEventListener('change', this._changeSubtype.bind(this));
    this.element.querySelector(`[name="system.isBaseHull"]`)?.addEventListener('change', this._changeIsBaseHull.bind(this));
    this.element.querySelector(`[name="item.type"]`)?.addEventListener('change', this._changeType.bind(this));
    this.element.querySelector(`[name="system.nonstackable"]`)?.addEventListener('change', this._changeNonstackable.bind(this));
    this.element.querySelector(`[name="name"]`)?.addEventListener('change', this._changeName.bind(this));
    this.element.querySelectorAll(`[name="reference"]`)?.forEach(el => el.addEventListener('change', changeReference.bind(this)));
  }

  /**
   * @param {Event} ev
   * @returns {Promise<void>}
   */
  async _changeName(ev) {
    // Name uniqueness for skills is now enforced in SkillItem._preUpdate.
    // No extra logic needed here — the form submitOnChange will trigger the update.
  }

  /**
   * @param {Event} ev
   * @returns {Promise<void>}
   */
  async _changeSubtype(ev) {
    ev.preventDefault(); //Needed?
    const chosenSubtype = ev.target.value;
    // Component constraints (image, weightIsPct, isBaseHull, hardened, pricingBasis) and
    // consumable isAttachment are now enforced in ComponentItem._preUpdate / ConsumableItem._preUpdate.
    await this.item.update({"system.subtype": chosenSubtype});
    // Re-render the parent item sheet if this is a consumable so its attachments list refreshes.
    if (this.item.type === "consumable" && this.item.actor) {
      const parentItem = this.item.actor.items.find(it => it.system.consumables?.includes(this.item.id));
      if (parentItem) {
        parentItem.sheet.render(false);
      }
    }
  }

  /**
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async _changeType(event) {
    const duplicateItem = this.item.toJSON();
    const newType = event.currentTarget.value;
    duplicateItem.system.priorType = this.item.type;
    //Remove Sorcery As Associated Skill if Spell
    if (duplicateItem.system.priorType === 'spell' && duplicateItem.system.associatedSkillName === game.settings.get("twodsix", "sorcerySkill")) {
      duplicateItem.system.associatedSkillName = "";
    } else if (newType === 'spell' && duplicateItem.system.associatedSkillName === "") {
      duplicateItem.system.associatedSkillName = game.settings.get("twodsix", "sorcerySkill");
    }
    duplicateItem.system.type = newType;
    duplicateItem.type = newType;
    const options = {renderSheet: true};
    if (this.item.pack) {
      options.pack = this.item.pack;
    } else {
      options.parent = this.item.parent;
    }
    const newItem = await TwodsixItem.create(duplicateItem, options);
    if (newItem) {
      if (this.item.pack) {
        await this.item.delete({pack: this.item.pack});
      } else {
        //Unattach from items if consumable
        if (duplicateItem.system.priorType === "consumable" && this.item.parent) {
          const attachedTo = this.item.parent?.items.filter(it => it.system.consumables?.includes(this.item.id));
          for (const holdingItem of attachedTo) {
            await (holdingItem).removeConsumable(this.item.id);
          }
        }
        await this.item.delete();
      }
    }
  }

  /* -------------------------------------------- */
  /**
   * @override
   * @param {Event} event
   * @returns {Promise<void>}
   */
  // Not really needed with change to prosemirror
  async _onChangeContenteditable(event) {
    //console.log(event);
    if (event.currentTarget?.name !== 'type') {
      const formField = event.currentTarget?.closest('div[contenteditable="true"][data-edit]');
      if (formField) {
        const target = formField.dataset?.edit;
        const newValue = formField.closest('div[contenteditable="true"][data-edit]').innerHTML;
        if (target) {
          this.item.update({[target]: newValue});
        }
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async _changeIsBaseHull() {
    // The isBaseHull -> weightIsPct: false constraint is now enforced in ComponentItem._preUpdate.
    await this.item.update({"system.isBaseHull": !this.item.system.isBaseHull});
  }

  /**
   * @returns {void}
   */
  _changeNonstackable() {
    // Warning for multiple layers is now emitted in ArmorItem._preUpdate.
  }

  /**
   * @param {HTMLElement} target
   * @returns {TwodsixItem|undefined}
   */
  getConsumable(target) {
    if (target) {
      const consumableId = target.closest(".consumable").dataset.consumableId;
      return (this.item).actor?.items.get(consumableId);
    } else {
      return undefined;
    }
  }

  /**
   * @param {Event} event
   * @returns {Promise<void>}
   */
  async _onChangeUseConsumableForAttack(event) {
    await this.item.update({"system.useConsumableForAttack": event.currentTarget.value});
    /*this.render();*/
  }

  //These aren't necessary with change to prosemirror
  /**
   * @param {HTMLElement} element
   * @returns {void}
   */
  handleContentEditable(element) {
    element.querySelectorAll('div[contenteditable="true"][data-edit]')?.forEach(el => {
      el.addEventListener('focusout', this._onChangeContenteditable.bind(this));
    });
    element.querySelectorAll('div[contenteditable="true"][data-edit]')?.forEach(el => {
      el.addEventListener('paste', onPasteStripFormatting.bind(this));
    });
  }
}

/**
 * Function to return a Font Awesome icon string based on the item type.
 * @param {string} type - The item type.
 * @returns {string} - Font Awesome icon string reference/id.
 */
function getItemIcon(type) {
  const iconMap = {
    spell: 'fa-solid fa-wand-sparkles',
    weapon: 'fa-solid fa-gun',
    armor: 'fa-solid fa-shield',
    consumable: 'fa-solid fa-battery-full',
    augment: 'fa-solid fa-users-rays',
    ship_position: 'fa-solid fa-gamepad',
    computer: 'fa-solid fa-computer',
    junk: 'fa-solid fa-trash-can',
    component: 'fa-solid fa-gears',
    psiAbility: 'fa-solid fa-head-side-virus',
    skills: 'fa-solid fa-person-running',
    trait: 'fa-solid fa-image-portrait',
    equipment: 'fa-solid fa-toolbox',
    tool: 'fa-solid fa-hammer',
    career: 'fa-solid fa-briefcase',
  };

  return iconMap[type] || '';
}
