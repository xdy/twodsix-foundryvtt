// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";
import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import { getDataFromDropEvent, getItemDataFromDropData, openPDFReference, deletePDFReference, openJournalEntry, getDifficultiesSelectObject, getRollTypeSelectObject, getConsumableOptions, getRangeTypes } from "../utils/sheetUtils";
import { Component} from "src/types/template";
import { getDamageTypes } from "../utils/sheetUtils";
import { getCharacteristicList } from "../utils/TwodsixRollSettings";
import { TwodsixActiveEffect } from "../entities/TwodsixActiveEffect";

/**
 * Extend the basic ItemSheetV2 with some very simple modifications
 * @extends {ItemSheetV2}
 */
export class TwodsixItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixItemSheet) {
  //returnData: any; ///Not certain on this one or is it just 'data' ************
  constructor(options = {}) {
    super(options);
    console.log(options);
  }

  /** @override */
  static DEFAULT_OPTIONS =  {
    classes: ["twodsix", "sheet", "item"],
    //tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "description"}],
    dragDrop: [{dropSelector: null, dragSelector: null}],
    window: {
      resizable: true,
      width: 550,
      height: 'auto'
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/items/item-stub.html",
      scroll
    }
  };

  /** @override */
  _canDragDrop() {
    //console.log("got to drop check", selector);
    return this.isEditable && this.item.isOwner;
  }
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options): ItemSheet {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    //returnData.actor = returnData.data;

    (<TwodsixItem>this.item).prepareConsumable();
    // Add relevant data from system settings
    context.settings = {
      ShowLawLevel: game.settings.get('twodsix', 'ShowLawLevel'),
      ShowRangeBandAndHideRange: ['CE_Bands', 'CT_Bands', 'CU_Bands'].includes(game.settings.get('twodsix', 'rangeModifierType')),
      ShowWeaponType: game.settings.get('twodsix', 'ShowWeaponType'),
      ShowDamageType: game.settings.get('twodsix', 'ShowDamageType'),
      ShowRateOfFire: game.settings.get('twodsix', 'ShowRateOfFire'),
      ShowRecoil: game.settings.get('twodsix', 'ShowRecoil'),
      ShowDoubleTap: game.settings.get('twodsix', 'ShowDoubleTap'),
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
      psiTalentsRequireRoll: game.settings.get('twodsix', 'psiTalentsRequireRoll')
    };

    if (this.item.type === 'skills') {
      context.settings.characteristicsList = getCharacteristicList(this.item.actor);
      //Set characterisitic, making certin it is valid choice
      if (Object.keys(context.settings.characteristicsList).includes(this.item.system.characteristic)) {
        context.system.initialCharacteristic = this.item.system.characteristic;
      } else {
        context.system.initialCharacteristic = 'NONE';
      }
    }

    //prevent processor/suite attachements to computers(?)
    context.config = foundry.utils.duplicate(TWODSIX);

    if (this.actor && this.item.type === "consumable" ) {
      const onComputer = this.actor.items.find(it => it.type === "computer" && it.system.consumables.includes(this.item.id));
      if(onComputer) {
        delete context.config.CONSUMABLES.processor;
        delete context.config.CONSUMABLES.suite;
      }
    }

    // Disable Melee Range DM if designated as Melee weapon
    if (this.item.type === 'weapon') {
      context.disableMeleeRangeDM = (typeof this.item.system.range === 'string') ? this.item.system.range.toLowerCase() === 'melee' : false;
    }

    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  /*setPosition(options: Partial<Application.Position> = {}): (Application.Position & { height: number }) | void {
    const position: Application.Position = <Application.Position>super.setPosition(options);
    const sheetBody = (this.element as JQuery).find(".sheet-body");
    const bodyHeight = <number>position.height - 192;
    sheetBody.css("height", bodyHeight);
    return <(Application.Position & { height: number }) | void>position;
  }*/

  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options): void {
    super._onRender(context, options);
    const html = $(this.element);

    // Everything below here is only needed if the sheet is editable
    if (!context.editable) {
      return;
    }

    html.find('.consumable-create').on('click', this._onCreateConsumable.bind(this));
    html.find('.attachment-create').on('click', this._onCreateAttachment.bind(this));
    html.find('.consumable-edit').on('click', this._onEditConsumable.bind(this));
    html.find('.consumable-delete').on('click', this._onDeleteConsumable.bind(this));
    html.find('.consumable-use-consumable-for-attack').on('change', this._onChangeUseConsumableForAttack.bind(this));

    html.find(".edit-active-effect").on("click", this._onEditEffect.bind(this));
    html.find(".create-active-effect").on("click", this._onCreateEffect.bind(this));
    html.find(".delete-active-effect").on("click", this._onDeleteEffect.bind(this));

    this.handleContentEditable(html);
    html.find('.open-link').on('click', openPDFReference.bind(this, this.item.system.docReference));
    html.find('.open-journal-entry').on('click', openJournalEntry.bind(this));
    html.find('.delete-link').on('click', deletePDFReference.bind(this));
    html.find(`[name="system.subtype"]`).on('change', this._changeSubtype.bind(this));
    html.find(`[name="system.isBaseHull"]`).on('change', this._changeIsBaseHull.bind(this));
    html.find(`[name="item.type"]`).on('change', this._changeType.bind(this));
    html.find(`[name="system.nonstackable"]`).on('change', this._changeNonstackable.bind(this));
  }
  private async _changeSubtype(event) {
    event.preventDefault(); //Needed?
    await this.item.update({"system.subtype": event.currentTarget.selectedOptions[0].value}); //for some reason this update must happen first
    if (this.item.type === "component") {
      const updates = {};
      /*Update default image if using system images*/
      const componentImagePath = "systems/twodsix/assets/icons/components/";
      if (this.item.img.includes(componentImagePath)) {
        Object.assign(updates, {"img": componentImagePath + event.currentTarget.selectedOptions[0].value + ".svg"});
      }
      /*Prevent cargo from using %hull weight*/
      const anComponent = <Component> this.item.system;
      if (anComponent.weightIsPct && event.currentTarget.value === "cargo") {
        Object.assign(updates, {"system.weightIsPct": false});
      }
      /*Unset isBaseHull if not hull component*/
      if (event.currentTarget.value !== "hull" && anComponent.isBaseHull) {
        Object.assign(updates, {"system.isBaseHull": false});
      }
      /*Unset hardened if fuel, cargo, storage, vehicle*/
      if (["fuel", "cargo", "storage", "vehicle"].includes(event.currentTarget.value)) {
        Object.assign(updates, {"system.hardened": false});
      }

      if (Object.keys(updates).length !== 0) {
        await this.item.update(updates);
      }
    } else if (this.item.type === "consumable" ) {
      if (["software", "processor", "suite"].includes(this.item.system.subtype)) {
        await this.item.update({"system.isAttachment": true});
      }
      if (this.item.actor) {
        const parentItem = this.item.actor.items.find(it => it.system.consumables?.includes(this.item.id));
        if (parentItem){
          parentItem.sheet.render(false);
        }
      }
    }
  }

  private async _changeType(event) {
    const duplicateItem = this.item.toJSON();
    const newType = event.currentTarget.value;
    duplicateItem.system.priorType = this.item.type;
    //Remove Sorcery As Associated Skill if Spell
    if (duplicateItem.system.priorType === 'spell'  && duplicateItem.system.associatedSkillName === game.settings.get("twodsix", "sorcerySkill")) {
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
        this.item.delete({pack: this.item.pack});
      } else {
        this.item.delete();
      }
    }
  }

  /* -------------------------------------------- */
  /** @override */
  // Kludge to fix consumables dissapearing when updating item sheet
  async _onChangeInput(event) {
    //console.log(event);
    if (event.currentTarget?.name !== 'type') {
      await super._onChangeInput(event);
      this.item?.sheet?.render();
    }
  }
  /* -------------------------------------------- */

  private async _changeIsBaseHull() {
    const anComponent = <Component> this.item.system;
    const newValue = !anComponent.isBaseHull;

    await this.item.update({"system.isBaseHull": newValue});
    /*Unset isWeightPct if changing to base hull*/
    if (newValue && anComponent.weightIsPct) {
      await this.item.update({"system.weightIsPct": false});
    }
  }

  private _changeNonstackable() {
    if (this.item.actor) {
      const newValue = !this.item.system.nonstackable;
      //check for having more than one equipped armor when changing to nonstackable
      if (this.item.actor.system.layersWorn > 1 && newValue && this.item.system.equipped === 'equipped') {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.WearingMultipleLayers"));
      }
    }
  }

  private async _onCreateEffect(): Promise<void> {
    if (this.actor?.type === "ship" || this.actor?.type === "vehicle") {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantEditCreateInCargo"));
    } else {
      const newId = foundry.utils.randomID();
      if(game.settings.get('twodsix', 'useItemActiveEffects')) {
        if (await fromUuid(this.item.uuid)) {
          TwodsixActiveEffect.create({
            origin: undefined, //UUID? this.item.uuid
            icon: this.item.img,
            tint: "#ffffff",
            name: this.item.name,
            description: "",
            transfer: game.settings.get('twodsix', "useItemActiveEffects"),
            disabled: false,
            _id: newId,
            //flags: {twodsix: {sourceId: newId}}  //Needed?
          }, {renderSheet: true, parent: this.item});
        } else {
          ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantCreateEffect"));
        }
      }
    }
  }

  private async _onEditEffect(): void {
    if (this.actor?.type === "ship" || this.actor?.type === "vehicle") {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantEditCreateInCargo"));
    } else if (await fromUuid(this.item.uuid)) {
      const editSheet = this.item.effects.contents[0].sheet?.render(true);
      try {
        editSheet?.bringToTop();
      } catch(err) {
        console.log(err);
      }
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantEditEffect"));
    }
  }

  private async _onDeleteEffect(): Promise<void> {
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
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantDeleteEffect"));
      }
    }
  }

  private getConsumable(event:Event):TwodsixItem | undefined {
    if (event.currentTarget) {
      const li = $(event.currentTarget).parents(".consumable");
      return <TwodsixItem>(this.item).actor?.items.get(li.data("consumableId"));
    } else {
      return undefined;
    }
  }

  private _onEditConsumable(event:Event): void {
    this.getConsumable(event)?.sheet?.render(true);
  }

  private async _onDeleteConsumable(event:Event): Promise<void> {
    const consumable = this.getConsumable(event);
    if (!consumable) {
      await (<TwodsixItem>this.item).removeConsumable("");
    } else {
      const body = game.i18n.localize("TWODSIX.Items.Consumable.RemoveConsumableFrom").replace("_CONSUMABLE_NAME_", <string>consumable.name).replace("_ITEM_NAME_", <string>this.item.name);

      if (await foundry.applications.api.DialogV2.confirm({
        window: {title: game.i18n.localize("TWODSIX.Items.Consumable.RemoveConsumable")},
        content: body,
      })) {
        if (consumable && consumable.id) {
          await (<TwodsixItem>this.item).removeConsumable(consumable.id);
          this.render();
        }
      }
    }
  }

  private async _onCreateConsumable(): Promise<void> {
    if (!this.item.isOwned) {
      console.error(`Twodsix | Consumables can only be created for owned items`);
      return;
    }
    const template = 'systems/twodsix/templates/items/dialogs/create-consumable.html';
    const consumablesList = foundry.utils.duplicate(TWODSIX.CONSUMABLES);
    if (this.item.type === "computer" || (this.item.type === "consumable" && ["processor", "suite"].includes(this.item.system.subtype))) {
      delete consumablesList["processor"];
      delete consumablesList["suite"];
    }
    const html = await renderTemplate(template, {
      consumables: consumablesList
    });
    new foundry.applications.api.DialogV2({
      window: {title: `${game.i18n.localize("TWODSIX.Items.Items.New")} ${game.i18n.localize("TWODSIX.itemTypes.consumable")}`},
      content: html,
      buttons: [
        {
          action: "ok",
          label: "TWODSIX.Create",
          callback: async (event, button, dialog) => {
            const buttonHtml = $(dialog);
            const max = parseInt(buttonHtml.find('.consumable-max').val() as string, 10) || 0;
            let equippedState = "";
            if (this.item.type !== "skills" && this.item.type !== "trait" && this.item.type !== "ship_position") {
              equippedState = this.item.system.equipped ?? "backpack";
            }
            const newConsumableData = {
              name: buttonHtml.find('.consumable-name').val() || game.i18n.localize("TYPES.Item.consumable"),
              type: "consumable",
              system: {
                subtype: buttonHtml.find('.consumable-subtype').val(),
                quantity: parseInt(buttonHtml.find('.consumable-quantity').val() as string, 10) || 0,
                currentCount: max,
                max: max,
                equipped: equippedState,
                isAttachment: ["processor", "software", "suite"].includes(buttonHtml.find('.consumable-subtype').val()) && this.item.type !== "consumable",
                parentName: this.item.name,
                parentType: this.item.type
              }
            };
            const newConsumable = await this.item.actor?.createEmbeddedDocuments("Item", [newConsumableData]);
            if (newConsumable) {
              await (<TwodsixItem>this.item).addConsumable(newConsumable[0].id);
              this.render();
            }
          }
        },
        {
          action: "cancel",
          label: "Cancel"
        }
      ],
      default: 'ok',
    }).render(true);
  }

  private async _onCreateAttachment():Promise<void> {
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
    const newConsumable = await this.item.actor?.createEmbeddedDocuments("Item", [newConsumableData]) || {};
    await (<TwodsixItem>this.item).addConsumable(newConsumable[0].id);
    this.render();
  }

  private async _onChangeUseConsumableForAttack(event): Promise<void> {
    await this.item.update({"system.useConsumableForAttack": $(event.currentTarget).val()});
    this.render();
  }

  private static check(cond: boolean, err: string) {
    if (cond) {
      throw new Error(game.i18n.localize(`TWODSIX.Errors.${err}`));
    }
  }

  protected async _onDrop(event: DragEvent): Promise<boolean | any> {
    event.preventDefault();
    try {
      const dropData = getDataFromDropEvent(event);
      TwodsixItemSheet.check(!dropData, "DraggingSomething");
      if (dropData.type === 'html' || dropData.type === 'pdf'){
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
      } else if (dropData.type === 'Item'){
        //This part handles just comsumables
        TwodsixItemSheet.check(!this.item.isOwned, "OnlyOwnedItems");
        TwodsixItemSheet.check(TWODSIX.WeightlessItems.includes(this.item.type), "TraitsandSkillsNoConsumables");

        TwodsixItemSheet.check(dropData.type !== "Item", "OnlyDropItems");

        const itemData = await getItemDataFromDropData(dropData);

        TwodsixItemSheet.check(itemData.type !== "consumable", "OnlyDropConsumables");
        TwodsixItemSheet.check(this.item.type === "consumable" && itemData.system.isAttachment, "CantDropAttachOnConsumables");

        // If the dropped item has the same actor as the current item let's just use the same id.
        let itemId: string;
        if (this.item.actor?.items.get(itemData.id)) {
          itemId = itemData.id;
        } else {
          const newItem = await this.item.actor?.createEmbeddedDocuments("Item", [itemData]);
          if (!newItem) {
            throw new Error(`Somehow could not create item ${itemData}`);
          }
          itemId = newItem[0].id;
        }
        await (<TwodsixItem>this.item).addConsumable(itemId);
      }
      this.render();
    } catch (err) {
      console.error(`Twodsix | ${err}`);
      ui.notifications.error(err);
    }
  }
}
