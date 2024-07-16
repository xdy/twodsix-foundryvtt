// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import TwodsixActor from "../entities/TwodsixActor";
import { calcModFor } from "./sheetUtils";
import {Traveller} from "../../types/template";
import { getDamageTypes } from "./sheetUtils";

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
  armorPiercingValue: number;
  effectiveArmor: number;
  primaryArmor:number;
  secondaryArmor:number;
  edited = false;
  actor: TwodsixActor;
  damageCharacteristics: string[] = [];
  useLifebloodStamina = false;
  useLifebloodEndurance = false;
  useLifebloodOnly = false;
  damageFormula: string;

  constructor(actor: TwodsixActor, damageValue: number, armorPiercingValue: number, damageType:string) {
    this.strength = new Attribute("strength", actor);
    this.dexterity = new Attribute("dexterity", actor);
    this.endurance = new Attribute("endurance", actor);
    this.stamina = new Attribute("stamina", actor);
    this.lifeblood = new Attribute("lifeblood", actor);
    this.actor = actor;
    this.damageValue = damageValue;
    this.damageType = damageType;
    const damageLabels = getDamageTypes(true);
    this.damageLabel = damageLabels[damageType];
    this.armorPiercingValue = armorPiercingValue;
    if (actor.type !== "ship") {
      this.primaryArmor = (<Traveller>actor.system).primaryArmor.value;
      this.secondaryArmor = actor.getSecondaryProtectionValue(damageType);
      this.effectiveArmor = Math.max(this.primaryArmor + this.secondaryArmor - this.armorPiercingValue, 0);
    }
    this.damageCharacteristics = getDamageCharacteristics(this.actor.type);
    this.damageFormula = game.settings.get("twodsix", "armorDamageFormula");

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
    const rollData = foundry.utils.deepClone(this.actor.getRollData());
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
  html: JQuery;
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

  public setHtml(html: JQuery): void {
    this.html = html;
    this.registerEventListeners();
    this.refresh();
  }

  private refresh(): void {
    this.html.find(".applied-damage").html(this.stats.totalDamage().toString());

    for (const characteristic of this.stats.damageCharacteristics) {
      const chrHtml = this.html.find(`.${characteristic}`);
      const stat = this.stats[characteristic];

      if (!this.stats.edited) {
        chrHtml.find(`.damage-input`).val(stat.damage);
      }

      if (characteristic === this.stats.damageCharacteristics[0] && stat.current() !== 0 && this.stats.currentDamage() - stat.damage > 0) {
        if (!chrHtml.find(`.damage-input`).hasClass("orange-border")) {
          chrHtml.find(`.damage-input`).addClass("orange-border");
          if (stat.original.damage === 0) {
            ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.DecreaseEnduranceFirst"));
          }
        }
      } else {
        chrHtml.find(`.damage-input`).removeClass("orange-border");
      }

      chrHtml.find(`.original-value`).html(stat.original.value.toString());
      chrHtml.find(`.original-current`).html(stat.original.current.toString());
      chrHtml.find(`.result-value`).html(stat.current().toString());
      chrHtml.find(`.result-total-damage`).html(stat.totalDamage().toString());
      chrHtml.find(`.current-mod`).html(stat.original.mod.toString());
      chrHtml.find(`.mod`).html(stat.mod().toString());
    }

    if (this.stats.unallocatedDamage() !== 0) {
      this.html.find(".unalocated-damage-text").addClass("orange");
    } else {
      this.html.find(".unalocated-damage-text").removeClass("orange");
    }
    this.html.find(".unalocated-damage").html(this.stats.unallocatedDamage().toString());

    const characterDead = this.html.find(".character-dead");
    if (this.stats.totalCurrent() === 0) {
      characterDead.show();
    } else {
      characterDead.hide();
    }
  }

  private registerEventListeners() {
    this.html.on('input', ".damage", (event) => {
      this.stats.setDamage(this.getNumericValueFromEvent(event));
      this.refresh();
    });

    this.html.on('input', ".armor", (event) => {
      this.stats.setArmor(this.getNumericValueFromEvent(event));
      this.refresh();
    });

    this.html.on('input', ".damage-input", (event) => {
      const value = this.getNumericValueFromEvent(event, true);
      const stat = this.stats[$(event.currentTarget).data("stat")];

      this.stats.edited = true;
      stat.damage = value;

      this.refresh();
    });
  }

  private getNumericValueFromEvent(event, upper?: boolean): number {
    const value = parseInt($(event.currentTarget).val() as string, 10);
    const newVal = isNaN(value) ? 0 : value;
    if (newVal < 0) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.StatValBelowZero"));
      $(event.currentTarget).val(0);
      return 0;
    }
    if (upper) {
      const stat = this.stats[$(event.currentTarget).data("stat")];
      const current = stat.original.current;
      if (value > current) {
        $(event.currentTarget).val(current);
        ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.MaxStatVal"));
        return current;
      }
    }
    return newVal;
  }

  public unRegisterListeners() {
    Object.entries(this.hooks).forEach(([hookName, hook]: [string, number]) => Hooks.off(hookName, hook));
    this.html.off('change', "**");
  }
}

export async function renderDamageDialog(damageData: Record<string, any>): Promise<void> {
  const {damageId, damageValue, armorPiercingValue, damageType} = damageData;
  let actor;
  if (damageData.actorId) {
    actor = game.actors?.get(damageData.actorId);
  } else {
    actor = (canvas.tokens?.placeables?.find((t: Token) => t.id === damageData.tokenId) || null)?.actor || null;
  }
  const actorUsersNonGM = game.users?.filter(user => user.active && actor && actor.testUserPermission(user, 3) && !user.isGM) || null;
  if ((game.user?.isGM && actorUsersNonGM?.length > 0) || (!game.user?.isGM && !actor.isOwner)) {
    return;
  }

  const template = 'systems/twodsix/templates/actors/damage-dialog.html';

  const stats = new Stats(actor, damageValue, armorPiercingValue, damageType);
  const damageDialogHandler = new DamageDialogHandler(stats);
  const renderedHtml = await renderTemplate(template, {stats: damageDialogHandler.stats});
  const title = game.i18n.localize("TWODSIX.Damage.DealDamageTo").replace("_ACTOR_NAME_", actor.name);

  new Dialog({
    title: title,
    content: renderedHtml,
    buttons: {
      ok: {
        label: game.i18n.localize("TWODSIX.Damage.DealDamage"),
        icon: '<i class="fa-solid fa-hand-fist"></i>',
        callback: () => {
          stats.edited = true;
          stats.applyDamage();
          game.socket?.emit("system.twodsix", ["destroyDamageDialog", damageId]);
          Hooks.call("destroyDamageDialog", damageId);
        }
      },
      cancel: {
        icon: '<i class="fa-solid fa-xmark"></i>',
        label: game.i18n.localize("Cancel"),
        callback: () => {
          //pass
        }
      },
    },
    default: 'ok',
    close: () => damageDialogHandler.unRegisterListeners(),
    render: (html: JQuery) => damageDialogHandler.setHtml(html),
  }, {id: damageId}).render(true);
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
