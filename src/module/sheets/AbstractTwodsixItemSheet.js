import { TWODSIX } from '../config';
import { TwodsixActiveEffect } from '../entities/TwodsixActiveEffect';
import {
  addPDFLink,
  deletePDFLink,
  deleteReference,
  getDataFromDropEvent,
  getDocFromDropData,
  isDisplayableSkill,
  openJournalEntry,
  openPDFLink
} from '../utils/sheetUtils';
import { sortByItemName } from '../utils/utils';

/**
 * Extend the basic ItemSheetV2 with some very simple modifications.
 * Shared DEFAULT_OPTIONS.actions provide PDF-link and ActiveEffect handlers
 * inherited by all item sheets (TwodsixItemSheet, CareerItemSheet, SpeciesItemSheet, etc.).
 * @extends {ItemSheetV2}
 */
export class AbstractTwodsixItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    actions: {
      editActiveEffect: this._onEditEffect,
      createActiveEffect: this._onCreateEffect,
      deleteActiveEffect: this._onDeleteEffect,
      openPDFLink: openPDFLink,
      deletePDFLink: deletePDFLink,
      addPDFLink: addPDFLink,
      openJournalEntry: openJournalEntry,
      deleteReference: deleteReference
    }
  };

  /**
   * Base TABS definition. Subclasses may override to add or remove tabs.
   * Only the description tab is shared by all item types.
   */
  static TABS = {
    primary: {
      tabs: [
        {id: "description", icon: "fa-solid fa-book", label: "TWODSIX.Items.Equipment.Description"}
      ],
      initial: "description"
    }
  };

  /**
   * Base tab filtering. Subclasses must call super or override entirely.
   * @param {object} tabs
   * @returns {object}
   */
  getApplicableTabs(tabs) {
    return tabs;
  }

  /* -------------------------------------------- */
  /**
   * Shared static action handler: create an ActiveEffect on the item.
   * @returns {Promise<void>}
   */
  static async _onCreateEffect() {
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

  /**
   * Shared static action handler: edit the item's ActiveEffect.
   * @returns {Promise<void>}
   */
  static async _onEditEffect() {
    if (await fromUuid(this.item.uuid)) {
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

  /*******************
   *
   * Drag Drop Handling
   *
   *******************/

  /**
   * Shared static action handler: delete the item's ActiveEffect.
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
   * @param {object} context
   * @param {object} options
   * @returns {Promise<void>}
   * @override
   */
  async _onRender(context, options) {
    await super._onRender(context, options);
    //need to create DragDrop listener as none in core
    if (game.user.isOwner && this.options.dragDrop) {
      (this.options.dragDrop).forEach((selector) => {
        new foundry.applications.ux.DragDrop({
          dragSelector: selector.dragSelector,
          dropSelector: selector.dropSelector,
          callbacks: {
            dragstart: this._onDragStart.bind(this),
            dragover: this._onDragOver.bind(this),
            drop: this._onDrop.bind(this)
          }
        }).bind(this.element);
      });
    }
  }

  /**
   * @param {object} options
   * @returns {Promise<object>}
   * @override
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system; //convenience access to item.system data
    context.owner = this.actor;
    if (this.actor) {
      //build Skills Pick List
      const skillsList = [];
      for (const skill of context.owner.itemTypes.skills) {
        if (isDisplayableSkill(skill) || (skill.getFlag("twodsix", "untrainedSkill") === game.settings.get('twodsix', 'hideUntrainedSkills'))) {
          skillsList.push(skill);
        }
      }
      context.skillsList = sortByItemName(skillsList);
    }

    // Base settings shared by all item sheets
    context.settings = {
      useTabbedViews: game.settings.get('twodsix', 'useTabbedViews'),
      usePDFPager: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      useItemAEs: game.settings.get('twodsix', 'useItemActiveEffects')
    };

    context.enrichedDescription = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
      this.item.system.description,
      {
        secrets: this.document.isOwner,
        relativeTo: this.item,
        rollData: this.item.getRollData(),
        async: true
      }
    );

    context.tabs = this.getApplicableTabs(context.tabs);

    return context;
  }

  /**
   * @returns {boolean}
   * @override
   */
  _canDragDrop(/*selector*/) {
    return this.isEditable && this.item.isOwner;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} ev       The originating DragEvent
   * @returns {void}
   */
  _onDragStart(ev) {
    if ('link' in ev.target.dataset || this.options.sheetType === "ShipPositionSheet") {
      return;
    }

    // Extract the data you need
    const consumableId = ev.currentTarget.closest(".consumable")?.dataset.consumableId;
    if (consumableId) {
      const draggedConsumable = this.item.actor?.items.get(consumableId);
      if (draggedConsumable) {
        const dragData = {
          type: "Item",
          uuid: draggedConsumable.uuid
        };
        // Set data transfer
        ev.dataTransfer.setData('text/plain', JSON.stringify(dragData));
      }
    }
  }

  /**
   * An event that occurs when a drag workflow moves over a drop target.
   * @param {DragEvent} ev
   * @returns {void}
   */
  _onDragOver(/*ev:DragEvent*/) {
  }

  /**
   * Callback actions which occur when dropping.  TWODSIX Specific!
   * @param {DragEvent} ev The originating DragEvent
   */
  async _onDrop(ev) {
    if (ev.target.classList.contains('ProseMirror') || ev.target.parentElement.className.includes('ProseMirror')) {
      return;
    }
    ev.preventDefault();
    try {
      const dropData = getDataFromDropEvent(ev);
      this._assertNonNullish(dropData, "DraggingSomething");
      if (['html', 'pdf'].includes(dropData.type)) {
        if (dropData.href) {
          await this.item.update({
            "system.pdfReference.type": dropData.type,
            "system.pdfReference.href": dropData.href,
            "system.pdfReference.label": dropData.label
          });
        }
      } else if (['JournalEntry', 'JournalEntryPage'].includes(dropData.type)) {
        const journalEntry = await fromUuid(dropData.uuid);
        if (journalEntry) {
          await this.item.update({
            "system.pdfReference.type": 'JournalEntry',
            "system.pdfReference.href": dropData.uuid,
            "system.pdfReference.label": journalEntry.name
          });
        }
      } else if (dropData.type === 'Item') {
        //This part handles just consumables
        this._assert(this.item.isOwned, "OnlyOwnedItems");
        this._assert(!TWODSIX.WeightlessItems.includes(this.item.type), "TraitsandSkillsNoConsumables");
        this._assert(dropData.type === "Item", "OnlyDropItems");

        const itemData = await getDocFromDropData(dropData);

        this._assert(itemData.type === "consumable", "OnlyDropConsumables");
        this._assert(!(this.item.type === "consumable" && itemData.system.isAttachment), "CantDropAttachOnConsumables");

        // If the dropped item has the same actor as the current item let's just use the same id.
        let itemId;
        if (this.item.actor?.items.get(itemData._id)) {
          itemId = itemData._id;
          //Check to see if consumable exists on another item for actor
          const previousItem = itemData.actor.items.find(it => it.system.consumables?.includes(itemId));
          if (previousItem) {
            await previousItem.removeConsumable(itemId, previousItem.system);
          }
        } else {
          const newItem = await (this.item.actor)?.createEmbeddedDocuments("Item", [foundry.utils.duplicate(itemData)]);
          if (!newItem) {
            throw new Error(`Somehow could not create item ${itemData}`);
          }
          itemId = newItem[0].id;
        }
        await (this.item).addConsumable(itemId);
      }
      this.render();
    } catch (err) {
      console.error(`Twodsix drop error| ${err}`);
      ui.notifications.error(err);
    }
  }

  /**
   * Assert that a condition is true; throws a localized error if not.
   * @param {boolean} cond    Condition to assert.
   * @param {string} errorKey Localization key suffix under `TWODSIX.Errors.*`.
   * @returns {void}
   */
  _assert(cond, errorKey) {
    if (!cond) {
      throw new Error(game.i18n.localize(`TWODSIX.Errors.${errorKey}`));
    }
  }

  /**
   * Assert a value is not null or undefined; throws a localized error if it is.
   * @param {*} value            The value to check.
   * @param {string} errorKey    Localization key suffix under `TWODSIX.Errors.*`.
   * @returns {void}
   */
  _assertNonNullish(value, errorKey) {
    if (value == null) {
      throw new Error(game.i18n.localize(`TWODSIX.Errors.${errorKey}`));
    }
  }
}

/**
 * @param {ClipboardEvent} event
 * @returns {void}
 */
export function onPasteStripFormatting(event) {
  if (event.originalEvent && event.originalEvent.clipboardData && event.originalEvent.clipboardData.getData) {
    event.preventDefault();
    const text = event.originalEvent.clipboardData.getData('text/plain');
    window.document.execCommand('insertText', false, text);
  } else if (event.clipboardData && event.clipboardData.getData) {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    window.document.execCommand('insertText', false, text);
  }
}
