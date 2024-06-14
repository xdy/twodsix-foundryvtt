// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixItemSheet } from "./AbstractTwodsixItemSheet";
import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import { getDataFromDropEvent, getItemDataFromDropData, openPDFReference, deletePDFReference, openJournalEntry, getDifficultiesSelectObject, getRollTypeSelectObject, getConsumableOptions } from "../utils/sheetUtils";
import { Component, Gear } from "src/types/template";
import { getDamageTypes } from "../utils/sheetUtils";
import { getCharacteristicList } from "../utils/TwodsixRollSettings";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class TwodsixItemSheet extends AbstractTwodsixItemSheet {
  returnData: any; ///Not certain on this one or is it just 'data' ************

  /** @override */
  static get defaultOptions(): ItemSheet.Options {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "item"],
      submitOnClose: true,
      submitOnChange: true,
      tabs: [{navSelector: ".tabs", contentSelector: ".sheet-body", initial: "description"}],
      dragDrop: [{dropSelector: null, dragSelector: null}],
      resizable: true,
      width: 550,
      height: 'auto'
    });
  }

  /** @override */
  get template(): string {
    const path = "systems/twodsix/templates/items";
    return `${path}/${this.item.type}-sheet.html`;
  }
  /** @override */
  _canDragDrop() {
    //console.log("got to drop check", selector);
    return this.isEditable && this.item.isOwner;
  }
  /* -------------------------------------------- */

  /** @override */
  getData(): ItemSheet {
    const returnData = super.getData();
    //returnData.actor = returnData.data;

    (<TwodsixItem>this.item).prepareConsumable();
    // Add relevant data from system settings
    returnData.settings = {
      ShowLawLevel: game.settings.get('twodsix', 'ShowLawLevel'),
      ShowRangeBandAndHideRange: ['CE_Bands', 'CT_Bands'].includes(game.settings.get('twodsix', 'rangeModifierType')),
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
      rangeTypes: game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands' ? TWODSIX.CT_WEAPON_RANGE_TYPES.long : TWODSIX.CE_WEAPON_RANGE_TYPES.long,
      useCTData: game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands' || game.settings.get('twodsix', 'ruleset') === 'CT',
      rollTypes: getRollTypeSelectObject(),
      augLocations: TWODSIX.AUG_LOCATIONS,
      consumableOptions: getConsumableOptions(this.item),
      itemTypes: TWODSIX.ITEM_TYPE_SELECT
    };

    if (this.item.type === 'skills') {
      returnData.settings.characteristicsList = getCharacteristicList(this.item.actor);
      //Set characterisitic, making certin it is valid choice
      if (Object.keys(returnData.settings.characteristicsList).includes(this.item.system.characteristic)) {
        returnData.system.initialCharacteristic = this.item.system.characteristic;
      } else {
        returnData.system.initialCharacteristic = 'NONE';
      }
    }

    //prevent processor attachements to software
    returnData.config = foundry.utils.duplicate(TWODSIX);

    if (this.actor && this.item.type === "consumable" ) {
      const onComputer = this.actor.items.find(it => it.type === "computer" && it.system.consumables.includes(this.item.id));
      if(onComputer) {
        delete returnData.config.CONSUMABLES.processor;
      }
    }

    // Disable Melee Range DM if designated as Melee weapon
    if (this.item.type === 'weapon') {
      returnData.disableMeleeRangeDM = (typeof this.item.system.range === 'string') ? this.item.system.range.toLowerCase() === 'melee' : false;
    }

    return returnData;
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options: Partial<Application.Position> = {}): (Application.Position & { height: number }) | void {
    const position: Application.Position = <Application.Position>super.setPosition(options);
    const sheetBody = (this.element as JQuery).find(".sheet-body");
    const bodyHeight = <number>position.height - 192;
    sheetBody.css("height", bodyHeight);
    return <(Application.Position & { height: number }) | void>position;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) {
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
    html.find(`[name="type"]`).on('change', this._changeType.bind(this));
    html.find(`[name="system.nonstackable"]`).on('change', this._changeNonstackable.bind(this));
    html.find(`[name="system.equipped"]`).on('change', this._changeEquipped.bind(this));
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
      if (["software", "processor"].includes(this.item.system.subtype)) {
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
    /*Unset active effect if storage or junk*/
    let disableState = true;
    if (!["storage", "junk"].includes(event.currentTarget.value)) {
      disableState = (this.item.system.equipped !== "equipped" && !["trait"].includes(event.currentTarget.value));
    } else {
      await this.item.update({"system.priorType": this.item.type});
    }
    await (<TwodsixItem>this.item).toggleActiveEffectStatus(disableState);
    //await this.item.update({"system.type": event.currentTarget.value});
    //await this.render(false);
  }

  /* -------------------------------------------- */
  /** @override */
  // Kludge to fix consumables dissapearing when updating item sheet
  async _onChangeInput(event) {
    //console.log(event);
    if (event.currentTarget?.name !== 'type') {
      await super._onChangeInput(event);
    } else {
      await this.item.update({"system.type": event.currentTarget.value, "type": event.currentTarget.value});
    }
    //await (<TwodsixItem>this.item).prepareConsumable();
    this.item?.sheet?.render();
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

  private _changeEquipped(event) {
    if (this.item.isEmbedded) {
      const newDiabledState = event.currentTarget.value !== 'equipped';
      const updates = [];
      for (const effect of this.item.effects) {
        if (effect.disabled !== newDiabledState) {
          updates.push({_id: effect.id, disabled: newDiabledState});
        }
      }
      if (updates.length > 0) {
        this.item.updateEmbeddedDocuments('ActiveEffect', updates);
      }
    }
  }

  private async _onCreateEffect(): Promise<void> {
    if (this.actor?.type === "ship" || this.actor?.type === "vehicle") {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantEditCreateInCargo"));
    } else {
      const newId = foundry.utils.randomID();
      if(game.settings.get('twodsix', 'useItemActiveEffects')) {
        const effects = [new ActiveEffect({
          origin: undefined, //UUID? this.item.uuid
          icon: this.item.img,
          tint: "#ffffff",
          name: this.item.name,
          description: "",
          transfer: game.settings.get('twodsix', "useItemActiveEffects"),
          disabled: (<Gear>this.item.system).equipped !== undefined && (<Gear>this.item.system).equipped !== "equipped" && !["trait"].includes(this.item.type),
          _id: newId,
          flags: {twodsix: {sourceId: newId}}
        }).toObject()];
        if (await fromUuid(this.item.uuid)) {
          await this.item.createEmbeddedDocuments('ActiveEffect', effects);
          await this.item.effects.contents[0]?.sheet?.render(true);
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
        //nothing
      }
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantEditEffect"));
    }
  }

  private async _onDeleteEffect(): Promise<void> {
    await Dialog.confirm({
      title: game.i18n.localize("TWODSIX.ActiveEffects.DeleteEffect"),
      content: game.i18n.localize("TWODSIX.ActiveEffects.ConfirmDelete"),
      yes: async () => {
        if (await fromUuid(this.item.uuid)) {
          await this.item.deleteEmbeddedDocuments('ActiveEffect', [], {deleteAll: true});
          if (this.item.actor) {
            this.item.actor.sheet.render(false);
          }
        } else {
          ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantDeleteEffect"));
        }
      },
      no: () => {
        //Nothing
      }
    });
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
      (<TwodsixItem>this.item).removeConsumable(""); //TODO Should have await?
    } else {
      const body = game.i18n.localize("TWODSIX.Items.Consumable.RemoveConsumableFrom").replace("_CONSUMABLE_NAME_", `"<strong>${consumable.name}</strong>"`).replace("_ITEM_NAME_", <string>this.item.name);

      await Dialog.confirm({
        title: game.i18n.localize("TWODSIX.Items.Consumable.RemoveConsumable"),
        content: `<div class="remove-consumable">${body}<br><br></div>`,
        yes: async () => {
          if (consumable && consumable.id) {
            await (<TwodsixItem>this.item).removeConsumable(consumable.id); //TODO Should have await?
            this.render();
          }
        },
        no: () => {
          //Nothing
        },
      });
    }
  }

  private async _onCreateConsumable(): Promise<void> {
    if (!this.item.isOwned) {
      console.error(`Twodsix | Consumables can only be created for owned items`);
      return;
    }
    const template = 'systems/twodsix/templates/items/dialogs/create-consumable.html';
    const consumablesList = foundry.utils.duplicate(TWODSIX.CONSUMABLES);
    if (this.item.type === "computer" ) {
      delete consumablesList["processor"];
    }
    const html = await renderTemplate(template, {
      consumables: consumablesList
    });
    new Dialog({
      title: `${game.i18n.localize("TWODSIX.Items.Items.New")} ${game.i18n.localize("TWODSIX.itemTypes.consumable")}`,
      content: html,
      buttons: {
        ok: {
          label: game.i18n.localize("TWODSIX.Create"),
          callback: async (buttonHtml: JQuery) => {
            const max = parseInt(buttonHtml.find('.consumable-max').val() as string, 10) || 0;
            let equippedState = "";
            if (this.item.type !== "skills" && this.item.type !== "trait" && this.item.type !== "ship_position") {
              equippedState = this.item.system.equipped ?? "backpack";
            }
            const newConsumableData = {
              name: buttonHtml.find('.consumable-name').val(),
              type: "consumable",
              system: {
                subtype: buttonHtml.find('.consumable-subtype').val(),
                quantity: parseInt(buttonHtml.find('.consumable-quantity').val() as string, 10) || 0,
                currentCount: max,
                max: max,
                equipped: equippedState,
                isAttachment: ["processor", "software"].includes(buttonHtml.find('.consumable-subtype').val())
              }
            };
            const newConsumable = await this.item.actor?.createEmbeddedDocuments("Item", [newConsumableData]) || {};
            await (<TwodsixItem>this.item).addConsumable(newConsumable[0].id);
            this.render();
          }
        },
        cancel: {
          label: game.i18n.localize("Cancel")
        }
      },
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
        isAttachment: true
      }
    };
    const newConsumable = await this.item.actor?.createEmbeddedDocuments("Item", [newConsumableData]) || {};
    //newConsumable.update({"system.isAttachment": true});
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
        TwodsixItemSheet.check(["skills", "trait", "spell"].includes(this.item.type), "TraitsandSkillsNoConsumables");

        TwodsixItemSheet.check(dropData.type !== "Item", "OnlyDropItems");

        const itemData = await getItemDataFromDropData(dropData);

        TwodsixItemSheet.check(itemData.type !== "consumable", "OnlyDropConsumables");

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
