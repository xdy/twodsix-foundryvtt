// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";
import TwodsixActor from "../entities/TwodsixActor";
import TwodsixItem from "../entities/TwodsixItem";
import { getDifficultiesSelectObject, getRollTypeSelectObject } from "./sheetUtils";
import { getTargetDMSelectObject } from "./targetModifiers";
import { getKeyByValue } from "./utils";

export default class RollDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  skill: TwodsixItem;
  settings: any;
  private _dialogTitle: string;

  constructor(object, options?) {
    // Merge the title into options before calling super
    const titleToUse = (object.title && object.title.trim()) ? object.title : "TWODSIX.Rolls.RollDialog";
    const mergedOptions = foundry.utils.mergeObject(options || {}, {
      window: {
        title: titleToUse
      }
    });

    super(object, mergedOptions);

    // Store the title for use in _onRender (after super call)
    this._dialogTitle = object.title;
    this.settings = object.settings;
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
      icon: "fa-solid fa-dice"
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
      ok: RollDialog._onSubmitRoll,
      cancel: RollDialog._onCancelRoll
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _onRender(_context, _options) {
    const htmlRend = this.element;

    // Set the initial title when first rendered - force it with DOM manipulation
    const titleElement = htmlRend.querySelector('.window-title');
    if (titleElement && this._dialogTitle) {
      titleElement.innerText = this._dialogTitle;
    }

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
      const titleElementUpdate = htmlRend.querySelector('.window-title');
      if (titleElementUpdate) {
        const usingWord = ' ' + game.i18n.localize("TWODSIX.Actor.using") + ' ';
        if (titleElementUpdate.innerText.includes(usingWord)) {
          newTitle = `${titleElementUpdate.innerText.substring(0, titleElementUpdate.innerText.indexOf(usingWord))}${usingWord}${newSkill?.name}`;
        } else {
          newTitle = newSkill?.name || "";
        }
        titleElementUpdate.innerText = newTitle;
      }
    });
  }
  /**
   * Spawn a TargetedConditionPrompt and wait for and actor to be selected or closed.
   * @param {Partial<ApplicationConfiguration>} [options]
   * @returns {Promise<string | null>}      Resolves to the actor uuid of the actor imposing the condition or null
   */
  static async prompt(object, options) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return new Promise((resolve, _reject) => {
      const dialog = new this(object, options);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      dialog.addEventListener("close", _event => resolve(this.settings), {once: true});

      dialog.render({force: true});
    });
  }

  static _onSubmitRoll(ev, target) {
    ev.preventDefault();
    const formData = new foundry.applications.ux.FormDataExtended(target.form);
    const data = formData.object;

    // Helper function for safe integer parsing
    const parseIntSafe = (value, defaultValue = 0) => {
      const parsed = Number.parseInt(value || defaultValue, 10);
      return Number.isNaN(parsed) ? defaultValue : parsed;
    };

    // Helper function for conditional assignment
    const assignIf = (condition, getValue, fallback) => condition ? getValue() : fallback;

    this.settings.shouldRoll = true;
    this.settings.difficulty = this.settings.difficulties[data.difficulty];
    this.settings.rollType = data.rollType;
    this.settings.rollMode = data.rollMode;

    // Roll modifiers with simplified conditional logic
    const rm = this.settings.rollModifiers;
    rm.chain = assignIf(this.settings.skillRoll, () => parseIntSafe(data["rollModifiers.chain"]), rm.chain);
    rm.characteristic = assignIf(this.settings.skillRoll, () => data["rollModifiers.characteristic"], rm.characteristic);
    rm.item = assignIf(this.settings.itemRoll, () => parseIntSafe(data["rollModifiers.item"]), rm.item);
    rm.rof = assignIf(this.settings.itemRoll && rm.rof, () => parseIntSafe(data["rollModifiers.rof"]), rm.rof);
    rm.dodgeParry = assignIf(this.settings.itemRoll && rm.dodgeParry, () => parseIntSafe(data["rollModifiers.dodgeParry"]), rm.dodgeParry);
    rm.weaponsHandling = assignIf(this.settings.itemRoll && rm.weaponsHandling, () => parseIntSafe(data["rollModifiers.weaponsHandling"]), rm.weaponsHandling);
    rm.weaponsRange = assignIf(this.settings.showRangeModifier, () => parseIntSafe(data["rollModifiers.weaponsRange"]), rm.weaponsRange);
    rm.attachments = assignIf(this.settings.itemRoll && rm.attachments, () => parseIntSafe(data["rollModifiers.attachments"]), rm.attachments);
    rm.other = parseIntSafe(data["rollModifiers.other"]);
    rm.wounds = assignIf(this.settings.showWounds, () => parseIntSafe(data["rollModifiers.wounds"]), 0);
    rm.selectedSkill = assignIf(this.settings.skillRoll, () => data["rollModifiers.selectedSkill"], "");
    rm.targetModifier = assignIf(this.settings.showTargetModifier && data["rollModifiers.targetModifier"],
      () => data["rollModifiers.targetModifier"], rm.targetModifier);
    rm.armorModifier = assignIf(this.settings.showArmorWeaponModifier, () => parseIntSafe(data["rollModifiers.armorModifier"]), 0);
    rm.componentDamage = assignIf(this.settings.isComponent, () => parseIntSafe(data["rollModifiers.componentDamage"]), rm.componentDamage);

    // Handle encumbrance logic
    const isPhysicalChar = ["strength", "dexterity", "endurance"].includes(
      getKeyByValue(TWODSIX.CHARACTERISTICS, rm.characteristic)
    );

    if (!this.settings.showEncumbered || !isPhysicalChar) {
      rm.encumbered = 0;
    } else {
      const dialogEncValue = Number.parseInt(data["rollModifiers.encumbered"] || 0, 10);
      const encValueChanged = dialogEncValue !== rm.encumbered;
      const charUnchanged = this.settings.initialChoice === rm.characteristic;

      if (charUnchanged || encValueChanged) {
        rm.encumbered = Number.isNaN(dialogEncValue) ? 0 : dialogEncValue;
      } else {
        const actorEncValue = this.skill?.actor?.system.conditions.encumberedEffect;
        rm.encumbered = actorEncValue ?? (Number.isNaN(dialogEncValue) ? 0 : dialogEncValue);
      }
    }

    this.settings.selectedTimeUnit = data.timeUnit;
    this.settings.timeRollFormula = data.timeRollFormula;

    // Close the dialog to trigger the promise resolution
    this.close();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static _onCancelRoll(_ev, _target) {
    this.settings.shouldRoll = false;
    // Close the dialog to trigger the promise resolution
    this.close();
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
