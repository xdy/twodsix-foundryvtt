export class AbstractTwodsixActorSheet extends ActorSheet {

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

    // Delete Item
    html.find('.item-delete').on('click', async (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const ownedItem = this.actor.getOwnedItem(li.data('itemId'));
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
      await Dialog.confirm({
        title: title,
        content: template,
        yes: async () => {
          await this.actor.deleteOwnedItem(ownedItem.id);
          li.slideUp(200, () => this.render(false));
        },
        no: () => {
          //Nothing
        },
      });
    });
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

    this.handleContentEditable(html);
  }

  private handleContentEditable(html:JQuery<HTMLElement>) {
    html.find('div[contenteditable="true"][data-edit]').on(
      'focusout',
      this._onSubmit.bind(this)
    );
  }


  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  private _onItemCreate(event:{ preventDefault:() => void; currentTarget:any }):Promise<Item> {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const {type} = header.dataset;
    // Grab any data associated with this control.
    const data = duplicate(header.dataset);
    // Initialize a default name, handle bad naming of 'skills' item type, which should be singular.
    const itemType = (type === "skills" ? "skill" : type).capitalize();
    const name = game.i18n.localize("TWODSIX.Items.Items.New") + " " + `${itemType}`;
    data.name = name;
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


  protected static _prepareItemContainers(sheetData:{ actor:any; items:any; }):void {
    const actorData = sheetData.actor;

    // Initialize containers.
    const storage = [];
    const equipment = [];
    const weapon = [];
    const armor = [];
    const augment = [];
    const tool = [];
    const junk = [];
    const skills = [];

    // Iterate through items, allocating to containers
    for (const i of sheetData.items) {
      i.img = i.img || CONST.DEFAULT_TOKEN;
      switch (i.type) {
        case 'storage':
          storage.push(i);
          break;
        case 'equipment':
        case 'tool':
        case 'junk':
          equipment.push(i);
          break;
        case 'weapon':
          weapon.push(i);
          break;
        case 'armor':
          armor.push(i);
          break;
        case 'augment':
          augment.push(i);
          break;
        case 'skills':
          skills.push(i);
          break;
        default:
          break;
      }
    }
    // Assign and return
    actorData.storage = storage;
    actorData.equipment = equipment;
    actorData.weapon = weapon;
    actorData.armor = armor;
    actorData.augment = augment;
    actorData.tool = tool;
    actorData.junk = junk;
    actorData.skills = skills;

  }
}
