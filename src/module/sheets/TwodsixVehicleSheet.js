import {TwodsixRollSettings} from "../utils/TwodsixRollSettings";
import {AbstractTwodsixActorSheet} from "./AbstractTwodsixActorSheet";
import {deletePDFReference, openPDFReference} from "../utils/sheetUtils";

export class TwodsixVehicleSheet extends AbstractTwodsixActorSheet {
  /** @override */
  getData() {
    const context = super.getData();
    context.dtypes = ["String", "Number", "Boolean"];
    AbstractTwodsixActorSheet._prepareItemContainers(this.actor, context);
    context.settings = {
      showHullAndArmor: game.settings.get('twodsix', 'showHullAndArmor'),
      usePDFPager: game.settings.get('twodsix', 'usePDFPagerForRefs'),
      showRangeSpeedNoUnits: game.settings.get('twodsix', 'showRangeSpeedNoUnits')
    };
    return context;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "vehicle", "actor"],
      template: "systems/twodsix/templates/actors/vehicle-sheet.html",
      width: 835,
      height: 698,
      resizable: true,
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find(".component-toggle").on("click", this._onToggleComponent.bind(this));
    //html.find('.roll-damage').on('click', onRollDamage.bind(this));
    html.find('.rollable').on('click', this._onRollWrapperVehicle(this._onSkillRollVehicle));
    html.find('.open-link').on('click', openPDFReference.bind(this, this.actor.system.docReference));
    html.find('.delete-link').on('click', deletePDFReference.bind(this));
  }

  _onToggleComponent(event) {
    if (event.currentTarget) {
      const system = event.currentTarget["dataset"]["key"];
      const stateTransitions = {
        "operational": "damaged",
        "damaged": "destroyed",
        "destroyed": "off",
        "off": "operational"
      };
      if (system) {
        const newState = stateTransitions[this.actor.system.systemStatus[system]];
        this.actor.update({[`system.systemStatus.${system}`]: newState});
      } else {
        const li = $(event.currentTarget).parents(".item");
        const itemSelected = this.actor.items.get(li.data("itemId"));
        itemSelected?.update({"system.status": stateTransitions[itemSelected.system?.status]});
      }
    }
  }

  _onRollWrapperVehicle(func) {
    return (event) => {
      event.preventDefault();
      event.stopPropagation();
      const useInvertedShiftClick = game.settings.get('twodsix', 'invertSkillRollShiftClick');
      const showTrowDiag = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
      func.bind(this)(event, showTrowDiag);
    };
  }

  /**
   * Handle clickable skill rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  async _onSkillRollVehicle(event, showThrowDiag) {
    //Get Controlled actor
    const selectedActor = getControlledTraveller();
    if (selectedActor) {
      let skill = selectedActor.items.getName(this.actor.system.skillToOperate);
      if (!skill) {
        skill = selectedActor.items.find((itm) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained") && itm.type === "skills");
      }
      const tmpSettings = {
        rollModifiers: {other: this.actor.system.maneuver.agility ? parseInt(this.actor.system.maneuver.agility) : 0},
        event: event
      };
      const settings = await TwodsixRollSettings.create(showThrowDiag, tmpSettings, skill, undefined, selectedActor);
      if (!settings.shouldRoll) {
        return;
      }
      await skill?.skillRoll(showThrowDiag, settings);
    }
  }
}

export function getControlledTraveller() {
  if (game.user?.isGM !== true) {
    if (game.user?.character) {
      return game.user.character;
    } else {
      const playerId = game.userId;
      if (playerId !== null) {
        const character = game.actors?.find(a => (a.permission === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER) && (a.type === "traveller") && !!a.getActiveTokens()[0]);
        if (character != null) {
          return game.actors?.get(character.id);
        }
      }
    }
  } else {
    // For GM, select actor as the selected traveller token
    if (canvas.tokens?.controlled !== undefined) {
      const selectedToken = canvas.tokens?.controlled.find(ct => ct.actor?.type === "traveller"); //<Actor>(canvas.tokens?.controlled[0].actor);
      if (selectedToken) {
        return (selectedToken.actor);
      }
    }
  }
}
