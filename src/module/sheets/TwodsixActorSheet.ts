/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */

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
        data.isToken = this.actor.isToken;

        return data;
    }

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Rollable abilities.
        html.find('.rollable').click(this._onRoll.bind(this));
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
