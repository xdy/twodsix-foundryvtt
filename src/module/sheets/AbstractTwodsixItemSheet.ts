// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { TWODSIX } from "../config";
import { getDataFromDropEvent, getDocFromDropData, isDisplayableSkill } from "../utils/sheetUtils";
import { sortByItemName } from "../utils/utils";

/**
 * Extend the basic ItemSheetV2 with some very simple modifications
 * @extends {ItemSheetV2}
 */
export abstract class AbstractTwodsixItemSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ItemSheetV2) {

  public async _onRender(context:any, options: any):void {
    await super._onRender(context, options);
    //need to create DragDrop listener as none in core
    if (game.user.isOwner && this.options.dragDrop) {
      (<object[]>this.options.dragDrop).forEach( (selector:{dragSelector: string, dropSelector:string}) => {
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

  async _prepareContext(options):any {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system; //convenience access to item.system data
    context.owner = this.actor;
    if (this.actor){
      //build Skills Pick List
      const skillsList: TwodsixItem[] = [];
      for (const skill of context.owner.itemTypes.skills) {
        if (isDisplayableSkill(<TwodsixItem>skill) || (skill.getFlag("twodsix", "untrainedSkill") === game.settings.get('twodsix', 'hideUntrainedSkills'))) {
          skillsList.push(<TwodsixItem>skill);
        }
      }
      context.skillsList = sortByItemName(skillsList);
    }
    return context;
  }

  /*******************
   *
   * Drag Drop Handling
   *
   *******************/

  /** @override */
  _canDragDrop(/*selector*/) {
    return this.isEditable && this.item.isOwner;
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} ev       The originating DragEvent
   * @protected
   */
  _onDragStart(ev: DragEvent):void {
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
   * @protected
   */
  _onDragOver(/*ev:DragEvent*/) {
  }

  /**
   * Callback actions which occur when dropping.  TWODSIX Specific!
   * @param {DragEvent} ev The originating DragEvent
   */
  async _onDrop(ev: DragEvent): Promise<boolean | any> {
    if (ev.target.classList.contains('ProseMirror') || ev.target.parentElement.className.includes('ProseMirror')) {
      return;
    }
    ev.preventDefault();
    try {
      const dropData = getDataFromDropEvent(ev);
      this.check(!dropData, "DraggingSomething");
      if (['html', 'pdf'].includes(dropData.type)){
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
        this.check(!this.item.isOwned, "OnlyOwnedItems");
        this.check(TWODSIX.WeightlessItems.includes(this.item.type), "TraitsandSkillsNoConsumables");

        this.check(dropData.type !== "Item", "OnlyDropItems");

        const itemData = await getDocFromDropData(dropData);

        this.check(itemData.type !== "consumable", "OnlyDropConsumables");
        this.check(this.item.type === "consumable" && itemData.system.isAttachment, "CantDropAttachOnConsumables");

        // If the dropped item has the same actor as the current item let's just use the same id.
        let itemId: string;
        if (this.item.actor?.items.get(itemData._id)) {
          itemId = itemData._id;
          //Check to see if consumable exists on another item for actor
          const previousItem:TwodsixItem = itemData.actor.items.find(it => it.system.consumables?.includes(itemId));
          if (previousItem) {
            await previousItem.removeConsumable(itemId, previousItem.system);
          }
        } else {
          const newItem = await (<TwodsixActor>this.item.actor)?.createEmbeddedDocuments("Item", [foundry.utils.duplicate(itemData)]);
          if (!newItem) {
            throw new Error(`Somehow could not create item ${itemData}`);
          }
          itemId = newItem[0].id;
        }
        await (<TwodsixItem>this.item).addConsumable(itemId);
      }
      this.render();
    } catch (err) {
      console.error(`Twodsix drop error| ${err}`);
      ui.notifications.error(err);
    }
  }

  private check(cond: boolean, err: string) {
    if (cond) {
      throw new Error(game.i18n.localize(`TWODSIX.Errors.${err}`));
    }
  }
}

export function onPasteStripFormatting(event): void {
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
