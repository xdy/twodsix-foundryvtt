/** @typedef {import("../entities/TwodsixActor").default} TwodsixActor */
import { getDamageCharacteristics } from "./actorDamage";
import { calcModFor } from "./sheetUtils";

/**
 * This class handles an individual attribute, such as strength and dexterity
 * and keeps track of the current damage value and the original values.
 */
class HealingAttribute {

  /** @type {number} */
  healing = 0;
  /** @type {object} */
  original;

  /**
   * @param {string} characteristic
   * @param {TwodsixActor} actor
   */
  constructor(characteristic, actor) {
    if (actor.type !== "ship") {
      this.original = (actor.system).characteristics[characteristic];
    }
  }

  /**
   * @returns {number}
   */
  newCurrent() {
    return this.original.current + this.healing;
  }

  /**
   * @returns {number}
   */
  newMod() {
    return calcModFor(this.newCurrent());
  }

  /**
   * @returns {number}
   */
  newDamage() {
    return this.current.damage - this.healing;
  }

}

/**
 * This class keeps track of all the stats, and re-calculates values upon need.
 */
export class Stats {
  /** @type {HealingAttribute} */
  strength;
  /** @type {HealingAttribute} */
  dexterity;
  /** @type {HealingAttribute} */
  endurance;
  /** @type {HealingAttribute} */
  stamina;
  /** @type {HealingAttribute} */
  lifeblood;
  /** @type {number} */
  healingValue;
  /** @type {object[]} */
  dice;
  /** @type {boolean} */
  edited = false;
  /** @type {TwodsixActor} */
  actor;
  /** @type {string[]} */
  damageCharacteristics = [];
  /** @type {boolean} */
  useLifebloodStamina = false;
  /** @type {boolean} */
  useLifebloodEndurance = false;
  /** @type {boolean} */
  useLifebloodOnly = false;

  /**
   * @param {TwodsixActor} actor
   * @param {number} healingValue
   * @param {object[]} [dice=[]]
   */
  constructor(actor, healingValue, dice = []) {
    this.strength = new HealingAttribute("strength", actor);
    this.dexterity = new HealingAttribute("dexterity", actor);
    this.endurance = new HealingAttribute("endurance", actor);
    this.stamina = new HealingAttribute("stamina", actor);
    this.lifeblood = new HealingAttribute("lifeblood", actor);
    this.actor = actor;
    this.healingValue = healingValue;
    this.dice = dice;
    this.damageCharacteristics = getDamageCharacteristics(this.actor.type);
    //this.useCUData = game.settings.get('twodsix', 'ruleset') === 'CU';

    if ((game.settings.get("twodsix", "animalsUseHits") && actor.type === 'animal') || (game.settings.get("twodsix", "robotsUseHits") && actor.type === 'robot')) {
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

    this.increaseStats();
  }

  /**
   * @returns {number}
   */
  totalAppliedHealing() {
    let retValue = 0;
    for (const characteristic of this.damageCharacteristics) {
      retValue += this[characteristic].healing;
    }
    return retValue;
  }

  /**
   * @returns {number}
   */
  maxHealing() {
    return this.healingValue;
  }

  /**
   * @returns {number}
   */
  totalNewCurrent() {
    let retValue = 0;
    for (const characteristic of this.damageCharacteristics) {
      retValue += this[characteristic].newCurrent();
    }
    return retValue;
  }

  /**
   * @param {number} healingValue
   * @returns {void}
   */
  setInitialHealing(healingValue) {
    this.healingValue = healingValue;
    if (!this.edited) {
      this.increaseStats();
    }
  }

  /**
   * @returns {number}
   */
  unallocatedHealing() {
    return this.maxHealing() - this.totalAppliedHealing();
  }

  /**
   * @returns {void}
   */
  updateActor() {
    this.actor.prepareData(); //Not certain why this is needed?
    for (const characteristic of this.damageCharacteristics) {
      this[characteristic].original = (this.actor.system).characteristics[characteristic];
    }
    if (!this.edited) {
      this.increaseStats();
    }
  }

  /**
   * @returns {void}
   */
  increaseStats() {
    let remaining = this.maxHealing();

    for (const characteristic of this.damageCharacteristics) {
      this[characteristic].healing = 0;
      if (remaining > 0) {
        if (remaining <= this[characteristic].original.damage) {
          this[characteristic].healing = remaining;
          remaining = 0;
        } else {
          remaining -= this[characteristic].original.damage;
          this[characteristic].healing = this[characteristic].original.damage;
        }
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async applyHealing() {
    let charName = '';
    const charArray = {};
    for (const characteristic of this.damageCharacteristics) {
      charName = 'system.characteristics.' + characteristic + '.damage';
      charArray[charName] = Math.clamp(this[characteristic].original.damage - this[characteristic].healing, 0, this[characteristic].original.value);
    }
    await this.actor.update(charArray);
    if (this.actor.sheet?.rendered) {
      this.actor.sheet.render({force: false});
    }
  }
}

/**
 * Listens to changes in the dialog and re-renders new values. Also listens
 * to updates to the actor (or token in case of unlinked actors) and updates
 * accordingly.
 */
class HealingDialogHandler {
  /** @type {HTMLElement} */
  html;
  /** @type {object} */
  hooks = {};
  /** @type {Stats} */
  stats;
  /** @type {Function} */
  debouncedRefresh;

  /**
   * @param {Stats} stats
   */
  constructor(stats) {
    this.stats = stats;
    this.hooks["updateActor"] = Hooks.on("updateActor", this.hookUpdate.bind(this));
    this.hooks["updateToken"] = Hooks.on("updateToken", this.hookUpdate.bind(this));
    // Create debounced version of refresh for input handlers (150ms delay for responsive feel)
    this.debouncedRefresh = foundry.utils.debounce(() => this.refresh(), 150);
  }

  /**
   * @returns {void}
   */
  hookUpdate() {
    this.stats.updateActor();
    this.refresh();
  }

  /**
   * @param {foundry.applications.api.ApplicationV2} html
   * @returns {void}
   */
  setHtml(html) {
    this.html = html.element;
    this.registerEventListeners();
    this.refresh();
  }

  /**
   * @returns {void}
   */
  refresh() {
    //this.html.querySelector(".applied-healing").textContent = this.stats.maxHealing().toString();

    for (const characteristic of this.stats.damageCharacteristics) {
      const chrHtml = this.html.querySelector(`.${characteristic}`);
      const stat = this.stats[characteristic];
      if (chrHtml) {
        if (!this.stats.edited) {
          chrHtml.querySelector(`.healing-input`).value = stat.healing;
        }

        if (characteristic === this.stats.damageCharacteristics[0] && stat.newCurrent() !== stat.original.value && this.stats.healingValue - stat.healing > 0) {
          if (!chrHtml.querySelector(`.healing-input`)?.classList.contains("orange-border")) {
            chrHtml.querySelector(`.healing-input`)?.classList.add("orange-border");
          }
        } else {
          chrHtml.querySelector(`.healing-input`)?.classList.remove("orange-border");
        }

        chrHtml.querySelector(`.original-value`).innerHTML = stat.original.value.toString();
        chrHtml.querySelector(`.original-current`).innerHTML = stat.original.current.toString();
        chrHtml.querySelector(`.result-value`).innerHTML = stat.newCurrent().toString();
        //chrHtml.querySelector(`.total-damage`).innerHTML = stat.totalDamage().toString();
        if (chrHtml.querySelector(`.current-mod`)) {
          chrHtml.querySelector(`.current-mod`).innerHTML = stat.original.mod.toString();
        }
        if (chrHtml.querySelector(`.mod`)) {
          chrHtml.querySelector(`.mod`).innerHTML = stat.newMod().toString();
        }
      }
    }

    if (this.stats.unallocatedHealing() !== 0) {
      this.html.querySelector(".unalocated-healing-text")?.classList.add("orange");
    } else {
      this.html.querySelector(".unalocated-healing-text")?.classList.remove("orange");
    }
    this.html.querySelector(".unalocated-healing").innerHTML = this.stats.unallocatedHealing().toString();
  }

  /**
   * @returns {void}
   */
  registerEventListeners() {
    this.html.querySelectorAll(".healing-input")?.forEach(el => {
      el.addEventListener('input', (ev) => {
        const stat = this.stats[ev.currentTarget.dataset.stat];
        // getNumericValueFromEvent handles validation and shows warnings immediately
        const value = this.getNumericValueFromEvent(ev, true);

        this.stats.edited = true;
        // Clamp value (should already be clamped by validation, but double-check)
        stat.healing = Math.clamp(value, 0, stat.original.damage);

        this.debouncedRefresh();
      });
    });
  }

  /**
   * @param {Event} ev
   * @param {boolean} upper
   * @returns {number}
   */
  getNumericValueFromEvent(ev, upper) {
    const value = parseInt(ev.currentTarget.value, 10);
    const newVal = isNaN(value) ? 0 : value;
    if (newVal < 0) {
      ui.notifications.warn("TWODSIX.Warnings.StatValBelowZero", {localize: true});
      ev.currentTarget.value = 0;
      return 0;
    }
    if (upper) {
      const stat = this.stats[ev.currentTarget.dataset.stat];
      const currentDamage = stat.original.damage;
      if (value > currentDamage) {
        ev.currentTarget.value = currentDamage;
        ui.notifications.warn("TWODSIX.Warnings.MaxStatVal", {localize: true});
        return currentDamage;
      }
    }
    return newVal;
  }

  /**
   * @returns {void}
   */
  unRegisterListeners() {
    Object.entries(this.hooks).forEach(([hookName, hook]) => Hooks.off(hookName, hook));
    // Cancel any pending debounced updates to prevent stale refresh after dialog closes
    if (this.debouncedRefresh?.cancel) {
      this.debouncedRefresh.cancel();
    }
    //this.html.removeEventListener('change', "**");
  }
}

/**
 * @param {object} healingeData
 * @returns {Promise<void>}
 */
export async function renderHealingDialog(healingeData) {
  const {healingId, healingValue, dice} = healingeData;
  let actor = healingeData.actor;
  if (!actor.uuid) {
    actor = await fromUuid(healingeData.targetUuid);
  }

  const actorUsersNonGM = game.users?.filter(user => user.active && actor && actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) && !user.isGM) || null;
  if ((game.user?.isGM && actorUsersNonGM?.length > 0) || (!game.user?.isGM && !actor.isOwner)) {
    return;
  }

  const template = 'systems/twodsix/templates/actors/healing-dialog.hbs';
  const stats = new Stats(actor, healingValue, dice);
  const healingDialogHandler = new HealingDialogHandler(stats);
  const renderedHtml = await foundry.applications.handlebars.renderTemplate(template, {stats: healingDialogHandler.stats});
  const title = game.i18n.format("TWODSIX.Healing.ApplyHealingTo", {actorName: actor.name});

  await foundry.applications.api.DialogV2.wait({
    window: {
      title: title,
      icon: "fa-solid fa-heart-circle-plus"
    },
    content: renderedHtml,
    buttons: [
      {
        action: "ok",
        label: "TWODSIX.Healing.ApplyHealing",
        icon: "fa-solid fa-kit-medical",
        default: true,
        callback: () => {
          stats.edited = true;
          stats.applyHealing();
          game.socket?.emit("system.twodsix", ["destroyHealingDialog", healingId]);
          Hooks.call("destroyHealingDialog", healingId);
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
    close: () => healingDialogHandler.unRegisterListeners(),
    render: (ev, html) => {
      healingDialogHandler.setHtml(html);
    },
    rejectClose: false
  }, {id: healingId});
}

/**
 * @param {string} healingId
 * @returns {void}
 */
export function destroyHealingDialog(healingId) {
  Object.values(ui.windows).forEach(foundryWindow => {
    if (foundryWindow instanceof Dialog && foundryWindow.id === healingId) {
      foundryWindow.close();
    }
  });
}
