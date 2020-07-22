import {Difficulties, Rolltype} from "../utils/sheetUtils";

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
        let attr:any;
        for (attr of Object.values(data.data.characteristics)) {
            attr.isCheckbox = attr.dtype === "Boolean";
        }
        //

        data.isToken = this.actor.isToken;
        data.itemsByType = {};

        if (data.items) {
            for (const item of data.items) {
                let list = data.itemsByType[item.type];
                if (!list) {
                    list = [];
                    data.itemsByType[item.type] = list;
                }
                list.push(item);
            }

            data.skills = data.itemsByType['skill'];
            data.weapons = data.itemsByType['weapon'];
        }

        // TODO Not sure this is the proper format.
        async function addAllSkillsFromCompendium() {
            const skillPack = game.packs.filter(c => c.metadata.entity && c.metadata.entity == 'Item' && c.metadata.name == 'skills')[0];
            const entities = await skillPack.getContent();

            data.allskills = entities.reduce(function (result, item) {
                result[item.data.data.label] = item;
                return result;
            }, {});
        }

        addAllSkillsFromCompendium();

        return data
    }

    /** @override */
    static get defaultOptions():FormApplicationOptions {
        return mergeObject(super.defaultOptions, {
            classes: ["twodsix", "sheet", "actor"],
            template: "systems/twodsix/templates/actors/actor-sheet.html",
            width: 600,
            height: 600,
            tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills"}]
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

        // // Draggables
        // const handler = (ev) => this._onDragItemStart(ev);
        // // Find all items on the character sheet.
        // html.find('.draggable').each((i, li) => {
        //     // Add draggable attribute and dragstart listener.
        //     li.setAttribute('draggable', 'true');
        //     li.addEventListener('dragstart', handler, false);
        // });

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

        // Delete Inventory Item
        html.find('.item-delete').on('click', ev => {
            const li = $(ev.currentTarget).parents(".item");
            this.actor.deleteOwnedItem(li.data("itemId"));
            li.slideUp(200, () => this.render(false));
        });

        // Rollable abilities.
        html.find('.rollable-characteristic').on('click', (this._onRollableCharacteristic).bind(this));

        html.find('.rollable-skill').on('click', (this._onRollableSkill).bind(this));

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
    _onRollableCharacteristic(event:{ preventDefault:() => void; currentTarget:any; }):void {
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

    /**
     * Handle clickable rolls.
     * @param {Event} event   The originating click event
     * @private
     */
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    _onRollableSkill(event:any):void {
        event.preventDefault();
        const children = event.currentTarget.children;


        if (event.originalEvent.target.type === 'select-one') {
            //Don't treat select as rollable
            return;
        }

        //Ugly...
        const skill:string = children.item(0).innerText;
        const skillValue:number = parseInt(children.item(4).textContent);
        const characteristicMod = parseInt(this.actor.data.data.characteristics[children.item(1).value].mod);
        const dice = Rolltype[children.item(2).value];
        const difficulty = children.item(3).value as keyof typeof Difficulties;

        //TODO This is for CE, other variants change the target from 8 instead of modifying roll, should read formula from config based on variant
        const successValue = 8;
        const formula = `${dice}ms=${successValue}+${skillValue}+${characteristicMod}+${Difficulties[difficulty]}`;
        const roll = new Roll(formula, this.actor.data.data);
        const label = `Rolling ${skill} at ${difficulty} difficulty`;
        //TODO Should use custom html
        roll.roll().toMessage({
            speaker: ChatMessage.getSpeaker({actor: this.actor}),
            flavor: label
        });
    }


    // async _onDrop(event:any):Promise<boolean> {
    //     event.preventDefault();
    //
    //     //TODO If an attribute mod is being dragged onto a skill, do a roll.
    //     const target = $(event.target);
    //     const dragData = event.dataTransfer.getData('text/plain');
    //     const dragItem = JSON.parse(dragData);
    //
    //     dragItem
    //
    //     return true;
    // }
}