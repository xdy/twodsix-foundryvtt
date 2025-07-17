// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import {Vehicle, Component } from "src/types/template";
import TwodsixItem from "../entities/TwodsixItem";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import TwodsixActor from "../entities/TwodsixActor";

export class TwodsixVehicleSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {

  static DEFAULT_OPTIONS =  {
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
      //scrollable: ['']
    }
  };

  static TABS = {
    primary: {
      tabs: [
        {id: "stats", icon: "fa-solid fa-chart-bar", label: "TWODSIX.Vehicle.Tabs.Stats"},
        {id: "components", icon: "fa-solid fa-gears", label: "TWODSIX.Vehicle.Tabs.Components"},
        {id: "cargo", icon: "fa-solid fa-boxes-stacked", label: "TWODSIX.Vehicle.Tabs.Cargo"},
        {id: "description", icon: "fa-solid fa-book", label: "TWODSIX.Vehicle.Tabs.Description"}
      ],
      initial: "stats"
    }
  };

  /** @override */
  async _prepareContext(options):any {
    const context = await super._prepareContext(options);

    // Add relevant data from system settings
    Object.assign(context.settings, {
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

  static _onToggleComponent(ev:Event, target:HTMLElement):void {
    if (target) {
      const vehicleSystem = target.dataset.key;
      const stateTransitions = {"operational": "damaged", "damaged": "destroyed", "destroyed": "off", "off": "operational"};
      if (vehicleSystem) {
        const newState = ev.shiftKey ? ((<Vehicle>this.actor.system).systemStatus[vehicleSystem] === "off" ? "operational" : "off") : stateTransitions[(<Vehicle>this.actor.system).systemStatus[vehicleSystem]];
        this.actor.update({[`system.systemStatus.${vehicleSystem}`]: newState});
      } else {
        const li = target.closest(".item");
        const itemSelected:Component = this.actor.items.get(li.dataset.itemId);
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
   * @private
   */
  static async _onSkillRollVehicle(ev:Event, /*target:HTMLElement*/): Promise<void> {
    ev.preventDefault();
    ev.stopPropagation();

    const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showThrowDiag: boolean = useInvertedShiftClick ? ev["shiftKey"] : !ev["shiftKey"];
    //Get Controlled actor
    const selectedActor:TwodsixActor = getControlledTraveller();

    if (selectedActor) {
      let skill = <TwodsixItem>selectedActor.items.getName((<Vehicle>this.actor.system).skillToOperate);
      if(!skill) {
        skill = selectedActor.items.find((itm: TwodsixItem) => itm.name === game.i18n.localize("TWODSIX.Actor.Skills.Untrained") && itm.type === "skills") as TwodsixItem;
      }
      const tmpSettings = {
        rollModifiers: {other: (<Vehicle>this.actor.system).maneuver.agility ? parseInt((<Vehicle>this.actor.system).maneuver.agility) : 0},
        event: ev
      };
      const settings:TwodsixRollSettings = await TwodsixRollSettings.create(showThrowDiag, tmpSettings, skill, undefined, selectedActor);
      if (!settings.shouldRoll) {
        return;
      }
      await skill?.skillRoll(showThrowDiag, settings);
    } else {
      ui.notifications.warn( "TWODSIX.Warnings.NoActorSelected", {localize: true});
    }
  }
}

export function getControlledTraveller(): TwodsixActor | void {
  if (game.user?.isGM !== true) {
    if (game.user?.character) {
      return <TwodsixActor>game.user.character;
    } else {
      const playerId = game.userId;
      if (playerId !== null) {
        const character = game.actors?.find(a => (a.permission === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER ) && (a.type === "traveller") && !!a.getActiveTokens()[0]);
        if (character != null) {
          return <TwodsixActor>game.actors?.get(character.id);
        }
      }
    }
  } else {
    // For GM, select actor as the selected traveller token
    if (canvas.tokens?.controlled !== undefined) {
      const selectedToken = canvas.tokens?.controlled.find(ct => ct.actor?.type === "traveller");//<Actor>(canvas.tokens?.controlled[0].actor);
      if (selectedToken) {
        return <TwodsixActor>(selectedToken.actor);
      }
    }
  }
}

