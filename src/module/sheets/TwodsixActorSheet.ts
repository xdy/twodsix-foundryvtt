/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
import {TWODSIX} from "../config";

export class TwodsixActorSheet extends ActorSheet {

    /**
     * Return the type of the current Actor
     * @type {String}
     */
    get actorType() {
        return this.actor.data.type;
    }

    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["twodsix", "sheet", "actor"],
            template: "systems/twodsix/templates/actors/actor-sheet.html",
            width: 600,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}]
        });
    }

    /* -------------------------------------------- */

    /** @override */
    getData() {
        const data: any = super.getData();
        data.dtypes = ["String", "Number", "Boolean"];
        let attr: any;
        for (attr of Object.values(data.data.characteristics)) {
            attr.isCheckbox = attr.dtype === "Boolean";
        }
        //

        data.isToken = this.actor.isToken;
        data.itemsByType = {};
        data.skills = {};
        data.weapons = {};
        data.data.allSkills = CONFIG.TWODSIX.skills;

        if (data.items) {
            for (const item of data.items) {
                let list = data.itemsByType[item.type];
                if (!list) {
                    list = [];
                    data.itemsByType[item.type] = list;
                }
                list.push(item);
            }

            for (const itemType in data.itemsByType) {
                data.itemsByType[itemType].sort((a, b) => {
                    let lca = a.name.toLowerCase();
                    let lcb = b.name.toLowerCase();
                    if (lca < lcb) return -1;
                    if (lca > lcb) return 1;
                    return 0;
                });
            }

            data.skills = data.itemsByType['skill'];
            data.weapons = data.itemsByType['skill'];

            return data;

        }
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Add Inventory Item
        html.find('.item-create').click(this._onItemCreate.bind(this));

        // Update Inventory Item
        html.find('.item-edit').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            const item = this.actor.getOwnedItem(li.data("itemId"));
            item.sheet.render(true);
        });

        if (this.actor.owner) {
            let handler = (ev) => this._onDragItemStart(ev);
            // Find all items on the character sheet.
            html.find('li.item').each((i, li) => {
                // Add draggable attribute and dragstart listener.
                li.setAttribute('draggable', 'true');
                li.addEventListener('dragstart', handler, false);
            });
        }

        // Increase Item Quantity
        html.find('.item-increase-quantity').click((event) => {
            const itemId = $(event.currentTarget).parents('.item').attr('data-item-id');
            const item = this.actor.getOwnedItem(itemId).data;
            this.actor.updateEmbeddedEntity('OwnedItem', {
                _id: itemId,
                'data.quantity.value': Number(item.data.quantity.value) + 1
            });
        });

        // Decrease Item Quantity
        html.find('.item-decrease-quantity').click((event) => {
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
        html.find('.item-delete').click(async (ev) => {
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
        html.find('.item-delete').click(ev => {
            const li = $(ev.currentTarget).parents(".item");
            this.actor.deleteOwnedItem(li.data("itemId"));
            li.slideUp(200, () => this.render(false));
        });

        // Rollable abilities.
        html.find('.rollable').click(this._onRoll.bind(this));
    }

    /* -------------------------------------------- */

    /**
     * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemCreate(event) {
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
    _onRoll(event) {
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
    }

}
