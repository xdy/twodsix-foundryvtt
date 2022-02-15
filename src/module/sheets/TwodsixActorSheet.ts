import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TWODSIX } from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import TwodsixActor from "../entities/TwodsixActor";
import { DICE_ROLL_MODES } from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import {Consumable, Skills} from "../../types/template";
import { resolveUnknownAutoMode } from "../utils/rollItemMacro";

export class TwodsixActorSheet extends AbstractTwodsixActorSheet {

  /**
   * Return the type of the current Actor
   * @type {String}
   */
  get actorType(): string {
    return this.actor.data.type;
  }

  /** @override */
  getData(): any {
    const data: any = super.getData();
    const actorData = data.data;
    data.actor = actorData;
    data.data = actorData.data;

    data.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.data.type == 'traveller') {
      const actor: TwodsixActor = <TwodsixActor>this.actor;
      TwodsixActorSheet._prepareItemContainers(actor.items, data);
      const untrainedSkill = actor.getUntrainedSkill();
      if (untrainedSkill) {
        data.untrainedSkill = actor.getUntrainedSkill();
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
  static get defaultOptions(): ActorSheet.Options {
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


  public activateListeners(html: JQuery): void {
    super.activateListeners(html);

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


  private getItem(event): TwodsixItem {
    const itemId = $(event.currentTarget).parents('.item').data('item-id');
    return <TwodsixItem>this.actor.items.get(itemId);
  }

  private _onRollWrapper(func: (event, showTrowDiag: boolean) => Promise<void>): (event) => void {
    return (event) => {
      event.preventDefault();
      event.stopPropagation();

      const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
      const showTrowDiag = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];

      func.bind(this)(event, showTrowDiag);
    };
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
      untrainedSkill.update({"data.value": skillValue});
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
      const skillValue = (<Skills>(<TwodsixActor>this.actor).getUntrainedSkill().data.data).value;
      event.currentTarget["value"] = TwodsixActorSheet.untrainedToJoat(skillValue);
    }
  }

  /**
   * Handle clickable weapon attacks.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  private async _onPerformAttack(event, showTrowDiag: boolean): Promise<void> {
    const attackType = event.currentTarget["dataset"].attackType;
    const rof = event.currentTarget["dataset"].rof ? parseInt(event.currentTarget["dataset"].rof, 10) : null;
    const item = this.getItem(event);
    if (this.options.template?.includes("npc-sheet")) {
      resolveUnknownAutoMode(item);
    } else {
      await item.performAttack(attackType, showTrowDiag, rof);
    }
  }

  /**
   * Handle clickable skill rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  private async _onSkillRoll(event, showTrowDiag: boolean): Promise<void> {
    const item = this.getItem(event);
    await item.skillRoll(showTrowDiag);
  }

  /**
   * Handle clickable characteristics rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  private async _onRollChar(event, showTrowDiag: boolean): Promise<void> {
    await (<TwodsixActor>this.actor).characteristicRoll({"characteristic": $(event.currentTarget).data("label")}, showTrowDiag);
  }

  /**
   * Handle clickable damage rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onRollDamage(event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const itemId = $(event.currentTarget).parents('.item').data('item-id');
    const item = this.actor.items.get(itemId) as TwodsixItem;

    const element = $(event.currentTarget);
    const bonusDamageFormula = String(element.data('bonus-damage') || 0);

    await item.rollDamage((<DICE_ROLL_MODES>game.settings.get('core', 'rollMode')), bonusDamageFormula);

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
        const refillAction = ["magazine", "power_cell"].includes((<Consumable>item.data.data).subtype) ? "Reload" : "Refill";
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

    const max = weaponSelected.data.data.ammo;
    if (max > 0 && weaponSelected.data.data.consumables.length === 0) {
      const data = {
        name: game.i18n.localize("TWODSIX.Items.Consumable.Types.magazine") + ": " + weaponSelected.data.name,
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
      await weaponSelected.update({"data.useConsumableForAttack": newConsumable[0].id});
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
  private async _onItemValueEdit(event): Promise<void> {
    const newValue = parseInt(event.currentTarget["value"], 10);
    const li = $(event.currentTarget).parents(".item");
    const itemSelected = this.actor.items.get(li.data("itemId"));

    if (itemSelected) {
      if (itemSelected.type === "skills") {
        itemSelected.update({"data.value": newValue});
      } else if (itemSelected.type === "consumable") {
        itemSelected.update({"data.quantity": newValue});
      }
    }
  }
}

export class TwodsixNPCSheet extends TwodsixActorSheet {
  static get defaultOptions(): ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "npc-actor"],
      template: "systems/twodsix/templates/actors/npc-sheet.html",
      width: 830,
      height: 500,
      resizable: true
    });
  }
}
