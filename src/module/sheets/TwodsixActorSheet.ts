/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */


export class TwodsixActorSheet extends ActorSheet {

    /** @override */
    static get defaultOptions():FormApplicationOptions {
        return mergeObject(super.defaultOptions, {
            classes: ["twodsix", "sheet", "actor"],
            template: "systems/twodsix/templates/actors/actor-sheet.html",
            width: 600,
            height: 600,
        });
    }

    /* -------------------------------------------- */

    /** @override */
    protected activateListeners(html:JQuery<HTMLElement>):void {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Submit when changing the state of checkboxes
        html.find('input[type="checkbox"]').on('change', (ev) =>
            this._onSubmit(ev)
        );

        // Add Inventory Item
        html.find('.item-create').on('click', this._onItemCreate.bind(this));

        // Update Inventory Item
        html.find('.item-edit').on('click', ev => {
            const li = $(ev.currentTarget).parents(".item");
            const item = this.actor.getOwnedItem(li.data("itemId"));
            item.sheet.render(true);
        });

        if (this.actor.owner) {
            const handler = (ev) => this._onDragItemStart(ev);
            // Find all items on the character sheet.
            html.find('li.item').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
        }

        // Increase Item Quantity
        html.find('.item-increase-quantity').on('click', (event) => {
            const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
            const item = this.actor.getOwnedItem(itemId).data;
            this.actor.updateEmbeddedEntity('OwnedItem', {
                _id: itemId,
                'data.quantity.value': Number(item.data.quantity.value) + 1
            });
        });

        // Decrease Item Quantity
        html.find('.item-decrease-quantity').on('click', (event) => {
            const li = $(event.currentTarget).parents('.item');
            const itemId = li.attr('data-item-id');
            const item = this.actor.getOwnedItem(itemId).data;
            if (Number(item.data.quantity.value) > 0) {
                this.actor.updateEmbeddedEntity('OwnedItem', {
                    _id: itemId,
                    'data.quantity.value': Number(item.data.quantity.value) - 1
                });
            }
        });

        // Delete Item
        html.find('.item-delete').on('click', async (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const ownedItem = this.actor.getOwnedItem(li.data('itemId'));
            const template = `
      <form>
        <div>
          <div style="text-align: center;">"Delete owned item"} 
            <strong>${ownedItem.name}</strong>?
          </div>
          <br>
        </div>
      </form>`;
            await Dialog.confirm({
                title: "Delete owned item",
                content: template,
                yes: async () => {
                    await this.actor.deleteOwnedItem(ownedItem.id);
                    li.slideUp(200, () => this.render(false));
                },
                no: () => {},
            });
        });

        // Delete Inventory Item
        html.find('.item-delete').on('click', ev => {
            const li = $(ev.currentTarget).parents(".item");
            this.actor.deleteOwnedItem(li.data("itemId"));
            li.slideUp(200, () => this.render(false));
        });

        // Rollable abilities.
        html.find('.rollable').on('click', (function (event):void {
            event.preventDefault();
            const element = event.currentTarget;
            const {dataset} = element;

            if (dataset.roll) {
                const roll = new Roll(dataset.roll, this.actor.data.data);
                const label = dataset.label ? `Rolling ${dataset.label}` : '';
                roll.roll().toMessage({
                    speaker: ChatMessage.getSpeaker({actor: this.actor}),
                    flavor: label
                });
            }
        }).bind(this));
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

}
