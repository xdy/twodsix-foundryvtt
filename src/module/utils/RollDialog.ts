// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";
import { getDifficultiesSelectObject, getRollTypeSelectObject } from "./sheetUtils";
import { getTargetDMSelectObject } from "./targetModifiers";
import { getKeyByValue } from "./utils";

export default class RollDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  title2: string;
  skill: TwodsixItem;
  settings: any;

  constructor(object, options?) {
    super(object, options);
    this.settings = object.settings;
    this.title2 = object.title;
    this.skill = object.skill;
  }

  /** @override */
  static DEFAULT_OPTIONS =  {
    classes: ["twodsix"],
    position: {
      width: 'auto',
      height: 'auto'
    },
    window: {
      resizable: true,
      contentClasses: ["standard-form"],
      title: "TWODSIX.Settings.settingsInterface.displaySettings.name",
      icon: "fa-solid fa-tv"
    },
    form: {
      /*handler: () => {
        Promise.resolve(this.settings);
      },*/
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false
    },
    tag: "form",
    actions: {
      ok: this._onSubmitRoll,
      cancel: this._onCancelRoll
    }
  };

  static PARTS = {
    main: {
      template: 'systems/twodsix/templates/chat/throw-dialog.hbs',
      scrollable: ['']
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    }
  };

  /** @override */
  tabGroups = {
    primary: "general"  //set default tab
  };

  /** @override */
  async _prepareContext(options): any {
    const context: any = await super._prepareContext(options);
    foundry.utils.mergeObject(context, {
      rollType: this.settings.rollType,
      rollTypes: getRollTypeSelectObject(),
      difficulty: getKeyByValue(this.settings.difficulties, this.settings.difficulty),
      difficultyList: getDifficultiesSelectObject(this.settings.difficulties),
      rollMode: this.settings.rollMode,
      rollModes: CONFIG.Dice.rollModes,
      characteristicList: _getTranslatedCharacteristicList(<TwodsixActor>this.skill?.actor),
      initialChoice: this.settings.rollModifiers.characteristic,
      initialSkill: this.settings.rollModifiers.selectedSkill,
      rollModifiers: this.settings.rollModifiers,
      skillLabel: this.settings.skillName,
      itemLabel: this.settings.itemName,
      showRangeModifier: this.settings.showRangeModifier,
      showTargetModifier: this.settings.showTargetModifier,
      showArmorWeaponModifier: this.settings.showArmorWeaponModifier,
      armorModifier: this.settings.rollModifiers.armorModifier,
      armorLabel: this.settings.rollModifiers.armorLabel,
      targetModifier: this.settings.rollModifiers.targetModifier,
      targetModifierOverride: this.settings.rollModifiers.targetModifierOverride,
      targetDMList: getTargetDMSelectObject(),
      skillRoll: this.settings.skillRoll,
      itemRoll: this.settings.itemRoll,
      timeUnits: TWODSIX.TimeUnits,
      selectedTimeUnit: this.settings.selectedTimeUnit,
      timeRollFormula: this.settings.timeRollFormula,
      showConditions: (game.settings.get('twodsix', 'useWoundedStatusIndicators') || game.settings.get('twodsix', 'useEncumbranceStatusIndicators')),
      showWounds: game.settings.get('twodsix', 'useWoundedStatusIndicators'),
      showEncumbered: game.settings.get('twodsix', 'useEncumbranceStatusIndicators'),
      isPsionicAbility: this.settings.isPsionicAbility,
      isComponent: this.settings.isComponent
    });
    context.skillsList = (<TwodsixActor>this.skill?.actor)?.getSkillNameList();
    context.buttons = [
      {
        action: "ok",
        label: "TWODSIX.Rolls.Roll",
        icon: "fa-solid fa-dice",
        default: true
      },
      {
        action: "cancel",
        icon: "fa-solid fa-xmark",
        label: "Cancel"
      }
    ];
    return context;
  }

  _onRender(_context, _options) {
    const htmlRend = this.element;
    htmlRend.querySelector(".select-skill")?.addEventListener("change", () => {
      const characteristicElement = htmlRend.querySelector('[name="rollModifiers.characteristic"]');
      let newSkill:TwodsixItem;
      if (characteristicElement) {
        const newSkillUuid = htmlRend.querySelector('[name="rollModifiers.selectedSkill"]')?.value;
        if (newSkillUuid) {
          newSkill = fromUuidSync(newSkillUuid);
          characteristicElement.value = newSkill?.system.characteristic || "NONE";
        }
      }
      let newTitle = "";
      const titleElement = htmlRend.querySelector('.window-title');
      if (titleElement) {
        const usingWord = ' ' + game.i18n.localize("TWODSIX.Actor.using") + ' ';
        if (titleElement.innerText.includes(usingWord)) {
          newTitle = `${titleElement.innerText.substring(0, titleElement.innerText.indexOf(usingWord))}${usingWord}${newSkill?.name}`;
        } else {
          newTitle = newSkill?.name || "";
        }
        titleElement.innerText = newTitle;
      }
    });
  }
  /**
   * Spawn a TargetedConditionPrompt and wait for and actor to be selected or closed.
   * @param {Partial<ApplicationConfiguration>} [options]
   * @returns {Promise<string | null>}      Resolves to the actor uuid of the actor imposing the condition or null
   */
  static async prompt(object, options) {
    return new Promise((resolve, reject) => {
      const dialog = new this(object, options);
      dialog.addEventListener("close", event => resolve(this.settings), {once: true});

      dialog.render({force: true});
    });
  }

  static _onSubmitRoll(ev, target) {
    const formElements = target.form.elements;
    this.settings.shouldRoll = true;
    this.settings.difficulty = this.settings.difficulties[formElements["difficulty"]?.value];
    this.settings.rollType = formElements["rollType"]?.value;
    this.settings.rollMode = formElements["rollMode"]?.value;
    this.settings.rollModifiers.chain = this.settings.skillRoll ? parseInt(formElements["rollModifiers.chain"]?.value || 0, 10) : this.settings.rollModifiers.chain;
    this.settings.rollModifiers.characteristic = this.settings.skillRoll ? formElements["rollModifiers.characteristic"]?.value : this.settings.rollModifiers.characteristic;
    this.settings.rollModifiers.item = this.settings.itemRoll ? parseInt(formElements["rollModifiers.item"]?.value || 0, 10) : this.settings.rollModifiers.item;
    this.settings.rollModifiers.rof = (this.settings.itemRoll && this.settings.rollModifiers.rof) ? parseInt(formElements["rollModifiers.rof"]?.value || 0, 10) : this.settings.rollModifiers.rof;
    this.settings.rollModifiers.dodgeParry = (this.settings.itemRoll && this.settings.rollModifiers.dodgeParry) ? parseInt(formElements["rollModifiers.dodgeParry"]?.value || 0, 10) : this.settings.rollModifiers.dodgeParry;
    this.settings.rollModifiers.weaponsHandling = (this.settings.itemRoll && this.settings.rollModifiers.weaponsHandling) ? parseInt(formElements["rollModifiers.weaponsHandling"]?.value || 0, 10) : this.settings.rollModifiers.weaponsHandling;
    this.settings.rollModifiers.weaponsRange = (this.settings.showRangeModifier) ? parseInt(formElements["rollModifiers.weaponsRange"]?.value || 0, 10) : this.settings.rollModifiers.weaponsRange;
    this.settings.rollModifiers.attachments = (this.settings.itemRoll && this.settings.rollModifiers.attachments) ? parseInt(formElements["rollModifiers.attachments"]?.value || 0, 10) : this.settings.rollModifiers.attachments;
    this.settings.rollModifiers.other = parseInt(formElements["rollModifiers.other"].value, 10);
    this.settings.rollModifiers.wounds = this.settings.showWounds ? parseInt(formElements["rollModifiers.wounds"]?.value || 0, 10) : 0;
    this.settings.rollModifiers.selectedSkill = this.settings.skillRoll ? formElements["rollModifiers.selectedSkill"]?.value : "";
    const targetModifierElement = formElements["rollModifiers.targetModifier"];
    this.settings.rollModifiers.targetModifier = (this.settings.showTargetModifier && targetModifierElement?.value)
      ? targetModifierElement.value
      : this.settings.rollModifiers.targetModifier;
    this.settings.rollModifiers.armorModifier  = (this.settings.showArmorWeaponModifier) ? parseInt(formElements["rollModifiers.armorModifier"]?.value || 0, 10) : 0;
    this.settings.rollModifiers.componentDamage = this.settings.isComponent ? parseInt(formElements["rollModifiers.componentDamage"]?.value || 0, 10) : this.settings.rollModifiers.componentDamage;

    if(!this.settings.showEncumbered || !["strength", "dexterity", "endurance"].includes(getKeyByValue(TWODSIX.CHARACTERISTICS, this.settings.rollModifiers.characteristic))) {
      //either dont show modifier or not a physical characterisitc
      this.settings.rollModifiers.encumbered = 0;
    } else {
      const dialogEncValue = parseInt(formElements["rollModifiers.encumbered"]?.value, 10);
      if (this.settings.initialChoice === this.settings.rollModifiers.characterisitc || dialogEncValue !== this.settings.rollModifiers.encumbered) {
        //characteristic didn't change or encumbrance modifer changed
        this.settings.rollModifiers.encumbered = isNaN(dialogEncValue) ? 0 : dialogEncValue;
      } else {
        this.settings.rollModifiers.encumbered = (<TwodsixActor>this.skill?.actor)?.system.conditions.encumberedEffect ?? (isNaN(dialogEncValue) ? 0 : dialogEncValue);
      }
    }

    this.settings.selectedTimeUnit = formElements["timeUnit"]?.value;
    this.settings.timeRollFormula = formElements["timeRollFormula"]?.value;

    Promise.resolve(this.settings);
  }

  static _onCancelRoll(ev, target) {
    this.settings.shouldRoll = false;
    Promise.resolve(this.settings);
  }
}

export function _getTranslatedCharacteristicList(actor:TwodsixActor):object {
  const returnValue = {};
  if (actor) {
    returnValue["STR"] = getCharacteristicLabelWithMod(actor, "strength");
    returnValue["DEX"] = getCharacteristicLabelWithMod(actor, "dexterity");
    returnValue["END"] = getCharacteristicLabelWithMod(actor, "endurance");
    returnValue["INT"] = getCharacteristicLabelWithMod(actor, "intelligence");
    returnValue["EDU"] = getCharacteristicLabelWithMod(actor, "education");
    returnValue["SOC"] = getCharacteristicLabelWithMod(actor, "socialStanding");
    if (!['base', 'core'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
      returnValue["ALT1"] = getCharacteristicLabelWithMod(actor, "alternative1");
      returnValue["ALT2"] =  getCharacteristicLabelWithMod(actor, "alternative2");
    }
    if (['all'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
      returnValue["ALT3"] =  getCharacteristicLabelWithMod(actor, "alternative3");
    }
    if (!['alternate', 'core'].includes(game.settings.get('twodsix', 'showAlternativeCharacteristics'))) {
      returnValue["PSI"] =  getCharacteristicLabelWithMod(actor, "psionicStrength");
    }
  }
  returnValue["NONE"] =  "---";
  return returnValue;
}

export function getCharacteristicLabelWithMod(actor: TwodsixActor, characterisitc: string) : string {
  return actor.system.characteristics[characterisitc].displayShortLabel + '(' +
  (actor.system.characteristics[characterisitc].mod >= 0 ? '+' : '') +
  actor.system.characteristics[characterisitc].mod + ')';
}
