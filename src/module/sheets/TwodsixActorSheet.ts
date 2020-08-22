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
    const gear = [];

    // Iterate through items, allocating to containers
    for (const i of sheetData.items) {
      i.img = i.img || CONST.DEFAULT_TOKEN;
      // Append to gear.
      if (i.type === 'equipment' || i.type === 'weapon' || i.type === 'armor' || i.type === 'augment') {
        gear.push(i);
      }
    }

    // Assign and return
    actorData.gear = gear;
  }

  /** @override */
  static get defaultOptions():FormApplicationOptions {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "actor"],
      template: "systems/twodsix/templates/actors/actor-sheet.html",
      width: 822,
      height: 653,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills"}]
    });
  }

  /* -------------------------------------------- */

  /** @override */
  protected activateListeners(html:JQuery<HTMLElement>):void {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

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

    // Upgrade/downgrade skills.
    html.find('.upgrade-skill').on('click', this._onUpgrade.bind(this));
    html.find('.downgrade-skill').on('click', this._onDowngrade.bind(this));
    html.find('.upgrade-joat').on('click', this._onUpgradeJoat.bind(this));
    html.find('.downgrade-joat').on('click', this._onDowngradeJoat.bind(this));

    html.find('.toggle-skills').on('click', ev => {
      ev.preventDefault();
      this.options.hideUntrainedSkills = !this.options.hideUntrainedSkills;
      this.actor.sheet.render(true)
    })

    // Drag events for macros.
    if (this.actor.owner) {
      const handler = ev => this._onDragItemStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
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
    };
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
  _onRoll(event:{ preventDefault:() => void; currentTarget:any; }):void {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset.roll) {
      const roll = new Roll(dataset.roll, this.actor.data.data);
      const label = dataset.label ? `Rolling ${dataset.label}` : '';
      roll.roll().toMessage({
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
        flavor: label
      });
    }
  }

  _onUpgradeJoat(event:{ preventDefault:() => void; currentTarget:any; }):void {
    event.preventDefault();
    const element = event.currentTarget;
    const actorData = this.actor.data;
    const data = actorData.data;

    if (data.jackOfAllTrades.value < 3) {
      this.actor.update({'data.jackOfAllTrades.value': data.jackOfAllTrades.value + 1})
    }
  }

  _onDowngradeJoat(event:{ preventDefault:() => void; currentTarget:any; }):void {
    event.preventDefault();
    const element = event.currentTarget;
    const actorData = this.actor.data;
    const data = actorData.data;

    if (data.jackOfAllTrades.value > 0) {
      this.actor.update({'data.jackOfAllTrades.value': data.jackOfAllTrades.value - 1})
    }
  }

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
    if (matchingSkill && !matchingSkill.trained) {
      this.actor.update({[`data.skills.${skillName}.value`]: 0})
      this.actor.update({[`data.skills.${skillName}.trained`]: true})
    } else if (matchingSkill && matchingSkill.value < matchingSkill.max) {
      this.actor.update({[`data.skills.${skillName}.value`]: data.skills[skillName].value + 1})
    }
  }

  /**
   * Handle skill downgrade
   * @param {Event} event   The originating click event
   * @private
   */
  _onDowngrade(event:{ preventDefault:() => void; currentTarget:any; }):void {
    event.preventDefault();
    const element = event.currentTarget;
    const skillName = element.getAttribute('data-label');
    const actorData = this.actor.data;
    const data = actorData.data;
    const matchingSkill = data.skills[skillName];
    if (matchingSkill && matchingSkill.trained && data.skills[skillName].value == 0) {
      this.actor.update({[`data.skills.${skillName}.value`]: -3})
      this.actor.update({[`data.skills.${skillName}.trained`]: false})
    } else if (matchingSkill && matchingSkill.trained) {
      this.actor.update({[`data.skills.${skillName}.value`]: data.skills[skillName].value - 1})
    }
  }
}



