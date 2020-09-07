/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class TwodsixShipSheet extends ActorSheet {

  /**
* Return the type of the current Actor
* @type {String}
*/
  get actorType(): string {
    return this.actor.data.type;
  }

  /** @override */
  getData(): any {
    const data: any = super.getData();
    data.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.data.type == 'ship') {
      TwodsixShipSheet._prepareCharacterItems(data);
    }

    return data;
  }

  private static _prepareCharacterItems(sheetData: any) {
    sheetData.data.storage = sheetData.actor.items;
  }


  /** @override */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "ship", "actor"],
      template: "systems/twodsix/templates/actors/ship-sheet.html",
      width: 825,
      height: 648,
      resizable: false,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "crew" }]
    });
  }


  /* -------------------------------------------- */

  /** @override */
  protected activateListeners(html: JQuery<HTMLElement>): void {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) {
      return;
    }

    // Add Inventory Item
    html.find('.item-create').on('click', this._onItemCreate.bind(this));

    // Update Inventory Item
    (console.log);
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
  _onItemCreate(event: { preventDefault: () => void; currentTarget: any; }): Promise<Item> {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const { type } = header.dataset;
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
}
