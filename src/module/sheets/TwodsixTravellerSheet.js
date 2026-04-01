/** @typedef {import("../entities/TwodsixActor").default} TwodsixActor */
/** @typedef {import("../entities/TwodsixItem").default} TwodsixItem */

import { CONSUMABLE_SUBTYPES, TWODSIX } from '../config';
import { AbstractTwodsixActorSheet } from './AbstractTwodsixActorSheet';

export class TwodsixTravellerSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {
  static DEFAULT_OPTIONS = {
    classes: ["twodsix", "sheet", "actor"],
    position: {
      width: 900,
      height: 780
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-user-astronaut"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      adjustConsumable: this._onAdjustConsumableCount,
      refillConsumable: this._onRefillConsumable,
      autoCreateConsumable: this._onAutoAddConsumable,
      toggleConsumable: this._onToggleConsumable,
      toggleItem: this._onToggleItem,
      toggleView: this._onViewToggle,
      toggleSkillHeader: this._onSkillHeaderToggle,
      toggleAttachmentsList: this._onToggleAttachmentsList,
      toggleConsumablesList: this._onToggleConsumablesList
    },
    tag: "form",
    sheetType: "TwodsixTravellerSheet"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/traveller-sheet.hbs",
      scrollable: [".skills", ".character-inventory", ".inventory", ".finances", ".info", ".effects", ".actor-notes"]
    }
  };

  static TABS = {
    primary: {
      tabs: [
        {id: "skills"},
        {id: "inventory"},
        {id: "finances"},
        {id: "info"},
        {id: "effects"},
        {id: "actorNotes"}
      ],
      initial: "skills"
    }
  };

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {void}
   */
  static _onToggleAttachmentsList(ev, target) {
    ev.preventDefault();
    const item = this.actor.items.get(target.dataset.itemId);
    const newState = !target.open;
    item.showAttachmentsList = newState;
    target.open = newState;
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {void}
   */
  static _onToggleConsumablesList(ev, target) {
    ev.preventDefault();
    const item = this.actor.items.get(target.dataset.itemId);
    const newState = !target.open;
    item.showConsumablesList = newState;
    target.open = newState;
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async _onAdjustConsumableCount(ev, target) {
    const modifier = parseInt(target.dataset.value, 10);
    const item = this.getConsumableItem(ev, target);
    await item.consume(modifier);
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async _onRefillConsumable(ev, target) {
    const item = this.getConsumableItem(ev, target);
    try {
      await item.refill();
    } catch (err) {
      if (err.name === "TooLowQuantityError") {
        const refillAction = item.system.isReloadable ? "Reload" : "Refill";
        const refillWord = game.i18n.localize(`TWODSIX.Actor.Items.${refillAction}`).toLocaleLowerCase();
        const tooFewString = game.i18n.localize("TWODSIX.Errors.TooFewToReload");
        ui.notifications.error(tooFewString.replace("_NAME_", item.name?.toLocaleLowerCase() || "???").replace("_REFILL_ACTION_", refillWord));
      } else {
        throw err;
      }
    }
  }

  /**
   * Handle auto add of weapons consumables.
   * @param {Event} ev   The originating click event
   * @param {HTMLElement} target THe clicked html element
   * @returns {Promise<void>}
   */
  static async _onAutoAddConsumable(ev, target) {
    const weaponSelected = this.actor.items.get(target.closest(".item")?.dataset.itemId);

    const max = weaponSelected.system.ammo;
    if (max > 0 && !weaponSelected.system.consumableData?.length) {
      const newConsumableData = {
        name: game.i18n.localize("TWODSIX.Items.Consumable.Types.magazine") + ": " + weaponSelected.name,
        type: "consumable",
        system: {
          subtype: CONSUMABLE_SUBTYPES.MAGAZINE,
          quantity: 1,
          currentCount: max,
          max,
          equipped: weaponSelected.system.equipped
        }
      };
      const newConsumable = await weaponSelected.actor.createEmbeddedDocuments("Item", [newConsumableData]);
      await weaponSelected.addConsumable(newConsumable[0].id);
      await weaponSelected.update({"system.useConsumableForAttack": newConsumable[0].id});
    }
  }

  /**
   * Handle toggling the state of an Owned Item within the Actor.
   * @param {Event} ev   The originating click event.
   * @param {HTMLElement} target The DOM element clicked
   * @static
   */
  static async _onToggleItem(ev, target) {
    if (!this.actor.isOwner) {
      ui.notifications.warn("TWODSIX.Warnings.LackPermissionToEdit", {localize: true});
      return;
    }
    if (target) {
      const li = target.closest(".item");
      const itemSelected = this.actor.items.get(li.dataset.itemId);
      await this.actor.toggleItemEquipped(itemSelected);
    }
  }

  /**
   * Handle toggling the view state of an Item class.
   * @param {Event} ev   The originating click event.
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  static async _onViewToggle(ev, target) {
    const itemType = target.dataset.itemType;
    await this.actor.update({[`system.hideStoredItems.${itemType}`]: !this.actor.system.hideStoredItems[itemType]});
  }

  /**
   * Handle toggling the active consumable.
   * @param {Event} ev   The originating click event.
   * @param {HTMLElement} target The clicked DOM rlement
   * @returns {Promise<void>}
   */
  static async _onToggleConsumable(ev, target) {
    const parentItem = await this.actor.items.get(target.dataset.parentId);
    const consumable = await this.actor.items.get(target.dataset.consumableId);
    if (parentItem?.type === "weapon" && !consumable.system.isAttachmentType) {
      if (parentItem?.system.useConsumableForAttack !== consumable.id) {
        await parentItem.update({'system.useConsumableForAttack': consumable.id});
      }
    } else {
      if (consumable.system.isSoftware) {
        await consumable.update({'system.softwareActive': !consumable.system.softwareActive});
      }
    }
  }

  /**
   * Handle toggling the skill header.
   * @param {Event} event   The originating click event.
   * @param {HTMLElement} target The clicked DOM element
   * @returns {Promise<void>}
   * @static
   */
  static async _onSkillHeaderToggle(ev, target) {
    const parentKey = target.dataset.parentKey;
    if (parentKey) {
      this.actor.update({[`system.displaySkillGroup.${parentKey}`]: !this.actor.system.displaySkillGroup[parentKey]});
    }
  }

  /**
   * @inheritDoc
   * @param {object} options
   * @returns {object}
   */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    if (applicationOptions.sheetType !== 'TwodsixNPCSheet') {
      applicationOptions.position.width = game.settings.get('twodsix', 'defaultActorSheetWidth');
      applicationOptions.position.height = game.settings.get('twodsix', 'defaultActorSheetHeight');
      applicationOptions.dragDrop = [{dragSelector: ".item", dropSelector: null}, {
        dragSelector: ".effect",
        dropSelector: null
      }];
    } else {
      applicationOptions.dragDrop = [{dragSelector: ".item-name", dropSelector: null}];
    }
    return applicationOptions;
  }

  /**
   * @override
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (game.settings.get('twodsix', 'useProseMirror')) {
      const TextEditorImp = foundry.applications.ux.TextEditor.implementation;
      context.richText = {
        description: await TextEditorImp.enrichHTML(context.system.description, {secrets: this.document.isOwner}),
        contacts: await TextEditorImp.enrichHTML(context.system.contacts, {secrets: this.document.isOwner}),
        bio: await TextEditorImp.enrichHTML(context.system.bio, {secrets: this.document.isOwner}),
        notes: await TextEditorImp.enrichHTML(context.system.notes, {secrets: this.document.isOwner}),
        xpNotes: await TextEditorImp.enrichHTML(context.system.xpNotes, {secrets: this.document.isOwner})
      };
    }

    // Add relevant data from system settings
    Object.assign(context.settings, {
      ShowDoubleTap: game.settings.get('twodsix', 'ShowDoubleTap'),
      showSkillCountsRanks: game.settings.get('twodsix', 'showSkillCountsRanks'),
      useNationality: game.settings.get('twodsix', 'useNationality'),
      showAllCharWithTable: game.settings.get('twodsix', 'showAllCharWithTable'),
      showSkillGroups: game.settings.get('twodsix', 'showSkillGroups'),
      useCEAutofireRules: game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CE.key,
      useCTAutofireRules: game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CT.key,
      useCELAutofireRules: game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key,
      useCUAutofireRules: game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CU.key,
      useRIDERFireRules: game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.RIDER.key,
      showTotalArmor: game.settings.get('twodsix', 'showTotalArmor') && !(this.actor.system.totalArmor > 0 && this.actor.system.totalArmor < 1), //total armor doesn't make sense with armor that blocks a percentage
      showTraitAE: game.settings.get('twodsix', 'showTraitAE')
    });

    //Add custom source labels for active effects
    for (const effect of context.effects) {
      if (["dead", "unconscious", "wounded", "encumbered"].includes(Array.from(effect.statuses)[0])) {
        effect.sourceLabel = game.i18n.localize("TWODSIX.ActiveEffects.Condition");
      } else if (effect.origin && !effect.origin?.includes("Compendium")) {
        const attachedItem = fromUuidSync(effect.origin);
        if (attachedItem) {
          effect.sourceLabel = (attachedItem.name ?? game.i18n.localize("TWODSIX.ActiveEffects.UnknownSource"));
        } else {
          effect.sourceLabel = effect.parent.name;
        }
      } else if (effect.parent.documentName === "Item") {
        effect.sourceLabel = effect.parent.name;
      } else {
        effect.sourceLabel = game.i18n.localize("TWODSIX.ActiveEffects.UnknownSource");
      }
    }
    return context;
  }

  /**
   * @override
   * @param {object} context
   * @param {object} options
   * @returns {Promise<void>}
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    //Set special class for FVTT window-content section so that it overlaps with header
    if (this.options.sheetType === 'TwodsixTravellerSheet') {
      this.element.querySelector(".window-content").classList.add("overlap-header");
      this.element.querySelector(".window-header").classList.add("transparent-header");
    }

    // Everything below here is only needed if the sheet is editable
    if (!context.editable) {
      return;
    }
    this.element.querySelector(".joat-skill-input")?.addEventListener('input', this._updateJoatSkill.bind(this));
    this.element.querySelector(".joat-skill-input")?.addEventListener('blur', this._onJoatSkillBlur.bind(this));
  }

  /**
   * @override
   * @param {object} context
   * @param {object} options
   * @returns {Promise<void>}
   */
  async _preRender(context, options) {
    await super._preRender(context, options);
    //Change window icon if western mode
    if (game.settings.get("twodsix", "themeStyle") === "western" && options.window?.icon) {
      options.window.icon = "fa-solid fa-hat-cowboy";
    }
  }

  /**
   * Handle when the joat skill is changed.
   * @param {Event} ev   The originating click event
   * @returns {Promise<void>}
   */
  async _updateJoatSkill(ev) {
    const joatValue = parseInt(ev.currentTarget.value, 10);
    const skillValue = AbstractTwodsixActorSheet.joatToUntrained(joatValue);

    if (!isNaN(joatValue) && joatValue >= 0 && skillValue <= 0) {
      const untrainedSkill = (this.actor).getUntrainedSkill();
      untrainedSkill.update({"system.value": skillValue});
    } else if (ev.currentTarget.value !== "") {
      ev.currentTarget.value = "";
    }
  }

  /**
   * Handle when user tabs out and leaves blank value.
   * @param {Event} ev   The originating click event
   * @returns {Promise<void>}
   */
  async _onJoatSkillBlur(ev) {
    if (isNaN(parseInt(ev.currentTarget.value, 10))) {
      const skillValue = ((this.actor).getUntrainedSkill().system).value;
      ev.currentTarget.value = AbstractTwodsixActorSheet.untrainedToJoat(skillValue);
    }
  }

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {TwodsixItem|undefined}
   */
  getConsumableItem(ev, target) {
    const itemId = target.closest('.consumable-row').dataset.consumableId;
    return this.actor.items.get(itemId);
  }
}

export class TwodsixNPCSheet extends foundry.applications.api.HandlebarsApplicationMixin(TwodsixTravellerSheet) {
  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixNPCSheet",
    classes: ["twodsix", "sheet", "npc-actor"],
    position: {
      width: 830,
      height: 500
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-person"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/npc-sheet.hbs",
    }
  };
}

