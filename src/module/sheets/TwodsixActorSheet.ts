// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TWODSIX } from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import { Consumable, Gear, Skills } from "../../types/template";
import TwodsixItem  from "../entities/TwodsixItem";

export class TwodsixActorSheet extends AbstractTwodsixActorSheet {

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType(): string {
    return this.actor.type;
  }

  /** @override */
  getData(): any {
    const returnData: any = super.getData();
    returnData.system = returnData.actor.system;
    returnData.container = {};
    if (game.settings.get('twodsix', 'useProseMirror')) {
      returnData.richText = {
        description: TextEditor.enrichHTML(returnData.system.description, {async: false}),
        contacts: TextEditor.enrichHTML(returnData.system.contacts, {async: false}),
        bio: TextEditor.enrichHTML(returnData.system.bio, {async: false}),
        notes: TextEditor.enrichHTML(returnData.system.notes, {async: false}),
        xpNotes: TextEditor.enrichHTML(returnData.system.xpNotes, {async: false})
      };
    }

    returnData.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.type === 'traveller') {
      const actor: TwodsixActor = <TwodsixActor>this.actor;
      const untrainedSkill = actor.getUntrainedSkill();
      if (untrainedSkill) {
        returnData.untrainedSkill = untrainedSkill;
        returnData.jackOfAllTrades = TwodsixActorSheet.untrainedToJoat(returnData.untrainedSkill.system.value);
      }
      AbstractTwodsixActorSheet._prepareItemContainers(actor, returnData);
    }

    // Add relevant data from system settings
    returnData.settings = {
      ShowRangeBandAndHideRange: game.settings.get('twodsix', 'ShowRangeBandAndHideRange'),
      ExperimentalFeatures: game.settings.get('twodsix', 'ExperimentalFeatures'),
      autofireRulesUsed: game.settings.get('twodsix', 'autofireRulesUsed'),
      lifebloodInsteadOfCharacteristics: game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics'),
      showContaminationBelowLifeblood: game.settings.get('twodsix', 'showContaminationBelowLifeblood'),
      showLifebloodStamina: game.settings.get("twodsix", "showLifebloodStamina"),
      showHeroPoints: game.settings.get("twodsix", "showHeroPoints"),
      showIcons: game.settings.get("twodsix", "showIcons"),
      showStatusIcons: game.settings.get("twodsix", "showStatusIcons"),
      showInitiativeButton: game.settings.get("twodsix", "showInitiativeButton"),
      showAlternativeCharacteristics: game.settings.get('twodsix', 'showAlternativeCharacteristics'),
      useProseMirror: game.settings.get('twodsix', 'useProseMirror'),
      useFoundryStandardStyle: game.settings.get('twodsix', 'useFoundryStandardStyle'),
      showSkillCountsRanks: game.settings.get('twodsix', 'showSkillCountsRanks'),
      showSpells: game.settings.get('twodsix', 'showSpells'),
      useNationality: game.settings.get('twodsix', 'useNationality'),
      hideUntrainedSkills: game.settings.get('twodsix', 'hideUntrainedSkills')
    };

    returnData.ACTIVE_EFFECT_MODES = Object.entries(CONST.ACTIVE_EFFECT_MODES).reduce((ret, entry) => {
      const [ key, value ] = entry;
      ret[ value ] = key;
      return ret;
    }, {});
    returnData.config = TWODSIX;

    return returnData;
  }


  /** @override */
  static get defaultOptions(): ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "actor"],
      template: "systems/twodsix/templates/actors/actor-sheet.html",
      width: 825,
      height: 656,
      resizable: false,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills"}],
      scrollY: [".skills", ".inventory", ".finances", ".info", ".effects", ".actor-notes"],
      dragDrop: [{dragSelector: ".item", dropSelector: null}]
    });
  }


  public activateListeners(html: JQuery): void {
    super.activateListeners(html);

    html.find('#joat-skill-input').on('input', this._updateJoatSkill.bind(this));
    html.find('#joat-skill-input').on('blur', this._onJoatSkillBlur.bind(this));
    html.find('#joat-skill-input').on('click', (event) => {
      $(event.currentTarget).trigger("select");
    });

    html.find(".adjust-consumable").on("click", this._onAdjustConsumableCount.bind(this));
    html.find(".refill-button").on("click", this._onRefillConsumable.bind(this));

    html.find(".item-fill-consumable").on("click", this._onAutoAddConsumable.bind(this));
    // Item State toggling
    html.find(".item-toggle").on("click", this._onToggleItem.bind(this));
    html.find(".item-viewToggle").on("click", this._onViewToggle.bind(this));

  }

  /**
   * Handle when the joat skill is changed.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _updateJoatSkill(event): Promise<void> {
    const joatValue = parseInt(event.currentTarget["value"], 10);
    const skillValue = TwodsixActorSheet.joatToUntrained(joatValue);

    if (!isNaN(joatValue) && joatValue >= 0 && skillValue <= 0) {
      const untrainedSkill = (<TwodsixActor>this.actor).getUntrainedSkill();
      untrainedSkill.update({"system.value": skillValue});
    } else if (event.currentTarget["value"] !== "") {
      event.currentTarget["value"] = "";
    }
  }

  /**
   * Handle when user tabs out and leaves blank value.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onJoatSkillBlur(event): Promise<void> {
    if (isNaN(parseInt(event.currentTarget["value"], 10))) {
      const skillValue = (<Skills>(<TwodsixActor>this.actor).getUntrainedSkill().system).value;
      event.currentTarget["value"] = TwodsixActorSheet.untrainedToJoat(skillValue);
    }
  }

  private static untrainedToJoat(skillValue: number): number {
    return skillValue - (<Skills>game.system.template?.Item?.skills)?.value;
  }

  private static joatToUntrained(joatValue: number): number {
    return joatValue + (<Skills>game.system.template?.Item?.skills)?.value;
  }

  private getConsumableItem(event): TwodsixItem {
    const itemId = $(event.currentTarget).parents('.consumable-row').data('consumable-id');
    return this.actor.items.get(itemId) as TwodsixItem;
  }

  private async _onAdjustConsumableCount(event): Promise<void> {
    const modifier = parseInt(event.currentTarget["dataset"]["value"], 10);
    const item = this.getConsumableItem(event);
    await item.consume(modifier);
  }

  private async _onRefillConsumable(event): Promise<void> {
    const item = this.getConsumableItem(event);
    try {
      await item.refill();
    } catch (err) {
      if (err.name === "TooLowQuantityError") {
        const refillAction = ["magazine", "power_cell"].includes((<Consumable>item.system).subtype) ? "Reload" : "Refill";
        const refillWord = game.i18n.localize(`TWODSIX.Actor.Items.${refillAction}`).toLocaleLowerCase();
        const tooFewString = game.i18n.localize("TWODSIX.Errors.TooFewToReload");
        ui.notifications.error(tooFewString.replace("_NAME_", item.name?.toLocaleLowerCase() || "???").replace("_REFILL_ACTION_", refillWord));
      } else {
        throw err;
      }
    }
  }

  /**
   * Handle auto add of weapons consumables.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onAutoAddConsumable(event): Promise<void> {
    const li = $(event.currentTarget).parents(".item");
    const weaponSelected: any = this.actor.items.get(li.data("itemId"));

    const max = weaponSelected.system.ammo;
    if (max > 0 && !weaponSelected.system.consumableData?.length) {
      const newConsumableData = {
        name: game.i18n.localize("TWODSIX.Items.Consumable.Types.magazine") + ": " + weaponSelected.name,
        type: "consumable",
        system: {
          subtype: "magazine",
          quantity: 1,
          currentCount: max,
          max,
          equipped: weaponSelected.system.equipped
        }
      };
      const newConsumable = await weaponSelected.actor.createEmbeddedDocuments("Item", [newConsumableData]);
      await weaponSelected.addConsumable(newConsumable[0].id);
      await weaponSelected.update({"system.useConsumableForAttack": newConsumable[0].id});
    }
  }

  /**
   * Handle toggling the state of an Owned Item within the Actor.
   * @param {Event} event   The originating click event.
   * @private
   */
  private async _onToggleItem(event:Event): Promise<void> {
    if (event.currentTarget) {
      const li = $(event.currentTarget).parents(".item");
      const itemSelected = <TwodsixItem>this.actor.items.get(li.data("itemId"));
      let newState = "";

      let disableEffect: boolean;
      switch ((<Gear>itemSelected.system).equipped) {
        case "equipped":
          newState = "ship";
          disableEffect = true;
          break;
        case "ship":
          newState = "backpack";
          disableEffect = true;
          break;
        case "backpack":
        default:
          newState = "equipped";
          disableEffect = false;
          break;
      }

      if (itemSelected.effects.size > 0 && game.settings.get('twodsix', 'useItemActiveEffects')) {
        const actorEffect = this.actor.effects.find(e => e.getFlag("twodsix", "sourceId") === itemSelected.effects.contents[0].id);
        //const itemEffect = itemSelected.effects.contents[0];
        if (actorEffect) {
          if (actorEffect.disabled !== disableEffect || actorEffect.getFlag("twodsix", "lastSetDisable") === undefined) {
            await actorEffect.setFlag("twodsix", "lastSetDisable", disableEffect);
            await this.actor.updateEmbeddedDocuments("ActiveEffect", [{_id: actorEffect.id , disabled: disableEffect}], {dontSync: true}).then();
            //await itemEffect.update({disabled: disableEffect}, {dontSync: true});
          }
        }
      }
      //change equipped state after toggling active effects so that encumbrance calcs correctly
      await itemSelected.update({["system.equipped"]: newState}).then();

      // Sync associated consumables equipped state
      for (const consumeableID of itemSelected.system.consumables) {
        const consumableSelected = itemSelected.actor.items.get(consumeableID);
        if(consumableSelected) {
          await consumableSelected.update({["system.equipped"]: itemSelected.system.equipped});
        }
      }
    }
  }

  /**
   * Handle toggling the view state of an Item class.
   * @param {Event} event   The originating click event.
   * @private
   */
  private async _onViewToggle(event): Promise<void> {
    const itemType: string = $(event.currentTarget).data("itemType");
    await this.actor.update({[`system.hideStoredItems.${itemType}`]: !this.actor.system.hideStoredItems[itemType]});
  }
}

export class TwodsixNPCSheet extends TwodsixActorSheet {
  static get defaultOptions(): ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "npc-actor"],
      template: "systems/twodsix/templates/actors/npc-sheet.html",
      width: 830,
      height: 500,
      resizable: true,
      dragDrop: [{dragSelector: ".item", dropSelector: null}]
    });
  }
}
