export abstract class AbstractTwodsixActorSheet extends ActorSheet {

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

  _onDragStart(event: DragEvent):void {
    const header = event.currentTarget;
    if (!header["dataset"]) {
      return;
    }

    return super._onDragStart(event);
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
    const itemType = (type === "skills" ? "skill" : type);
    data.name = game.i18n.localize("TWODSIX.Items.Items.New") + " " + game.i18n.localize("TWODSIX.itemTypes." + itemType);
    // Prepare the item object.
    const itemData = {
      name: data.name,
      type,
      data
    };

    // Remove the type from the dataset since it's in the itemData.type prop.
    delete itemData.data.type;

    if (itemData.type === 'skills') {
      if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
        itemData.data.value = game.settings.get('twodsix', 'untrainedSkillValue');
      } else {
        itemData.data.value = 0;
      }
    }
    // Finally, create the item!
    return this.actor.createOwnedItem(itemData);
  }


  /**
   * Special handling of skills dropping.
   */
  protected async _onDrop(event:DragEvent):Promise<any> {
    event.preventDefault();

    let data:any;
    try {
      if (!event.dataTransfer) {
        return false;
      }
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch (err) {
      console.log(`Twodsix | Drop failed with {err}`);
      return false;
    }

    if (!data) {
      console.log(`Twodsix | Dragging something that can't be dragged`);
      return false;
    }

    if (data.type === 'damageItem') {
      await this.actor.damageActor(data.payload["damage"]);
      return;
    }

    const actor = this.actor;
    let itemData;

    if (data.pack) {
      // compendium
      const pack = game.packs.find((p) => p.collection === data.pack);
      if (pack.metadata.entity !== 'Item') {
        return;
      }
      const item = await pack.getEntity(data.id);
      itemData = duplicate(item.data);
    } else if (data.data) {
      // other actor
      itemData = duplicate(data.data);
    } else {
      // items directory
      itemData = duplicate(game.items.get(data.id).data);
    }


    //If we get here, we're sorting things.
    //Special for skills
    if (itemData.type === 'skills') {
      const matching = actor.data.items.filter(x => {
        return x.name === itemData.name;
      });

      // Handle item sorting within the same Actor
      const sameActor = (data.actorId === actor._id) || (actor.isToken && (data.tokenId === actor.token.id));
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
        itemData.data.value = game.settings.get('twodsix', 'untrainedSkillValue');
      } else {
        itemData.data.value = 0;
      }

      await actor.createOwnedItem(itemData);
      console.log(`Twodsix | Added Skill ${itemData.name} to character`);
    } else {
      // Handle item sorting within the same Actor
      const sameActor = (data.actorId === actor._id) || (actor.isToken && (data.tokenId === actor.token.id));
      if (sameActor) {
        return this._onSortItem(event, itemData);
      }

      // Create the owned item (TODO Add to type and remove the two lines below...)
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return this._onDropItemCreate(itemData);
    }

  }

  protected static _prepareItemContainers(sheetData:{ actor; items; }):void {
    const actorData = sheetData.actor;

    // Initialize containers.
    const storage:Item[] = [];
    const equipment:Item[] = [];
    const weapon:Item[] = [];
    const armor:Item[] = [];
    const augment:Item[] = [];
    const tool:Item[] = [];
    const junk:Item[] = [];
    const skills:Item[] = [];

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
