import {TWODSIX} from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import { getDataFromDropEvent } from "../utils/sheetUtils";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";

export class TwodsixShipV2Sheet extends AbstractTwodsixActorSheet {

  /** @override */
  getData():any {
    const data:any = super.getData();
    data.dtypes = ["String", "Number", "Boolean"];
    if (this.actor.data.type == 'ship_v2') {
      data.data.storage = data.actor.items;
      AbstractTwodsixActorSheet._prepareItemContainers(this.actor.items, data);
    }
    
    data.data.crewPositions = data.items.filter(item=>item.type==="ship_crew_position").map(crewPosition => {
      const shipCrewPositionActorIds = Object.entries(data.data.data.shipCrewPositionActorIds).filter(([_, shipCrewPositionId]) => shipCrewPositionId === crewPosition._id)
      if (shipCrewPositionActorIds.length > 0) {
        const actorIds = shipCrewPositionActorIds.map(([actorId, _]) => actorId);
        crewPosition.data.actors = actorIds.map(actorId => game.actors.get(actorId));
      } else {
        crewPosition.data.actors = [];
      }
      
      crewPosition.data.sorted_actions = Object.entries(crewPosition.data.actions).map((act) => {
        let ret = act[1]
        ret["id"] = act[0]
        return ret;
      })
      crewPosition.data.sorted_actions.sort((a, b) => (a.order > b.order) ? 1 : -1)
      return crewPosition;
    })
    data.data.crewPositions.sort((a,b) => a.data.order-b.data.order);

    data.data.settings = {
      showSingleComponentColumn: game.settings.get('twodsix', 'showSingleComponentColumn')
    };

    return data;
  }
  
  // @ts-ignore
  static get defaultOptions():FormApplicationOptions {
    // @ts-ignore
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "ship_v2", "actor"],
      template: "systems/twodsix/templates/actors/ship-sheet_v2.html",
      width: 825,
      height: 648,
      resizable: false,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "crew"}],
      scrollY: [".ship-crew", ".ship-component", ".ship-storage", ".storage-wrapper", ".finances", ".ship-notes"],
      dragDrop: [
        {dropSelector: null, dragSelector: ".drag"},
        {
          dropSelector: null,
          dragSelector: ".crew-actor-token"
        }
      ]
    });
  }

  async _executeAction(event: DragEvent): Promise<boolean | any> {
    let actorId:string;
    const crewPosEl = $(event.currentTarget).parents(".crew-position");
    if ($(event.currentTarget).parents(".crew-position").find(".crew-actor-token").length === 1) {
      actorId = crewPosEl.find(".crew-actor-token").data("id");
    } else {
      actorId = crewPosEl.find(".crew-actor-token.force-border").data("id");
    }
    
    if (!actorId) {
      ui.notifications.error(game.i18n.localize("TWODSIX.ShipV2.ActorMustBeSelectedForAction"));
      return null;
    }
    const actionId = $(event.currentTarget).data("id");
    const shipCrewPositionId = $(event.currentTarget).parents(".crew-position").data("id");
    const shipCrewPosition = this.actor.items.get(shipCrewPositionId);
    const action = shipCrewPosition.data.data.actions[actionId];
    
    if (action.type === "simple") {
      const actor = game.actors.get(actorId);
      const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showTrowDiag = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
      const difficulties = TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))];
      const re = new RegExp(/^(.+?)\/?([A-Z]*?) ?(\d*?)\+?$/);
      const [_, parsedSkill, char, diff] = re.exec(action.command);
      const skill = actor.items.filter(itm => itm.name === parsedSkill)[0] as TwodsixItem;
      let settings = {
        characteristic: char ? char : undefined
      };
      if (diff) {
        settings["difficulty"] = Object.values(difficulties).filter(difficulty => difficulty.target === parseInt(diff, 10))[0];
      }
      
      const options = await TwodsixRollSettings.create(showTrowDiag, settings, skill, null)
      skill.skillRoll(showTrowDiag, options);
        
    } else {
      const code = `
      const ship = game.actors.get("${this.actor.id}");
      const components = ship.items.filter(item => ${JSON.stringify(shipCrewPosition.data.data.componentIds)}.includes(item.id));
      const actor = game.actors.get("${actorId}");
      ${action.command}
      `;
      console.debug(code);
      new Macro({"name": "tmpMacro", "command": code, "type": "script"}).execute();
    }
  }

  activateListeners(html:JQuery):void {
    super.activateListeners(html);
    html.find('.crew_position-edit').on('click', this._onCrewPositionEdit.bind(this));
    html.find('.crew_position-delete').on('click', this._onCrewPositionDelete.bind(this));
    html.find('.crew-actor-token').on('click', this._onCrewActorClick.bind(this));
    html.find('.crew-action').on('click', this._executeAction.bind(this));
  }

  private _onCrewPositionEdit(event:Event):void {
    const crewPositionId = $(event.currentTarget).parents(".crew-position").data("id");
    this.actor.items.get(crewPositionId).sheet.render(true);
  }

  private _onCrewPositionDelete(event:Event):void {
    if (confirm("Are you sure you want to delete this position?")) {
      const crewPositionId = $(event.currentTarget).parents(".crew-position").data("id");
      this.actor.deleteEmbeddedDocuments("Item", [crewPositionId]);
    }
  }

  private _onCrewActorClick(event:Event) {
    const hasClass = $(event.currentTarget).hasClass("force-border")
    $(event.currentTarget).parents(".crew-position").find(".crew-actor-token").removeClass("force-border");
    if (!hasClass) {
      $(event.currentTarget).addClass("force-border")
    }
  }

  _onDragStart(event: DragEvent):void {
    event.dataTransfer.setData("text/plain", JSON.stringify({"type": "Actor", "id": $(event.target).data("id")}))
  }

   async _onDrop(event:DragEvent):Promise<boolean | any> {
    event.preventDefault();

    const data = getDataFromDropEvent(event);
    console.log(event, data)
    if ((data.type === "Actor" && game.actors.get(data.id).type === "traveller")) {
      const actorId = data.id;
      if ($(event.target).parents(".crew-position").length === 1) {
        const shipCrewPositionId = $(event.target).parents(".crew-position").data("id");
        this.actor.update({[`data.shipCrewPositionActorIds.${actorId}`]: shipCrewPositionId})
      } else {
        this.actor.update({[`data.shipCrewPositionActorIds.-=${actorId}`]: null})
      }
    } else {
      return super._onDrop(event);
    }
  }
}