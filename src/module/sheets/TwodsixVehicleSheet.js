/** @typedef {import("../entities/TwodsixActor").default} TwodsixActor */
/** @typedef {import("../entities/TwodsixItem").default} TwodsixItem */

import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";

export class TwodsixVehicleSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {

  static DEFAULT_OPTIONS = {
    sheetType: "TwodsixVehicleSheet",
    classes: ["twodsix", "vehicle", "actor"],
    dragDrop: [{dragSelector: ".item", dropSelector: null}],
    position: {
      width: 835,
      height: 600
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-truck-plane"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      toggleComponent: this._onToggleComponent,
      rollSkillVehicle: this._onSkillRollVehicle
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/vehicle-sheet.hbs",
      scrollable: ["", ".vehicle-storage", ".vehicle-components"]
    }
  };

  static TABS = {
    primary: {
      tabs: [
        {id: "stats", icon: "fa-solid fa-chart-bar", label: "TWODSIX.Vehicle.Tabs.Stats"},
        {id: "components", icon: "fa-solid fa-gears", label: "TWODSIX.Vehicle.Tabs.Components"},
        {id: "cargo", icon: "fa-solid fa-boxes-stacked", label: "TWODSIX.Vehicle.Tabs.Cargo"},
        {id: "storage", icon: "fa-solid fa-vault", label: "TWODSIX.Vehicle.Tabs.Storage"},
        {id: "description", icon: "fa-solid fa-book", label: "TWODSIX.Vehicle.Tabs.Description"}
      ],
      initial: "stats"
    }
  };

  /**
   * @param {Event} ev
   * @param {HTMLElement} target
   * @returns {void}
   */
  static _onToggleComponent(ev, target) {
    if (target) {
      const vehicleSystem = target.dataset.key;
      const stateTransitions = {
        "operational": "damaged",
        "damaged": "destroyed",
        "destroyed": "off",
        "off": "operational"
      };
      if (vehicleSystem) {
        const newState = ev.shiftKey ? ((this.actor.system).systemStatus[vehicleSystem] === "off" ? "operational" : "off") : stateTransitions[(this.actor.system).systemStatus[vehicleSystem]];
        this.actor.update({[`system.systemStatus.${vehicleSystem}`]: newState});
      } else {
        const li = target.closest(".item");
        const itemSelected = this.actor.items.get(li.dataset.itemId);
        if (!itemSelected) {
          return;
        }
        const type = target.dataset.type;
        if (type === "status") {
          const newState = ev.shiftKey ? (itemSelected.system.status === "off" ? "operational" : "off") : stateTransitions[itemSelected.system.status];
          itemSelected.update({"system.status": newState});
        } else if (type === "popup") {
          itemSelected.update({"system.isExtended": !itemSelected.system.isExtended});
        }
      }
    }
  }

  /**
   * Handle clickable skill rolls.
   * @param {Event} ev   The originating click event
   * @returns {Promise<void>}
   */
  static async _onSkillRollVehicle(ev /*target:HTMLElement*/) {
    ev.preventDefault();
    ev.stopPropagation();

    const useInvertedShiftClick = (game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showThrowDiag = useInvertedShiftClick ? ev["shiftKey"] : !ev["shiftKey"];
    //Get Controlled actor
    const selectedActor = getControlledTraveller();

    if (selectedActor) {
      let skill = selectedActor.items.getName((this.actor.system).skillToOperate);
      if (!skill) {
        skill = selectedActor.items.find((itm) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained") && itm.type === "skills");
      }
      const tmpSettings = {
        rollModifiers: {other: (this.actor.system).maneuver.agility ? parseInt((this.actor.system).maneuver.agility) : 0},
        event: ev
      };
      const settings = await TwodsixRollSettings.create(showThrowDiag, tmpSettings, skill, undefined, selectedActor);
      if (!settings.shouldRoll) {
        return;
      }
      await skill?.skillRoll(showThrowDiag, settings);
    } else {
      ui.notifications.warn("TWODSIX.Warnings.NoActorSelected", {localize: true});
    }
  }

  /**
   * @override
   * @param {object} options
   * @returns {Promise<object>}
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Add relevant data from system settings
    Object.assign(context.settings, {
      showSingleComponentColumn: game.settings.get('twodsix', 'showSingleComponentColumn'),
      showHullAndArmor: game.settings.get('twodsix', 'showHullAndArmor'),
      showRangeSpeedNoUnits: game.settings.get('twodsix', 'showRangeSpeedNoUnits'),
      maxComponentHits: game.settings.get('twodsix', 'maxComponentHits')
    });

    if (game.settings.get('twodsix', 'useProseMirror')) {
      const TextEditorImp = foundry.applications.ux.TextEditor.implementation;
      context.richText = {
        description: await TextEditorImp.enrichHTML(context.system.description, {secrets: this.document.isOwner}),
      };
    }

    return context;
  }
}

/**
 * @returns {TwodsixActor|undefined}
 */
export function getControlledTraveller() {
  if (game.user?.isGM !== true) {
    if (game.user?.character) {
      return game.user.character;
    } else {
      const playerId = game.userId;
      if (playerId !== null) {
        const character = game.actors?.find(a => (a.permission === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) && (a.type === "traveller") && !!a.getActiveTokens()[0]);
        if (character != null) {
          return game.actors?.get(character.id);
        }
      }
    }
  } else {
    // For GM, select actor as the selected traveller token
    if (canvas.tokens?.controlled !== undefined) {
      const selectedToken = canvas.tokens?.controlled.find(ct => ct.actor?.type === "traveller");//<Actor>(canvas.tokens?.controlled[0].actor);
      if (selectedToken) {
        return (selectedToken.actor);
      }
    }
  }
}

