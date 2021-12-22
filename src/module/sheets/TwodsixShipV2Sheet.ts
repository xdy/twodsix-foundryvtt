export class TwodsixShipV2Sheet extends ActorSheet {
  
  /** @override */
  getData():any {
    const data:any = super.getData();
    // data.dtypes = ["String", "Number", "Boolean"];

    data.data.crewPositions = data.items.filter(item=>item.type=="ship_crew_position").map(crewPosition => {
      crewPosition.data.actors = crewPosition.data.actorIds.map(actorId => game.actors.get(actorId));
      crewPosition.data.actions = crewPosition.data.actionIds.map(actionId => game.macros.get(actionId));
      return crewPosition;
    })
    // console.log(data.data.crewPositions)
    // 
      
    // });
    data.data.crewPositions.sort((a,b) => a.data.order-b.data.order);

    
    // // Prepare items.
    // if (this.actor.data.type == 'ship') {
    //   data.data.storage = data.actor.items;
    // }

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
      scrollY: [".ship-crew"],
      dragDrop: [
        {dropSelector: null, dragSelector: ".drag"}, 
        {
          dropSelector: null,
          dragSelector: ".crew-actor-token",
          callbacks: { 
            dragstart: () => console.log("DRAG START"), 
            drop: () => console.log("DROP!!!"),
          }
        }
      ]
    });
  }

  activateListeners(html:JQuery):void {
    super.activateListeners(html);
    html.find('.crew_position-edit').on('click', this._onCrewPositionEdit.bind(this));
    html.find('.crew-actor-token').on('click', this._onCrewActorClick.bind(this));
    html.find('.crew-actor-token').on('drop', this._onCrewActorDrop.bind(this));
    html.find('.crew-action').on('click', this._onCrewActionClick.bind(this));
  }

  private _onCrewPositionEdit(event:Event):void {
    const crewPositionId = $(event.currentTarget).parents(".crew-position").data("id");
    this.actor.items.get(crewPositionId).sheet.render(true);
  }
   
  private async _onCrewActionClick(event:Event) {
    const actorId = $(".crew-actor-token.force-border").data("id");
    const actor = game.actors.get(actorId);

    const skillName = $(event.currentTarget).data("value");

    await actor.items.find(x=>x.data.data.skillName === skillName).skillRoll(true);

  }

  private _onCrewActorClick(event:Event) {
    $(".crew-actor-token").removeClass("force-border")
    $(event.currentTarget).addClass("force-border")
  }

  _onDragStart(event: DragEvent):void {
    console.log(event)

    return super._onDragStart(event);
  }


  async _onCrewActorDrop(event) {
    console.log("DROPPER!")
  }

  async _onDropItem(event, data) {
    console.log("DROP!", event, data)
    if (game.items.get(data.id).data.type === "ship_crew_position") {
      return super._onDropItem(event, data)
    }
  }

  async _onDropActor(event, data) {
    if ( !this.actor.owner ) return false;
    const actor = game.actors.get(data.id);
    if (actor.data.type !== "traveller") return false;
    const crewPositionId = $(event.target).parents(".crew-position").data("id");
    const crewPosition = this.actor.getOwnedItem(crewPositionId);
    if (crewPosition.data.data.actorIds.includes(data.id)) return false;
    const actorIds = crewPosition.data.data.actorIds.concat([data.id]);
    crewPosition.update({"data.actorIds": actorIds})
    return true;
  }

  /**
   * Special handling of skills dropping.
   */
   async _on222Drop(event:DragEvent):Promise<boolean | any> {
    // console.log(event, event.dataTransfer.getData('text/plain'))
    // event.preventDefault();

    // const data = getDataFromDropEvent(event);

    // if (!data) {
    //   console.log(`Twodsix | Dragging something that can't be dragged`);
    //   return false;
    // }

    // if (data.type === 'damageItem') {
    //   // @ts-ignore
    //   await this.actor.damageActor(data.payload["damage"]);
    //   return;
    // }

    // const actor = this.actor;
    // const itemData = await getItemDataFromDropData(data);


    // //If we get here, we're sorting things.
    // //Special for skills
    // if (itemData.type === 'skills') {
    //   const matching = actor.data.items.filter(x => {
    //     // @ts-ignore
    //     return x.name === itemData.name;
    //   });

    //   // Handle item sorting within the same Actor
    //   const sameActor = (data.actorId === actor._id) || (actor.isToken && (data.tokenId === actor.token.id));
    //   if (sameActor) {
    //     // @ts-ignore
    //     console.log(`Twodsix | Moved Skill ${itemData.name} to another position in the skill list`);
    //     // @ts-ignore
    //     return this._onSortItem(event, itemData);
    //   }

    //   if (matching.length > 0) {
    //     // @ts-ignore
    //     console.log(`Twodsix | Skill ${itemData.name} already on character ${actor.name}.`);
    //     //TODO Maybe this should mean increase skill value?
    //     return false;
    //   }

    //   if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
    //     // @ts-ignore
    //     itemData.data.value = game.system.template.Item.skills.value;
    //   } else {
    //     // @ts-ignore
    //     itemData.data.value = 0;
    //   }

    //   await actor.createOwnedItem(itemData);
    //   // @ts-ignore
    //   console.log(`Twodsix | Added Skill ${itemData.name} to character`);
    // } else {
    //   // Handle item sorting within the same Actor
    //   const sameActor = (data.actorId === actor._id) || (actor.isToken && (data.tokenId === actor.token.id));
    //   if (sameActor) {
    //     // @ts-ignore
    //     return this._onSortItem(event, itemData);
    //   }

    //   // Create the owned item (TODO Add to type and remove the two lines below...)
    //   // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //   // @ts-ignore
    //   return this._onDropItemCreate(itemData);
    // }

  }
}