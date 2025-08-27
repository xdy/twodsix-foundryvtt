// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
import { calcModFor } from "./sheetUtils";
import {Traveller} from "../../types/template";
import { getDamageTypes } from "./sheetUtils";
import { TwodsixRollSettings } from "./TwodsixRollSettings";
import { TWODSIX } from "../config";

/**
 * This class handles an individual attribute, such as strength and dexterity
 * and keeps track of the current damage value and the original values.
 */
class Attribute {

  damage = 0;
  original: Record<string, number>;

  constructor(characteristic: string, actor: TwodsixActor) {
    if (actor.type !== "ship") {
      this.original = (<Traveller>actor.system).characteristics[characteristic];
    }
  }

  current(): number {
    return this.original.value - this.totalDamage();
  }

  mod(): number {
    return calcModFor(this.current());
  }

  totalDamage(): number {
    return this.damage + this.original.damage;
  }
}

/**
 * This class keeps track of all the stats, and re-calculates values upon need.
 */
export class Stats {
  strength: Attribute;
  dexterity: Attribute;
  endurance: Attribute;
  stamina: Attribute;
  lifeblood: Attribute;
  damageValue: number;
  damageType: string;
  damageLabel: string;
  dice: any[];
  armorPiercingValue: number;
  effectiveArmor: number;
  primaryArmor:number;
  secondaryArmor:number;
  parryArmor: number;
  canOnlyBeBlocked: boolean;
  edited = false;
  actor: TwodsixActor;
  damageCharacteristics: string[] = [];
  useLifebloodStamina = false;
  useLifebloodEndurance = false;
  useLifebloodOnly = false;
  damageFormula: string;

  constructor(actor: TwodsixActor, damageValue: number, armorPiercingValue: number, damageType:string, damageLabel:string, parryArmor:number = 0, canOnlyBeBlocked:boolean = false, dice:any[] = []) {
    this.strength = new Attribute("strength", actor);
    this.dexterity = new Attribute("dexterity", actor);
    this.endurance = new Attribute("endurance", actor);
    this.stamina = new Attribute("stamina", actor);
    this.lifeblood = new Attribute("lifeblood", actor);
    this.actor = actor;
    this.damageValue = damageValue;
    this.damageType = damageType;
    const damageLabels = getDamageTypes(true);
    this.damageLabel = damageLabels[damageType] || damageLabel;
    this.dice = dice;
    this.armorPiercingValue = armorPiercingValue;
    if (actor.type !== "ship") {
      this.primaryArmor = this.damageType === 'psionic' ? 0 : (<Traveller>actor.system).primaryArmor.value; //primary armor does not stop psionic damage
      this.secondaryArmor = actor.getSecondaryProtectionValue(damageType);
      this.parryArmor = parryArmor;
      this.canOnlyBeBlocked = canOnlyBeBlocked;
      this.effectiveArmor = game.settings.get('twodsix', 'ruleset') === 'CU' ? Math.max(this.secondaryArmor + this.parryArmor - this.armorPiercingValue, 0) :  Math.max(this.primaryArmor + this.secondaryArmor - this.armorPiercingValue, 0);
    }
    this.damageCharacteristics = getDamageCharacteristics(this.actor.type);
    this.damageFormula = game.settings.get("twodsix", "armorDamageFormula");
    this.useCUData = game.settings.get('twodsix', 'ruleset') === 'CU';

    if ((game.settings.get("twodsix", "animalsUseHits") && actor.type === 'animal' ) || (game.settings.get("twodsix", "robotsUseHits") && actor.type === 'robot')) {
      this.useLifebloodStamina = false;
      this.useLifebloodEndurance = false;
      this.useLifebloodOnly = true;
    } else if (game.settings.get("twodsix", "lifebloodInsteadOfCharacteristics")) {
      this.useLifebloodStamina = false;
      this.useLifebloodEndurance = true;
      this.useLifebloodOnly = false;
    } else if (game.settings.get("twodsix", "showLifebloodStamina")) {
      this.useLifebloodStamina = true;
      this.useLifebloodEndurance = false;
      this.useLifebloodOnly = false;
    }

    this.reduceStats();
  }

  currentDamage(): number {
    let retValue = 0;
    for (const characteristic of this.damageCharacteristics) {
      retValue += this[characteristic].damage;
    }
    return retValue;
  }

  totalDamage(): number {
    const rollData = foundry.utils.duplicate(this.actor.getRollData());
    Object.assign(rollData, {damage: this.damageValue, effectiveArmor: this.effectiveArmor});
    const damageFormula = this.armorPiercingValue === 9999 ? "@damage" : this.damageFormula;
    if (Roll.validate(damageFormula)) {
      const totalDamage = Roll.safeEval(Roll.replaceFormulaData(damageFormula, rollData, {missing: "0", warn: true}));
      return Math.round(Math.max(totalDamage, 0));
    }
    return Math.max(this.damageValue - this.effectiveArmor, 0);
  }

  remaining(): number {
    return this.totalDamage() - this.currentDamage();
  }

  totalCurrent(): number {
    let retValue = 0;
    for (const characteristic of this.damageCharacteristics) {
      retValue += this[characteristic].current();
    }
    return retValue;
  }

  public setDamage(damageValue: number): void {
    this.damageValue = damageValue;
    if (!this.edited) {
      this.reduceStats();
    }
  }

  public setArmor(effectiveArmor: number): void {
    this.effectiveArmor = effectiveArmor;
    if (!this.edited) {
      this.reduceStats();
    }
  }

  unallocatedDamage(): number {
    let retValue: number = this.totalDamage();
    for (const characteristic of this.damageCharacteristics) {
      retValue -= this[characteristic].damage;
    }
    return retValue;
  }

  public updateActor(): void {
    this.actor.prepareData(); //Not certain why this is needed?
    for (const characteristic of this.damageCharacteristics) {
      this[characteristic].original = (<Traveller>this.actor.system).characteristics[characteristic];
    }
    if (!this.edited) {
      this.reduceStats();
    }
  }

  private reduceStats(): void {
    let remaining = this.totalDamage();

    for (const characteristic of this.damageCharacteristics) {
      this[characteristic].damage = 0;
      if (remaining > 0) {
        if (remaining <= this[characteristic].current()) {
          this[characteristic].damage = remaining;
          remaining = 0;
        } else {
          remaining -= this[characteristic].current();
          this[characteristic].damage = this[characteristic].current();
        }
      }
    }
  }

  public async applyDamage(): Promise<void> {
    let charName = '';
    const charArray = {};
    for (const characteristic of this.damageCharacteristics) {
      charName = 'system.characteristics.' + characteristic + '.damage';
      charArray[charName] = this[characteristic].totalDamage();
    }
    await this.actor.update(charArray);
  }
}

/**
 * Listens to changes in the dialog and re-renders new values. Also listens
 * to updates to the actor (or token in case of unlinked actors) and updates
 * accordingly.
 */
class DamageDialogHandler {
  html: HTMLElement;
  hooks = {};
  stats: Stats;

  constructor(stats: Stats) {
    this.stats = stats;
    this.hooks["updateActor"] = Hooks.on("updateActor", this.hookUpdate.bind(this));
    this.hooks["updateToken"] = Hooks.on("updateToken", this.hookUpdate.bind(this));
  }

  private hookUpdate(): void {
    this.stats.updateActor();
    this.refresh();
  }

  public setHtml(html: HTMLElement): void {
    this.html = html.element;
    this.registerEventListeners();
    this.refresh();
  }

  private refresh(): void {
    this.html.querySelector(".applied-damage").textContent = this.stats.totalDamage().toString();

    for (const characteristic of this.stats.damageCharacteristics) {
      const chrHtml = this.html.querySelector(`.${characteristic}`);
      const stat = this.stats[characteristic];
      if (chrHtml) {
        if (!this.stats.edited) {
          chrHtml.querySelector(`.damage-input`).value = stat.damage;
        }

        if (characteristic === this.stats.damageCharacteristics[0] && stat.current() !== 0 && this.stats.currentDamage() - stat.damage > 0) {
          if (!chrHtml.querySelector(`.damage-input`)?.classList.contains("orange-border")) {
            chrHtml.querySelector(`.damage-input`)?.classList.add("orange-border");
            if (stat.original.damage === 0) {
              ui.notifications.warn("TWODSIX.Warnings.DecreaseEnduranceFirst", {localize: true});
            }
          }
        } else {
          chrHtml.querySelector(`.damage-input`)?.classList.remove("orange-border");
        }

        chrHtml.querySelector(`.original-value`).innerHTML = stat.original.value.toString();
        chrHtml.querySelector(`.original-current`).innerHTML = stat.original.current.toString();
        chrHtml.querySelector(`.result-value`).innerHTML = stat.current().toString();
        //chrHtml.querySelector(`.total-damage`).innerHTML = stat.totalDamage().toString();
        if (chrHtml.querySelector(`.current-mod`)) {
          chrHtml.querySelector(`.current-mod`).innerHTML = stat.original.mod.toString();
        }
        if (chrHtml.querySelector(`.mod`)) {
          chrHtml.querySelector(`.mod`).innerHTML = stat.mod().toString();
        }
      }
    }

    if (this.stats.unallocatedDamage() !== 0) {
      this.html.querySelector(".unalocated-damage-text")?.classList.add("orange");
    } else {
      this.html.querySelector(".unalocated-damage-text")?.classList.remove("orange");
    }
    this.html.querySelector(".unalocated-damage").innerHTML = this.stats.unallocatedDamage().toString();

    const characterDead = this.html.querySelector(".character-dead");
    if (characterDead) {
      if (this.stats.totalCurrent() === 0) {
        characterDead.style.display = '';
      } else {
        characterDead.style.display = 'none';
      }
    }
  }

  private registerEventListeners() {
    this.html.querySelectorAll(".damage")?.forEach(el => {
      el.addEventListener ('input', (ev:Event) => {
        this.stats.setDamage(this.getNumericValueFromEvent(ev));
        this.refresh();
      });
    });

    this.html.querySelectorAll(".armor")?.forEach(el => {
      el.addEventListener ('input', (ev:Event) => {
        this.stats.setArmor(this.getNumericValueFromEvent(ev));
        this.refresh();
      });
    });

    this.html.querySelectorAll(".damage-input")?.forEach(el => {
      el.addEventListener ('input', (ev:Event) => {
        const value = this.getNumericValueFromEvent(ev, true);
        const stat = this.stats[ev.currentTarget.dataset.stat];

        this.stats.edited = true;
        stat.damage = value;

        this.refresh();
      });
    });
  }

  private getNumericValueFromEvent(ev:Event, upper?: boolean): number {
    const value = parseInt(ev.currentTarget.value as string, 10);
    const newVal = isNaN(value) ? 0 : value;
    if (newVal < 0) {
      ui.notifications.warn("TWODSIX.Warnings.StatValBelowZero", {localize: true});
      ev.currentTarget.value = 0;
      return 0;
    }
    if (upper) {
      const stat = this.stats[ev.currentTarget.dataset.stat];
      const current = stat.original.current;
      if (value > current) {
        ev.currentTarget.value = current;
        ui.notifications.warn("TWODSIX.Warnings.MaxStatVal", {localize: true});
        return current;
      }
    }
    return newVal;
  }

  public unRegisterListeners() {
    Object.entries(this.hooks).forEach(([hookName, hook]: [string, number]) => Hooks.off(hookName, hook));
    //this.html.removeEventListener('change', "**");
  }
}

export async function renderDamageDialog(damageData: Record<string, any>): Promise<void> {
  const {damageId, damageValue, armorPiercingValue, damageType, damageLabel, canBeParried, canBeBlocked, dice} = damageData;
  let actor:TwodsixActor = damageData.actor;
  if (!actor.uuid) {
    actor = await fromUuid(damageData.targetUuid);
  }

  const actorUsersNonGM = game.users?.filter(user => user.active && actor && actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) && !user.isGM) || null;
  if ((game.user?.isGM && actorUsersNonGM?.length > 0) || (!game.user?.isGM && !actor.isOwner)) {
    return;
  }

  const template = 'systems/twodsix/templates/actors/damage-dialog.hbs';
  const canOnlyBeBlocked = canBeBlocked && !canBeParried;
  const parryArmor = canBeParried || canBeBlocked ? await getParryValue(actor, canOnlyBeBlocked) : 0;
  const stats = new Stats(actor, damageValue, armorPiercingValue, damageType, damageLabel, parryArmor, canOnlyBeBlocked, dice);
  const damageDialogHandler = new DamageDialogHandler(stats);
  const renderedHtml = await foundry.applications.handlebars.renderTemplate(template, {stats: damageDialogHandler.stats});
  const title = game.i18n.localize("TWODSIX.Damage.DealDamageTo").replace("_ACTOR_NAME_", actor.name);

  await foundry.applications.api.DialogV2.wait({
    window: {
      title: title,
      icon: "fa-solid fa-person-burst"
    },
    content: renderedHtml,
    buttons: [
      {
        action: "ok",
        label: "TWODSIX.Damage.DealDamage",
        icon: "fa-solid fa-hand-fist",
        default: true,
        callback: () => {
          stats.edited = true;
          stats.applyDamage();
          game.socket?.emit("system.twodsix", ["destroyDamageDialog", damageId]);
          Hooks.call("destroyDamageDialog", damageId);
        }
      },
      {
        action: "cancel",
        icon: "fa-solid fa-xmark",
        label: "Cancel",
        callback: () => {
          //pass
        }
      },
    ],
    close: () => damageDialogHandler.unRegisterListeners(),
    render: (ev, html) => {
      damageDialogHandler.setHtml(html);
    },
    rejectClose: false
  }, {id: damageId});
}

export function destroyDamageDialog(damageId: string): void {
  Object.values(ui.windows).forEach(foundryWindow => {
    if (foundryWindow instanceof Dialog && foundryWindow.id === damageId) {
      foundryWindow.close();
    }
  });
}

export function getDamageCharacteristics(actorType:string): string[] {
  if ((game.settings.get("twodsix", "animalsUseHits") && actorType === 'animal') || (game.settings.get("twodsix", "robotsUseHits") && actorType === 'robot')) {
    return ["lifeblood"];
  } else if (game.settings.get("twodsix", "lifebloodInsteadOfCharacteristics")) {
    return ["endurance", "strength"];
  } else if (game.settings.get("twodsix", "showLifebloodStamina")) {
    return ["stamina", "lifeblood"];
  } else {
    return ["endurance", "strength", "dexterity"];
  }
}

/**
 * Gets the best Parry AV value based on equipped melee damage weapons on a sucesssful melee roll if ruleset is CU.
 * @param {TwodsixActor} actor The defending actor
 * @param {boolean} canOnlyBeBlocked Damage can only be blocked with shield
 * @returns {number} The best equipped melee damage weapon parry AV value if sucessful, otherwise zero
 */
export async function getParryValue(actor:TwodsixActor, canOnlyBeBlocked:boolean): number {
  let returnValue = 0;

  if (game.settings.get('twodsix', 'ruleset') === 'CU'){
    //Try to find melee combat skill
    const meleeSkill:TwodsixItem =  actor.getBestSkill(game.i18n.localize("TWODSIX.Items.Skills.MeleeCombat") + "| Melee Combat | Melee", false);
    if (meleeSkill) {
      const weaponsList: TwodsixItem[] = actor.itemTypes.weapon.filter( it => itemCanBlock(it, canOnlyBeBlocked));
      if (weaponsList?.length > 0) {
        weaponsList.sort((a, b) => b.system.parryAV - a.system.parryAV); //Find best parry weapon
        const weapon:TwodsixItem = weaponsList[0];
        if (weapon.system.parryAV > 0){
          const tmpSettings = {
            difficulty: TWODSIX.DIFFICULTIES.CU.Average,
            rollModifiers: {char: 'DEX'},
            extraFlavor: `${game.i18n.localize("TWODSIX.Rolls.MakesParryRoll")} ${weapon.name}(AV: ${weapon.system.parryAV})`
          };
          const settings:TwodsixRollSettings = await TwodsixRollSettings.create(false, tmpSettings, meleeSkill, undefined, actor);
          if (settings.shouldRoll) {
            const returnRoll = await meleeSkill.skillRoll(false, settings);
            if (returnRoll?.effect >= 0) {
              returnValue = weapon.system.parryAV;
            }
          }
        }
      } else {
        ui.notifications.warn("TWODSIX.Warnings.CantFind" + (canOnlyBeBlocked ? "Shield" : "MeleeWeapon"), {localize: true});
      }
    } else {
      ui.notifications.warn("TWODSIX.Warnings.CantFindMeleeSkill", {localize: true});
    }
  }
  return returnValue;
}

/**
 * Returns whether an weapon (item) can mitigate damage.
 * @param {TwodsixItem} weapon The weapon attempting to parry/block
 * @param {boolean} canBeBlocked Damage can be blocked only with shield
 * @returns {boolean} Whether the item can mitigate damage
 */
function itemCanBlock(weapon:TwodsixItem, canBeBlocked: boolean):boolean {
  let returnValue = weapon.system.damageType === 'melee' && weapon.system.equipped === 'equipped' && Number.isInteger(weapon.system.parryAV);
  if (canBeBlocked) {
    returnValue = returnValue && weapon.system.isShield;
  }
  return returnValue;
}
