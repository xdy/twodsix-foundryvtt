// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixItem, { onRollDamage }  from "../entities/TwodsixItem";
import {getDataFromDropEvent, getItemDataFromDropData} from "../utils/sheetUtils";
import TwodsixActor from "../entities/TwodsixActor";
import {Armor, Skills, UsesConsumables, Component} from "../../types/template";
import { TwodsixShipSheetData } from "../../types/twodsix";
import {onPasteStripFormatting} from "../sheets/AbstractTwodsixItemSheet";
import { getKeyByValue } from "../utils/sheetUtils";
import { resolveUnknownAutoMode } from "../utils/rollItemMacro";
import { TWODSIX } from "../config";

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

      html.find('.rollable').on('click', this._onRollWrapper(this._onSkillRoll));
      html.find('.rollable-characteristic').on('click', this._onRollWrapper(this._onRollChar));

      html.find('.roll-damage').on('click', onRollDamage.bind(this));

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
    console.log("Sheet Item Attack: ", item);
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
      if (actor.type === 'traveller' || actor.type === 'animal') {
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
      case 'animal':
        if (itemData.type === 'skills') {
          return this.handleDroppedSkills(actor, itemData);
        } else if (["weapon", "trait"].includes(itemData.type)) {
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

  protected async handleDroppedSkills(actor, itemData) {
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

  protected async handleDroppedItem(actor:Actor, itemData) {
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

  protected static _getWeight(item):number {
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
    if (sheetData.actor.type === "traveller") {
      const encumbFormula = game.settings.get('twodsix', 'maxEncumbrance');
      if (Roll.validate(encumbFormula)) {
        maxEncumbrance = new Roll(encumbFormula, sheetData.actor.system).evaluate({async: false}).total;
      } else {
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.EncumbranceFormulaInvalid"));
      }
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
    } else if (sheetData.actor.type === "animal" ) {
      sheetData.container.weapon = weapon;
      sheetData.container.armor = armor;
      sheetData.container.skills = skills;
      sheetData.container.traits = traits;
    } else if (sheetData.actor.type === "ship" || sheetData.actor.type === "vehicle" ) {
      sheetData.component = sortObj(component);
      sheetData.summaryStatus = sortObj(summaryStatus);
      sheetData.storage = storage;
    } else {
      console.log("Unrecognized Actor in AbstractActorSheet");
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
    const fullCharLabel = getKeyByValue(TWODSIX.CHARACTERISTICS, shortChar);
    const displayShortChar = (<TwodsixActor>this.actor).system["characteristics"][fullCharLabel].displayShortLabel;
    await (<TwodsixActor>this.actor).characteristicRoll({ "characteristic": shortChar, "displayLabel": displayShortChar }, showThrowDiag);
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
    const selectedEffect = await fromUuid(effectUuid);
    console.log(selectedEffect);
    new ActiveEffectConfig(selectedEffect).render(true);
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
