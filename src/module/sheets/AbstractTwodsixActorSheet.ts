// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixItem from "../entities/TwodsixItem";
import {getDataFromDropEvent, getItemDataFromDropData} from "../utils/sheetUtils";
import TwodsixActor from "../entities/TwodsixActor";
import {Armor, Skills, UsesConsumables, Component} from "../../types/template";
import { TwodsixShipSheetData } from "../../types/twodsix";
import {onPasteStripFormatting} from "../sheets/AbstractTwodsixItemSheet";


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
            const selectedActor = this.actor.isToken ? this.token?.actor : this.actor;
            await selectedActor?.deleteEmbeddedDocuments("Item", [<string>ownedItem.id]);
            // somehow on hooks isn't working when a consumable is deleted  - force the issue
            if (ownedItem.type === "consumable") {
              selectedActor?.items.filter(i => i.type !== "skills" && i.type !== "trait").forEach(async i => {
                const consumablesList = (<UsesConsumables>i.system).consumables;
                let usedForAttack = (<UsesConsumables>i.system).useConsumableForAttack;
                if (consumablesList != undefined) {
                  if (consumablesList.includes(ownedItem.id) || usedForAttack === ownedItem.id) {
                    //await (<TwodsixItem>i).removeConsumable(<string>ownedItem.id);
                    const index = consumablesList.indexOf(ownedItem.id);
                    if (index > -1) {
                      consumablesList.splice(index, 1); // 2nd parameter means remove one item only
                    }
                    if (usedForAttack === ownedItem.id) {
                      usedForAttack = "";
                    }
                    selectedActor.updateEmbeddedDocuments('Item', [{_id: i.id, 'system.consumables': consumablesList, 'system.useConsumableForAttack': usedForAttack}]);
                  }
                }
              });
            }
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
    html.find('div[contenteditable="true"][data-edit]').on(
      'paste',
      onPasteStripFormatting.bind(this)
    );
  }

  private updateWithItemSpecificValues(itemData:Record<string, any>, type:string, subtype = "otherInternal"):void {
    switch (type) {
      case "skills":
        if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
          const skills:Skills = <Skills>game.system.template?.Item?.skills;
          itemData.system.value = skills?.value;
        } else {
          itemData.system.value = 0;
        }
        break;
      case "weapon":
        if (game.settings.get('twodsix', 'hideUntrainedSkills')) {
          itemData.system.skill = (<TwodsixActor>this.actor).getUntrainedSkill().id;
        }
        if (!itemData?.img) {
          itemData.img = 'systems/twodsix/assets/icons/default_weapon.png';
        }
        break;
      case "component":
        itemData.system.subtype = subtype || "otherInternal";
        if (subtype === "power") {
          itemData.system.generatesPower = true;
        }
        itemData.system.status = "operational";
        itemData.img = "systems/twodsix/assets/icons/components/" + itemData.system.subtype + ".svg";
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
    let itemName = game.i18n.localize("TWODSIX.Items.Items.New") + " ";

    if (itemType === "component") {
      itemName += game.i18n.localize("TWODSIX.Items.Component." + (header.dataset.subtype || "otherInternal"));
    } else {
      itemName += game.i18n.localize("TWODSIX.itemTypes." + itemType);
    }
    // Prepare the item object.
    const itemData = {
      name: itemName,
      type,
      system: data
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

    const dropData = getDataFromDropEvent(event);
    const actor = this.actor;

    if (!dropData) {
      console.log(`Twodsix | Dragging something that can't be dragged`);
      return false;
    }

    if (dropData.type === 'damageItem') {
      if (actor.type === 'traveller') {
        const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
        const showDamageDialog = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
        await (<TwodsixActor>this.actor).damageActor(dropData.payload.damage, dropData.payload.armorPiercingValue, showDamageDialog);
      } else {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantAutoDamage"));
      }
      return false;
    }

    // Handle dropped scene on ship sheet
    if (dropData.type === "Scene") {
      if (actor.type === 'ship') {
        const scene = await fromUuidSync(dropData.uuid);
        actor.update({"system.deckPlan": scene.id});
      }
      return false;
    }

    const itemData = await getItemDataFromDropData(dropData);

    switch (actor.type) {
      case 'traveller':
        if (itemData.type === 'skills') {
          return this.handleDroppedSkills(actor, itemData);
        } else if (!["component"].includes(itemData.type)) {
          return this.handleDroppedItem(actor, itemData);
        }
        break;
      case 'ship':
        if (!["augment", "skills", "trait"].includes(itemData.type)) {
          return this.handleDroppedItem(actor, itemData);
        }
        break;
      case 'vehicle':
        if (itemData.type === "component" && itemData.system.subtype === "armament") {
          return this.handleDroppedItem(actor, itemData);
        }
        break;
    }
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.CantDragOntoActor"));
    return false;
  }

  private async handleDroppedSkills(actor, itemData) {
    const matching = actor.items.filter(x => {
      return x.name === itemData.name;
    });

    // Handle item sorting within the same Actor
    const sameActor = actor.items.get(itemData._id);;
    if (sameActor) {
      console.log(`Twodsix | Moved Skill ${itemData.name} to another position in the skill list`);
      //return this._onSortItem(event, sameActor);
      return false;
    }

    if (matching.length > 0) {
      console.log(`Twodsix | Skill ${itemData.name} already on character ${actor.name}.`);
      //TODO Maybe this should mean increase skill value?
      return false;
    }

    if (itemData.system.value < 0 || !itemData.system.value) {
      if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
        const skills: Skills = <Skills>game.system.template.Item?.skills;
        itemData.system.value = skills?.value;
      } else {
        itemData.system.value = 0;
      }
    }

    await actor.createEmbeddedDocuments("Item", [itemData]);
    console.log(`Twodsix | Added Skill ${itemData.name} to character`);
  }

  private async handleDroppedItem(actor:Actor, itemData) {
    // Handle item sorting within the same Actor
    const sameActor = actor.items.get(itemData._id);
    if (sameActor) {
      //return this._onSortItem(event, sameActor);
      return false;
    }

    //Remove any attached consumables
    if (itemData.system.consumables !== undefined) {
      if (itemData.system.consumables.length > 0) {
        itemData.system.consumables = [];
      }
    }

    //Link an actor skill with name defined by item.associatedSkillName
    if (itemData.system.associatedSkillName !== "") {
      itemData.system.skill = actor.items.getName(itemData.system.associatedSkillName)?.id;
      //Try to link Untrained if no match
      if (!itemData.system.skill) {
        itemData.system.skill = (<TwodsixActor>actor).getUntrainedSkill()?.id;
      }
    }

    // Create the owned item (TODO Add to type and remove the two lines below...)
    return this._onDropItemCreate(itemData);
  }

  private static _getWeight(item):number {
    if ((item.type === "weapon") || (item.type === "armor") ||
      (item.type === "equipment") || (item.type === "tool") ||
      (item.type === "junk") || (item.type === "consumable")) {
      if (item.system.equipped !== "ship") {
        let q = item.system.quantity || 0;
        const w = item.system.weight || 0;
        if (item.type === "armor" && item.system.equipped === "equipped") {
          if (item.system.isPowered) {
            q = Math.max(0, q - 1);
          } else {
            q = Math.max(0, q - 1 + Number(game.settings.get("twodsix", "weightModifierForWornArmor")));
          }
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
    const spells:Item[] = [];
    const consumable:Item[] = [];
    const component = {};
    let encumbrance = 0;
    let primaryArmor = 0;
    let secondaryArmor = 0;
    let radiationProtection = 0;
    let numberOfSkills = 0;
    let skillRanks = 0;
    const summaryStatus = {};
    const statusOrder = {"operational": 1, "damaged": 2, "destroyed": 3, "off": 0};

    // Iterate through items, allocating to containers
    items.forEach((item:TwodsixItem) => {
      // item.img = item.img || CONST.DEFAULT_TOKEN; // apparent item.img is read-only..
      if (item.type !== "skills") {
        item.prepareConsumable();
      }
      if (sheetData.actor.type === "traveller") {
        encumbrance += AbstractTwodsixActorSheet._getWeight(item);
        const anArmor = <Armor>item.system;
        if (item.type === "armor" && anArmor.equipped === "equipped") {
          primaryArmor += anArmor.armor;
          secondaryArmor += anArmor.secondaryArmor.value;
          radiationProtection += anArmor.radiationProtection.value;
        } else if (item.type === "skills") {
          if (item.system.value >= 0 && !item.getFlag("twodsix", "untrainedSkill")) {
            numberOfSkills += 1;
            skillRanks += Number(item.system.value);
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
        case "spell":
          spells.push(item);
          break;
        case 'consumable':
          consumable.push(item);
          storage.push(item);
          break;
        case "component":
          if(component[(<Component>item.system).subtype] === undefined) {
            component[(<Component>item.system).subtype] = [];
            summaryStatus[(<Component>item.system).subtype] = {
              status: item.system.status,
              uuid: item.uuid
            };
          }
          component[(<Component>item.system).subtype].push(item);
          if (statusOrder[summaryStatus[(<Component>item.system).subtype]] < statusOrder[item.system.status]) {
            summaryStatus[(<Component>item.system).subtype] = {
              status: item.system.status,
              uuid: item.uuid
            };
          }
          break;
        default:
          break;
      }
    });
    // Calc Max Encumbrance
    let maxEncumbrance = 0;
    const encumbFormula = game.settings.get('twodsix', 'maxEncumbrance');
    if (Roll.validate(encumbFormula)) {
      maxEncumbrance = new Roll(encumbFormula, sheetData.actor.system).evaluate({async: false}).total;
    } else {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.EncumbranceFormulaInvalid"));
    }

    // Assign and return sheetData.data to sheetData.system????
    if (sheetData.actor.type === "traveller") {
      sheetData.container.equipment = equipment;
      sheetData.container.weapon = weapon;
      sheetData.container.armor = armor;
      sheetData.container.augment = augment;
      sheetData.container.tool = tool;
      sheetData.container.junk = junk;
      sheetData.container.consumable = consumable;
      sheetData.container.skills = skills;
      sheetData.container.traits = traits;
      sheetData.container.spells = spells;
      sheetData.system.primaryArmor.value = primaryArmor;
      sheetData.system.secondaryArmor.value = secondaryArmor;
      sheetData.system.radiationProtection.value = radiationProtection;
      sheetData.system.encumbrance.value = Math.round(encumbrance * 10) / 10; /*Round value to nearest tenth*/
      sheetData.system.encumbrance.max = Math.round((maxEncumbrance || 0)* 10) / 10;
      sheetData.numberOfSkills = numberOfSkills + (sheetData.jackOfAllTrades > 0 ? 1 : 0);
      sheetData.skillRanks = skillRanks + sheetData.jackOfAllTrades;
    } else if (sheetData.actor.type === "ship" || sheetData.actor.type === "vehicle" ) {
      sheetData.component = sortObj(component);
      sheetData.summaryStatus = sortObj(summaryStatus);
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
