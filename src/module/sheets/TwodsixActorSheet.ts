import {AbstractTwodsixActorSheet} from "./AbstractTwodsixActorSheet";
import {TWODSIX} from "../config";
import TwodsixItem from "../entities/TwodsixItem";

export class TwodsixActorSheet extends AbstractTwodsixActorSheet {

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
    const actorData = data.data;
    data.actor = actorData;
    data.data = actorData.data;

    data.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.data.type == 'traveller') {
      TwodsixActorSheet._prepareItemContainers(this.actor.items, data);
      // @ts-ignore
      const untrainedSkill = this.actor.getUntrainedSkill();
      if (untrainedSkill) {
        // @ts-ignore
        data.untrainedSkill = this.actor.getUntrainedSkill();
        data.jackOfAllTrades = TwodsixActorSheet.untrainedToJoat(data.untrainedSkill.data.data.value);
      }
    }

    // Add relevant data from system settings
    data.data.settings = {
      ShowRangeBandAndHideRange: game.settings.get('twodsix', 'ShowRangeBandAndHideRange'),
      ExperimentalFeatures: game.settings.get('twodsix', 'ExperimentalFeatures'),
      autofireRulesUsed: game.settings.get('twodsix', 'autofireRulesUsed'),
      lifebloodInsteadOfCharacteristics: game.settings.get('twodsix', 'lifebloodInsteadOfCharacteristics'),
      showContaminationBelowLifeblood: game.settings.get('twodsix', 'showContaminationBelowLifeblood'),
      showLifebloodStamina: game.settings.get("twodsix", "showLifebloodStamina"),
      showHeroPoints: game.settings.get("twodsix", "showHeroPoints")
    };
    data.config = TWODSIX;

    return data;
  }

  /** @override */
  // @ts-ignore
  static get defaultOptions():FormApplicationOptions {
    // @ts-ignore
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "actor"],
      template: "systems/twodsix/templates/actors/actor-sheet.html",
      width: 825,
      height: 648,
      resizable: false,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "skills"}],
      scrollY: [".skills", ".inventory", ".finances", ".info", ".notes"]
    });
  }


  private static setHoverColor(el, color) {
    $(el.currentTarget).find(".svg-remake").get(0).contentDocument.querySelectorAll("path").forEach((element) => {
      element.setAttribute("fill", color)
    });
  }

  private static updateTabColors(el, colorMap) {
    $(el.currentTarget).siblings().each((_, tab) => {
      $(tab).find(".svg-remake").get(0).contentDocument.querySelectorAll("path").forEach((element) => {
        if (el.currentTarget == tab) {
          element.setAttribute("fill", colorMap["active"])
        } else {
          element.setAttribute("fill", "")
        } 
      });
    })
  }

  private static updateAllSvgColors(el, colorMap) {
    if ($(el.currentTarget).parent().hasClass("active")) {
      el.currentTarget.contentDocument.querySelectorAll("path").forEach((element) => {
        element.setAttribute("fill", colorMap["active"])
      });
    }

    function updateColor(element, attr) {
      if (element.getAttribute(attr) && ! ["url(#a)", "none"].includes(element.getAttribute(attr))) {
        const color = colorMap[element.getAttribute(attr).toUpperCase()]
        if (color) {
          element.setAttribute(attr, color)
        }
      }
    }

    el.currentTarget.contentDocument.querySelectorAll("path, g").forEach((element) => {
      updateColor(element, "fill")
      updateColor(element, "stroke")     
    })
  }

  protected activateListeners(html:JQuery):void {
    super.activateListeners(html);

    const colorMap = JSON.parse(<string>game.settings.get('twodsix', 'colorScheme'));

    html.find(".sheet-tabs .item").on("mouseover", (el) =>{
      if (!$(el.currentTarget).hasClass("active")) {
        TwodsixActorSheet.setHoverColor(el, colorMap["hover"]);
      }
    })

    html.find(".sheet-tabs .item").on("mouseout", (el) =>{
      if (!$(el.currentTarget).hasClass("active")) {
        TwodsixActorSheet.setHoverColor(el, "");
      }

    })

    html.find(".sheet-tabs .item").on("click", (el) =>{
      TwodsixActorSheet.updateTabColors(el, colorMap);
    })

    html.find('.svg-remake').on("load", (el) => {  
      TwodsixActorSheet.updateAllSvgColors(el, colorMap);
    })

    // Rollable abilities. Really should be in base class, but that will have to wait for issue 86

    html.find('.perform-attack').on('click', this._onRollWrapper(this._onPerformAttack));
    html.find('.rollable').on('click', this._onRollWrapper(this._onSkillRoll));
    html.find('.rollable-characteristic').on('click', this._onRollWrapper(this._onRollChar));

    html.find('.roll-damage').on('click', this._onRollDamage.bind(this));

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

    //add hooks to allow skill levels consumable counts to be updated on skill and equipment tabs, repectively
    html.find(".item-value-edit").on("input", this._onItemValueEdit.bind(this));
    html.find(".item-value-edit").on("click", (event) => {
      $(event.currentTarget).trigger("select");
    });
  }


  private getItem(event:Event):TwodsixItem {
    const itemId = $(event.currentTarget).parents('.item').data('item-id');
    // @ts-ignore
    return this.actor.items.get(itemId);
  }

  private _onRollWrapper(func:(event:Event, showTrowDiag:boolean) => Promise<void>):(event:Event) => void {
    return (event:Event) => {
      event.preventDefault();
      event.stopPropagation();

      const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showTrowDiag = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];

      func.bind(this)(event, showTrowDiag);
    };
  }


  /**
   * Handle when the joat skill is changed.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _updateJoatSkill(event:Event):Promise<void> {
    const joatValue = parseInt(event.currentTarget["value"], 10);
    const skillValue = TwodsixActorSheet.joatToUntrained(joatValue);

    if (!isNaN(joatValue) && joatValue >= 0 && skillValue <= 0) {
      // @ts-ignore
      const untrainedSkill = this.actor.getUntrainedSkill();
      untrainedSkill.update({"data.value": skillValue});
    } else if (event.currentTarget["value"] !== "")  {
      event.currentTarget["value"] = "";
    }
  }

  /**
   * Handle when user tabs out and leaves blank value.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onJoatSkillBlur(event:Event):Promise<void> {
    if (isNaN(parseInt(event.currentTarget["value"], 10))) {
      // @ts-ignore
      const skillValue = this.actor.getUntrainedSkill().data.data.value;
      event.currentTarget["value"] = TwodsixActorSheet.untrainedToJoat(skillValue);
    }
  }

  /**
   * Handle clickable weapon attacks.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  private async _onPerformAttack(event:Event, showTrowDiag:boolean):Promise<void> {
    const attackType = event.currentTarget["dataset"].attackType;
    const rof = event.currentTarget["dataset"].rof ? parseInt(event.currentTarget["dataset"].rof, 10) : null;

    const item = this.getItem(event);
    await item.performAttack(attackType, showTrowDiag, rof);
  }

  /**
   * Handle clickable skill rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  private async _onSkillRoll(event:Event, showTrowDiag:boolean):Promise<void> {
    const item = this.getItem(event);
    await item.skillRoll(showTrowDiag);
  }

  /**
   * Handle clickable characteristics rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  private async _onRollChar(event:Event, showTrowDiag:boolean):Promise<void> {
    // @ts-ignore
    await this.actor.characteristicRoll({"characteristic": $(event.currentTarget).data("label")}, showTrowDiag);
  }

  /**
   * Handle clickable damage rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onRollDamage(event:Event):Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const itemId = $(event.currentTarget).parents('.item').data('item-id');
    const item = this.actor.items.get(itemId) as TwodsixItem;

    const element = $(event.currentTarget);
    const bonusDamageFormula = String(element.data('bonus-damage') || 0);

    await item.rollDamage((<string>game.settings.get('core', 'rollMode')), bonusDamageFormula);

  }

  private static untrainedToJoat(skillValue:number):number {
    return skillValue - game.system.template.Item.skills["value"];
  }

  private static joatToUntrained(joatValue:number):number {
    return joatValue + game.system.template.Item.skills["value"];
  }

  private getConsumableItem(event:Event):TwodsixItem {
    const itemId = $(event.currentTarget).parents('.consumable-row').data('consumable-id');
    return this.actor.items.get(itemId) as TwodsixItem;
  }

  private async _onAdjustConsumableCount(event:Event): Promise<void> {
    const modifier = parseInt(event.currentTarget["dataset"]["value"], 10);
    const item = this.getConsumableItem(event);
    await item.consume(modifier);
  }

  private async _onRefillConsumable(event:Event): Promise<void> {
    const item = this.getConsumableItem(event);
    try {
      await item.refill();
    } catch (err) {
      if (err.name === "TooLowQuantityError") {
        const refillAction = ["magazine", "power_cell"].includes(item.data.data.subtype) ? "Reload" : "Refill";
        const refillWord = game.i18n.localize(`TWODSIX.Actor.Items.${refillAction}`).toLowerCase();
        const tooFewString = game.i18n.localize("TWODSIX.Errors.TooFewToReload");
        ui.notifications.error(tooFewString.replace("_NAME_", item.name.toLowerCase()).replace("_REFILL_ACTION_", refillWord));
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
  private async _onAutoAddConsumable(event: Event): Promise<void> {
    const li = $(event.currentTarget).parents(".item");
    const weaponSelected: any = this.actor.items.get(li.data("itemId"));

    const max = weaponSelected.data.data.ammo;
    if (max > 0 && weaponSelected.data.data.consumables.length === 0) {
      const data = {
        name: game.i18n.localize("TWODSIX.Items.Consumable.Types.magazine")+ ": " + weaponSelected.data.name,
        type: "consumable",
        data: {
          subtype: "other",
          quantity: 1,
          currentCount: max,
          max
        }
      };
      const newConsumable = await weaponSelected.actor.createEmbeddedDocuments("Item", [data]);
      await weaponSelected.addConsumable(newConsumable[0].id);
      await weaponSelected.update({ "data.useConsumableForAttack": newConsumable[0].id });
    }
  }

  /**
   * Handle toggling the state of an Owned Item within the Actor.
   * @param {Event} event   The originating click event.
   * @private
   */
  private async _onToggleItem(event): Promise<void> {
    const li = $(event.currentTarget).parents(".item");
    const itemSelected: any = this.actor.items.get(li.data("itemId"));

    switch (itemSelected.data.data.equipped) {
      case "equipped":
        await itemSelected.update({["data.equipped"]: "ship"});
        break;
      case "ship":
        await itemSelected.update({["data.equipped"]: "backpack"});
        break;
      case "backpack":
      default:
        await itemSelected.update({["data.equipped"]: "equipped"});
        break;
    }
  }

  /**
   * Update an item value when edited on skill or inventory tab.
   * @param {Event} event  The originating input event
   * @private
   */
  private async _onItemValueEdit(event:Event): Promise<void> {
    const newValue = parseInt(event.currentTarget["value"], 10);
    const li = $(event.currentTarget).parents(".item");
    const itemSelected = this.actor.items.get(li.data("itemId"));

    if (itemSelected.type === "skills") {
      itemSelected.update({ "data.value": newValue });
    } else if (itemSelected.type === "consumable") {
      itemSelected.update({ "data.quantity": newValue });
    }
  }
}
