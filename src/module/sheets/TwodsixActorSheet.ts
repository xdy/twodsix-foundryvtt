import TwodsixItem from "../entities/TwodsixItem";
import {TwodsixRolls} from "../utils/TwodsixRolls";

export class TwodsixActorSheet extends ActorSheet {

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType():string {
    return this.actor.data.type;
  }

  /** @override */
  getData():any {
    const data:any = super.getData();
    data.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.data.type == 'traveller') {
      TwodsixActorSheet._prepareCharacterItems(data);
    }

    return data;
  }


  private static _prepareCharacterItems(sheetData:any) {

    const actorData = sheetData.actor;

    // Initialize containers.
    const storage = [];
    const inventory = [];
    const equipment = [];
    const weapon = [];
    const armor = [];
    const augment = [];
    const skills = [];

    // Iterate through items, allocating to containers
    for (const i of sheetData.items) {
      i.img = i.img || CONST.DEFAULT_TOKEN;
      // Append to gear.
      if (i.type === 'storage') {
        storage.push(i);
      }
      if (i.type === 'inventory') {
        inventory.push(i);
      }
      if (i.type === 'equipment') {
        equipment.push(i);
      }
      if (i.type === 'weapon') {
        weapon.push(i);
      }
      if (i.type === 'armor') {
        armor.push(i);
      }
      if (i.type === 'augment') {
        augment.push(i);
      }
      if (i.type === 'skills') {
        skills.push(i);
      }
    }
    // Assign and return
    actorData.storage = storage;
    actorData.inventory = inventory;
    actorData.equipment = equipment;
    actorData.weapon = weapon;
    actorData.armor = armor;
    actorData.augment = augment;
    actorData.skills = skills;

  }

  /** @override */
  static get defaultOptions():FormApplicationOptions {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "actor"],
      template: "systems/twodsix/templates/actors/actor-sheet.html",
      width: 825,
      height: 648,
      resizable: false,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills"}],
      scrollY: [".skills", ".inventory"]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  protected activateListeners(html:JQuery<HTMLElement>):void {
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
      const item = this.actor.getOwnedItem(li.data("itemId"));
      item.sheet.render(true);
    }));

    // Delete Inventory Item
    html.find('.item-delete').on('click', (ev => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteOwnedItem(li.data("itemId"));
      li.slideUp(200, () => this.render(false));
    }));

    // Rollable abilities.
    html.find('.rollable').on('click', (this._onRoll.bind(this)));

    // Drag events for macros.
    if (this.actor.owner) {
      const handler = ev => this._onDragItemStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) {
          return;
        }
        li.setAttribute("draggable", 'true');
        li.addEventListener("dragstart", handler, false);
      });
    }
  }


  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  _onItemCreate(event:{ preventDefault:() => void; currentTarget:any; }):Promise<Item> {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const {type} = header.dataset;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name,
      type,
      data
    }

    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data.type;

    // Finally, create the item!
    return this.actor.createOwnedItem(itemData);
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event:{ preventDefault:any; currentTarget:any; shiftKey?:any; }):void {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
    const item = this.actor.getOwnedItem(itemId) as TwodsixItem;

    if (dataset.roll) {
      if (item != null && 'skills' === item.type && event.shiftKey) {
        this.rollSkill(itemId, event, dataset);
      } else {
        const roll = new Roll(dataset.roll, this.actor.data.data);
        const label = dataset.label ? game.i18n.localize("TWODSIX.Actor.Rolling") + ` ${dataset.label}` : '';

        roll.roll().toMessage({
          speaker: ChatMessage.getSpeaker({actor: this.actor}),
          flavor: label
        });
      }
    }
  }

  rollSkill(
    skillId:string,
    event:{ preventDefault:() => void; currentTarget:any; },
    dataset:{ roll:string; }
  ):Promise<any> {

    const skillData = {};
    const skills = this.getData().actor.skills;
    if (!skills.length) {
      return;
    }

    const rollParts = dataset.roll.split("+");

    const flavorParts:string[] = [];
    const skill = skills.filter(x => x._id === skillId)[0];
    flavorParts.push(`${skill.name}`);

    return TwodsixRolls.Roll({
      parts: rollParts,
      data: skillData,
      flavorParts: flavorParts,
      title: `${skill.name}`,
      speaker: ChatMessage.getSpeaker({actor: this.getData().actor}),
    });
  }

  //Unused, but something like it is needed to support cascade/subskills, so letting it stay for now.
  /**
   * Handle skill upgrade
   * @param {Event} event   The originating click event
   * @private
   */
  _onUpgrade(event:{ preventDefault:() => void; currentTarget:any; }):void {
    event.preventDefault();
    const element = event.currentTarget;
    const skillName = element.getAttribute('data-label');
    const actorData = this.actor.data;
    const data = actorData.data;
    const matchingSkill = data.skills[skillName];
    const maxSkillLevel = game.settings.get('twodsix', 'maxSkillLevel');

    if (matchingSkill) {
      if (TwodsixActorSheet.isChildSkill(matchingSkill)) {
        if (this.parentSkillIsTrained(matchingSkill) && matchingSkill.value < maxSkillLevel) {
          this.actor.update({[`data.skills.${skillName}.value`]: data.skills[skillName].value + 1})
        }
      } else if (matchingSkill.value < 0) {
        this.actor.update({[`data.skills.${skillName}.value`]: 0})
        if (matchingSkill.hasChildren) {
          this.processChildren(data, skillName, 0);
        }
      } else if (!matchingSkill.hasChildren && matchingSkill.value < maxSkillLevel) {
        this.actor.update({[`data.skills.${skillName}.value`]: data.skills[skillName].value + 1})
      }
    }
  }

  private processChildren(data:any, skillName:string, level:number) {
    for (const [key, value] of Object.entries(data.skills)) {
      if (key.startsWith(skillName + "-")) {
        this.actor.update({[`data.skills.${key}.value`]: level})
      }
    }
  }

  private static isChildSkill(matchingSkill:any) {
    return matchingSkill.childOf != null && matchingSkill.childOf != "";
  }

  private parentSkillIsTrained(matchingSkill:any) {
    const parent = this.actor.data.data.skills[matchingSkill.childOf];
    return parent && parent.value >= 0;
  }
}



