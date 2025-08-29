// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import TwodsixItem from "./TwodsixItem";
import { getControlledTraveller } from "../sheets/TwodsixVehicleSheet";
import TwodsixActor from "./TwodsixActor";
import { TwodsixDiceRoll } from "../utils/TwodsixDiceRoll";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import { TWODSIX } from "../config";

/**
 * The sidebar chat tab.
 * @extends {ChatLog}
 * @mixes HandlebarsApplication
 */
export class TwodsixChatLog extends foundry.applications.sidebar.tabs.ChatLog {
  static onChatCardAction: any;
  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    applicationOptions.actions = assignNewActions(applicationOptions.actions);
    return applicationOptions;
  }

  /**
   * Get context menu entries for chat messages in the log.
   * @returns {ContextMenuEntry[]}
   * @inheritDoc
   */
  _getEntryContextOptions():ContextMenuEntry[] {
    const options:ContextMenuEntry[] = super._getEntryContextOptions();
    return newContextOptions(options);
  }
}

/**
 * The chat popout
 * @extends {ChatPopout}
 *
 */
export class TwodsixChatPopout extends foundry.applications.sidebar.apps.ChatPopout {
  /** @inheritDoc */
  _initializeApplicationOptions(options) {
    const applicationOptions = super._initializeApplicationOptions(options);
    applicationOptions.actions = assignNewActions(applicationOptions.actions);
    Object.assign(applicationOptions.actions, {expandRoll: onExpandRoll});
    return applicationOptions;
  }

  /**
   * Get context menu entries for chat messages in the log.
   * @returns {ContextMenuEntry[]}
   * @inheritDoc
   */
  _getEntryContextOptions():ContextMenuEntry[] {
    const options:ContextMenuEntry[] = super._getEntryContextOptions();
    return newContextOptions(options);
  }
}

/** Function that adds custom chat card buttons to action object
* @param {Partial<Configuration>} coreActions
* @returns {Partial<Configuration>} object of actions links
*/
function assignNewActions(coreActions:Partial<Configuration>):Partial<Configuration> {
  return Object.assign(coreActions, {
    opposed: onChatCardAction,
    chain: onChatCardAction,
    expand: onChatCardAction,
    abilityCheck: onChatCardAction,
    damage: onChatCardAction
  });
}

/** Function that adds chat card context
* @param {ContextMenuEntry[]} coreContext
* @returns {ContextMenuEntry[]} object of context
*/
function newContextOptions(coreContext:ContextMenuEntry[] ):ContextMenuEntry[]  {
  const canApply = li => {
    const message = game.messages.get(li.dataset?.messageId);
    return message?.isRoll && message?.isContentVisible && canvas.tokens?.controlled.length;
  };
  coreContext.push(
    {
      name: game.i18n.localize("TWODSIX.Chat.Roll.ApplyDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 1)
    },
    {
      name: game.i18n.localize("TWODSIX.Chat.Roll.ApplyDestructiveDamage"),
      icon: '<i class="fas fa-user-injured"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 10)
    },
    {
      name: game.i18n.localize("TWODSIX.Chat.Roll.ApplyReducedDamage"),
      icon: '<i class="fas fa-user-shield"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, 0.1)
    },
    {
      name: game.i18n.localize("TWODSIX.Chat.Roll.ApplyHealing"),
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: li => applyChatCardDamage(li, -1)
    }
  );
  return coreContext;
}

/**
   * Handle execution of a chat card action via a click event on one of the card buttons
   * @param {Event} event       The originating click event
   * @param {HTMLElement} target Click Target
   * @returns {Promise}         A promise which resolves once the handler workflow is complete
   * @private
   */
export async function onChatCardAction(event: Event, target:HTMLElement): Promise<any> {
  event.preventDefault();
  //console.log(target);

  // Extract card data
  const button = target;
  //button.disabled = true;
  const messageId = target.closest("[data-message-id]")?.dataset.messageId;
  const message = game.messages.get(messageId);
  if (!message) {
    return;
  }
  const action = button.dataset.action;

  // Handle different actions
  if (action === "expand") {
    onExpandClick(message);
    return;
  } else if (action === "abilityCheck") {
    makeRequestedRoll(message);
    return;
  } else {
    // Recover the actor for the chat card
    const actor = await getChatCardActor(message);
    if (!actor) {
      return;
    }

    // Validate permission to proceed with the roll
    const isTargettedAction = ["chain", "opposed"].includes(action);
    if (!(isTargettedAction || game.user.isGM || actor.isOwner)) {
      return;
    }
    // Get the Item from stored flag data
    const storedData = message.getFlag("twodsix", "itemUUID");
    const item: TwodsixItem = storedData ? await fromUuid(storedData) : {};
    if (!item) {
      const err = game.i18n.format("DND5E.ActionWarningNoItem", { item: card.dataset.itemId, name: actor.name });
      return ui.notifications.error(err);
    }

    const useInvertedShiftClick: boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showFormulaDialog = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
    const bonusDamage: string = message.getFlag("twodsix", "bonusDamage");
    const effect = message.getFlag("twodsix", "effect") ?? 0;
    const addEffect: boolean = game.settings.get('twodsix', 'addEffectToDamage');
    let totalBonusDamage = addEffect ? `${effect}` : ``;
    if (bonusDamage !== "0" && bonusDamage !== "") {
      totalBonusDamage += ((addEffect) ? ` + ` : ``) + `${bonusDamage}`;
    }
    switch (action) {
      case "damage":
        await item.rollDamage((<DICE_ROLL_MODES>game.settings.get('core', 'rollMode')), totalBonusDamage, true, showFormulaDialog);
        break;
      case "opposed":
        //opposed roll
        makeSecondaryRoll(message, "opposed", showFormulaDialog);
        break;
      case "chain":
        //chain roll
        makeSecondaryRoll(message, "chain", showFormulaDialog);
        break;
      default:
        break;
    }
  }
}

/**
 * Apply rolled dice damage to the token or tokens which are currently controlled.
 *
 * @param {HTMLElement} li      The chat entry which contains the roll data
 * @param {number} multiplier   A damage multiplier to apply to the rolled damage.
 * @returns {Promise|undefined}
 */
function applyChatCardDamage(li:HTMLElement, multiplier:number): Promise<any>|undefined {
  const message = game.messages.get(li.dataset?.messageId);
  const transfer = message.getFlag('twodsix', 'transfer') ? JSON.parse(message.getFlag('twodsix', 'transfer')) : undefined;
  const effect = transfer?.payload.damageValue ?? message.getFlag('twodsix', 'effect') ?? message.rolls[0].total;
  if (effect > 0) {
    return Promise.all(canvas.tokens.controlled.map(t => {
      if (["traveller", "robot", "animal"].includes(t.actor.type)) {
        const damage = Math.floor(effect * multiplier);
        if (damage > 0) {
          (<TwodsixActor>t.actor).damageActor({damageValue: damage, armorPiercingValue: transfer?.payload.armorPiercingValue ?? 0, damageType: transfer?.payload.damageType ?? "", dice: transfer?.payload.dice }, true);
        } else if (multiplier < 0) {
          t.actor.healActor(effect);
        }
      } else {
        ui.notifications.warn("TWODSIX.Warnings.CantAutoDamage", {localize: true});
      }
    }));
  } else {
    ui.notifications.warn("TWODSIX.Warnings.NoDamageToApply", {localize: true});
  }
}

/* -------------------------------------------- */

/**
 * Get the Actor which is the author of a chat card
 * @param {ChatMessage} message    The chat card being used
 * @returns {Actor|null}        The Actor document or null
 * @private
 */
async function getChatCardActor(message: ChatMessage): Actor | null {
  const actor: TwodsixActor = await fromUuid(message.getFlag("twodsix", "actorUUID"));
  if (actor) {
    return actor;
  } else {
    return null;
  }
}

/* -------------------------------------------- */

/** Handle clicking of dice tooltip buttons
  * @param {Event} event
  * @private
  */
async function onExpandClick(message: ChatMessage) {
  // Toggle the message flag

  if (message.flavor.includes('class="dice-chattip" style="display:none"')) {
    message.update({ flavor: message.flavor.replace('class="dice-chattip" style="display:none"', 'class="dice-chattip" style="display:contents"') });
  } else {
    message.update({ flavor: message.flavor.replace('class="dice-chattip" style="display:contents"', 'class="dice-chattip" style="display:none"') });
  }
}
/**
 * Make second skill roll from chat card
 * @param {ChatMessage} message    The originating message
 * @param {string} type The type of decondary roll, chain or opposed
 * @param {boolean} showDialog whether or not to show skill roll dialog
 * @returns {Promise<void>}
 */
async function makeSecondaryRoll(message: ChatMessage, type: string, showDialog: boolean): Promise<void> {
  const secondActor: TwodsixActor = getControlledTraveller();
  if (!secondActor) {
    ui.notifications.warn("TWODSIX.Warnings.NoActorSelected", {localize: true});
    return;
  }

  const skillList = secondActor.getSkillNameList();
  const selectedSkillUuid = await skillDialog(skillList);
  const originalEffect = message.getFlag("twodsix", "effect");
  if (selectedSkillUuid === false) {
    return;
  } else if (selectedSkillUuid === "") {
    ui.notifications.warn("TWODSIX.Warnings.NoSkillSelected", {localize: true});
    return;
  }
  const selectedSkill: TwodsixItem = await fromUuid(selectedSkillUuid);
  const tempSettings = {};
  switch (type) {
    case "opposed":
      Object.assign(tempSettings, {
        extraFlavor: game.i18n.localize("TWODSIX.Rolls.MakesOpposedRoll")
      });
      break;
    case "chain":
      Object.assign(tempSettings, {
        extraFlavor: game.i18n.localize("TWODSIX.Rolls.MakesChainRoll"),
        rollModifiers: { chain: getChainRollBonus(originalEffect) }
      });
      break;
    default:
      break;
  }
  const settings: TwodsixRollSettings = await TwodsixRollSettings.create(showDialog, tempSettings, selectedSkill, undefined, <TwodsixActor>secondActor);
  if (!settings.shouldRoll) {
    return;
  }
  const roll: TwodsixDiceRoll = await selectedSkill.skillRoll(showDialog, settings, true);
  let winnerName = "";
  if (roll && type === "opposed") {
    if (originalEffect > roll.effect) {
      winnerName = (await fromUuid(message.getFlag("twodsix", "actorUUID"))).name;
    } else if (roll.effect > originalEffect) {
      winnerName = secondActor.name;
    }
    if (winnerName === "") {
      ChatMessage.create({ content: game.i18n.localize("TWODSIX.Chat.Roll.TiedRoll"), speaker: ChatMessage.getSpeaker({ actor: secondActor }) });
    } else {
      ChatMessage.create({ content: `${winnerName} ${game.i18n.localize("TWODSIX.Chat.Roll.WinsRoll")}`, speaker: ChatMessage.getSpeaker({ actor: secondActor }) });
    }
  }

}

/**
 * Prompt for skill from actor. Returns selected skill's uuid
 * @param {object} skillList    list of skill uuid and name pairs
 * @returns {string|boolean} the uuid of the selected skill item or flase for cancelled action
 */
async function skillDialog(skillList: object): Promise<string|boolean> {
  let returnValue = "";
  let options = ``;
  for (const [key, value] of Object.entries(skillList)) {
    options += `<option value="${key}">${value}</option>`;
  }
  const select = `<select name="item-select">${options}</select>`;
  const content = `<form><div class="form-group"><label>${game.i18n.localize("TWODSIX.Rolls.SkillName")} (${game.i18n.localize("TWODSIX.Actor.Skills.Level")}): ${select}</label></div></form>`;

  const buttons = [
    {
      action: "ok",
      label: "TWODSIX.Rolls.SelectSkill",
      icon: "fa-solid fa-list",
      default: true,
      callback: (event, button, dialog) => {
        returnValue = dialog.element.querySelector("select[name='item-select']").value;
      }
    },
    {
      action: "cancel",
      icon: "fa-solid fa-xmark",
      label: "Cancel",
      callback: () => {
        returnValue = false;
      }
    }
  ];

  return new Promise<void>((resolve) => {
    new foundry.applications.api.DialogV2({
      window: {title: "TWODSIX.Rolls.SelectSkill"},
      content: content,
      buttons: buttons,
      submit: () => {
        resolve(returnValue);
      },
    }).render({force: true});
  });
}
/**
 * Returns chain roll DM based on effect and string setting
 * @param {number} effect    effect from assisting / first roll
 * @returns {number} DM for second roll base on first roll
 */
function getChainRollBonus(effect: number): number {
  const ranges = game.settings.get('twodsix', 'chainBonus').split(",").map((str:string) => parseInt(str));
  if (ranges.length !== 6) {
    return 0;
  } else {
    if (effect <= -6) {
      return ranges[0];
    } else if (effect <= -2) {
      return ranges[1];
    } else if (effect === -1) {
      return ranges[2];
    } else if (effect === 0) {
      return ranges[3];
    } else if (effect <= 5) {
      return ranges[4];
    } else if (effect >= 6) {
      return ranges[5];
    }
  }
}

/**
 * Makes roll per chat message flag settings using default actor
 * @param {ChatMessage} message    clicked Chat message
 */
async function makeRequestedRoll(message: ChatMessage): void {
  const messageSettings = message.getFlag("twodsix", "rollSettings");
  const tmpSettings = {
    difficulty: messageSettings.difficulty,
    rollType: messageSettings.rollType,
    rollMode: messageSettings.rollMode,
    itemRoll: messageSettings.itemId !== "NONE",
    skillName: messageSettings.skillName,
    skillRoll: messageSettings.skillName !== "---" || messageSettings.itemId !== "NONE",
    rollModifiers: {
      characteristic: messageSettings.characteristic || "NONE",
      other: messageSettings.other
    }
  };
  const rollingActorsUuids = messageSettings.userActorList[game.user.id];
  if (rollingActorsUuids?.length > 0) {
    for (const actorUuid of rollingActorsUuids) {
      const actor:TwodsixActor = fromUuidSync(actorUuid);
      const selectedSkill:TwodsixItem = messageSettings.skillName !== "---" ? await actor.items.find((it) => it.name === messageSettings.skillName && it.type === "skills") ?? actor.items.get(actor.system.untrainedSkill) : undefined;
      if (messageSettings.itemId && messageSettings.itemId !== "NONE") {
        //Item Rolls
        const item:TwodsixItem = actor.items.get(messageSettings.itemId) ?? actor.items.getName(messageSettings.itemName);
        if (item) {
          if (item.type === "weapon") {
            // Set skill uuid if one is selected
            if (selectedSkill) {
              tmpSettings.rollModifiers.selectedSkill = selectedSkill.uuid;
            }
            await item.resolveUnknownAutoMode(true, tmpSettings);
          } else {
            const rollSettings = await TwodsixRollSettings.create(false, tmpSettings, selectedSkill, item, actor);
            await item.doSkillTalentRoll(false, rollSettings);
          }
        } else {
          //Cannot find item on actor
          ui.notifications.warn("TWODSIX.Warnings.CantFindItemOnActor", {localize: true});
        }
      } else {
        // Handle skill/characteristic rolls
        let selectedCharacteristic = messageSettings.characteristic !== "---" ? messageSettings.characteristic : "NONE";
        if (selectedSkill && selectedCharacteristic === "NONE") {
          selectedCharacteristic = selectedSkill.system.characteristic ?? "NONE";
        }
        tmpSettings.rollModifiers.characteristic = selectedCharacteristic;
        const rollSettings = await TwodsixRollSettings.create(false, tmpSettings, selectedSkill, undefined, actor);
        if (rollSettings.shouldRoll) {
          const diceRoll = new TwodsixDiceRoll(rollSettings, actor);
          await diceRoll.evaluateRoll();
          diceRoll.sendToChat(TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')]);
        }
      }
    }
  }
}

/**
 * Handle toggling the expanded state of a roll breakdown.
 * @this {ChatLog}
 * @type {ApplicationClickAction}
 */
function onExpandRoll(event, target) {
  event.preventDefault();
  target.classList.toggle("expanded");
}
