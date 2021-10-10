import TwodsixItem from "../entities/TwodsixItem";
import { getDataFromDropEvent, getItemDataFromDropData } from "../utils/sheetUtils";
import { TwodsixItemData } from "../../types/twodsix";

// @ts-ignore
export abstract class AbstractTwodsixActorSheet extends ActorSheet {

  /** @override */
  protected activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) {
      return;
    }

    // Add Inventory Item
    html.find('.item-create').on('click', this._onItemCreate.bind(this));

    // Update Inventory Item
    html.find('.item-edit').on('click', (ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    }));

    // Delete Item
    html.find('.item-delete').on('click', async (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const ownedItem = this.actor.items.get(li.data('itemId'));
      const title = game.i18n.localize("TWODSIX.Actor.DeleteOwnedItem");
      const template = `
      <form>
        <div>
          <div style="text-align: center;">${title}
             "<strong>${ownedItem.name}</strong>"?
          </div>
          <br>
        </div>
      </form>`;
      // @ts-ignore
      await Dialog.confirm({
        title: title,
        content: template,
        yes: async () => {
          // @ts-ignore
          // somehow on hooks isn't wokring when a consumable is deleted  - force the issue
          if (ownedItem.type === "consumable") {
            const tempItems = this.actor.items.filter(i => i.type !== "skills");
            tempItems.forEach(i => {
              if (i.data.data.consumables != undefined) {
                if (i.data.data.consumables.includes(ownedItem.id) || i.data.data.useConsumableForAttack === ownedItem.id) {
                  i.removeConsumable(ownedItem.id);
                }
              }
            });
          }

          await this.actor.deleteEmbeddedDocuments("Item", [ownedItem.id]);
          li.slideUp(200, () => this.render(false));
        },
        no: () => {
          //Nothing
        },
      });
    });
    // Drag events for macros.
    // @ts-ignore Until 0.8
    if (this.actor.isOwner) {
      const handler = ev => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) {
          return;
        }
        li.setAttribute("draggable", 'true');
        li.addEventListener("dragstart", handler, false);
      });
    }

    this.handleContentEditable(html);
  }

  _onDragStart(event: DragEvent): void {
    const header = event.currentTarget;
    if (!header["dataset"]) {
      return;
    }

    return super._onDragStart(event);
  }

  private handleContentEditable(html: JQuery) {
    html.find('div[contenteditable="true"][data-edit]').on(
      'focusout',
      this._onSubmit.bind(this)
    );
  }


  private updateWithItemSpecificValues(itemData: Record<string, any>, type: string): void {
    switch (type) {
      case "skills":
        if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
          itemData.data.value = game.system.template.Item.skills["value"];
        } else {
          itemData.data.value = 0;
        }
        break;
      case "weapon":
        if (game.settings.get('twodsix', 'hideUntrainedSkills')) {
          // @ts-ignore
          itemData.data.skill = this.actor.getUntrainedSkill().id;
        }
        break;
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onItemCreate(event: { preventDefault: () => void; currentTarget: HTMLElement }): Promise<void> {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const {type} = header.dataset;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset) as Record<string, any>;
    // Initialize a default name, handle bad naming of 'skills' item type, which should be singular.
    const itemType = (type === "skills" ? "skill" : type);
    data.name = game.i18n.localize("TWODSIX.Items.Items.New") + " " + game.i18n.localize("TWODSIX.itemTypes." + itemType);
    // Prepare the item object.
    const itemData = {
      name: data.name,
      type,
      data
    };

    // Remove the type from the dataset since it's in the itemData.type prop.
    // delete itemData.data.type;
    this.updateWithItemSpecificValues(itemData, type);

    // Finally, create the item!
    // @ts-ignore
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }


  /**
   * Special handling of skills dropping.
   */
  protected async _onDrop(event: DragEvent): Promise<boolean | any> {
    event.preventDefault();

    const data = getDataFromDropEvent(event);
    const actor = this.actor;

    if (!data) {
      console.log(`Twodsix | Dragging something that can't be dragged`);
      return false;
    }

    if (data.type === 'damageItem') {
      if (actor.data.type === 'traveller') {
        const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
        const showDamageDialog = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
        // @ts-ignore
        await this.actor.damageActor(data.payload["damage"], showDamageDialog);
      } else {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantAutoDamageShip"));
      }
      return false;
    }

    const itemData = await getItemDataFromDropData(data);

    switch (actor.data.type) {
      case 'traveller':
        if (itemData.type === 'skills') {
          return this.handleDroppedSkills(actor, itemData, data, event);
        } else if (!["component"].includes(itemData.type)) {
          return this.handleDroppedItem(actor, itemData, data, event);
        }
        break;
      case 'ship':
        if (!["augment", "skills", "trait"].includes(itemData.type)) {
          return this.handleDroppedItem(actor, itemData, data, event);
        }
        break;
    }
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantDragOntoActor"));
    return false;
  }

  private async handleDroppedSkills(actor: ActorSheet.Data<Actor> extends ActorSheet.Data<infer T> ? T : Actor, itemData: TwodsixItemData, data: Record<string, any>, event: DragEvent) {
    const matching = actor.data.items.filter(x => {
      // @ts-ignore
      return x.name === itemData.name;
    });

    // Handle item sorting within the same Actor
    const sameActor = (data.actorId === actor.id) || (actor.isToken && (data.tokenId === actor.token.id));
    if (sameActor) {
      // @ts-ignore
      console.log(`Twodsix | Moved Skill ${itemData.name} to another position in the skill list`);
      // @ts-ignore
      return this._onSortItem(event, itemData);
    }

    if (matching.length > 0) {
      // @ts-ignore
      console.log(`Twodsix | Skill ${itemData.name} already on character ${actor.name}.`);
      //TODO Maybe this should mean increase skill value?
      return false;
    }

    if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
      // @ts-ignore
      itemData.data.value = game.system.template.Item.skills.value;
    } else {
      // @ts-ignore
      itemData.data.value = 0;
    }

    // @ts-ignore
    await actor.createEmbeddedDocuments("Item", [itemData]);
    // @ts-ignore
    console.log(`Twodsix | Added Skill ${itemData.name} to character`);
  }

  private async handleDroppedItem(actor: ActorSheet.Data<Actor> extends ActorSheet.Data<infer T> ? T : Actor, itemData: TwodsixItemData, data: Record<string, any>, event: DragEvent) {
    // Handle item sorting within the same Actor
    const sameActor = (data.actorId === actor.id) || (actor.isToken && (data.tokenId === actor.token.id));
    if (sameActor) {
      // @ts-ignore
      return this._onSortItem(event, itemData);
    }

    //Remove any attached consumables
    // @ts-ignore
    if (itemData.data.consumables !== undefined) {
      if (itemData.data.consumables.length > 0) {
        // @ts-ignore
        itemData.data.consumables = [];
      }
    }

    //Link an actor skill with name defined by item.associatedSkillName
    if (itemData.data.associatedSkillName !== "") {
      itemData.data.skill = actor.items.getName(itemData.data.associatedSkillName)?.data._id;
    }

    // Create the owned item (TODO Add to type and remove the two lines below...)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this._onDropItemCreate(itemData);
  }

  protected static _prepareItemContainers(items, sheetData: any): void {

    // Initialize containers.
    const storage: Item[] = [];
    const equipment: Item[] = [];
    const weapon: Item[] = [];
    const armor: Item[] = [];
    const augment: Item[] = [];
    const tool: Item[] = [];
    const junk: Item[] = [];
    const skills: Item[] = [];
    const traits: Item[] = [];
    const consumable: Item[] = [];
    const component: Item[] = [];
    let encumbrance = 0;
    let primaryArmor = 0;
    let secondaryArmor = 0;
    let radiationProtection = 0;

    // Iterate through items, allocating to containers
    items.forEach((item: TwodsixItem) => {
      // item.img = item.img || CONST.DEFAULT_TOKEN; // apparent item.img is read-only..
      if (item.type !== "skills") {
        item.prepareConsumable();
      }
      if (sheetData.actor.type === "traveller") {
        if ((item.type === "weapon") || (item.type === "armor") ||
            (item.type === "equipment") || (item.type === "tool") ||
            (item.type === "junk") || (item.type === "consumable")) {
          if (item.data.data.equipped !== "ship") {
            const q = item.data.data.quantity || 0;
            let w = item.data.data.weight || 0;
            if (item.type === "armor" && item.data.data.equipped === "equipped") {
              w *= 0.25;
              primaryArmor += item.data.data.armor;
              secondaryArmor += item.data.data.secondaryArmor.value;
              radiationProtection += item.data.data.radiationProtection.value;
            }
            encumbrance += (q * w);
          }
        }
      }
      switch (item.type) {
        case 'storage':
          storage.push(item);
          break;
        case 'equipment':
        case 'tool':
        case 'junk':
          equipment.push(item);
          storage.push(item);
          break;
        case 'weapon':
          weapon.push(item);
          storage.push(item);
          break;
        case 'armor':
          armor.push(item);
          storage.push(item);
          break;
        case 'augment':
          augment.push(item);
          break;
        case 'skills':
          skills.push(item);
          break;
        case "trait":
          traits.push(item);
          break;
        case 'consumable':
          consumable.push(item);
          storage.push(item);
          break;
        case "component":
          component.push(item);
          break;
        default:
          break;
      }
    });

    // Assign and return
    sheetData.data.storage = storage;
    sheetData.data.equipment = equipment;
    sheetData.data.weapon = weapon;
    sheetData.data.armor = armor;
    sheetData.data.augment = augment;
    sheetData.data.tool = tool;
    sheetData.data.junk = junk;
    sheetData.data.consumable = consumable;
    sheetData.data.skills = skills;
    sheetData.data.traits = traits;
    sheetData.data.component = component;
    if (sheetData.actor.type === "traveller") {
      sheetData.data.primaryArmor.value = primaryArmor;
      sheetData.data.secondaryArmor.value = secondaryArmor;
      sheetData.data.radiationProtection.value = radiationProtection;
      sheetData.data.encumbrance.value = encumbrance;
    }
  }
}
