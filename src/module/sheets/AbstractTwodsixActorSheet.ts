// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixItem, { onRollDamage }  from "../entities/TwodsixItem";
import {getDataFromDropEvent, getDocFromDropData, isDisplayableSkill, openPDFLink, getDamageTypes, getRangeTypes, openJournalEntry, deleteReference, changeReference } from "../utils/sheetUtils";
import TwodsixActor from "../entities/TwodsixActor";
import {Skills, UsesConsumables, Component} from "../../types/template";
import {onPasteStripFormatting} from "../sheets/AbstractTwodsixItemSheet";
import { getRollTypeSelectObject } from "../utils/sheetUtils";
import { sortObj } from "../utils/utils";
import { TwodsixActiveEffect } from "../entities/TwodsixActiveEffect";
import { TWODSIX } from "../config";

/**
 * Extend the basic ActorSheetV2 with common functions for all Twodsix actors
 * @extends {ActorSheetV2}
 */
export abstract class AbstractTwodsixActorSheet extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.sheets.ActorSheetV2) {
  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType(): string {
    return this.actor.type;
  }


  static DEFAULT_OPTIONS = {
    actions: {
      itemCreate: this._onItemCreate,
      itemEdit: this._onItemEdit,
      itemDelete: this._onItemDelete,
      editConsumable: this._onEditConsumable,
      openPDFLink: openPDFLink,
      deleteReference: deleteReference,
      adjustCounter: this._onAdjustCounter,
      showChat: this._onShowInChat,
      performAttack: this._onPerformAttack,
      skillTalentRoll: this._onSkillTalentRoll,
      rollChar: this._onRollChar,
      rollDamage: onRollDamage,
      rollInitiative: this._onRollInitiative,
      selectItem: this._onItemSelect,
      openJournalEntry: openJournalEntry
    }
  };

  async _prepareContext(options):any {
    const context = await super._prepareContext(options);
    context.owner = this.actor;
    context.actor = context.owner;
    context.system = this.actor.system;

    context.dtypes = ["String", "Number", "Boolean"];

    // Add relevant data from system settings
    context.settings = {
      ShowRangeBandAndHideRange: ['CE_Bands', 'CT_Bands', 'CU_Bands'].includes(game.settings.get('twodsix', 'rangeModifierType')),
      rangeTypes: getRangeTypes('short'),
      ExperimentalFeatures: game.settings.get('twodsix', 'ExperimentalFeatures'),
      autofireRulesUsed: game.settings.get('twodsix', 'autofireRulesUsed'),
      showAlternativeCharacteristics: game.settings.get('twodsix', 'showAlternativeCharacteristics'),
      lifebloodInsteadOfCharacteristics: game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics'),
      showContaminationBelowLifeblood: game.settings.get('twodsix', 'showContaminationBelowLifeblood'),
      showLifebloodStamina: game.settings.get("twodsix", "showLifebloodStamina"),
      showHeroPoints: game.settings.get("twodsix", "showHeroPoints"),
      showIcons: game.settings.get("twodsix", "showIcons"),
      showStatusIcons: game.settings.get("twodsix", "showStatusIcons"),
      showInitiativeButton: game.settings.get("twodsix", "showInitiativeButton"),
      useProseMirror: game.settings.get('twodsix', 'useProseMirror'),
      useFoundryStandardStyle: game.settings.get('twodsix', 'useFoundryStandardStyle'),
      showReferences: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      showSpells: game.settings.get('twodsix', 'showSpells'),
      dontShowStatBlock: (game.settings.get("twodsix", "showLifebloodStamina") || game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics')),
      hideUntrainedSkills: game.settings.get('twodsix', 'hideUntrainedSkills'),
      damageTypes: getDamageTypes(false),
      Infinity: Infinity,
      usePDFPager: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      showActorReferences: game.settings.get('twodsix', 'showActorReferences'),
      useCTData: game.settings.get('twodsix', 'ruleset') === 'CT',
      useCUData: game.settings.get('twodsix', 'ruleset') === 'CU'
    };

    if (!['ship', 'vehicle', 'space-object'].includes(this.actor.type)) {
      context.untrainedSkill = (<TwodsixActor>this.actor).getUntrainedSkill();
      if (!context.untrainedSkill) {
        //NEED TO HAVE CHECKS FOR MISSING UNTRAINED SKILL
        const existingSkill:Skills = actor.itemTypes.skills?.find(sk => (sk.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained")) || sk.getFlag("twodsix", "untrainedSkill"));
        if (existingSkill) {
          context.untrainedSkill = existingSkill;
        } else {
          ui.notifications.warn("TWODSIX.Warnings.MissingUntrainedSkill", {localize: true});
        }
      }

      //Prepare characteristic display values
      setCharacteristicDisplay(context);
      if (this.actor.type === 'traveller') {
        context.system.characteristics.displayOrder = getDisplayOrder(context);
      }
    }
    this._prepareItemContainers(context);
    context.config = TWODSIX;
    return context;
  }

  /** @override */
  async _onRender(context:Context, options:any): void {
    await super._onRender(context, options);
    // Everything below here is only needed if the sheet is editable
    if (!context.editable) {
      return;
    }

    // Handle format stripping for content editable
    this.handleContentEditable(this.element);

    //Non-ship actors listeners
    if (this.actor.type !== "ship") {
      //add hooks to allow skill levels and consumable counts to be updated on skill and equipment tabs, repectively
      this.element.querySelectorAll(".item-value-edit")?.forEach(el => {
        el.addEventListener('input', this._onItemValueEdit.bind(this));
      });

      //Edit active effects shown on actor
      this.element.querySelectorAll('.condition-icon')?.forEach(el => {
        el.addEventListener('click', this._onEditEffect.bind(this));
      });
      this.element.querySelectorAll('.condition-icon')?.forEach(el => {
        el.addEventListener('contextmenu', this._onDeleteEffect.bind(this));
      });

      this.element.querySelectorAll('.effect-control')?.forEach(el => {
        el.addEventListener('click', this._modifyEffect.bind(this));
      });
    }

    //Handle update of doc reference
    this.element.querySelectorAll(`[name="reference"]`)?.forEach( el => el.addEventListener('change', changeReference.bind(this)));

    /****************
     *
     * Drag Drop
     *
     ****************/

    //need to augment DragDrop listener as only GM and droppable class is allowed in core ActorSheetV2
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

  /**
   * Handle delete item for actor sheet.
   * @param {Event} ev   The originating click event
   */
  static async _onItemDelete(ev:Event, target:HTMLElement):Promise<void> {
    const li = target.closest('.item');
    const ownedItem = this.actor.items.get(li.dataset.itemId) || null;

    if (ownedItem) {
      if (await foundry.applications.api.DialogV2.confirm({
        window: {title: game.i18n.localize("TWODSIX.Actor.Items.DeleteItem")},
        content: `<strong>${game.i18n.localize("TWODSIX.Actor.DeleteOwnedItem")}: ${ownedItem?.name}</strong>`,
      })) {
        const selectedActor = this.actor ?? this.token?.actor;
        await ownedItem.update({ 'system.equipped': 'ship' }); /*Needed to keep enc calc correct*/
        await selectedActor?.deleteEmbeddedDocuments("Item", [ownedItem.id]);
        // somehow on hooks isn't working when a consumable is deleted  - force the issue
        if (ownedItem.type === "consumable") {
          selectedActor?.items.filter(i => i.type !== "skills" && i.type !== "trait").forEach(async (i) => {
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
                selectedActor.updateEmbeddedDocuments('Item', [{ _id: i.id, 'system.consumables': consumablesList, 'system.useConsumableForAttack': usedForAttack }]);
              }
            }
          });
        }
      }
    }
  }

  /**
   * Handle clickable weapon attacks.
   * @param {Event} ev   The originating click event
   * @param {HTMLElement} target  HTMLElement clicked
   */
  static async _onPerformAttack(ev:Event, target:HTMLElement): Promise<void> {
    const attackType = target.dataset.attackType || "single";
    const rof = target.dataset.rof ? parseInt(target.dataset.rof, 10) : 1;
    const item: TwodsixItem = getItemFromTarget(target, this.actor);
    const showThrowDiag:boolean = game.settings.get('twodsix', 'invertSkillRollShiftClick') ? ev["shiftKey"] : !ev["shiftKey"];
    //console.log("Sheet Item Attack: ", item);
    if (this.options.sheetType?.includes("TwodsixNPCSheet") || ["robot", "animal"].includes(this.actor.type)) {
      item.resolveUnknownAutoMode();
    } else {
      await item.performAttack(attackType, showThrowDiag, rof);
    }
  }

  /**
   * An event that occurs when a drag workflow begins for a draggable item on the sheet.
   * @param {DragEvent} event       The initiating drag start event
   * @returns {Promise<void>}
   * @protected
   */
  _onDragStart(ev:DragEvent):void {
    let li = ev.currentTarget.closest('.item');
    let dragData:any;
    if (li?.dataset) {
      if ( "link" in event.target.dataset ) {
        return;
      }

      // Owned Items
      if ( li.dataset.itemId ) {
        const item = this.actor.items.get(li.dataset.itemId);
        dragData = item.toDragData();
      }

    } else {
      li = ev.currentTarget.closest('.effect');
      // Active Effect
      if ( li?.dataset.uuid ) {
        const effect = fromUuidSync(li.dataset.uuid);
        dragData = effect.toDragData();
      }
    }
    // Set data transfer
    if ( !dragData ) {
      return;
    }
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /**
   * An event that occurs when a drag workflow moves over a drop target.
   * @param {DragEvent} event
   * @protected
   */
  _onDragOver(ev:DragEvent) {
    super._onDragOver(ev);
  }

  /* -------------------------------------------- */
  /**
   * Handle show in chat click
   * @param {Event} ev   The originating click event
   * @static
   */
  static _onShowInChat(ev:Event, target: HTMLElement) {
    const item:TwodsixItem = getItemFromTarget(target, this.actor);
    if (item) {
      item.sendDescriptionToChat();
    }
  }


  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} ev   The originating click event
   * @static
   */
  static async _onItemCreate(ev:Event, target:HTMLElement):Promise<void> {
    ev.preventDefault();

    // Get the type of item to create.
    const {type, subtype} = target.dataset;

    // Grab any data associated with this control.
    //const data = foundry.utils.duplicate(header.dataset) as Record<string, any>;

    // Initialize a default name, handle bad naming of 'skills' item type, which should be singular.
    const itemType = (type === "skills" ? "skill" : type);

    let itemName = game.i18n.localize("TWODSIX.Items.Items.New") + " ";

    if (type === "component") {
      itemName += game.i18n.localize("TWODSIX.Items.Component." + (subtype || "otherInternal"));
    } else {
      itemName += game.i18n.localize("TWODSIX.itemTypes." + itemType);
    }

    //Skill Names should be unique
    if (type === "skills") {
      itemName = (<TwodsixActor>this.actor).generateUniqueSkillName(itemName);
    }
    // Prepare the item object.
    const itemData = {
      name: itemName,
      type,
      system: {}
    };

    // Remove the type from the dataset since it's in the itemData.type prop.
    // delete itemData.data.type;
    updateWithItemSpecificValues(itemData, <string>itemType, <string>(["component", "consumable"].includes(itemType) ? subtype : ""), this.actor);

    // Finally, create the item!
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  /**
   * Handle editing an item
   * @param {Event} ev   The originating click event
   * @static
   */
  static _onItemEdit(ev:Event, target:HTMLElement):Promise<void> {
    const li = target.closest('.item');
    const item = this.actor.items.get(li.dataset.itemId);
    item?.sheet?.render({force: true});
  }

  /**
   * Handle selecting an item element to edit
   * @param {Event} ev   The originating click event
   * @static
   */
  static _onItemSelect(ev:Event, target:HTMLElement):Promise<void> {
    target.select();
  }

  /**
   * Handle editing a consumable
   * @param {Event} ev   The originating click event
   * @static
   */
  static _onEditConsumable(ev:Event, target:HTMLElement):Promise<void> {
    const li = target.closest(".consumable-row");
    const item = this.actor.items.get(li.dataset.consumableId);
    item?.sheet?.render({force: true});
  }

  /**
   * Process dropped information.
   */
  protected async _onDrop(ev:DragEvent):Promise<boolean | any> {
    ev.preventDefault();
    const dropData = getDataFromDropEvent(ev);
    const actor = <TwodsixActor>this.actor;

    if (!dropData) {
      console.log(`Twodsix | Dragging something that can't be dragged`);
      return false;
    }

    if (actor.type === "traveller" && dropData.type === "Actor") { ///what about ship where valid?******************
      ui.notifications.warn("TWODSIX.Warnings.CantDragActorOntoActor", {localize: true});
      return false;
    }

    if (dropData.type === 'damageItem') {
      const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showDamageDialog = useInvertedShiftClick ? ev["shiftKey"] : !ev["shiftKey"];
      return actor.handleDamageData(dropData.payload, showDamageDialog);
    } else if (dropData.type === "Scene") {
      // Handle dropped scene on ship sheet
      if (actor.type === 'ship') {
        const scene = await fromUuid(dropData.uuid);
        await actor.update({"system.deckPlan": scene.id});
      }
      return false;
    } else if (['html', 'pdf', 'JournalEntry'].includes(dropData.type)){
      // Handle droped pdf reference for sheet
      if (dropData.href) {
        await this.actor.update({ system: { pdfReference: { type: dropData.type, href: dropData.href, label: dropData.label}}});
      } else if (dropData.uuid) {
        await this.actor.update({ system: { pdfReference: { type: dropData.type, href: dropData.uuid, label: dropData.type}}});
      }
      return false;
    } else if (dropData.type === 'Item') {
      const droppedItem:TwodsixItem = await getDocFromDropData(dropData);
      return await this.processDroppedItem(ev, droppedItem);
    } else if (dropData.type === 'ActiveEffect') {
      const droppedEffect = await fromUuid(dropData.uuid);
      await this.onDropActiveEffect(ev, droppedEffect);
    } else if (dropData.type === 'Folder') {
      const droppedFolder = await fromUuid(dropData.uuid);
      await (<TwodsixActor>this.actor).handleDroppedFolder(droppedFolder);
    } else if (dropData.type === 'ItemList') {
      await (<TwodsixActor>this.actor).handleDroppedList(dropData.parseString);
    } else {
      console.log(`Unknown Drop Type ${dropData.type}`);
      return false;
    }
  }

  public async processDroppedItem(ev:DragEvent, dropedItem: TwodsixItem): Promise<boolean> {
    const sameActor:TwodsixItem = this.actor.items.get(dropedItem._id);
    if (sameActor) {
      const dropTargetId = ev.target.closest("[data-item-id]")?.dataset?.itemId;
      const targetItem = this.actor.items.get(dropTargetId);
      const sortSetting = ["ship", "vehicle"].includes(this.actor.type) ? 'allowDragDropOfListsShip' : 'allowDragDropOfListsActor';
      if (dropTargetId !== "" && !targetItem?.getFlag('twodsix','untrainedSkill') && game.settings.get('twodsix', sortSetting) && !sameActor.getFlag('twodsix','untrainedSkill')) {
        console.log(`Twodsix | Moved item ${dropedItem.name} to another position in the ITEM list`);
        //super._onDrop(event); //needed?
        return !!await this._onSortItem(ev, dropedItem); //.toJSON()???
      } else {
        return false; //JOAT or Untrained which can't be moved / or drag dropping not allowed
      }
    }
    return await (<TwodsixActor>this.actor).handleDroppedItem(dropedItem);
  }

  /**
   * Handle a dropped Active Effect on the Actor Sheet.
   * The default implementation creates an Active Effect embedded document on the Actor.
   * @param {DragEvent} ev       The initiating drop event
   * @param {TwodsixActiveEffect} effect   The dropped ActiveEffect document
   * @returns {Promise<void>}
   * @protected
   */
  async onDropActiveEffect(ev:DragEvent, effect:TwodsixActiveEffect): Promise<void> {
    if ( !this.actor.isOwner ) {
      return;
    }
    (<TwodsixActor>this.actor).handleDroppedActiveEffect(effect);
  }

  _prepareItemContainers(context:any):void {
    // Initialize containers.
    const actor:TwodsixActor = this.actor;
    context.container = actor.itemTypes;
    const items = actor.items;
    const component = {};
    let numberOfSkills = 0;
    let skillRanks = 0;
    const summaryStatus = {};
    const skillsList = [];
    const skillGroups = {};
    const statusOrder = {"operational": 1, "damaged": 2, "destroyed": 3, "off": 0};

    // Iterate through items, calculating derived data
    items.forEach((item:TwodsixItem) => {
      // item.img = item.img || CONST.DEFAULT_TOKEN; // apparent item.img is read-only..
      if (![...TWODSIX.WeightlessItems, "ship_position"].includes(item.type)) {
        item.prepareConsumable();
      }
      if (["traveller", "animal", "robot"].includes(actor.type)) {
        if (item.type === "skills") {
          if (item.system.value >= 0 && !item.getFlag("twodsix", "untrainedSkill")) {
            numberOfSkills += 1;
            skillRanks += Number(item.system.value);
          }
          if (isDisplayableSkill(<Skills>item)) {
            if (actor.type === 'traveller') {
              // Create and Organize by Group Labels
              const groupLabel:string = item.system.groupLabel || game.i18n.localize('TWODSIX.Actor.Skills.NoGroup');
              if(!Object.hasOwn(skillGroups, groupLabel)) {
                skillGroups[groupLabel] = [];
              }
              skillGroups[groupLabel].push(item);

              // Create toggle states
              if (!Object.hasOwn(actor.system.displaySkillGroup, groupLabel)) {
                Object.assign(actor.system.displaySkillGroup, {[groupLabel]: false});
              }
            }
            skillsList.push(item);
          }
        }
      }
      //Add consumable labels
      if (["traveller"].includes(actor.type)  && item.type === "consumable") {
        const parentItem = actor.items.find((i) => i.system.consumables?.includes(item.id));
        if (parentItem) {
          item.system.parentName = parentItem.name;
          item.system.parentType = parentItem.type;
        }
      }
      //prepare ship summary status
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
    context.container.equipmentAndTools = actor.itemTypes.equipment.concat(actor.itemTypes.tool).concat(actor.itemTypes.computer);
    context.container.storageAndJunk = actor.itemTypes.storage.concat(actor.itemTypes.junk);
    context.container.skillsList = skillsList;
    context.container.skillGroups = sortObj(skillGroups);
    if (["traveller"].includes(actor.type)) {
      //Assign JOAT Value
      context.jackOfAllTrades = context.untrainedSkill ? AbstractTwodsixActorSheet.untrainedToJoat(context.untrainedSkill.system.value) : 0;
      context.numberOfSkills = numberOfSkills + (context.jackOfAllTrades > 0 ? 1 : 0);
      context.numberListedSkills = numberOfSkills;
      context.skillRanks = skillRanks + context.jackOfAllTrades;
    } else if (["ship", "vehicle"].includes(actor.type)) {
      context.componentObject = sortObj(component);
      context.summaryStatus = sortObj(summaryStatus);
      context.storage = items.filter(i => ![...TWODSIX.WeightlessItems, "ship_position", "component"].includes(i.type));
      context.container.nonCargo = actor.itemTypes.component.filter( i => i.system.subtype !== "cargo");
    }
    context.effects = Array.from(actor.allApplicableEffects());

    //Sort containers
    const sortSetting = ["ship", "vehicle"].includes(this.type)  ? 'allowDragDropOfListsShip' : 'allowDragDropOfListsActor';
    const sortLabel = game.settings.get('twodsix', sortSetting) ? "sort" : "name";
    for (const key of Object.keys(context.container)) {
      if (key !== "skillGroups") {
        context.container[key].sort((a, b) =>
          sortLabel === "sort"
            ? a[sortLabel] - b[sortLabel]
            : a[sortLabel].localeCompare(b[sortLabel])
        );
      } else {
        for (const groupKey of Object.keys(context.container.skillGroups)) {
          const group = context.container.skillGroups[groupKey];
          group.sort((a, b) =>
            sortLabel === "sort"
              ? a[sortLabel] - b[sortLabel]
              : a[sortLabel].localeCompare(b[sortLabel])
          );
        }
      }
    }
  }

  public static untrainedToJoat(skillValue: number): number {
    if (game.settings.get('twodsix', 'ruleset') === 'CT') {
      return skillValue >= 0 ? 1 : 0;
    } else {
      return skillValue - CONFIG.Item.dataModels.skills.schema.getInitialValue().value;
    }
  }

  public static joatToUntrained(joatValue: number): number {
    if (game.settings.get('twodsix', 'ruleset') === 'CT') {
      return joatValue > 0 ? 0 : CONFIG.Item.dataModels.skills.schema.getInitialValue().value;
    } else {
      return joatValue + CONFIG.Item.dataModels.skills.schema.getInitialValue().value;
    }
  }

  /**
   * Handle when the roll initiative button is pressed.
   * @param {Event} ev   The originating click event
   * @param {HTMLElement} target The target element
   * @private
   */
  static async _onRollInitiative(ev:Event /*, target:HTMLElement*/): Promise<void> {
    if (!canvas.tokens?.ownedTokens.find(t => t.actor?.id === this.actor.id)) { //would this.actor.token work as well? Maybe not for multile canvases
      ui.notifications.warn("TWODSIX.Warnings.NoActiveToken", {localize: true});
      return;
    } else if (this.token?.combatant && this.token?.combatant.initiative !== null ) {
      ui.notifications.warn("TWODSIX.Warnings.ActorHasInitiativeAlready", {localize: true});
      return;
    } else if (!this.actor.isToken && game.combat?.combatants?.find(c => c.actor?.id === this.actor.id)?.initiative) {
      ui.notifications.warn("TWODSIX.Warnings.ActorHasInitiativeAlready", {localize: true});
      return;
    }
    const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showThrowDiag = useInvertedShiftClick ? ev["shiftKey"] : !ev["shiftKey"];
    const dialogData = {
      shouldRoll: false,
      rollType: "Normal",
      rollTypes: getRollTypeSelectObject(),
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
      //@ts-expect-error FVTT Object not included currently
      game.combat?.rollInitiative(this.token.combatant.id, {formula: dialogData.rollFormula, messageOptions: {rollMode: dialogData.rollMode}});
    } else {
      this.actor.rollInitiative({createCombatants: true, rerollInitiative: false, initiativeOptions: {formula: dialogData.rollFormula, messageOptions: {rollMode: dialogData.rollMode}}});
    }
  }

  protected async initiativeDialog(dialogData):Promise<any> {
    const template = 'systems/twodsix/templates/chat/initiative-dialog.hbs';
    const buttons = [
      {
        action: "ok",
        label: "TWODSIX.Rolls.Roll",
        icon: "fa-solid fa-dice",
        default: true,
        callback: (event, button, dialog) => {
          const formElements = dialog.element.querySelector(".standard-form").elements;
          dialogData.shouldRoll = true;
          dialogData.rollType = formElements["rollType"]?.value;
          dialogData.diceModifier = formElements["diceModifier"]?.value;
          dialogData.rollMode = formElements["rollMode"]?.value;
          dialogData.rollFormula = formElements["rollFormula"]?.value;
        }
      },
      {
        action: "cancel",
        icon: "fa-solid fa-xmark",
        label: "Cancel",
        callback: () => {
          dialogData.shouldRoll = false;
        }
      },
    ];

    const html = await foundry.applications.handlebars.renderTemplate(template, dialogData);
    return new Promise<void>((resolve) => {
      new foundry.applications.api.DialogV2({
        window: {title: "TWODSIX.Rolls.RollInitiative", icon: "fa-solid fa-dice"},
        content: html,
        buttons: buttons,
        submit: () => {
          resolve();
        },
      }).render({force: true});
    });
  }

  /**
   * Handle clickable skill and talent rolls.
   * @param {Event} ev   The originating click event
   * @param {HTMLElement} target  HTML element clicked
   * @static
   */
  static async _onSkillTalentRoll(ev:Event, target:HTMLElement): Promise<void> {
    const showThrowDiag:boolean = game.settings.get('twodsix', 'invertSkillRollShiftClick') ? ev["shiftKey"] : !ev["shiftKey"];
    const item:TwodsixItem = getItemFromTarget(target, this.actor);
    if (item) {
      item.doSkillTalentRoll(showThrowDiag);
    }
  }

  /**
   * Handle clickable characteristics rolls.
   * @param {Event} ev   The originating click event
   * @param {HTMLElement} target  the clicked html element
   * @static
   */
  static async _onRollChar(ev:Event, target: HTMLElement): Promise<void> {
    const shortChar = target.dataset.label;
    const showThrowDiag:boolean = game.settings.get('twodsix', 'invertSkillRollShiftClick') ? ev["shiftKey"] : !ev["shiftKey"];
    await (<TwodsixActor>this.actor).characteristicRoll({ rollModifiers: {characteristic: shortChar}}, showThrowDiag);
  }

  /**
   * Update an item value when edited on skill or inventory tab.
   * @param {Event} ev  The originating input event
   * @private
   */
  protected async _onItemValueEdit(ev:Event): Promise<void> {
    const newValue = parseInt(ev.currentTarget["value"], 10);
    const li = ev.currentTarget.closest(".item");
    const itemSelected = this.actor.items.get(li.dataset.itemId);

    if (itemSelected && Number.isInteger(newValue)) {
      if (itemSelected.type === "skills" ) {
        await itemSelected.update({"system.value": newValue});
      } else if (itemSelected.type === "consumable") {
        await itemSelected.update({"system.quantity": newValue});
      }
    }
  }

  /**
   * Handle when the clicking on status icon.
   * @param {Event} ev   The originating click event
   * @private
   */
  protected async _onEditEffect(ev:Event): Promise<void> {
    const effectUuid:string = ev.currentTarget.dataset.uuid;
    const selectedEffect = <TwodsixActiveEffect> await fromUuid(effectUuid);
    //console.log(selectedEffect);
    if (selectedEffect) {
      await new foundry.applications.sheets.ActiveEffectConfig({document: selectedEffect}).render({force: true});
    }
  }

  /**
   * Handle when the right clicking on status icon.
   * @param {Event} ev   The originating click event
   * @private
   */
  async _onDeleteEffect(ev:Event): Promise<void> {
    const effectUuid = ev.currentTarget.dataset.uuid;
    const selectedEffect = await fromUuid(effectUuid);
    if (await foundry.applications.api.DialogV2.confirm({
      window: {title: game.i18n.localize("TWODSIX.ActiveEffects.DeleteEffect")},
      content: game.i18n.localize("TWODSIX.ActiveEffects.ConfirmDelete")
    })) {
      await selectedEffect.delete();
      await this.render(false); //needed because can right-click on icon over image instead of toggle icons
    }
  }
  //THIS NEEDS TO BE CHECKED LATER
  async _modifyEffect(ev:Event): Promise<void> {
    const target:HTMLElement = ev.currentTarget;
    const action = target.dataset.controlaction;
    if (action === "delete") {
      await this._onDeleteEffect(ev);
    } else if (action === "edit") {
      await this._onEditEffect(ev);
    } else if (action === "toggle") {
      const selectedEffect:TwodsixActiveEffect = await fromUuid(target.dataset.uuid);
      if (selectedEffect) {
        await selectedEffect.update({disabled: !selectedEffect.disabled});
      }
    } else if (action === "create") {
      await this.actor.createEmbeddedDocuments("ActiveEffect", [{
        name: game.i18n.localize("TWODSIX.ActiveEffects.NewEffect"),
        icon: "icons/svg/aura.svg",
        origin: "Custom",
        disabled: false,
        description: ""
      }]);
    } else {
      console.log("Unknown Action");
    }
    await this.render(false);
  }

  static async _onAdjustCounter(ev:Event, target:HTMLElement): Promise<void> {
    const modifier = parseInt(target.dataset.value, 10);
    const field = target.closest(".combined-buttons")?.dataset.field;
    const li = target.closest(".item");
    const itemSelected = this.actor.items.get(li.dataset.itemId);
    if (itemSelected && field) {
      if (field === "hits") {
        const newHits = (<Component>itemSelected.system).hits + modifier;
        if (newHits <= game.settings.get('twodsix', 'maxComponentHits') && newHits >= 0) {
          await itemSelected.update({ "system.hits": newHits });
        }
        if (newHits === game.settings.get('twodsix', 'maxComponentHits')) {
          await itemSelected.update({ "system.status": "destroyed" });
        } else if (newHits > 0 && (<Component>itemSelected.system).status !== "off") {
          await itemSelected.update({ "system.status": "damaged" });
        } else if (newHits === 0 && (<Component>itemSelected.system).status !== "off") {
          await itemSelected.update({ "system.status": "operational" });
        }
      } else if (field === "ammo") {
        const newAmmo = (<Component>itemSelected.system).ammunition.value + modifier;
        if (newAmmo >= 0  && newAmmo <= (<Component>itemSelected.system).ammunition.max) {
          await itemSelected.update({ "system.ammunition.value": newAmmo });
        }
      }
    }
  }

  //These aren't necessary with change to prosemirror
  protected handleContentEditable(element:HTMLElement):void {
    element.querySelectorAll('div[contenteditable="true"][data-edit]')?.forEach(el => {
      el.addEventListener('focusout', this._onChangeContenteditable.bind(this));
    });
    element.querySelectorAll('div[contenteditable="true"][data-edit]')?.forEach(el => {
      el.addEventListener('paste', onPasteStripFormatting.bind(this));
    });
  }

  /** @override */
  // Not really needed with change to prosemirror
  async _onChangeContenteditable(ev:Event) {
    //console.log(event);
    if (ev.currentTarget?.name !== 'type') {
      const  formField = ev.currentTarget?.closest('div[contenteditable="true"][data-edit]');
      if (formField) {
        const target = formField.dataset?.edit;
        const newValue = formField.closest('div[contenteditable="true"][data-edit]').innerHTML;
        if (target) {
          this.actor.update({[target]: newValue});
        }
      }
    }
  }
}

export function setCharacteristicDisplay(context: object): void {
  const charMode = game.settings.get('twodsix', 'showAlternativeCharacteristics');
  context.system.characteristics.alternative1.displayChar = ['alternate', 'all'].includes(charMode) &&
        (context.system.characteristics.alternative1.value !== 0 || !game.settings.get('twodsix', 'omitALTifZero'));
  context.system.characteristics.alternative2.displayChar = ['alternate', 'all'].includes(charMode) &&
        (context.system.characteristics.alternative2.value !== 0 || !game.settings.get('twodsix', 'omitALTifZero'));
  context.system.characteristics.alternative3.displayChar = ['all'].includes(charMode) &&
        (context.system.characteristics.alternative3.value !== 0 || !game.settings.get('twodsix', 'omitALTifZero'));
  context.system.characteristics.dexterity.displayChar = true;
  context.system.characteristics.education.displayChar = (context.system.characteristics.education.value !== 0 || !game.settings.get('twodsix', 'omitALTifZero'));
  context.system.characteristics.endurance.displayChar = true;
  context.system.characteristics.intelligence.displayChar = (context.system.characteristics.intelligence.value !== 0 || !game.settings.get('twodsix', 'omitALTifZero'));
  context.system.characteristics.lifeblood.displayChar = false;
  context.system.characteristics.psionicStrength.displayChar = ['base', 'all'].includes(charMode) &&
        (context.system.characteristics.psionicStrength.value !== 0 || !game.settings.get('twodsix', 'omitPSIifZero'));
  context.system.characteristics.socialStanding.displayChar = (context.system.characteristics.socialStanding.value !== 0 || !game.settings.get('twodsix', 'omitALTifZero'));
  context.system.characteristics.stamina.displayChar = false;
  context.system.characteristics.strength.displayChar = true;
}

export function getDisplayOrder(context: any): string[] {
  const returnValue = ['strength', 'intelligence', 'dexterity', 'education', 'endurance', 'socialStanding'];
  const charMode = game.settings.get('twodsix', 'showAlternativeCharacteristics');

  switch (charMode) {
    case 'core':
      break;
    case 'base':
      if (context.system.characteristics.psionicStrength.value !== 0 || !game.settings.get('twodsix', 'omitPSIifZero')) {
        returnValue.push('psionicStrength');
      }
      break;
    case 'alternate':
    case 'all':
    {
      const altList = ['alternative1', 'alternative2', 'alternative3'];
      if (charMode === 'alternate') {
        altList.pop();
      } else {
        altList.push('psionicStrength');
      }

      for (const key of altList) {
        const displaySetting = key === 'psionicStrength' ? game.settings.get('twodsix', 'omitPSIifZero') : game.settings.get('twodsix', 'omitALTifZero');
        if (context.system.characteristics[key].value !== 0 || !displaySetting) {
          returnValue.push(key);
        }
      }
      break;
    }
    default:
      break;
  }
  return returnValue;
}

function updateWithItemSpecificValues(itemData:Record<string, any>, type:string, subtype = "otherInternal", actor:TwodsixActor):void {
  switch (type) {
    case "skills":
      if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
        const initialValue = CONFIG.Item.dataModels.skills.schema.getInitialValue().value;
        itemData.system.value = initialValue;
      } else {
        itemData.system.value = 0;
      }
      break;
    case "weapon":
      if (game.settings.get('twodsix', 'hideUntrainedSkills')) {
        itemData.system.skill = actor.getUntrainedSkill().id;
      }
      if (!itemData.img) {
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
      if (!itemData.img) {
        itemData.img = 'systems/twodsix/assets/icons/spell-book.svg';
      }
      if (!itemData.system.associatedSkillName) {
        itemData.system.associatedSkillName = game.settings.get("twodsix", "sorcerySkill") ?? "";
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
    case "psiAbility":
      if (!itemData.img) {
        itemData.img = 'systems/twodsix/assets/icons/extra-lucid.svg';
      }
      break;
  }
}
/**
* Get Item from target HTMLElement and sheet associated actor.
* @param {HTMLElement} target  HTML element clicked
* @param {TwodsixActor} actor   The sheet's actor
*/
function getItemFromTarget(target:HTMLElement, actor:TwodsixActor): TwodsixItem {
  const itemId = target.closest('.item').dataset.itemId;
  return <TwodsixItem>actor.items.get(itemId);
}
