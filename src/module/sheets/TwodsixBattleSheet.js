import { TwodsixShipSheet } from './TwodsixShipSheet';

export class TwodsixBattleSheet extends foundry.applications.api.HandlebarsApplicationMixin(TwodsixShipSheet) {
  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixBattleSheet",
    classes: ["twodsix", "battle", "actor"],
    position: {
      width: 850,
      height: 730
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-rocket"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      positionClick: this._onPositionClick
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/battle-sheet.hbs",
      scrollable: ["battle-content-container"]
    }
  };

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {void}
   */
  static _onPositionClick(ev, target) {
    if (target !== null) {
      const li = target.closest(".item");
      const selectedPositionId = li?.dataset.itemId;
      let selectedActorId = "";
      let selectedActionId = "";
      let uncrewed = false;
      if (selectedPositionId) {
        const actorSelect = li.querySelector("[name='selectedActor']");
        selectedActorId = actorSelect?.value ?? "";
        uncrewed = this.actor.items.get(selectedPositionId)?.system?.actors?.length === 0;
        selectedActionId = li.querySelector("[name='selectedAction']")?.value ?? "";
      }
      TwodsixShipSheet.performShipAction(ev, selectedPositionId, selectedActorId, selectedActionId, this.actor, uncrewed);
    }
  }

  /**
   * @inheritDoc
   * @param {object} options
   * @returns {object}
   */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    applicationOptions.dragDrop = [{dragSelector: ".item", dropSelector: null}];
    return applicationOptions;
  }

  /**
   * @override
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    //Build Position Data context
    const positionData = [];
    const allPositions = this.actor.itemTypes.ship_position.sort(comparePositions);
    for (const position of allPositions) {
      const actions = {};
      let defaultAction = "";
      for (const action in position.system.actions) {
        //const actionIcon = getActionIcon(position.system.actions[action].type);
        Object.assign(actions, {[action]: position.system.actions[action].name});
        //Object.assign(actions, {[action]: [`${position.system.actions[action].name} `, actionIcon]});
        if (!defaultAction) {
          defaultAction = action;
        }
      }
      const actors = {};
      let defaultActor = "";
      for (const actor of position.system.actors) {
        Object.assign(actors, {[actor.id]: actor.name});
        if (!defaultActor) {
          defaultActor = actor.id;
        }
      }
      if (!defaultActor) {
        actors[""] = game.i18n.localize("TWODSIX.Ship.UncrewedPositionName").replace("_POSITION_NAME_", position.name).trim();
      }
      positionData.push({
        id: position.id,
        name: position.name,
        actions: actions,
        actors: actors,
        defaultActor: defaultActor,
        defaultAction: defaultAction
      });
    }
    Object.assign(context, {positionData: positionData});

    //Build filtered components data
    const componentsToIgnore = game.settings.get('twodsix', 'componentsIgnored');
    context.container.nonCargoForDamage = context.container.nonCargo?.filter((comp) => !(componentsToIgnore.includes(comp.system.subtype)));

    return context;
  }
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
function comparePositions(a, b) {
  return a.system.order - b.system.order;
}
