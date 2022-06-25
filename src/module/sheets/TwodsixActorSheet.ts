import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TWODSIX } from "../config";
import TwodsixItem, { onRollDamage } from "../entities/TwodsixItem";
import TwodsixActor from "../entities/TwodsixActor";
import { Consumable, Skills } from "../../types/template";
import { resolveUnknownAutoMode } from "../utils/rollItemMacro";
import { getKeyByValue } from "../utils/sheetUtils";

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
      showHeroPoints: game.settings.get("twodsix", "showHeroPoints"),
      showIcons: game.settings.get("twodsix", "showIcons"),
      showStatusIcons: game.settings.get("twodsix", "showStatusIcons"),
      showInitiativeButton: game.settings.get("twodsix", "showInitiativeButton")
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
      height: 656,
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

    html.find('.roll-damage').on('click', onRollDamage.bind(this));

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

    //display trait item to chat
    html.find(".showChat").on("click", this._onSendToChat.bind(this));

    //Roll initiative from traveller sheet
    html.find(".roll-initiative").on("click", this._onRollInitiative.bind(this));
  }


  private getItem(event): TwodsixItem {
    const itemId = $(event.currentTarget).parents('.item').data('item-id');
    return <TwodsixItem>this.actor.items.get(itemId);
  }

  /**
   * Handle when the roll initiative button is pressed.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onRollInitiative(event): Promise<void> {
    if (!this.token) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoActiveToken"));
      return;
    } else if (this.token.combatant && this.token.combatant.initiative !== null ) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.ActorHasInitiativeAlready"));
      return;
    }
    const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showThrowDiag = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
    const dialogData = {
      shouldRoll: false,
      rollType: "Normal",
      rollTypes: TWODSIX.ROLLTYPES,
      diceModifier: "",
      rollFormula: game.settings.get("twodsix", "initiativeFormula")
    };
    if (showThrowDiag) {
      await this.initiativeDialog(dialogData);
      if (dialogData.shouldRoll) {
        if (dialogData.rollType !== "Normal") {
          if (dialogData.rollType === "Advantage") {
            dialogData.rollFormula = dialogData.rollFormula.replace("2d6", "3d6kh2");
          } else if (dialogData.rollType === "Disadvantage") {
            dialogData.rollFormula = dialogData.rollFormula.replace("2d6", "3d6kl2");
          }
        }
        if (dialogData.diceModifier !== "") {
          dialogData.rollFormula += "+" + dialogData.diceModifier;
        }
      } else {
        return;
      }
    }
    this.actor.rollInitiative({createCombatants: true, rerollInitiative: false, initiativeOptions: {formula: dialogData.rollFormula}});
  }

  private async initiativeDialog(dialogData):Promise<any> {
    const template = 'systems/twodsix/templates/chat/initiative-dialog.html';

    const buttons = {
      ok: {
        label: game.i18n.localize("TWODSIX.Rolls.Roll"),
        icon: '<i class="fas fa-dice"></i>',
        callback: (buttonHtml) => {
          dialogData.shouldRoll = true;
          dialogData.rollType = buttonHtml.find('[name="rollType"]').val();
          dialogData.diceModifier = buttonHtml.find('[name="diceModifier"]').val();
          dialogData.rollFormula = buttonHtml.find('[name="rollFormula"]').val();
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel"),
        callback: () => {
          dialogData.shouldRoll = false;
        }
      },
    };

    const html = await renderTemplate(template, dialogData);
    return new Promise<void>((resolve) => {
      new Dialog({
        title: game.i18n.localize("TWODSIX.Rolls.RollInitiative"),
        content: html,
        buttons: buttons,
        default: 'ok',
        close: () => {
          resolve();
        },
      }).render(true);
    });
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
  private async _onPerformAttack(event, showThrowDiag: boolean): Promise<void> {
    const attackType = event.currentTarget["dataset"].attackType;
    const rof = event.currentTarget["dataset"].rof ? parseInt(event.currentTarget["dataset"].rof, 10) : null;
    const item = this.getItem(event);
    console.log("Sheet Item Attack: ", item);
    if (this.options.template?.includes("npc-sheet")) {
      resolveUnknownAutoMode(item);
    } else {
      await item.performAttack(attackType, showThrowDiag, rof);
    }
  }

  /**
   * Handle clickable skill rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showTrowDiag  Whether to show the throw dialog or not
   * @private
   */
  private async _onSkillRoll(event, showThrowDiag: boolean): Promise<void> {
    const item = this.getItem(event);
    await item.skillRoll(showThrowDiag );
  }

  /**
   * Handle clickable characteristics rolls.
   * @param {Event} event   The originating click event
   * @param {boolean} showThrowDiag  Whether to show the throw dialog or not
   * @private
   */
  private async _onRollChar(event, showThrowDiag: boolean): Promise<void> {
    const shortChar = $(event.currentTarget).data("label");
    const fullCharLabel = getKeyByValue(TWODSIX.CHARACTERISTICS, shortChar);
    const displayShortChar = (<TwodsixActor>this.actor).data.data["characteristics"][fullCharLabel].displayShortLabel;
    await (<TwodsixActor>this.actor).characteristicRoll({ "characteristic": shortChar, "displayLabel": displayShortChar }, showThrowDiag);
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
          max,
          equipped: weaponSelected.data.data.equipped
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

    // Sync associated consumables equipped state
    for (const consumeableID of itemSelected.data.data.consumables) {
      const consumableSelected = itemSelected.actor.items.get(consumeableID);
      if(consumableSelected) {
        await consumableSelected.update({["data.equipped"]: itemSelected.data.data.equipped});
      }
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

  /**
   * Handle send to chat.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onSendToChat(event): Promise<void> {
    const item = <TwodsixItem>this.getItem(event);
    const picture = item.data.img;
    if (item.type === "trait") {
      const msg = `<div style ="display: table-cell"><img src="${picture}" alt="" height=40px max-width=40px></img>  <strong>Trait: ${item.name}</strong></div><br>${item.data.data["description"]}`;
      ChatMessage.create({ content: msg, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
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
