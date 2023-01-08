// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixItem, { onRollDamage }  from "../entities/TwodsixItem";
import {getDataFromDropEvent, getItemDataFromDropData, isDisplayableSkill} from "../utils/sheetUtils";
import TwodsixActor from "../entities/TwodsixActor";
import {Skills, UsesConsumables, Component} from "../../types/template";
import { TwodsixShipSheetData } from "../../types/twodsix";
import {onPasteStripFormatting} from "../sheets/AbstractTwodsixItemSheet";
//import { getKeyByValue } from "../utils/sheetUtils";
import { resolveUnknownAutoMode } from "../utils/rollItemMacro";
import { TWODSIX } from "../config";
//import { applyEncumberedEffect } from "../hooks/showStatusIcons";

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

    // Handle format stripping for content editable
    html.find('div[contenteditable="true"][data-edit]').on('focusout', this._onSubmit.bind(this));
    html.find('div[contenteditable="true"][data-edit]').on('paste', onPasteStripFormatting.bind(this));

    //Non-ship actors listeners
    if (this.actor.type !== "ship") {
      // Handle click for attack roll
      html.find('.perform-attack').on('click', this._onRollWrapper(this._onPerformAttack));
      if (this.actor.type != "vehicle") {  //Vehcile has a special skill roll
        html.find('.rollable').on('click', this._onRollWrapper(this._onSkillRoll));
      }
      html.find('.rollable-characteristic').on('click', this._onRollWrapper(this._onRollChar));
      if (this.actor.type != "space-object") {  //Space Object has a non-item damage roll
        html.find('.roll-damage').on('click', onRollDamage.bind(this));
      }
      //add hooks to allow skill levels consumable counts to be updated on skill and equipment tabs, repectively
      html.find(".item-value-edit").on("input", this._onItemValueEdit.bind(this));
      html.find(".item-value-edit").on("click", (event) => {
        $(event.currentTarget).trigger("select");
      });

      //display trait item to chat
      html.find(".showChat").on("click", this._onSendToChat.bind(this));

      //Roll initiative from traveller sheet
      html.find(".roll-initiative").on("click", this._onRollInitiative.bind(this));

      //Edit active effect shown on actor
      html.find('.condition-icon').on('click', this._onEditEffect.bind(this));
      html.find('.condition-icon').on('contextmenu', this._onDeleteEffect.bind(this));
    }
  }

  /**
   * Handle clickable weapon attacks.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   */
  protected async _onPerformAttack(event, showThrowDiag: boolean): Promise<void> {
    const attackType = event.currentTarget["dataset"].attackType;
    const rof = event.currentTarget["dataset"].rof ? parseInt(event.currentTarget["dataset"].rof, 10) : null;
    const item = this.getItem(event);
    //console.log("Sheet Item Attack: ", item);
    if (this.options.template?.includes("npc-sheet")) {
      resolveUnknownAutoMode(item);
    } else {
      await item.performAttack(attackType, showThrowDiag, rof);
    }
  }

  _onDragStart(event:DragEvent):void {
    if (event.currentTarget && !(event.currentTarget)["dataset"]) {
      return;
    }

    return super._onDragStart(event);
  }

  protected updateWithItemSpecificValues(itemData:Record<string, any>, type:string, subtype = "otherInternal"):void {
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
      case "spell":
        if (!itemData?.img) {
          itemData.img = 'systems/twodsix/assets/icons/spell-book.svg';
        }
        break;
      case "consumable":
        itemData.system.subtype = "other";
        if (subtype === "attachment") {
          itemData.system.isAttachment = true;
          itemData.name = game.i18n.localize("TWODSIX.Items.Equipment.NewAttachment");
        } else {
          itemData.system.max = 1;
        }
        break;
    }
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  protected async _onItemCreate(event:{ preventDefault:() => void; currentTarget:HTMLElement }):Promise<void> {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const {type} = header.dataset;

    // Grab any data associated with this control.
    //const data = duplicate(header.dataset) as Record<string, any>;

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
      system: {}
    };

    // Remove the type from the dataset since it's in the itemData.type prop.
    // delete itemData.data.type;
    this.updateWithItemSpecificValues(itemData, <string>type, <string>header.dataset.subtype);

    // Finally, create the item!
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  /**
   * Process dropped information.
   */
  protected async _onDrop(event:DragEvent):Promise<boolean | any> {
    event.preventDefault();
    const dropData = getDataFromDropEvent(event);
    const actor = <TwodsixActor>this.actor;

    if (!dropData) {
      console.log(`Twodsix | Dragging something that can't be dragged`);
      return false;
    }

    if (dropData.type === 'damageItem') {
      const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showDamageDialog = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
      return actor.handleDamageData(dropData.payload, showDamageDialog);
    }

    // Handle dropped scene on ship sheet
    if (dropData.type === "Scene") {
      if (actor.type === 'ship') {
        const scene = await fromUuidSync(dropData.uuid);
        actor.update({"system.deckPlan": scene.id});
      }
      return false;
    }

    //Handle droped pdf reference for vehicle sheet
    if (dropData.type === 'html' || dropData.type === 'pdf'){
      if (dropData.href && this.actor.type === 'vehicle') {
        await this.actor.update({"system.pdfReference.type": dropData.type, "system.pdfReference.href": dropData.href, "system.pdfReference.label": dropData.label});
      }
      return false;
    }

    const itemData = await getItemDataFromDropData(dropData);
    const sameActor = this.actor.items.get(itemData._id);;
    if (sameActor) {
      const dropTargetId = event.target.closest("[data-item-id]")?.dataset?.itemId;
      const targetItem = this.actor.items.get(dropTargetId);
      if (dropTargetId !== "" && !targetItem?.getFlag('twodsix','untrainedSkill') && game.settings.get('twodsix', 'allowDragDropOfLists') && !sameActor.getFlag('twodsix','untrainedSkill')) {
        console.log(`Twodsix | Moved item ${itemData.name} to another position in the ITEM list`);
        //super._onDrop(event); //needed?
        return await this._onSortItem(event, itemData); //.toJSON()???
      } else {
        return false; //JOAT or Untrained which can't be moved / or drag dropping not allowed
      }
    }
    return actor.handleDroppedItem(itemData);
  }

  protected static _prepareItemContainers(actor:TwodsixActor, sheetData:TwodsixShipSheetData|any):void {

    // Initialize containers.
    const items = actor.items;
    const component = {};
    let numberOfSkills = 0;
    let skillRanks = 0;
    const summaryStatus = {};
    const skillsList = [];
    const statusOrder = {"operational": 1, "damaged": 2, "destroyed": 3, "off": 0};

    // Iterate through items, calculating derived data
    items.forEach((item:TwodsixItem) => {
      // item.img = item.img || CONST.DEFAULT_TOKEN; // apparent item.img is read-only..
      if (!["ship_position", "spell", "skills", "trait"].includes(item.type)) {
        item.prepareConsumable();
      }
      if (actor.type === "traveller" || actor.type === "animal") {
        if (item.type === "skills") {
          if (item.system.value >= 0 && !item.getFlag("twodsix", "untrainedSkill")) {
            numberOfSkills += 1;
            skillRanks += Number(item.system.value);
          }
          if (isDisplayableSkill(<Skills>item)) {
            skillsList.push(item);
          }
        }
      }
      if (item.type === "component") {
        if(component[(<Component>item.system).subtype] === undefined) {
          component[(<Component>item.system).subtype] = [];
          summaryStatus[(<Component>item.system).subtype] = {
            status: item.system.status,
            uuid: item.uuid
          };
        }
        component[(<Component>item.system).subtype].push(item);
        if (statusOrder[summaryStatus[(<Component>item.system).subtype].status] < statusOrder[item.system.status]) {
          summaryStatus[(<Component>item.system).subtype] = {
            status: item.system.status,
            uuid: item.uuid
          };
        }
      }
    });

    // Prepare Containers for sheetData
    sheetData.container = actor.itemTypes;
    sheetData.container.equipmentAndTools = actor.itemTypes.equipment.concat(actor.itemTypes.tool);
    sheetData.container.skills = skillsList;
    sheetData.container.nonCargo = actor.itemTypes.component.filter( i => i.system.subtype !== "cargo");
    if (actor.type === "traveller") {
      sheetData.numberOfSkills = numberOfSkills + (sheetData.jackOfAllTrades > 0 ? 1 : 0);
      sheetData.numberListedSkills = numberOfSkills;
      sheetData.skillRanks = skillRanks + sheetData.jackOfAllTrades;

    } else if (actor.type === "ship" || actor.type === "vehicle" ) {
      sheetData.componentObject = sortObj(component);
      sheetData.summaryStatus = sortObj(summaryStatus);
      sheetData.storage = items.filter(i => !["ship_position", "spell", "skills", "trait", "augment", "component"].includes(i.type));
    }
  }

  protected _onRollWrapper(func: (event, showTrowDiag: boolean) => Promise<void>): (event) => void {
    return (event) => {
      event.preventDefault();
      event.stopPropagation();

      const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showTrowDiag = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];

      func.bind(this)(event, showTrowDiag);
    };
  }

  /**
   * Handle when the roll initiative button is pressed.
   * @param {Event} event   The originating click event
   * @private
   */
  protected async _onRollInitiative(event): Promise<void> {
    if (!canvas.tokens?.ownedTokens.find(t => t.actor?.id === this.actor.id)) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoActiveToken"));
      return;
    } else if (this.token?.combatant && this.token.combatant.initiative !== null ) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.ActorHasInitiativeAlready"));
      return;
    } else if (!this.actor.isToken && game.combat?.combatants?.find(c => c.actor?.id === this.actor.id)?.initiative) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.ActorHasInitiativeAlready"));
      return;
    }
    const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showThrowDiag = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
    const dialogData = {
      shouldRoll: false,
      rollType: "Normal",
      rollTypes: TWODSIX.ROLLTYPES,
      diceModifier: "",
      rollMode: game.settings.get('core', 'rollMode'),
      rollModes: CONFIG.Dice.rollModes,
      rollFormula: game.settings.get("twodsix", "initiativeFormula")
    };
    if (showThrowDiag) {
      await this.initiativeDialog(dialogData);
      if (dialogData.shouldRoll) {
        if (dialogData.rollType !== "Normal") {
          if (dialogData.rollType === "Advantage") {
            dialogData.rollFormula = dialogData.rollFormula.replace("2d6", "3d6kh2");
          } else if (dialogData.rollType === "Disadvantage") {
            dialogData.rollFormula = dialogData.rollFormula.replace("2d6", "3d6kl2");
          }
        }
        if (dialogData.diceModifier !== "") {
          dialogData.rollFormula += "+" + dialogData.diceModifier;
        }
      } else {
        return;
      }
    }

    if (this.token?.combatant?.id) {
      //@ts-ignore
      game.combat?.rollInitiative(this.token.combatant.id, {formula: dialogData.rollFormula, messageOptions: {rollMode: dialogData.rollMode}});
    } else {
      this.actor.rollInitiative({createCombatants: true, rerollInitiative: false, initiativeOptions: {formula: dialogData.rollFormula, messageOptions: {rollMode: dialogData.rollMode}}});
    }
  }

  protected async initiativeDialog(dialogData):Promise<any> {
    const template = 'systems/twodsix/templates/chat/initiative-dialog.html';

    const buttons = {
      ok: {
        label: game.i18n.localize("TWODSIX.Rolls.Roll"),
        icon: '<i class="fa-solid fa-dice"></i>',
        callback: (buttonHtml) => {
          dialogData.shouldRoll = true;
          dialogData.rollType = buttonHtml.find('[name="rollType"]').val();
          dialogData.diceModifier = buttonHtml.find('[name="diceModifier"]').val();
          dialogData.rollMode = buttonHtml.find('[name="rollMode"]').val();
          dialogData.rollFormula = buttonHtml.find('[name="rollFormula"]').val();
        }
      },
      cancel: {
        icon: '<i class="fa-solid fa-xmark"></i>',
        label: game.i18n.localize("Cancel"),
        callback: () => {
          dialogData.shouldRoll = false;
        }
      },
    };

    const html = await renderTemplate(template, dialogData);
    return new Promise<void>((resolve) => {
      new Dialog({
        title: game.i18n.localize("TWODSIX.Rolls.RollInitiative"),
        content: html,
        buttons: buttons,
        default: 'ok',
        close: () => {
          resolve();
        },
      }).render(true);
    });
  }

  /**
   * Handle clickable skill rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  protected async _onSkillRoll(event, showThrowDiag: boolean): Promise<void> {
    const item = this.getItem(event);
    await item.skillRoll(showThrowDiag );
  }

  /**
   * Handle clickable characteristics rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showThrowDiag  Whether to show the throw dialog or not
   * @private
   */
  protected async _onRollChar(event, showThrowDiag: boolean): Promise<void> {
    const shortChar = $(event.currentTarget).data("label");
    //const fullCharLabel = getKeyByValue(TWODSIX.CHARACTERISTICS, shortChar);
    //const displayShortChar = (<TwodsixActor>this.actor).system["characteristics"][fullCharLabel].displayShortLabel;
    await (<TwodsixActor>this.actor).characteristicRoll({ rollModifiers: {characteristic: shortChar}}, showThrowDiag);
  }

  /**
   * Update an item value when edited on skill or inventory tab.
   * @param {Event} event  The originating input event
   * @private
   */
  protected async _onItemValueEdit(event): Promise<void> {
    const newValue = parseInt(event.currentTarget["value"], 10);
    const li = $(event.currentTarget).parents(".item");
    const itemSelected = this.actor.items.get(li.data("itemId"));

    if (itemSelected) {
      if (itemSelected.type === "skills") {
        itemSelected.update({"system.value": newValue});
      } else if (itemSelected.type === "consumable") {
        itemSelected.update({"system.quantity": newValue});
      }
    }
  }

  /**
   * Handle send to chat.
   * @param {Event} event   The originating click event
   * @private
   */
  protected async _onSendToChat(event): Promise<void> {
    const item = <TwodsixItem>this.getItem(event);
    const picture = item.img;
    const capType = item.type.capitalize();
    if (item.type === "trait"  || item.type === "spell") {
      const msg = `<div style ="display: table-cell"><img src="${picture}" alt="" height=40px max-width=40px></img>  <strong>${capType}: ${item.name}</strong></div><br>${item.system["description"]}`;
      ChatMessage.create({ content: msg, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
    }
  }

  /**
   * Handle when the clicking on status icon.
   * @param {Event} event   The originating click event
   * @private
   */
  protected async _onEditEffect(event): Promise<void> {
    const effectUuid = event.currentTarget["dataset"].uuid;
    const selectedEffect = <ActiveEffect> await fromUuid(effectUuid);
    //console.log(selectedEffect);
    if (selectedEffect) {
      new ActiveEffectConfig(selectedEffect).render(true);
    };
  }
  /**
   * Handle when the right clicking on status icon.
   * @param {Event} event   The originating click event
   * @private
   */
  protected async _onDeleteEffect(event): Promise<void> {
    const effectUuid = event.currentTarget["dataset"].uuid;
    const selectedEffect = await fromUuid(effectUuid);
    console.log(selectedEffect);
    await Dialog.confirm({
      title: game.i18n.localize("TWODSIX.ActiveEffects.DeleteEffect"),
      content: game.i18n.localize("TWODSIX.ActiveEffects.ConfirmDelete"),
      yes: async () => {
        await selectedEffect?.delete();
      },
      no: () => {
        //Nothing
      },
    });
  }

  private getItem(event): TwodsixItem {
    const itemId = $(event.currentTarget).parents('.item').data('item-id');
    return <TwodsixItem>this.actor.items.get(itemId);
  }
}

function sortObj(obj) {
  return Object.keys(obj).sort().reduce(function (result, key) {
    result[key] = obj[key];
    return result;
  }, {});
}

