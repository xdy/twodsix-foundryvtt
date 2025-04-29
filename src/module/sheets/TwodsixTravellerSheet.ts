// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TWODSIX } from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import { Consumable, Skills } from "../../types/template";
import TwodsixItem  from "../entities/TwodsixItem";

export class TwodsixTravellerSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {
  static DEFAULT_OPTIONS =  {
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

  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    if (applicationOptions.sheetType !== 'TwodsixNPCSheet') {
      applicationOptions.position.width = game.settings.get('twodsix', 'defaultActorSheetWidth');
      applicationOptions.position.height = game.settings.get('twodsix', 'defaultActorSheetHeight');
      applicationOptions.dragDrop = [{dragSelector: ".item", dropSelector: null}, {dragSelector: ".effect", dropSelector: null}];
    } else{
      applicationOptions.dragDrop = [{dragSelector: ".item-name", dropSelector: null}];
    }
    return applicationOptions;
  }

  /** @override */
  async _prepareContext(options):any {
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
      showTotalArmor: game.settings.get('twodsix', 'showTotalArmor')
    });

    context.ACTIVE_EFFECT_MODES = Object.entries(CONST.ACTIVE_EFFECT_MODES).reduce((ret, entry) => {
      const [ key, value ] = entry;
      ret[ value ] = key;
      return ret;
    }, {});

    //Add custom source labels for active effects
    for(const effect of context.effects) {
      if (["dead", "unconscious", "wounded", "encumbered"].includes(Array.from(effect.statuses)[0])) {
        effect.sourceLabel = game.i18n.localize("TWODSIX.ActiveEffects.Condition");
      } else if (effect.origin && !effect.origin?.includes("Compendium")) {
        const attachedItem:TwodsixItem = fromUuidSync(effect.origin);
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

  async _onRender(context:Context, options:any): void {
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
   * Handle when the joat skill is changed.
   * @param {Event} ev   The originating click event
   * @private
   */
  private async _updateJoatSkill(ev:Event): Promise<void> {
    const joatValue = parseInt(ev.currentTarget.value, 10);
    const skillValue = AbstractTwodsixActorSheet.joatToUntrained(joatValue);

    if (!isNaN(joatValue) && joatValue >= 0 && skillValue <= 0) {
      const untrainedSkill = (<TwodsixActor>this.actor).getUntrainedSkill();
      untrainedSkill.update({"system.value": skillValue});
    } else if (ev.currentTarget.value !== "") {
      ev.currentTarget.value = "";
    }
  }

  /**
   * Handle when user tabs out and leaves blank value.
   * @param {Event} ev   The originating click event
   * @private
   */
  private async _onJoatSkillBlur(ev:Event): Promise<void> {
    if (isNaN(parseInt(ev.currentTarget.value, 10))) {
      const skillValue = (<Skills>(<TwodsixActor>this.actor).getUntrainedSkill().system).value;
      ev.currentTarget.value = AbstractTwodsixActorSheet.untrainedToJoat(skillValue);
    }
  }

  private getConsumableItem(ev:Event, target:HTMLElement): TwodsixItem {
    const itemId = target.closest('.consumable-row').dataset.consumableId;
    return this.actor.items.get(itemId) as TwodsixItem;
  }

  static _onToggleAttachmentsList(ev: Event, target:HTMLElement):void {
    ev.preventDefault();
    const item = this.actor.items.get(target.dataset.itemId);
    const newState = !target.open;
    item.showAttachmentsList = newState;
    target.open = newState;
  }

  static _onToggleConsumablesList(ev: Event, target:HTMLElement): void {
    ev.preventDefault();
    const item = this.actor.items.get(target.dataset.itemId);
    const newState = !target.open;
    item.showConsumablesList = newState;
    target.open = newState;
  }

  static async _onAdjustConsumableCount(ev: Event, target:HTMLElement): Promise<void> {
    const modifier = parseInt(target.dataset.value, 10);
    const item:TwodsixItem = this.getConsumableItem(ev, target);
    await item.consume(modifier);
  }

  static async _onRefillConsumable(ev: Event, target:HTMLElement): Promise<void> {
    const item:TwodsixItem = this.getConsumableItem(ev, target);
    try {
      await item.refill();
    } catch (err) {
      if (err.name === "TooLowQuantityError") {
        const refillAction = ["magazine", "power_cell"].includes((<Consumable>item.system).subtype) ? "Reload" : "Refill";
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
   * @private
   */
  static async _onAutoAddConsumable(ev:Event, target:HTMLElement): Promise<void> {
    const weaponSelected: any = this.actor.items.get(target.closest(".item")?.dataset.itemId);

    const max = weaponSelected.system.ammo;
    if (max > 0 && !weaponSelected.system.consumableData?.length) {
      const newConsumableData = {
        name: game.i18n.localize("TWODSIX.Items.Consumable.Types.magazine") + ": " + weaponSelected.name,
        type: "consumable",
        system: {
          subtype: "magazine",
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
  static async _onToggleItem(ev:Event, target:HTMLElement): Promise<void> {
    if (target) {
      const li = target.closest(".item");
      const itemSelected = <TwodsixItem>this.actor.items.get(li.dataset.itemId);
      const newSuspendedState = getNewEquippedState(itemSelected);

      //change equipped state
      const itemUpdates = [];
      itemUpdates.push({_id: itemSelected.id, "system.equipped": newSuspendedState});

      // Sync associated consumables equipped state - need to gate due to race condition
      for (const consumeableID of itemSelected.system.consumables) {
        const consumableSelected = await itemSelected.actor.items.get(consumeableID);
        if (consumableSelected) {
          itemUpdates.push({_id: consumableSelected.id, "system.equipped": newSuspendedState});
        }
      }
      await this.actor.updateEmbeddedDocuments("Item", itemUpdates);

      //check for equipping more than one armor with nonstackable
      if (this.actor.system.layersWorn > 1 && this.actor.system.wearingNonstackable && itemSelected.type === 'armor') {
        ui.notifications.warn("TWODSIX.Warnings.WearingMultipleLayers", {localize: true});
      }
    }
  }

  /**
   * Handle toggling the view state of an Item class.
   * @param {Event} ev   The originating click event.
   * @private
   */
  static async _onViewToggle(ev: Event, target:HTMLElement): Promise<void> {
    const itemType: string = target.dataset.itemType;
    await this.actor.update({[`system.hideStoredItems.${itemType}`]: !this.actor.system.hideStoredItems[itemType]});
  }

  /**
   * Handle toggling the active consumable.
   * @param {Event} ev   The originating click event.
   * @param {HTMLElement} target The clicked DOM rlement
   * @private
   */
  static async _onToggleConsumable(ev: Event, target:HTMLElement): Promise<void> {
    const parentItem: TwodsixItem = await this.actor.items.get(target.dataset.parentId);
    const consumable: TwodsixItem = await this.actor.items.get(target.dataset.consumableId);
    if (parentItem?.type === "weapon" && !["software", "processor", "suite"].includes(consumable.system.subtype)) {
      if (parentItem?.system.useConsumableForAttack !== consumable.id) {
        await parentItem.update({'system.useConsumableForAttack': consumable.id});
      }
    } else {
      if (consumable.system.subtype === "software") {
        await consumable.update({'system.softwareActive': !consumable.system.softwareActive});
      }
    }
  }

  /**
   * Handle toggling the skill header.
   * @param {Event} event   The originating click event.
   * @param {HTMLElement} target The clicked DOM element
   * @static
   */
  static async _onSkillHeaderToggle(ev:Event, target:HTMLElement): Promise<void> {
    const parentKey: string = target.dataset.parentKey;
    if (parentKey) {
      this.actor.update({[`system.displaySkillGroup.${parentKey}`]: !this.actor.system.displaySkillGroup[parentKey]});
    }
  }
}

export class TwodsixNPCSheet extends foundry.applications.api.HandlebarsApplicationMixin(TwodsixTravellerSheet) {
  static DEFAULT_OPTIONS =  {
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

/**
 * Determine the new equipped state after toggling.
 * @param {TwodsixItem} itemSelected   The item to change the equipped state.
 * @returns {string} The new equipped state based on old one ans display setting
 */
function getNewEquippedState(itemSelected: TwodsixItem): string {
  const currentState = itemSelected.system.equipped;
  if (!currentState) {
    return 'backpack';
  } else {
    switch (game.settings.get('twodsix', 'equippedToggleStates')) {
      case 'all':
        return {'vehicle': 'ship', 'ship': 'base',  'base': 'backpack', 'backpack': 'equipped', 'equipped': 'vehicle'}[currentState];
      case 'core':
        return {'vehicle': 'backpack', 'ship': 'backpack', 'base': 'backpack', 'backpack': 'equipped', 'equipped': 'backpack'}[currentState];
      case 'default':
      default:
        return {'vehicle': 'backpack', 'ship': 'backpack',  'base': 'backpack', 'backpack': 'equipped', 'equipped': 'ship'}[currentState];
    }
  }
}
