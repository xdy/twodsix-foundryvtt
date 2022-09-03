// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { TWODSIX } from "../config";
import TwodsixItem, { onRollDamage } from "../entities/TwodsixItem";
import TwodsixActor from "../entities/TwodsixActor";
import { resolveUnknownAutoMode } from "../utils/rollItemMacro";
import { getKeyByValue } from "../utils/sheetUtils";

export class TwodsixAnimalSheet extends AbstractTwodsixActorSheet {

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
        notes: TextEditor.enrichHTML(returnData.system.notes, {async: false})
      };
    }

    returnData.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.type == 'animal') {
      const actor: TwodsixActor = <TwodsixActor>this.actor;
      const untrainedSkill = actor.getUntrainedSkill();
      if (untrainedSkill) {
        returnData.untrainedSkill = untrainedSkill;
      }
      AbstractTwodsixActorSheet._prepareItemContainers(actor.items, returnData);
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
      useProseMirror: game.settings.get('twodsix', 'useProseMirror'),
      useFoundryStandardStyle: game.settings.get('twodsix', 'useFoundryStandardStyle'),
      showReferences: game.settings.get('twodsix', 'showItemReferences'),
      showSpells: game.settings.get('twodsix', 'showSpells')
    };
    //returnData.data.settings = returnData.settings; // DELETE WHEN CONVERSION IS COMPLETE
    returnData.config = TWODSIX;

    return returnData;
  }


  /** @override */
  static get defaultOptions(): ActorSheet.Options {
    return mergeObject(super.defaultOptions, {
      classes: ["twodsix", "sheet", "animal-actor"],
      template: "systems/twodsix/templates/actors/animal-sheet.html",
      width: 830,
      height: 500,
      resizable: true
    });
  }

  public activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Rollable abilities. Really should be in base class, but that will have to wait for issue 86

    html.find('.perform-attack').on('click', this._onRollWrapper(this._onPerformAttack));
    html.find('.rollable').on('click', this._onRollWrapper(this._onSkillRoll));
    html.find('.rollable-characteristic').on('click', this._onRollWrapper(this._onRollChar));

    html.find('.roll-damage').on('click', onRollDamage.bind(this));

    //add hooks to allow skill levels consumable counts to be updated on skill and equipment tabs, repectively
    html.find(".item-value-edit").on("input", this._onItemValueEdit.bind(this));
    html.find(".item-value-edit").on("click", (event) => {
      $(event.currentTarget).trigger("select");
    });

    //display trait item to chat
    html.find(".showChat").on("click", this._onSendToChat.bind(this));

    //Roll initiative from traveller sheet
    html.find(".roll-initiative").on("click", this._onRollInitiative.bind(this));

    //Edit active effect shown on actor
    html.find('.condition-icon').on('click', this._onEditEffect.bind(this));
    html.find('.condition-icon').on('contextmenu', this._onDeleteEffect.bind(this));
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
    if (!canvas.tokens?.ownedTokens.find(t => t.actor?.id === this.actor.id)) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoActiveToken"));
      return;
    } else if (this.token?.combatant && this.token.combatant.initiative !== null ) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.ActorHasInitiativeAlready"));
      return;
    } else if (!this.actor.isToken && game.combat?.combatants?.find(c => c.actor?.id === this.actor.id)?.initiative) {
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
      rollMode: game.settings.get('core', 'rollMode'),
      rollModes: CONFIG.Dice.rollModes,
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

    if (this.token?.combatant?.id) {
      //@ts-ignore
      game.combat?.rollInitiative(this.token.combatant.id, {formula: dialogData.rollFormula, messageOptions: {rollMode: dialogData.rollMode}});
    } else {
      this.actor.rollInitiative({createCombatants: true, rerollInitiative: false, initiativeOptions: {formula: dialogData.rollFormula, messageOptions: {rollMode: dialogData.rollMode}}});
    }
  }

  private async initiativeDialog(dialogData):Promise<any> {
    const template = 'systems/twodsix/templates/chat/initiative-dialog.html';

    const buttons = {
      ok: {
        label: game.i18n.localize("TWODSIX.Rolls.Roll"),
        icon: '<i class="fa-solid fa-dice"></i>',
        callback: (buttonHtml) => {
          dialogData.shouldRoll = true;
          dialogData.rollType = buttonHtml.find('[name="rollType"]').val();
          dialogData.diceModifier = buttonHtml.find('[name="diceModifier"]').val();
          dialogData.rollMode = buttonHtml.find('[name="rollMode"]').val();
          dialogData.rollFormula = buttonHtml.find('[name="rollFormula"]').val();
        }
      },
      cancel: {
        icon: '<i class="fa-solid fa-xmark"></i>',
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
    const displayShortChar = (<TwodsixActor>this.actor).system["characteristics"][fullCharLabel].displayShortLabel;
    await (<TwodsixActor>this.actor).characteristicRoll({ "characteristic": shortChar, "displayLabel": displayShortChar }, showThrowDiag);
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
        itemSelected.update({"system.value": newValue});
      } else if (itemSelected.type === "consumable") {
        itemSelected.update({"system.quantity": newValue});
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
    const picture = item.img;
    const capType = item.type.capitalize();
    if (item.type === "trait"  || item.type === "spell") {
      const msg = `<div style ="display: table-cell"><img src="${picture}" alt="" height=40px max-width=40px></img>  <strong>${capType}: ${item.name}</strong></div><br>${item.system["description"]}`;
      ChatMessage.create({ content: msg, speaker: ChatMessage.getSpeaker({ actor: this.actor }) });
    }
  }

  /**
   * Handle when the clicking on status icon.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onEditEffect(event): Promise<void> {
    const effectUuid = event.currentTarget["dataset"].uuid;
    const selectedEffect = await fromUuid(effectUuid);
    console.log(selectedEffect);
    new ActiveEffectConfig(selectedEffect).render(true);
  }
  /**
   * Handle when the right clicking on status icon.
   * @param {Event} event   The originating click event
   * @private
   */
  private async _onDeleteEffect(event): Promise<void> {
    const effectUuid = event.currentTarget["dataset"].uuid;
    const selectedEffect = await fromUuid(effectUuid);
    console.log(selectedEffect);
    await Dialog.confirm({
      title: game.i18n.localize("TWODSIX.ActiveEffects.DeleteEffect"),
      content: game.i18n.localize("TWODSIX.ActiveEffects.ConfirmDelete"),
      yes: async () => {
        await selectedEffect?.delete();
      },
      no: () => {
        //Nothing
      },
    });
  }
}
