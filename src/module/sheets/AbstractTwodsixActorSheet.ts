import TwodsixItem from "../entities/TwodsixItem";
import {getDataFromDropEvent, getItemDataFromDropData} from "../utils/sheetUtils";
import TwodsixActor from "../entities/TwodsixActor";
import {Armor, Skills, UsesConsumables, Component} from "../../types/template";
import { TwodsixShipSheetData } from "../../types/twodsix";



export abstract class AbstractTwodsixActorSheet extends ActorSheet {

  /** @override */
  public activateListeners(html:JQuery):void {
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
      item?.sheet?.render(true);
    }));

    // Delete Item
    html.find('.item-delete').on('click', async (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const ownedItem = this.actor.items.get(li.data('itemId')) || null;
      const title = game.i18n.localize("TWODSIX.Actor.DeleteOwnedItem");
      const template = `
      <form>
        <div>
          <div style="text-align: center;">${title}
             "<strong>${ownedItem?.name}</strong>"?
          </div>
          <br>
        </div>
      </form>`;
      if (ownedItem) {
        await Dialog.confirm({
          title: title,
          content: template,
          yes: async () => {
            // somehow on hooks isn't working when a consumable is deleted  - force the issue
            if (ownedItem.type === "consumable") {
              this.actor.items.filter(i => i.type !== "skills").forEach(i => {
                const usesConsumables:UsesConsumables = <UsesConsumables>i.data.data;
                if (usesConsumables.consumables != undefined) {
                  if (usesConsumables.consumables.includes(ownedItem.id) || usesConsumables.useConsumableForAttack === ownedItem.id) {
                    (<TwodsixItem>i).removeConsumable(<string>ownedItem.id);
                  }
                }
              });
            }

            await this.actor.deleteEmbeddedDocuments("Item", [<string>ownedItem.id]);
            li.slideUp(200, () => this.render(false));
          },
          no: () => {
            //Nothing
          },
        });
      }
    });
    // Drag events for macros.
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

  _onDragStart(event:DragEvent):void {
    if (event.currentTarget && !(event.currentTarget)["dataset"]) {
      return;
    }

    return super._onDragStart(event);
  }

  private handleContentEditable(html:JQuery) {
    html.find('div[contenteditable="true"][data-edit]').on(
      'focusout',
      this._onSubmit.bind(this)
    );
  }

  private updateWithItemSpecificValues(itemData:Record<string, any>, type:string, subtype = "otherInternal"):void {
    switch (type) {
      case "skills":
        if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
          const skills:Skills = <Skills>game.system.template?.Item?.skills;
          itemData.data.value = skills?.value;
        } else {
          itemData.data.value = 0;
        }
        break;
      case "weapon":
        if (game.settings.get('twodsix', 'hideUntrainedSkills')) {
          itemData.data.skill = (<TwodsixActor>this.actor).getUntrainedSkill().id;
        }
        if (!itemData?.img) {
          itemData.img = 'systems/twodsix/assets/icons/default_weapon.png';
        }
        break;
      case "component":
        itemData.data.subtype = subtype || "otherInternal";
        itemData.data.status = "operational";
        itemData.img = "systems/twodsix/assets/icons/components/" + itemData.data.subtype + ".svg";
        break;
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onItemCreate(event:{ preventDefault:() => void; currentTarget:HTMLElement }):Promise<void> {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const {type} = header.dataset;

    // Grab any data associated with this control.
    const data = duplicate(header.dataset) as Record<string, any>;

    // Initialize a default name, handle bad naming of 'skills' item type, which should be singular.
    const itemType = (type === "skills" ? "skill" : type);
    data.name = game.i18n.localize("TWODSIX.Items.Items.New") + " ";

    if (itemType === "component") {
      data.name += game.i18n.localize("TWODSIX.Items.Component." + (header.dataset.subtype || "otherInternal"));
    } else {
      data.name += game.i18n.localize("TWODSIX.itemTypes." + itemType);
    }
    // Prepare the item object.
    const itemData = {
      name: data.name,
      type,
      data
    };

    // Remove the type from the dataset since it's in the itemData.type prop.
    // delete itemData.data.type;
    this.updateWithItemSpecificValues(itemData, <string>type, <string>header.dataset.subtype);

    // Finally, create the item!
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }


  /**
   * Special handling of skills dropping.
   */
  protected async _onDrop(event:DragEvent):Promise<boolean | any> {
    event.preventDefault();

    const data = getDataFromDropEvent(event);
    const actor = this.actor;

    if (!data) {
      console.log(`Twodsix | Dragging something that can't be dragged`);
      return false;
    }

    if (data.type === 'damageItem') {
      if (actor.data.type === 'traveller') {
        const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
        const showDamageDialog = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
        await (<TwodsixActor>this.actor).damageActor(data.payload.damage, data.payload.armorPiercingValue, showDamageDialog);
      } else {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantAutoDamageShip"));
      }
      return false;
    }

    // Handle dropped scene on ship sheet
    if (data.type === "Scene") {
      if (actor.data.type === 'ship') {
        actor.update({"data.deckPlan": data.id});
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

  private async handleDroppedSkills(actor, itemData, data:Record<string, any>, event:DragEvent) {
    const matching = actor.data.items.filter(x => {
      return x.name === itemData.name;
    });

    // Handle item sorting within the same Actor
    const sameActor = (data.actorId === actor.id) || (actor.isToken && (data.tokenId === actor.token?.id));
    if (sameActor) {
      console.log(`Twodsix | Moved Skill ${itemData.name} to another position in the skill list`);
      return this._onSortItem(event, itemData);
    }

    if (matching.length > 0) {
      console.log(`Twodsix | Skill ${itemData.name} already on character ${actor.name}.`);
      //TODO Maybe this should mean increase skill value?
      return false;
    }

    if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
      const skills:Skills = <Skills>game.system.template.Item?.skills;
      itemData.data.value = skills?.value;
    } else {
      itemData.data.value = 0;
    }

    await actor.createEmbeddedDocuments("Item", [itemData]);
    console.log(`Twodsix | Added Skill ${itemData.name} to character`);
  }

  private async handleDroppedItem(actor:Actor, itemData, data:Record<string, any>, event:DragEvent) {
    // Handle item sorting within the same Actor
    const sameActor = (data.actorId === actor.id) || (actor.isToken && (data.tokenId === actor.token?.id));
    if (sameActor) {
      return this._onSortItem(event, itemData);
    }

    //Remove any attached consumables
    if (itemData.data.consumables !== undefined) {
      if (itemData.data.consumables.length > 0) {
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

  private static _getWeight(item):number {
    if ((item.type === "weapon") || (item.type === "armor") ||
      (item.type === "equipment") || (item.type === "tool") ||
      (item.type === "junk") || (item.type === "consumable")) {
      if (item.data.data.equipped !== "ship") {
        const q = item.data.data.quantity || 0;
        let w = item.data.data.weight || 0;
        if (item.type === "armor" && item.data.data.equipped === "equipped") {
          w *= Number(game.settings.get("twodsix", "weightModifierForWornArmor"));
        }
        return (q * w);
      }
    }
    return 0;
  }

  protected static _prepareItemContainers(items, sheetData:TwodsixShipSheetData|any):void {

    // Initialize containers.
    const storage:Item[] = [];
    const equipment:Item[] = [];
    const weapon:Item[] = [];
    const armor:Item[] = [];
    const augment:Item[] = [];
    const tool:Item[] = [];
    const junk:Item[] = [];
    const skills:Item[] = [];
    const traits:Item[] = [];
    const consumable:Item[] = [];
    const component = {};
    let encumbrance = 0;
    let primaryArmor = 0;
    let secondaryArmor = 0;
    let radiationProtection = 0;

    // Iterate through items, allocating to containers
    items.forEach((item:TwodsixItem) => {
      // item.img = item.img || CONST.DEFAULT_TOKEN; // apparent item.img is read-only..
      if (item.type !== "skills") {
        item.prepareConsumable();
      }
      if (sheetData.actor.type === "traveller") {
        encumbrance += AbstractTwodsixActorSheet._getWeight(item);
        const anArmor = <Armor>item.data.data;
        if (item.type === "armor" && anArmor.equipped === "equipped") {
          primaryArmor += anArmor.armor;
          secondaryArmor += anArmor.secondaryArmor.value;
          radiationProtection += anArmor.radiationProtection.value;
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
          if(component[(<Component>item.data.data).subtype] === undefined) {
            component[(<Component>item.data.data).subtype] = [];
          }
          component[(<Component>item.data.data).subtype].push(item);
          break;
        default:
          break;
      }
    });

    // Assign and return
    if (sheetData.actor.type === "traveller") {
      sheetData.data.equipment = equipment;
      sheetData.data.weapon = weapon;
      sheetData.data.armor = armor;
      sheetData.data.augment = augment;
      sheetData.data.tool = tool;
      sheetData.data.junk = junk;
      sheetData.data.consumable = consumable;
      sheetData.data.skills = skills;
      sheetData.data.traits = traits;
      sheetData.data.primaryArmor.value = primaryArmor;
      sheetData.data.secondaryArmor.value = secondaryArmor;
      sheetData.data.radiationProtection.value = radiationProtection;
      sheetData.data.encumbrance.value = Math.round(encumbrance * 10) / 10; /*Round value to nearest tenth*/
    } else if (sheetData.actor.type === "ship") {
      sheetData.component = sortObj(component);
      sheetData.storage = storage;
    } else {
      console.log("Unrecognized Actor in AbstractActorSheet");
    }
  }
}

function sortObj(obj) {
  return Object.keys(obj).sort().reduce(function (result, key) {
    result[key] = obj[key];
    return result;
  }, {});
}
