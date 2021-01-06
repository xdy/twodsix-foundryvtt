import {AbstractTwodsixActorSheet} from "./AbstractTwodsixActorSheet";
import {calcModFor} from "../utils/sheetUtils";
import {TWODSIX} from "../config";
import TwodsixItem from "../entities/TwodsixItem";
import {CharacteristicType} from "../../types/twodsix";

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
    data.dtypes = ["String", "Number", "Boolean"];

    // Prepare items.
    if (this.actor.data.type == 'traveller') {
      TwodsixActorSheet._prepareItemContainers(data);
    }

    // Add relevant data from system settings
    data.data.settings = {
      ShowRangeBandAndHideRange: game.settings.get('twodsix', 'ShowRangeBandAndHideRange'),
      ExperimentalFeatures: game.settings.get('twodsix', 'ExperimentalFeatures'),
      untrainedSkillValue: game.settings.get('twodsix', 'untrainedSkillValue'),
      autofireRulesUsed: game.settings.get('twodsix', 'autofireRulesUsed')
    };
    data.config = TWODSIX;

    return data;
  }

  /** @override */
  static get defaultOptions():FormApplicationOptions {
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


  protected activateListeners(html:JQuery):void {
    super.activateListeners(html);

    // Rollable abilities. Really should be in base class, but that will have to wait for issue 86

    html.find('.perform-attack').on('click', this._onRollWrapper(this._onPerformAttack));
    html.find('.rollable').on('click', this._onRollWrapper(this._onSkillRoll));
    html.find('.rollable-characteristic').on('click', this._onRollWrapper(this._onRollChar));

    html.find('.roll-damage').on('click', (this._onRollDamage.bind(this)));

    html.find('.stat-damage').on('change', this._setDamageFromEvent.bind(this));
    html.find('.special-damage').on('change', this._setDamageFromEvent.bind(this));
  }

  private async _setDamageFromEvent(event:Event):Promise<void> {
    const eventTargets = $(event.currentTarget);
    const characteristicKey = eventTargets.parents('.stat:first,.special:first').attr('data-characteristic');
    const characteristic:CharacteristicType = this.actor.data.data.characteristics[characteristicKey];
    let damage = Number(eventTargets.children("").val());
    if (damage > characteristic.value) {
      damage = characteristic.value;
    } else if (damage < 0) {
      damage = 0;
    }
    eventTargets.children("").val(damage);
    characteristic.damage = damage;
    characteristic.current = characteristic.value - characteristic.damage;
    characteristic.mod = calcModFor(characteristic.current);
    await this.actor.updateActor();
  }

  private getItem(event:Event):TwodsixItem {
    const itemId = $(event.currentTarget).parents('.item').data('item-id');
    return this.actor.getOwnedItem(itemId);
  }

  private _onRollWrapper(func:(event:Event, showTrowDiag:boolean) => Promise<void>):(event:Event) => void {
    return (event:Event) => {
      event.preventDefault();
      event.stopPropagation();

      const useInvertedShiftClick:boolean = game.settings.get('twodsix', 'invertSkillRollShiftClick');
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
    await this.actor.characteristicRoll({"characteristic": $(event.currentTarget).data("label")}, showTrowDiag);
  }

  /**
   * Handle clickable damage rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  private _onRollDamage(event:Event):void {
    event.preventDefault();
    event.stopPropagation();
    const itemId = $(event.currentTarget).parents('.item').data('item-id');
    const item = this.actor.getOwnedItem(itemId) as TwodsixItem;

    const element = $(event.currentTarget);
    const bonusDamageFormula = String(element.data('bonus-damage') || 0);

    async function rollDamage(this:TwodsixActorSheet):Promise<Roll> {
      return item.rollDamage(game.settings.get('core', 'rollMode'), bonusDamageFormula);
    }

    rollDamage.call(this);
  }
}
