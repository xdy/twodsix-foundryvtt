import { TWODSIX } from '../../config';
import { getTargetStatusModifiers } from '../../utils/targetModifiers';
import { TwodsixRollSettings } from '../../utils/TwodsixRollSettings';
import { getCharacteristicFromDisplayLabel } from '../../utils/utils';
import { GearItem } from './GearItem.js';
import { getValueFromRollFormula } from './item-base.js';

/** @typedef {import("../TwodsixActor").default} TwodsixActor */
/** @typedef {import("../../utils/TwodsixDiceRoll").TwodsixDiceRoll} TwodsixDiceRoll */
/** @typedef {import("../../utils/TwodsixRollSettings").TwodsixRollSettings} TwodsixRollSettings */

/**
 * Document class for weapon item type.
 * Contains all weapon-specific combat logic.
 * @extends {GearItem}
 */
export class WeaponItem extends GearItem {

  /** @override */
  _getDefaultIcon() {
    return 'systems/twodsix/assets/icons/default_weapon.png';
  }

  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) {
      return false;
    }
    if (!Object.keys(data.system ?? {}).includes('damage')) {
      await this.updateSource({"system.damage": game.settings.get('twodsix', 'defaultWeaponDamage')});
    }
    return allowed;
  }

  /**
   * @param {number} number
   * @returns {number}
   */
  static burstAttackDM(number) {
    if (number === null) {
      return 0;
    }
    if (number >= 100) {
      return 4;
    } else if (number >= 20) {
      return 3;
    } else if (number >= 10) {
      return 2;
    } else if (number >= 3) {
      return 1;
    } else {
      return 0;
    }
  }

  /**
   * @param {number} number
   * @returns {string}
   */
  static burstBonusDamage(number) {
    if (number === null) {
      return '0';
    }
    if (number >= 100) {
      return '4d6';
    } else if (number >= 20) {
      return '3d6';
    } else if (number >= 10) {
      return '2d6';
    } else if (number >= 4) {
      return '1d6';
    } else if (number >= 3) {
      return '1';
    } else {
      return '0';
    }
  }

  //////// WEAPON ////////
  /**
   * Perform a weapon attack.
   * @param {string} attackType Type of autofire attack (e.g. 'single', 'auto-full', 'auto-burst')
   * @param {boolean} showThrowDialog Whether to show roll/through dialog
   * @param {number} rateOfFireCE Fire rate / consumables used
   * @param {boolean} [showInChat] Whether to show attack in chat
   * @param {object} [overrideSettings] settings to override default roll parameters from Item
   * @returns {Promise<void>}
   */
  async performAttack(
    attackType,
    showThrowDialog,
    rateOfFireCE,
    showInChat = true,
    overrideSettings
  ) {
    const weapon = this.system;

    // Set skill
    let skill = undefined;
    if (weapon.skill || overrideSettings?.skillName) {
      if (overrideSettings?.skillName && overrideSettings?.skillName !== "---") {
        skill = this.actor?.items.getName(overrideSettings?.skillName);
      } else {
        skill = this.actor?.items.get(weapon.skill);
      }
      skill ??= game.settings.get("twodsix", "hideUntrainedSkills") ? this.actor?.getUntrainedSkill() : undefined;
    }
    if (!skill) {
      ui.notifications.error("TWODSIX.Errors.NoSkillForSkillRoll", {localize: true});
      return;
    }

    // Initialize settings
    const tmpSettings = this.initializeAttackSettings();
    if (overrideSettings) {
      foundry.utils.mergeObject(tmpSettings, overrideSettings);
    }

    // Always ensure characteristic and rollType are set from skill, but allow overrideSettings to take precedence
    if (!overrideSettings?.rollModifiers?.characteristic ||
      (overrideSettings?.skillName === "---" && overrideSettings?.rollModifiers?.characteristic === "NONE")) {
      tmpSettings.rollModifiers.characteristic = (skill.system).characteristic || "NONE";
    }

    tmpSettings.rollType = overrideSettings?.rollType || skill.system.rolltype || "Normal";

    // Apply measured template if valid AOE. drawItemTemplate handles region placement and targeting.
    const isAOE = await this.drawItemTemplate();
    if (isAOE) {
      // Switch back to token control after region placement for user convenience
      if (canvas.tokens && typeof canvas.tokens.activate === 'function') {
        canvas.tokens.activate({tool: 'select'});
      }
      // Targeting is now handled within the region placement workflow; no redundant call here.
    }

    // Get fire mode parameters
    const {
      weaponType,
      isAutoFull,
      usedAmmo,
      numberOfAttacks
    } = this.getFireModeParams(rateOfFireCE, attackType, tmpSettings, isAOE, skill);
    const useCTBands = game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands';

    // Define Targets
    const targetTokens = Array.from(game.user.targets);
    const controlledTokens = this.actor?.getActiveTokens();

    // Get target Modifiers
    if (targetTokens.length === 0 && useCTBands) {
      Object.assign(tmpSettings.rollModifiers, {
        armorModifier: 0,
        armorLabel: game.i18n.localize('TWODSIX.Ship.Unknown')
      });
    } else if (targetTokens.length === 1) {
      // Get Single Target Dodge Parry information
      const dodgeParryInfo = this.getDodgeParryValues(targetTokens[0], isAOE);
      Object.assign(tmpSettings.rollModifiers, dodgeParryInfo);

      //Get single target weapon-armor modifier
      if (useCTBands) {
        const weaponArmorInfo = this.getWeaponArmorValues(targetTokens[0], weaponType, isAutoFull);
        Object.assign(tmpSettings.rollModifiers, weaponArmorInfo);
      }
    }

    // Get weapon handling modifier
    if (this.system.handlingModifiers !== "") {
      Object.assign(tmpSettings.rollModifiers, {weaponsHandling: this.getWeaponsHandlingMod(rateOfFireCE)});
    }

    //Get weapons range modifier for roll dialog - note, values only apply if single target, otherwise empty or undefined returned.
    if (controlledTokens?.length === 1) {
      const {
        rangeModifier,
        rangeLabel
      } = this.calculateRangeAndLabel(controlledTokens, targetTokens, weaponType, isAutoFull, tmpSettings);
      Object.assign(tmpSettings.rollModifiers, {
        weaponsRange: rangeModifier,
        rangeLabel: rangeLabel
      });
    }
    // Assign applied statuses if exactly one target token
    const appliedStatuses = targetTokens.length === 1 ? getTargetStatusModifiers(targetTokens[0].actor) : [];
    Object.assign(tmpSettings.rollModifiers, {
      targetModifier: appliedStatuses
    });

    //Flag that targetDM is an override
    Object.assign(tmpSettings.rollModifiers, {targetModifierOverride: targetTokens.length > 1});

    // Create roll settings
    const settings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings, skill, this, this.actor);

    if (!settings.shouldRoll) {
      return;
    }

    // Update consumables for use
    if (!(await this.consumeAmmo(this, usedAmmo))) {
      return;
    }

    // Warn if too many targets
    if (targetTokens.length > numberOfAttacks && !isAOE) {
      ui.notifications.warn("TWODSIX.Warnings.TooManyTargets", {localize: true});
    }
    //Make attack rolls
    await this.executeAttackRolls(numberOfAttacks, targetTokens, controlledTokens, weaponType, isAutoFull, settings, showInChat, isAOE, attackType);
  }

  /**
   * Initializes the default settings for an attack roll.
   * @returns {object} The default attack roll settings.
   */
  initializeAttackSettings() {
    return {
      rollType: "Normal",
      bonusDamage: "0",
      rollModifiers: {
        characteristic: "NONE",
        other: 0
      }
    };
  }

  /**
   * Executes multiple attack rolls for a weapon attack, applying modifiers and handling damage for each roll.
   * @param {number} numberOfAttacks - The number of attack rolls to execute.
   * @param {Token[]} targetedTokens - The tokens targeted by the attack.
   * @param {Token[]} controlledTokens - The tokens controlled by the actor performing the attack.
   * @param {string} weaponType - The type of weapon being used (e.g., rifle, pistol).
   * @param {boolean} isAutoFull - Whether the attack is a full-auto attack.
   * @param {TwodsixRollSettings} settings - The settings used for the attack roll.
   * @param {boolean} showInChat - Whether to display the attack roll results in the chat.
   * @param {boolean} isAOE - Whether the attack is an area-of-effect attack.
   * @returns {Promise<void>} A promise that resolves when all attack rolls and damage handling are complete.
   */
  async executeAttackRolls(
    numberOfAttacks,
    targetedTokens,
    controlledTokens,
    weaponType,
    isAutoFull,
    settings,
    showInChat,
    isAOE,
    attackType
  ) {
    const targetModifiers = [...settings.rollModifiers.targetModifier];
    Object.assign(settings.flags, {attackType: attackType ?? ""});
    for (let i = 0; i < numberOfAttacks; i++) {
      const targetToken = targetedTokens[i % targetedTokens.length];
      // Update modifiers for each target if multi attack, otherwise use settings that have been preselected
      if (targetedTokens.length > 1) {
        this.updateRollModifiers(settings, targetToken, controlledTokens, weaponType, isAutoFull, isAOE, targetModifiers);
      }

      // Perform the skill roll
      const roll = await this.skillRoll(false, settings, showInChat);

      // Handle damage if the roll is successful
      if (game.settings.get("twodsix", "automateDamageRollOnHit") && roll?.isSuccess()) {
        await this.handleDamageRoll(roll, settings, targetedTokens, i, isAOE, showInChat);
      }
    }
  }

  /**
   * Updates the roll modifiers for a weapon attack based on various factors such as dodge/parry, armor, range, and target statuses.
   * @param {TwodsixRollSettings} settings - The settings used for the attack roll.
   * @param {Token} targetToken - The token representing the target of the attack.
   * @param {Token[]} controlledTokens - The tokens controlled by the actor performing the attack.
   * @param {string} weaponType - The type of weapon being used (e.g., rifle, pistol).
   * @param {boolean} isAutoFull - Whether the attack is a full-auto attack.
   * @param {boolean} isAOE - Whether the attack is an area-of-effect attack.
   * @param {any[]} targetModifiers - A list of target-specific modifiers to apply.
   * @returns {void}
   */
  updateRollModifiers(
    settings,
    targetToken,
    controlledTokens,
    weaponType,
    isAutoFull,
    isAOE,
    targetModifiers
  ) {
    // Update dodge/parry modifiers
    const dodgeParryInfo = this.getDodgeParryValues(targetToken, isAOE);
    Object.assign(settings.rollModifiers, dodgeParryInfo);

    // Update armor modifiers if necessary
    if (game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands') {
      const weaponArmorInfo = this.getWeaponArmorValues(targetToken, weaponType, isAutoFull);
      Object.assign(settings.rollModifiers, weaponArmorInfo);
    }

    // Update range modifiers if controlled tokens exist
    if (controlledTokens.length === 1 && targetToken) {
      const targetRange = this.measureTokenDistance(controlledTokens[0], targetToken);
      const rangeData = this.getRangeModifier(targetRange, weaponType, isAutoFull);
      Object.assign(settings.rollModifiers, {weaponsRange: rangeData.rangeModifier});
      Object.assign(settings, {rollType: rangeData.rollType});
    }

    // Update target modifiers based on statuses or overrides
    if (targetModifiers.length > 0) {
      Object.assign(settings.rollModifiers, {targetModifier: targetModifiers});
    } else {
      Object.assign(settings.rollModifiers, {targetModifier: getTargetStatusModifiers(targetToken.actor)});
    }
  }

  /**
   * @param {Token[]} targetTokens
   * @returns {object[]}
   */
  getAppliedStatuses(targetTokens) {
    if (targetTokens.length === 1) {
      return getTargetStatusModifiers(targetTokens[0].actor);
    }
    return [];
  }

  /**
   * Handles the damage roll for a successful attack.
   * @param {TwodsixDiceRoll} roll The result of the attack roll.
   * @param {TwodsixRollSettings} settings The settings used for the attack roll.
   * @param {Token[]} targetTokens The list of target tokens.
   * @param {number} attackIndex The index of the current attack in a multi-attack sequence.
   * @param {boolean} isAOE Whether the attack is an area-of-effect attack.
   * @param {boolean} showInChat Whether to show attack in chat
   * @returns {Promise<void>}
   */
  async handleDamageRoll(roll, settings, targetTokens, attackIndex, isAOE, showInChat) {
    const addEffect = game.settings.get('twodsix', 'addEffectToDamage');
    let totalBonusDamage = addEffect ? `${roll.effect}` : ``;
    if (settings.bonusDamage !== "0" && settings.bonusDamage !== "") {
      totalBonusDamage += (addEffect ? ` + ` : ``) + `${settings.bonusDamage}`;
    }

    const damagePayload = (await this.rollDamage(settings.messageMode, totalBonusDamage, showInChat, false, roll.effect)) || null;
    if (targetTokens.length >= 1 && damagePayload) {
      if (isAOE) {
        for (const target of targetTokens) {
          (target.actor).handleDamageData(damagePayload, !game.settings.get('twodsix', 'autoDamageTarget'));
        }
      } else {
        (targetTokens[attackIndex % targetTokens.length].actor).handleDamageData(damagePayload, !game.settings.get('twodsix', 'autoDamageTarget'));
      }
    }
  }

  /**
   * A method to get the weapon fire mode parameters.
   * @param {number} rateOfFireCE  The rate of fire used
   * @param {string} attackType The type of attack (e.g. burst, double-tap, etc.)
   * @param {object} tmpSettings the temporary settings object for the roll
   * @param {boolean} isAOE Attack is an area attack - force to only a single attack
   * @param {TwodsixItem} skill Skill used for attack
   * @returns {object} { weaponType, isAutoFull, usedAmmo, numberOfAttacks }
   */
  getFireModeParams(rateOfFireCE, attackType, tmpSettings, isAOE, skill) {
    const ruleSet = game.settings.get('twodsix', 'ruleset');
    const weapon = this.system;
    let numberOfAttacks = 1;
    let bonusDamage = "0";
    let isAutoFull = false;
    let skillLevelMax = undefined;
    const rof = parseInt(weapon.rateOfFire, 10);
    const rateOfFire = rateOfFireCE ?? (!isNaN(rof) ? rof : 1);
    if (attackType !== 'single' && !rateOfFire) {
      ui.notifications.error("TWODSIX.Errors.NoROFForAttack", {localize: true});
    }

    let usedAmmo = rateOfFire;
    let weaponTypeOverride = "";
    const autoFireRules = game.settings.get('twodsix', 'autofireRulesUsed');

    switch (attackType) {
      case "single":
        usedAmmo = 1;
        // Need a single fire override for auto weapons
        if (game.settings.get('twodsix', 'rangeModifierType') === 'CT_Bands') {
          if (weapon.rangeBand === 'autoRifle') {
            weaponTypeOverride = 'rifle';
          } else if (weapon.rangeBand === 'submachinegun') {
            weaponTypeOverride = 'autoPistol';
          }
        }
        break;
      case "auto-full":
        numberOfAttacks = isAOE ? 1 : getNumberOfAttacks(autoFireRules, rateOfFire);
        if (autoFireRules === 'CEL') {
          usedAmmo = 3 * rateOfFire;
        }
        skillLevelMax = ruleSet === "CDEE" ? 1 : undefined; //special rule for CD-EE
        isAutoFull = true;
        break;
      case "auto-burst":
        if (autoFireRules !== 'CT') {
          bonusDamage = ruleSet === "CDEE" ? `${rateOfFire}d6kh` : rateOfFire.toString(); //special rule for CD-EE
        }
        break;
      case "burst-attack-dm":
        Object.assign(tmpSettings.rollModifiers, {rof: WeaponItem.burstAttackDM(rateOfFire)});
        break;
      case "burst-bonus-damage":
        bonusDamage = WeaponItem.burstBonusDamage(rateOfFire);
        break;
      case "double-tap":
        //Need to assign as bonus damage or rof bonus depending on rules
        if (['CD', 'CLU'].includes(ruleSet)) {
          bonusDamage = "1d6";
        } else if (['AC', 'CEL'].includes(ruleSet)) {
          bonusDamage = "1";
        } else {
          Object.assign(tmpSettings.rollModifiers, {rof: 1});
        }
        usedAmmo = 2;
        break;
      case "multi":
        numberOfAttacks = isAOE ? 1 : rateOfFire;
        usedAmmo = numberOfAttacks;
        break;
      case "fan":
        numberOfAttacks = 3;
        usedAmmo = numberOfAttacks;
        Object.assign(tmpSettings.rollModifiers, {rof: skill?.system.value > 2 ? -1 : -2});
        break;
    }
    Object.assign(tmpSettings, {bonusDamage: bonusDamage});
    Object.assign(tmpSettings.rollModifiers, {skillLevelMax: skillLevelMax});
    const weaponType = weaponTypeOverride || weapon.rangeBand;
    return {weaponType, isAutoFull, usedAmmo, numberOfAttacks};
  }

  /**
   * A method to get the weapons range modifer based on the weapon type and measured range (distance).
   * Valid for Classic Traveller, Cepheus Engine, and Cepheus Universal band types as well as other rule sets with range values.
   * @param {number} range  The measured distance to the target
   * @param {string} weaponBand The type of weapon used - as key string
   * @param {boolean} isAutoFull - Whether the attack is a full-auto attack.
   * @returns {object} {rangeModifier: rangeModifier, rollType: rollType}
   */
  getRangeModifier(range, weaponBand, isAutoFull) {
    if (range === undefined) {
      return {rangeModifier: 0, rollType: 'Normal'};
    }
    let rangeModifier = 0;
    let rollType = 'Normal';
    const rangeModifierType = game.settings.get('twodsix', 'rangeModifierType');
    const ammoModifier = this.getAmmoRangeModifier(rangeModifierType);

    // Validate weapon range
    if (typeof this.system.range !== 'string') {
      // check for bad migration
      if (typeof this.system.range === 'number' && !['CE_Bands', 'CT_Bands', 'CU_Bands'].includes(rangeModifierType)) {
        console.warn("Bad weapon system.range value - should be string");
      } else {
        console.warn("Invalid weapon system.range value:", this.system.range);
      }
      return {rangeModifier: 0, rollType: 'Normal'};
    }

    const rangeValues = this.system.range?.split('/', 2).map((s) => parseFloat(s));
    if (rangeModifierType === 'none') {
      //rangeModifier = 0;
    } else if (['CE_Bands', 'CT_Bands', 'CU_Bands'].includes(rangeModifierType)) {
      const targetBand = getRangeBand(range);
      if (targetBand !== "unknown") {
        rangeModifier = this.getRangeBandModifier(weaponBand, targetBand, isAutoFull, range);
      }
    } else if (this.isMeleeWeapon()) { // replaced this.system.range?.toLowerCase().includes('melee')
      // Handle special case of melee weapon
      if (range > game.settings.get('twodsix', 'meleeRange')) {
        rangeModifier = INFEASIBLE;
      }
    } else if (isNaN(rangeValues[0]) /*|| (rangeValues[0] === 0 && range === 0)*/) {
      //rangeModifier = 0;
    } else if (range <= game.settings.get('twodsix', 'meleeRange')) {
      // Handle within melee range
      if (range > (rangeModifierType === 'singleBand' ? rangeValues[0] : rangeValues[1] ?? rangeValues[0])) {
        rangeModifier = INFEASIBLE;
      } else if (game.settings.get('twodsix', 'termForAdvantage').toLowerCase() === this.system.meleeRangeModifier.toLowerCase()) {
        rollType = 'Advantage';
      } else if (game.settings.get('twodsix', 'termForDisadvantage').toLowerCase() === this.system.meleeRangeModifier.toLowerCase()) {
        rollType = 'Disadvantage';
      } else {
        rangeModifier = parseInt(this.system.meleeRangeModifier) || 0;
      }
    } else if (rangeModifierType === 'singleBand') {
      if (range <= rangeValues[0] * 0.25 * ammoModifier) {
        rangeModifier = 1;
      } else if (range <= rangeValues[0] * ammoModifier) {
        //rangeModifier = 0;
      } else if (range <= rangeValues[0] * 2 * ammoModifier) {
        rangeModifier = -2;
      } else if (range <= rangeValues[0] * 4 * ammoModifier) {
        rangeModifier = -4;
      } else {
        rangeModifier = INFEASIBLE;
      }
    } else if (rangeModifierType === 'doubleBand') {
      if (rangeValues[0] > rangeValues[1]) {
        //rangeModifier = 0;
      } else if (range <= rangeValues[0] * ammoModifier) {
        //rangeModifier = 0;
      } else if (range <= rangeValues[1] * ammoModifier) {
        rangeModifier = -2;
      } else {
        rangeModifier = INFEASIBLE;
      }
    }
    return {rangeModifier: rangeModifier, rollType: rollType};
  }

  /**
   * A method to return ammo range modifier.
   * @param {string} rangeModifierType  The type of range modifier (setting)
   * @returns {number} range modifier DM
   */
  getAmmoRangeModifier(rangeModifierType) {
    let returnValue = 1;
    //Get ammo range modifier if single or double bands
    if (['singleBand', 'doubleBand'].includes(rangeModifierType) && this.system.useConsumableForAttack) {
      const magazine = this.actor?.items.get(this.system.useConsumableForAttack);
      if (magazine?.system.ammoRangeModifier !== "" && magazine?.system.ammoRangeModifier !== "0") {
        const modifierVal = parseFloat(magazine.system.ammoRangeModifier);
        if (!isNaN(modifierVal)) {
          returnValue = 1 + (modifierVal / 100);
        }
      }
    }
    return returnValue;
  }

  /**
   * A method to get the dodge / parry modifer based on the target's corresponding skill used for attack.
   * @param {Token} target  The target token
   * @param {boolean} isAOE Is an area-of-effect attack (cannot be dodged)
   * @returns {object} {dodgeParry: dodgeParryModifier, dodgeParryLabel: skillName}
   */
  getDodgeParryValues(target, isAOE) {
    let dodgeParryModifier = 0;
    let skillName = "";
    if (game.settings.get("twodsix", "useDodgeParry") && target && !isAOE) {
      const weaponSkill = this.actor?.items.get(this.system.skill);
      skillName = weaponSkill?.getFlag("twodsix", "untrainedSkill") ? this.system.associatedSkillName : weaponSkill?.name;
      const targetMatchingSkill = target.actor?.itemTypes.skills?.find(sk => sk.name === skillName);
      dodgeParryModifier = -targetMatchingSkill?.system.value || 0;
    }
    return {dodgeParry: dodgeParryModifier, dodgeParryLabel: skillName};
  }

  /**
   * A method to determine whether weapon is a melee weapon.
   * @returns {boolean} Whether item is a melee weapon
   */
  isMeleeWeapon() {
    if (this.system.weaponType.toLowerCase() === 'melee' || this.system.range.toLowerCase() === 'melee') {
      //explicit override
      return true;
    } else {
      const rangeModifierType = game.settings.get('twodsix', 'rangeModifierType');
      switch (rangeModifierType) {
        case 'none':
          return false;
        case 'CE_Bands':
          return ['closeQuarters', 'extendedReach'].includes(this.system.rangeBand);
        case 'CU_Bands':
          return ['close', 'personal'].includes(this.system.rangeBand);
        case 'CT_Bands':
          return !(['bodyPistol', 'autoPistol', 'revolver', 'carbine', 'rifle', 'autoRifle', 'shotgun', 'submachinegun', 'laserCarbine', 'laserRifle', 'custom', 'none'].includes(this.system.rangeBand));
        case 'singleBand':
        case 'doubleBand':
          if (parseInt(this.system.range) === 0 || this.system.range === "") {
            return false;
          } else {
            const rangeValues = this.system.range.split('/', 2).map((s) => parseFloat(s));
            const upperValue = rangeModifierType === 'singleBand' ? rangeValues[0] : rangeValues[1] ?? rangeValues[0];
            return (upperValue > 0 && upperValue <= game.settings.get('twodsix', 'meleeRange'));
          }
        default:
          return false;
      }
    }
  }

  /**
   * A method to parse and return the weapon's handling modifier based on attacker's characteristics.
   * @param {number} rateOfFire The weapon rate of fire (needed for CU)
   * @returns {number} The DM for the actor firing the weapon used
   */
  getWeaponsHandlingMod(rateOfFire) {
    // Handle CU special case of auto fire affecting recoil
    let rofOffset = 0;
    if (game.settings.get('twodsix', 'ruleset') === 'CU') {
      if (rateOfFire === 4) {
        rofOffset = 1;
      } else if (rateOfFire >= 10) {
        rofOffset = 2;
      }
    }

    let weaponHandlingMod = 0;
    const re = new RegExp(/^(\w+)\s+([0-9]+)-?\/(.+)\s+([0-9]+)\+?\/(.+)/gm);
    const parsedResult = re.exec(this.system.handlingModifiers);
    if (parsedResult) {
      const checkCharacteristic = getCharacteristicFromDisplayLabel(parsedResult[1], this.actor);
      if (checkCharacteristic) {
        const charValue = game.settings.get('twodsix', 'ruleset') === 'CU' ? this.actor.system.characteristics[checkCharacteristic].current : this.actor.system.characteristics[checkCharacteristic].value;
        if (charValue <= parseInt(parsedResult[2], 10) + rofOffset) {
          weaponHandlingMod = getValueFromRollFormula(parsedResult[3], this);
        } else if (charValue >= parseInt(parsedResult[4], 10) + rofOffset) {
          weaponHandlingMod = getValueFromRollFormula(parsedResult[5], this);
        }
      }
    }
    return weaponHandlingMod;
  }

  /**
   * A function to resolve autofire mode when a weapon is fired without selecting mode.
   * Through an NPC sheet or macro, typically.
   * @param {boolean} [showThrowDialog=true]
   * @param {object} [tmpSettings]
   * @returns {Promise<void>}
   */
  async resolveUnknownAutoMode(showThrowDialog = true, tmpSettings) {
    let attackType = 'single';
    let rof;
    const modes = ((this.system).rateOfFire ?? "").split(/[-/]/);
    switch (game.settings.get('twodsix', 'autofireRulesUsed')) {
      case TWODSIX.RULESETS.CEL.key:
        if (this.shouldShowCELAutoFireDialog()) {
          attackType = await promptForCELROF(this);
        }
        rof = (attackType === 'single') ? 1 : Number(modes[0]);
        await this.performAttack(attackType, showThrowDialog, rof, true, tmpSettings);
        break;
      case TWODSIX.RULESETS.CT.key:
        if (modes.length > 1) {
          attackType = await promptForCTROF(modes);
          rof = (attackType === 'single') ? 1 : Number(modes[1]);
          await this.performAttack(attackType, showThrowDialog, rof, true, tmpSettings);
        } else {
          await this.performAttack(attackType, showThrowDialog, Number(modes[0]), true, tmpSettings);
        }
        break;
      case TWODSIX.RULESETS.CE.key:
        if (modes.length > 1) {
          await promptAndAttackForCE(modes, this);
        } else {
          await this.performAttack(attackType, showThrowDialog, Number(modes[0]), true, tmpSettings);
        }
        break;
      case TWODSIX.RULESETS.CU.key:
        if (modes[0] > 1) {
          attackType = await promptForCTROF(modes);
          rof = (attackType === 'single') ? 1 : Number(modes[0]);
          await this.performAttack(attackType, showThrowDialog, rof, true, tmpSettings);
        } else {
          await this.performAttack(attackType, showThrowDialog, 1, true, tmpSettings);
        }
        break;
      case TWODSIX.RULESETS.RIDER.key:
        if (modes[0] > 1 || this.system.isSingleAction) {
          attackType = await promptForRIDERROF(this);
          rof = (attackType === 'single') ? 1 : Number(modes[0]);
          await this.performAttack(attackType, showThrowDialog, rof, true, tmpSettings);
        } else {
          await this.performAttack(attackType, showThrowDialog, 1, true, tmpSettings);
        }
        break;
      default:
        await this.performAttack(attackType, showThrowDialog, 1, true, tmpSettings);
        break;
    }
  }

  /**
   * @returns {boolean}
   */
  shouldShowCELAutoFireDialog() {
    const rateOfFire = (this.system).rateOfFire;
    return (
      /*(game.settings.get('twodsix', 'autofireRulesUsed') === TWODSIX.RULESETS.CEL.key) && */
      (Number(rateOfFire) > 1 || (this.system.doubleTap && game.settings.get('twodsix', 'ShowDoubleTap')))
    );
  }

  /**
   * A method for returning the weapons-armor modifier based on target and weapon type used - Classic Traveller
   * @param {Token} targetToken Token for target
   * @param {string} weaponType Weapon's type description, (e.g., club, rifle, hands). Can be an override based on fire mode (e.g. auto rifle in single fire mode)
   * @param {boolean} isAuto is full auto fire
   * @returns {object} Object of {armorModifier:number, armorLabel:string}
   */
  getWeaponArmorValues(targetToken, weaponType, isAuto) {
    let armorModifier = 0;
    let armorLabel = "";
    if (weaponType !== 'none') {
      const targetActor = targetToken?.actor;
      const lookupRow = weaponType === 'custom' ? this.getCustomArmorMod(isAuto) : CT_Armor_Table[weaponType];
      if (targetActor && lookupRow) {
        if (targetActor.type === 'traveller') {
          const wornArmor = targetActor.itemTypes.armor.filter((armor) => armor.system.equipped === 'equipped');
          if (wornArmor.length > 2) {
            ui.notifications.warn("TWODSIX.Warnings.TooManyLayersOnTarget", {localize: true});
          } else if (targetActor.system.reflectOn && wornArmor.length === 2) {
            const armor0Mod = lookupRow[wornArmor[0].system.armorType] + (wornArmor[0].system.armorDM ?? 0);
            const armor1Mod = lookupRow[wornArmor[1].system.armorType] + (wornArmor[1].system.armorDM ?? 0);
            armorModifier = armor0Mod < armor1Mod ? armor0Mod : armor1Mod;
            armorLabel = armor0Mod < armor1Mod ? wornArmor[0].system.armorType : wornArmor[1].system.armorType;
          } else if (wornArmor.length === 1) {
            armorModifier = lookupRow[wornArmor[0].system.armorType] + (wornArmor[0].system.armorDM ?? 0);
            armorLabel = wornArmor[0].system.armorType;
          } else if (wornArmor.length === 0) {
            armorModifier = lookupRow['nothing'];
            armorLabel = 'nothing';
          }
        } else if (['animal', 'robot'].includes(targetActor.type)) {
          armorModifier = lookupRow[targetActor.system.armorType] + (targetActor.system.armorDM ?? 0);
          armorLabel = targetActor.system.armorType;
        }
      } else {
        ui.notifications.error("TWODSIX.Errors.InvalidWeaponArmor", {localize: true});
      }
    }
    armorLabel = game.i18n.localize(armorLabel !== "" ? TWODSIX.CT_ARMOR_TYPES[armorLabel] : 'TWODSIX.Ship.Unknown');
    return {armorModifier: armorModifier, armorLabel: armorLabel};
  }

  /**
   * A method for returning an object of custom armor values for a weapon in CT
   * @param {boolean} isAuto Is full automatic fire
   * @returns {object} Object of protection values versus different armor types
   */
  getCustomArmorMod(isAuto) {
    return {
      nothing: parseCustomCTValue(this.system.customCT.armor.nothing, isAuto),
      jack: parseCustomCTValue(this.system.customCT.armor.jack, isAuto),
      mesh: parseCustomCTValue(this.system.customCT.armor.mesh, isAuto),
      cloth: parseCustomCTValue(this.system.customCT.armor.cloth, isAuto),
      reflec: parseCustomCTValue(this.system.customCT.armor.reflec, isAuto),
      ablat: parseCustomCTValue(this.system.customCT.armor.ablat, isAuto),
      combat: parseCustomCTValue(this.system.customCT.armor.combat, isAuto)
    };
  }

  /**
   * A method for returning range modifier based on RangeTable constant
   * @param {string} weaponBand   Weapon's range description, (.e.g., close quarters, thrown, rifle)
   * @param {string} targetDistanceBand Qualitative distance to target, (e.g. close, short, very long)
   * @param {number} range Range to target, in meters
   * @param {boolean} isAuto Is full automatic fire
   * @returns {number} Range Modifier
   */
  getRangeBandModifier(weaponBand, targetDistanceBand, isAuto, range) {
    const rangeSettings = game.settings.get('twodsix', 'rangeModifierType');
    let returnVal = 0;
    if (targetDistanceBand !== 'unknown' && weaponBand !== 'none') {
      try {
        switch (rangeSettings) {
          case 'CE_Bands':
            returnVal = CE_Range_Table[weaponBand][targetDistanceBand];
            break;
          case 'CU_Bands': {
            if (weaponBand === 'thrown') {
              //Special case for thrown weapons
              const maxThrow = 10 + this.actor?.system.characteristics.strength.value - this.system.weight;
              if (range < maxThrow / 2) {
                returnVal = 0;
              } else if (range > maxThrow) {
                returnVal = INFEASIBLE;
              } else {
                returnVal = -2; //Thrown weapons default to DIFFICULT
              }
            } else {
              returnVal = CU_Range_Table[weaponBand][targetDistanceBand];
            }
            break;
          }
          case 'CT_Bands': {
            const lookupRow = (weaponBand === 'custom') ? this.getCustomRangeMod(isAuto) : CT_Range_Table[weaponBand];
            returnVal = lookupRow[targetDistanceBand] || 0;
            break;
          }
          default:
            console.log("Not a valid weapon range band type");
            break;
        }
      } catch /*(err)*/ {
        ui.notifications.error("TWODSIX.Errors.InvalidRangeBand", {localize: true});
      }
    }
    return returnVal;
  }

  /**
   * A method for returning an object of custom range modifiers for a weapon in CT
   * @param {boolean} isAuto Is full automatic fire
   * @returns {object} Object of range modifiers versus different range bands
   */
  getCustomRangeMod(isAuto) {
    return {
      close: parseCustomCTValue(this.system.customCT.range.close, isAuto),
      short: parseCustomCTValue(this.system.customCT.range.short, isAuto),
      medium: parseCustomCTValue(this.system.customCT.range.medium, isAuto),
      long: parseCustomCTValue(this.system.customCT.range.long, isAuto),
      veryLong: parseCustomCTValue(this.system.customCT.range.veryLong, isAuto)
    };
  }

  /**
   * Calculates the range modifier and range label for a weapon attack.
   * @param {Token[]} controlledTokens - The tokens controlled by the actor performing the attack.
   * @param {Token[]} targetTokens - The tokens targeted by the attack.
   * @param {string} weaponType - The type of weapon being used (e.g., rifle, pistol).
   * @param {boolean} isAutoFull - Whether the attack is a full-auto attack.
   * @param {object} tmpSettings - Temporary settings for the attack roll.
   * @returns {object} An object containing the range modifier and range label.
   * @property {number} rangeModifier - The calculated range modifier for the attack.
   * @property {string} rangeLabel - The label describing the range of the attack.
   */
  calculateRangeAndLabel(controlledTokens, targetTokens, weaponType, isAutoFull, tmpSettings) {
    let rangeLabel = "";
    let rangeModifier = 0;
    const isQualitativeBands = ['CE_Bands', 'CT_Bands', 'CU_Bands'].includes(game.settings.get('twodsix', 'rangeModifierType'));
    const localizePrefix = "TWODSIX.Chat.Roll.RangeBandTypes.";

    if (targetTokens.length === 1) {
      const targetRange = this.measureTokenDistance(controlledTokens[0], targetTokens[0]);
      const rangeData = this.getRangeModifier(targetRange, weaponType, isAutoFull);
      rangeModifier = rangeData.rangeModifier;

      if (rangeData.rollType !== tmpSettings.rollType) {
        Object.assign(tmpSettings, {rollType: tmpSettings.rollType === 'Normal' ? rangeData.rollType : 'Normal'});
      }

      if (isQualitativeBands) {
        rangeLabel = this.system.rangeBand === 'none'
          ? game.i18n.localize(localizePrefix + "none")
          : `${game.i18n.localize('TWODSIX.Chat.Roll.WeaponRangeTypes.' + weaponType)} @ ${game.i18n.localize(localizePrefix + getRangeBand(targetRange))}`;
      } else {
        const ammoMultiplier = this.getAmmoRangeModifier(game.settings.get('twodsix', 'rangeModifierType'));
        const effectiveRange = (this.system.range)
          .split("/")
          .map((str) => (parseFloat(str) * ammoMultiplier).toLocaleString(game.i18n.lang, {maximumFractionDigits: 1}))
          .join('/')
          .replace('NaN', game.i18n.localize((this.isMeleeWeapon() ? "TWODSIX.DamageType.Melee" : "TWODSIX.Ship.Unknown")));
        rangeLabel = `${effectiveRange} @ ${targetRange.toLocaleString(game.i18n.lang, {maximumFractionDigits: 1})}${canvas.scene.grid.units}`;
      }
    } else if (targetTokens.length === 0) {
      rangeLabel = isQualitativeBands && this.system.rangeBand === 'none'
        ? game.i18n.localize(localizePrefix + "none")
        : game.i18n.localize("TWODSIX.Ship.Unknown");
    }

    return {rangeModifier, rangeLabel};
  }

  /**
   * Measure the shortest distance between two tokens, accounting for footprint and elevation.
   * @param {Token} sourceToken
   * @param {Token} targetToken
   * @returns {number|undefined} Distance in scene units, or undefined if tokens or canvas are unavailable.
   */
  measureTokenDistance(sourceToken, targetToken) {
    if (!sourceToken || !targetToken || !canvas?.grid) {
      return undefined;
    }
    const sourceDocument = sourceToken.document ?? sourceToken;
    const targetDocument = targetToken.document ?? targetToken;

    if (canvas.grid.isHexagonal) {
      return this.measureHexTokenDistance(sourceDocument, targetDocument);
    } else if (canvas.grid.isSquare) {
      return this.measureSquareTokenDistance(sourceDocument, targetDocument);
    } else {
      return this.measureGridlessTokenDistance(sourceDocument, targetDocument);
    }
  }

  /**
   * Measure token distance on hex grids using occupied hex offsets.
   * Finds the nearest hex-pair center-to-center distance, then subtracts one
   * hex step to convert to edge-to-edge (adjacent tokens = 0).
   * @param {TokenDocument} sourceToken
   * @param {TokenDocument} targetToken
   * @returns {number}
   */
  measureHexTokenDistance(sourceToken, targetToken) {
    const gridDistance = canvas?.scene?.grid?.distance ?? 0;
    const sourceOffsets = sourceToken.getOccupiedGridSpaceOffsets();
    const targetOffsets = targetToken.getOccupiedGridSpaceOffsets();
    let shortestHorizontal = 0;

    if (sourceOffsets.length > 0 && targetOffsets.length > 0) {
      let minCellDist = Infinity;
      for (const sourceOffset of sourceOffsets) {
        const sourcePoint = canvas.grid.getCenterPoint(sourceOffset);
        for (const targetOffset of targetOffsets) {
          const targetPoint = canvas.grid.getCenterPoint(targetOffset);
          const cellDist = canvas.grid.measurePath([sourcePoint, targetPoint]).distance;
          if (cellDist < minCellDist) {
            minCellDist = cellDist;
          }
        }
      }
      // Subtract one hex step to convert center-to-center → edge-to-edge
      shortestHorizontal = Math.max(0, minCellDist - gridDistance);
    }

    const sourceBottom = Number(sourceToken.elevation ?? 0);
    const targetBottom = Number(targetToken.elevation ?? 0);
    const sourceTop = sourceBottom + (Number(sourceToken.depth ?? 0) * gridDistance);
    const targetTop = targetBottom + (Number(targetToken.depth ?? 0) * gridDistance);
    const verticalDistance = this.getAxisSeparation(sourceBottom, sourceTop, targetBottom, targetTop);

    return Math.hypot(shortestHorizontal, verticalDistance);
  }

  /**
   * Measure token distance on square grids using occupied cell offsets and measurePath,
   * respecting the scene's diagonal cost setting. Finds the nearest cell-pair
   * center-to-center distance, then subtracts one step to give edge-to-edge distance.
   * @param {TokenDocument} sourceToken
   * @param {TokenDocument} targetToken
   * @returns {number}
   */
  measureSquareTokenDistance(sourceToken, targetToken) {
    const gridDistance = canvas?.scene?.grid?.distance ?? 0;
    const sourceOffsets = sourceToken.getOccupiedGridSpaceOffsets();
    const targetOffsets = targetToken.getOccupiedGridSpaceOffsets();
    let shortestHorizontal = 0;

    if (sourceOffsets.length > 0 && targetOffsets.length > 0) {
      let minCellDist = Infinity;
      for (const sourceOffset of sourceOffsets) {
        const sourcePoint = canvas.grid.getCenterPoint(sourceOffset);
        for (const targetOffset of targetOffsets) {
          const targetPoint = canvas.grid.getCenterPoint(targetOffset);
          const cellDist = canvas.grid.measurePath([sourcePoint, targetPoint]).distance;
          if (cellDist < minCellDist) {
            minCellDist = cellDist;
          }
        }
      }
      // Subtract one grid step to convert center-to-center → edge-to-edge
      shortestHorizontal = Math.max(0, minCellDist - gridDistance);
    }

    const sourceBottom = Number(sourceToken.elevation ?? 0);
    const targetBottom = Number(targetToken.elevation ?? 0);
    const sourceTop = sourceBottom + (Number(sourceToken.depth ?? 0) * gridDistance);
    const targetTop = targetBottom + (Number(targetToken.depth ?? 0) * gridDistance);
    const verticalDistance = this.getAxisSeparation(sourceBottom, sourceTop, targetBottom, targetTop);

    return Math.hypot(shortestHorizontal, verticalDistance);
  }

  /**
   * Measure token distance in gridless scenes using pixel bounding boxes and elevation bands.
   * @param {TokenDocument} sourceToken
   * @param {TokenDocument} targetToken
   * @returns {number}
   */
  measureGridlessTokenDistance(sourceToken, targetToken) {
    const sourceBounds = this.getTokenBounds(sourceToken);
    const targetBounds = this.getTokenBounds(targetToken);
    const horizontalDistance = Math.hypot(
      this.getAxisSeparation(sourceBounds.left, sourceBounds.right, targetBounds.left, targetBounds.right),
      this.getAxisSeparation(sourceBounds.top, sourceBounds.bottom, targetBounds.top, targetBounds.bottom)
    ) / canvas.dimensions.distancePixels;

    const gridDistance = canvas.scene?.grid?.distance ?? 0;
    const sourceBottom = Number(sourceToken.elevation ?? 0);
    const targetBottom = Number(targetToken.elevation ?? 0);
    const sourceTop = sourceBottom + (Number(sourceToken.depth ?? 0) * gridDistance);
    const targetTop = targetBottom + (Number(targetToken.depth ?? 0) * gridDistance);
    const verticalDistance = this.getAxisSeparation(sourceBottom, sourceTop, targetBottom, targetTop);

    return Math.hypot(horizontalDistance, verticalDistance);
  }

  /**
   * Get token bounds in canvas pixels.
   * @param {TokenDocument} token
   * @returns {{left: number, right: number, top: number, bottom: number}}
   */
  getTokenBounds(token) {
    const {width, height} = token.getSize();
    return {
      left: token.x ?? 0,
      right: (token.x ?? 0) + width,
      top: token.y ?? 0,
      bottom: (token.y ?? 0) + height
    };
  }

  /**
   * Get the distance between two one-dimensional intervals.
   * @param {number} minA
   * @param {number} maxA
   * @param {number} minB
   * @param {number} maxB
   * @returns {number}
   */
  getAxisSeparation(minA, maxA, minB, maxB) {
    if (maxA < minB) {
      return minB - maxA;
    }
    if (maxB < minA) {
      return minA - maxB;
    }
    return 0;
  }
}

// ─── Module-level helpers (weapon-only) ─────────────────────────────────────

/**
 * Parse a custom Weapon Range/Armor modifier for CT and return value
 * @param {string} inputString   The custom input string of format x/y or x
 * @param {boolean} isAuto Is full automatic fire
 * @returns {number} modifier value, return defaults to zero if no valid number found
 */
function parseCustomCTValue(inputString, isAuto) {
  const parsedInput = inputString.split("/");
  let returnVal = 0;
  if (parsedInput.length > 0) {
    returnVal = parseInt(parsedInput[isAuto ? 1 : 0]);
    if (isNaN(returnVal) && isAuto) { // base case where no slash and auto is default, e.g. submachinegun
      returnVal = parseInt(parsedInput[0]);
    }
  }
  return returnVal || 0;
}

/**
 * @param {import('./item-base.js').default} weapon
 * @returns {Promise<string>}
 */
async function promptForCELROF(weapon) {
  if (weapon.system.doubleTap && game.settings.get('twodsix', 'ShowDoubleTap')) {
    return await foundry.applications.api.DialogV2.wait({
      window: {title: "TWODSIX.Dialogs.ROFPickerTitle"},
      content: "",
      buttons: [
        {
          action: "single",
          label: "TWODSIX.Dialogs.ROFSingle",
          default: true
        },
        {
          action: "double-tap",
          label: "TWODSIX.Dialogs.ROFDoubleTap",
        }
      ],
      rejectClose: false
    });
  } else {
    return await foundry.applications.api.DialogV2.wait({
      window: {title: "TWODSIX.Dialogs.ROFPickerTitle"},
      content: "",
      buttons: [
        {
          action: "single",
          label: "TWODSIX.Dialogs.ROFSingle",
          default: true
        },
        {
          action: "auto-burst",
          label: "TWODSIX.Dialogs.ROFBurst"
        },
        {
          action: "auto-full",
          label: "TWODSIX.Dialogs.ROFFull"
        }
      ],
      rejectClose: false
    });
  }
}

/**
 * @param {string[]} modes
 * @param {WeaponItem} item
 * @returns {Promise<void>}
 */
async function promptAndAttackForCE(modes, item) {
  const buttons = [];

  for (const mode of modes) {
    const number = Number(mode);
    const attackDM = WeaponItem.burstAttackDM(number);
    const bonusDamage = WeaponItem.burstBonusDamage(number);

    if (number === 1) {
      buttons.push({
        action: "single",
        label: "TWODSIX.Dialogs.ROFSingle",
        default: true,
        callback: () => {
          item.performAttack("single", true, 1);
        }
      });
    } else if (number > 1) {
      let key = game.i18n.localize("TWODSIX.Rolls.AttackDM") + ' +' + attackDM;
      buttons.push({
        action: `burst${number}`,
        label: key,
        callback: () => {
          item.performAttack('burst-attack-dm', true, number);
        }
      });

      key = game.i18n.localize("TWODSIX.Rolls.BonusDamage") + ' +' + bonusDamage;
      buttons.push({
        action: `bonus${number}`,
        label: key,
        callback: () => {
          item.performAttack('burst-bonus-damage', true, number);
        }
      });
    }
  }
  await foundry.applications.api.DialogV2.wait({
    window: {title: "TWODSIX.Dialogs.ROFPickerTitle"},
    content: "",
    buttons: buttons,
    rejectClose: false
  });
}

/**
 * @param {string[]} modes
 * @returns {Promise<string>}
 */
async function promptForCTROF(modes) {
  if (parseInt(modes[0]) === 0) {
    return 'auto-full';
  } else {
    return await foundry.applications.api.DialogV2.wait({
      window: {title: "TWODSIX.Dialogs.ROFPickerTitle"},
      content: "",
      buttons: [
        {
          action: "single",
          label: "TWODSIX.Dialogs.ROFSingle",
          default: true
        },
        {
          action: "auto-full",
          label: "TWODSIX.Dialogs.ROFFull"
        }
      ],
      rejectClose: false
    });
  }
}

/**
 * @param {WeaponItem} weapon
 * @returns {Promise<string>}
 */
async function promptForRIDERROF(weapon) {
  const buttons = [{
    action: "single",
    label: "TWODSIX.Dialogs.ROFSingle",
    default: true
  }];
  if (weapon.system.rateOfFire > 1) {
    buttons.push({
      action: "multi",
      label: "TWODSIX.Dialogs.ROFMulti"
    });
  }
  if (weapon.system.isSingleAction) {
    buttons.push({
      action: "fan",
      label: "TWODSIX.Dialogs.ROFFan"
    });
  }
  return await foundry.applications.api.DialogV2.wait({
    window: {title: "TWODSIX.Dialogs.ROFPickerTitle"},
    content: "",
    buttons: buttons,
    rejectClose: false
  });
}

/**
 * A function for returning qualitative range band. Per CE rules https://www.orffenspace.com/cepheus-srd/personal-combat.html#range
 * or per Classic Traveller Rules https://www.drivethrurpg.com/product/80192/CTTTBThe-Traveller-Book?cPath=21_4767
 *
 * @param {number} range    The range in meters
 * @returns {string}        The resulting range band
 */
function getRangeBand(range) {
  //Convert ft to m if necessay
  const rangeModifierType = game.settings.get('twodsix', 'rangeModifierType');
  const units = canvas.scene.grid.units.toLowerCase();
  if (units === 'ft' || units === 'feet') {
    range /= 3.28;
  }
  if (rangeModifierType === 'CE_Bands') {
    if (range < 1.5) {
      return 'personal';
    } else if (range <= 3) {
      return 'close';
    } else if (range <= 12) {
      return 'short';
    } else if (range <= 50) {
      return 'medium';
    } else if (range <= 250) {
      return 'long';
    } else if (range <= 500) {
      return 'veryLong';
    } else if (range > 500) {
      return 'distant';
    } else {
      return 'unknown';
    }
  } else if (rangeModifierType === 'CT_Bands') {
    if (range < 1) {
      return 'close';
    } else if (range <= 5) {
      return 'short';
    } else if (range <= 50) {
      return 'medium';
    } else if (range <= 250) {
      return 'long';
    } else if (range <= 500) {
      return 'veryLong';
    } else if (range > 500) {
      return 'distant';
    } else {
      return 'unknown';
    }
  } else if (rangeModifierType === 'CU_Bands') {
    if (range < 1.5) {
      return 'personal';
    } else if (range <= 3) {
      return 'close';
    } else if (range <= 15) {
      return 'short';
    } else if (range <= 50) {
      return 'medium';
    } else if (range <= 250) {
      return 'long';
    } else if (range <= 500) {
      return 'veryLong';
    } else if (range > 500) {
      return 'distant';
    } else {
      return 'unknown';
    }
  } else {
    return 'unknown';
  }
}

// CE SRD Range Table Cepheus Engine SRD Table https://www.orffenspace.com/cepheus-srd/personal-combat.html#range.
const INFEASIBLE = -99;
const CE_Range_Table = Object.freeze({
  closeQuarters: {
    personal: 0,
    close: -2,
    short: INFEASIBLE,
    medium: INFEASIBLE,
    long: INFEASIBLE,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  extendedReach: {
    personal: -2,
    close: 0,
    short: INFEASIBLE,
    medium: INFEASIBLE,
    long: INFEASIBLE,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  thrown: {
    personal: INFEASIBLE,
    close: 0,
    short: -2,
    medium: -2,
    long: INFEASIBLE,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  pistol: {personal: -2, close: 0, short: 0, medium: -2, long: -4, veryLong: INFEASIBLE, distant: INFEASIBLE},
  rifle: {personal: -4, close: -2, short: 0, medium: 0, long: 0, veryLong: -2, distant: -4},
  shotgun: {personal: -2, close: 0, short: -2, medium: -2, long: -4, veryLong: INFEASIBLE, distant: INFEASIBLE},
  assaultWeapon: {personal: -2, close: 0, short: 0, medium: 0, long: -2, veryLong: -4, distant: -6},
  rocket: {personal: -4, close: -2, short: -2, medium: 0, long: 0, veryLong: -2, distant: -4}
});

// From Combat Data Sheet pg 427 Cepheus Universal
const CU_Range_Table = Object.freeze({
  personal: {
    personal: 0,
    close: -1,
    short: INFEASIBLE,
    medium: INFEASIBLE,
    long: INFEASIBLE,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  close: {
    personal: -1,
    close: 0,
    short: INFEASIBLE,
    medium: INFEASIBLE,
    long: INFEASIBLE,
    veryLong: INFEASIBLE,
    distant: INFEASIBLE
  },
  short: {personal: 2, close: 2, short: 0, medium: -2, long: -4, veryLong: INFEASIBLE, distant: INFEASIBLE},
  medium: {personal: 2, close: 2, short: 0, medium: 0, long: -2, veryLong: -4, distant: INFEASIBLE},
  shotgun: {personal: 2, close: 2, short: 1, medium: 0, long: -2, veryLong: -4, distant: INFEASIBLE},
  long: {personal: 2, close: 2, short: 0, medium: 0, long: 0, veryLong: -2, distant: -4},
  veryLong: {personal: 2, close: 2, short: 0, medium: 0, long: 0, veryLong: 0, distant: -2},
  distant: {personal: 2, close: 2, short: 0, medium: 0, long: 0, veryLong: 0, distant: 0},
});

//Classic Traveller Range Modifiers from https://www.drivethrurpg.com/product/355200/Classic-Traveller-Facsimile-Edition puls errat corrections from
// CONSOLIDATED CT ERRATA, v0.7 (06/01/12)
const CT_Range_Table = Object.freeze({
  hands: {close: 2, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  claws: {close: 1, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  teeth: {close: 2, short: 0, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  horns: {close: -1, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  hooves: {close: -1, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  stinger: {close: 4, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  thrasher: {close: 5, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  club: {close: 1, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  dagger: {close: 1, short: -1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  blade: {close: 1, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  foil: {close: -1, short: 0, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  cutlass: {close: -4, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  sword: {close: -2, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  broadsword: {close: -8, short: 3, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  bayonet: {close: -1, short: 2, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  spear: {close: -2, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  halberd: {close: 0, short: 1, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  pike: {close: -4, short: 4, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  cudgel: {close: 0, short: 0, medium: INFEASIBLE, long: INFEASIBLE, veryLong: INFEASIBLE},
  bodyPistol: {close: 2, short: 1, medium: -6, long: INFEASIBLE, veryLong: INFEASIBLE},
  autoPistol: {close: 1, short: 2, medium: -4, long: -6, veryLong: INFEASIBLE},
  revolver: {close: 1, short: 2, medium: -3, long: -5, veryLong: INFEASIBLE},
  carbine: {close: -4, short: 1, medium: -2, long: -4, veryLong: -5},
  rifle: {close: -4, short: 1, medium: 0, long: -1, veryLong: -3},
  autoRifle: {close: -8, short: 0, medium: 2, long: 1, veryLong: -2},
  shotgun: {close: -8, short: 1, medium: 3, long: -6, veryLong: INFEASIBLE},
  submachinegun: {close: -4, short: 3, medium: 3, long: -3, veryLong: -9},
  laserCarbine: {close: -2, short: 1, medium: 1, long: 1, veryLong: 0},
  laserRifle: {close: -4, short: 2, medium: 2, long: 2, veryLong: 1}
});

const CT_Armor_Table = Object.freeze({
  hands: {nothing: 1, jack: -1, mesh: -4, cloth: -4, reflec: 0, ablat: -1, combat: -6},
  claws: {nothing: 3, jack: 0, mesh: 0, cloth: 1, reflec: -1, ablat: -3, combat: -7},
  teeth: {nothing: 2, jack: 1, mesh: -1, cloth: 0, reflec: -2, ablat: -4, combat: -7},
  horns: {nothing: 2, jack: 1, mesh: 0, cloth: -1, reflec: 2, ablat: -2, combat: -5},
  hooves: {nothing: 3, jack: 3, mesh: 2, cloth: 2, reflec: 3, ablat: 2, combat: -6},
  stinger: {nothing: 4, jack: 3, mesh: 0, cloth: 1, reflec: 2, ablat: 0, combat: -6},
  thrasher: {nothing: 7, jack: 7, mesh: 4, cloth: 4, reflec: 7, ablat: 4, combat: 0},
  club: {nothing: 0, jack: 0, mesh: -2, cloth: -3, reflec: 0, ablat: -2, combat: -7},
  dagger: {nothing: 0, jack: -1, mesh: -4, cloth: -4, reflec: 0, ablat: -2, combat: -7},
  blade: {nothing: 0, jack: -1, mesh: -4, cloth: -4, reflec: 0, ablat: -2, combat: -7},
  foil: {nothing: 2, jack: 0, mesh: -4, cloth: -3, reflec: 2, ablat: -2, combat: -6},
  cutlass: {nothing: 4, jack: 3, mesh: -2, cloth: -3, reflec: 4, ablat: -2, combat: -6},
  sword: {nothing: 3, jack: 3, mesh: -3, cloth: -3, reflec: 3, ablat: -2, combat: -6},
  broadsword: {nothing: 5, jack: 5, mesh: 1, cloth: 0, reflec: 5, ablat: 1, combat: -4},
  bayonet: {nothing: 2, jack: 1, mesh: 0, cloth: -1, reflec: 2, ablat: -2, combat: -6},
  spear: {nothing: 1, jack: 0, mesh: -2, cloth: -2, reflec: -1, ablat: -3, combat: -6},
  halberd: {nothing: 4, jack: 3, mesh: -2, cloth: -3, reflec: 4, ablat: -2, combat: -5},
  pike: {nothing: 1, jack: 0, mesh: -2, cloth: -2, reflec: -1, ablat: -3, combat: -6},
  cudgel: {nothing: 0, jack: 0, mesh: -2, cloth: -3, reflec: 0, ablat: -2, combat: -7},
  bodyPistol: {nothing: 0, jack: 0, mesh: -2, cloth: -4, reflec: -4, ablat: -2, combat: -7},
  autoPistol: {nothing: 1, jack: 1, mesh: -1, cloth: -3, reflec: 1, ablat: -1, combat: -5},
  revolver: {nothing: 1, jack: 1, mesh: -1, cloth: -3, reflec: 1, ablat: -1, combat: -5},
  carbine: {nothing: 2, jack: 2, mesh: 0, cloth: -3, reflec: 2, ablat: -1, combat: -5},
  rifle: {nothing: 3, jack: 3, mesh: 0, cloth: -3, reflec: 2, ablat: 1, combat: -5},
  autoRifle: {nothing: 6, jack: 6, mesh: 2, cloth: -1, reflec: 6, ablat: 3, combat: -3},
  shotgun: {nothing: 5, jack: 5, mesh: -1, cloth: -3, reflec: 5, ablat: 2, combat: -5},
  submachinegun: {nothing: 5, jack: 5, mesh: 0, cloth: -3, reflec: 5, ablat: 2, combat: -4},
  laserCarbine: {nothing: 2, jack: 2, mesh: 1, cloth: 1, reflec: -8, ablat: -7, combat: -6},
  laserRifle: {nothing: 3, jack: 3, mesh: 2, cloth: 2, reflec: -8, ablat: -7, combat: -6}
});

/**
 * A function to return number of attacks for auto fire depending on rules set and rof
 * @param {string} autoFireRulesUsed The automatic fire rules used
 * @param {number} rateOfFire The fire rate (rounds used)
 * @returns {number} The number of attacks
 */
function getNumberOfAttacks(autoFireRulesUsed, rateOfFire) {
  let returnValue = rateOfFire;
  switch (autoFireRulesUsed) {
    case 'CT':
      returnValue = 2;
      break;
    case 'CU':
      if (rateOfFire === 4) {
        returnValue = 2;
      } else if (rateOfFire === 10 || rateOfFire === 20) {
        returnValue = 3;
      }
      break;
    default:
      break;
  }
  return returnValue;
}
