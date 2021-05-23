import TwodsixActor from "../entities/TwodsixActor";
import { calcModFor } from "../utils/sheetUtils";


/**
 * This class handles an individual attribute, such as strength and dexterity
 * and keeps track of the current damage value and the original values.
 */
class Attribute {

  damage = 0;
  original: Record<string,number>;

  constructor(characteristic:string, actor:TwodsixActor) {
    this.original = actor.data.data.characteristics[characteristic];
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
  damage: number;
  armor: number;
  edited = false;
  actor: TwodsixActor;

  constructor(actor: TwodsixActor, damage:number) {
    this.strength = new Attribute("strength", actor);
    this.dexterity = new Attribute("dexterity", actor);
    this.endurance = new Attribute("endurance", actor);
    this.actor = actor;
    this.damage = damage;
    this.armor = actor.data.data.primaryArmor.value;
    this.reduceStats();
  }

  currentDamage(): number {
    return this.strength.damage + this.dexterity.damage + this.endurance.damage;
  }

  remaining(): number {
    return this.damage - this.armor - this.currentDamage();
  }

  totalCurrent(): number {
    return this.strength.current() + this.dexterity.current() + this.endurance.current();
  }

  public setDamage(damage:number): void {
    this.damage = damage;
    if (!this.edited) {
      this.reduceStats();
    }
  }

  public setArmor(armor:number): void {
    this.armor = armor;
    if (!this.edited) {
      this.reduceStats();
    }
  }

  unallocatedDamage(): number {
    return this.totalDamage() - this.strength.damage - this.dexterity.damage - this.endurance.damage;
  }

  totalDamage():number {
    return Math.max(this.damage - this.armor, 0);
  }

  public updateActor(): void {
    this.actor.prepareData();
    this.strength.original = this.actor.data.data.characteristics.strength;
    this.dexterity.original = this.actor.data.data.characteristics.dexterity;
    this.endurance.original = this.actor.data.data.characteristics.endurance;
    if (!this.edited) {
      this.reduceStats();
    }
  }

  private reduceStats(): void {
    let remaining = this.totalDamage();
    for (const characteristic of ["endurance", "strength", "dexterity"])  {
      this[characteristic].damage = 0;
      if (remaining > 0) {
        if (remaining <= this[characteristic].current()) {
          this[characteristic].damage = remaining;
          remaining = 0;
        } else  {
          remaining -= this[characteristic].current();
          this[characteristic].damage = this[characteristic].current();
        }
      }
    }
  }

  public applyDamage(): void {
    if (this.actor.token && this.totalCurrent() === 0) {
      const isDead = this.actor.effects.map((e:ActiveEffect) => {
        return e.getFlag("core", "statusId") === "dead";
      }).includes(true);

      if (!isDead) {
        const deadEffect = CONFIG.statusEffects.find(effect => (effect.id === "dead"));
        // @ts-ignore
        this.actor.token.toggleEffect(deadEffect, {active: true});
      }
    }
    this.actor.update({
      "data.characteristics.strength.damage": this.strength.totalDamage(),
      "data.characteristics.dexterity.damage": this.dexterity.totalDamage(),
      "data.characteristics.endurance.damage": this.endurance.totalDamage(),
    });
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

  private hookUpdate():void {
    this.stats.updateActor();
    this.refresh();
  }

  public setHtml(html:JQuery):void {
    this.html = html;
    this.registerEventListeners();
    this.refresh();
  }

  private refresh():void {
    this.html.find(".applied-damage").html(this.stats.totalDamage().toString());

    for (const characteristic of ["strength", "dexterity", "endurance"])  {
      const chrHtml = this.html.find(`.${characteristic}`);
      const stat = this.stats[characteristic];

      if (!this.stats.edited) {
        chrHtml.find(`.damage-input`).val(stat.damage);
      }

      if (characteristic === "endurance" && stat.current() !== 0 && this.stats.currentDamage() - stat.damage > 0) {
        if (!chrHtml.find(`.damage-input`).hasClass("orange-border")) {
          chrHtml.find(`.damage-input`).addClass("orange-border");
          ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.DecreaseEnduranceFirst"));
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
    if (this.stats.totalCurrent() === 0){
      characterDead.show();
    } else {
      characterDead.hide();
    }
  }

  private registerEventListeners() {
    this.html.on('input', ".damage", (event:Event) => {
      this.stats.setDamage(this.getNumericValueFromEvent(event));
      this.refresh();
    });

    this.html.on('input', ".armor", (event:Event) => {
      this.stats.setArmor(this.getNumericValueFromEvent(event));
      this.refresh();
    });

    this.html.on('input', ".damage-input", (event:Event) => {
      const value = this.getNumericValueFromEvent(event, true);
      const stat = this.stats[$(event.currentTarget).data("stat")];

      this.stats.edited = true;
      stat.damage = value;

      this.refresh();
    });
  }

  private getNumericValueFromEvent(event:Event, upper?: boolean):number {
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
    Object.entries(this.hooks).forEach(([hookName, hook]:[string,number]) => Hooks.off(hookName, hook));
    this.html.off('change', "**");
  }
}

export async function renderDamageDialog(damageData:Record<string,any>): Promise<void> {
  const {damageId, damage} = damageData;
  let actor:TwodsixActor;
  if (damageData.actorId) {
    actor = game.actors.get(damageData.actorId);
  } else {
    // @ts-ignore
    actor = canvas.tokens.placeables.find((t:Token) => t.id === damageData.tokenId).actor;
  }
  // @ts-ignore
  const actorUsers = game.users.filter(user=>user.active && actor.testUserPermission(user, 3));
  if ((game.user.isGM && actorUsers.length > 1) || (!game.user.isGM && !actor.owner)) {
    return;
  }

  const template = 'systems/twodsix/templates/actors/damage-dialog.html';

  const stats = new Stats(actor, damage);
  const damageDialogHandler = new DamageDialogHandler(stats);
  const renderedHtml = await renderTemplate(template, {stats: damageDialogHandler.stats});
  const title = game.i18n.localize("TWODSIX.Damage.DealDamageTo").replace("_ACTOR_NAME_", actor.name);

  new Dialog({
    title: title,
    content: renderedHtml,
    buttons: {
      ok: {
        label: game.i18n.localize("TWODSIX.Damage.DealDamage"),
        icon: '<i class="fas fa-fist-raised"></i>',
        callback: () => {
          stats.edited = true;
          stats.applyDamage();
          game.socket.emit("system.twodsix", ["destroyDamageDialog", damageId]);
          Hooks.call("destroyDamageDialog", damageId);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
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

export function destroyDamageDialog(damageId:string): void {
  Object.values(ui.windows).forEach(foundryWindow => {
    if (foundryWindow instanceof Dialog && foundryWindow.id === damageId) {
      foundryWindow.close();
    }
  });
}
