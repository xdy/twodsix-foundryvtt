// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import TwodsixItem from "../entities/TwodsixItem";
//import ItemTemplate from "../utils/ItemTemplate";
import { getControlledTraveller } from "../sheets/TwodsixVehicleSheet";
import TwodsixActor from "../entities/TwodsixActor";
import { TwodsixDiceRoll } from "../utils/TwodsixDiceRoll";
import { TwodsixRollSettings } from "../utils/TwodsixRollSettings";
import { TWODSIX } from "../config";

Hooks.on("renderChatLog", (_app, html, _data) => {
  html.on("click", ".card-buttons button", onChatCardAction);
  html.on("click", ".item-name", onChatCardToggleContent);
});
Hooks.on("renderChatPopout", (_app, html, _data) => {
  html.on("click", ".card-buttons button", onChatCardAction);
  html.on("click", ".item-name", onChatCardToggleContent);
});

/* -------------------------------------------- */
/*  Chat Message Helpers                        */
/* -------------------------------------------- */

/**
 * Apply listeners to chat messages.
 * @param {HTML} html  Rendered chat message.
 */
/*static function chatListeners(html) {
  html.on("click", ".card-buttons button", onChatCardAction.bind(this));
  html.on("click", ".item-name", onChatCardToggleContent.bind(this));
}*/
/* -------------------------------------------- */

/**
 * Handle execution of a chat card action via a click event on one of the card buttons
 * @param {Event} event       The originating click event
 * @returns {Promise}         A promise which resolves once the handler workflow is complete
 * @private
 */
async function onChatCardAction(event: Event): Promise<any> {
  event.preventDefault();

  // Extract card data
  const button = event.currentTarget;
  //button.disabled = true;
  const messageId = event.target.closest("[data-message-id]")?.dataset.messageId;
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
    if ( !actor ) {
      return;
    }

    // Validate permission to proceed with the roll
    const isTargettedAction = ["chain", "opposed"].includes(action);
    if ( !( isTargettedAction || game.user.isGM || actor.isOwner ) ) {
      return;
    }
    // Get the Item from stored flag data
    const storedData = message.getFlag("twodsix", "itemUUID");
    const item:TwodsixItem = storedData ? await fromUuid(storedData) : {};
    if ( !item ) {
      const err = game.i18n.format("DND5E.ActionWarningNoItem", {item: card.dataset.itemId, name: actor.name});
      return ui.notifications.error(err);
    }

    const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
    const showFormulaDialog = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
    const bonusDamage:string = message.getFlag("twodsix", "bonusDamage");
    const effect = message.getFlag("twodsix", "effect") ?? 0;
    const totalBonusDamage = (bonusDamage !== "0" && bonusDamage !== "") ? `${effect} + ${bonusDamage}` : `${effect}`;
    switch ( action ) {
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

/* -------------------------------------------- */

/**
 * Handle toggling the visibility of chat card content when the name is clicked
 * @param {Event} event   The originating click event
 * @private
 */
function onChatCardToggleContent(event: Event) {
  event.preventDefault();
  const header = event.currentTarget;
  const card = header.closest(".chat-card");
  if (card) { //Check needed for MEJ Messages
    const content = card.querySelector(".card-content");
    content.style.display = content.style.display === "none" ? "block" : "none";
  }
}

/* -------------------------------------------- */

/**
 * Get the Actor which is the author of a chat card
 * @param {ChatMessage} message    The chat card being used
 * @returns {Actor|null}        The Actor document or null
 * @private
 */
async function getChatCardActor(message:ChatMessage): Actor | null {
  const actor:TwodsixActor = await fromUuid(message.getFlag("twodsix", "actorUUID"));
  if (actor) {
    return actor;
  } else {
    return null;
  }
}

/* -------------------------------------------- */

/**
 * Get the Actor which is the author of a chat card
 * @param {HTMLElement} card    The chat card being used
 * @returns {Token[]}            An Array of Token documents, if any
 * @private
 */
/*function getChatCardTargets(): Token[] {
  let targets = canvas.tokens.controlled.filter(t => !!t.actor);
  if ( !targets.length && game.user.character ) {
    targets = targets.concat(game.user.character.getActiveTokens());
  }
  if ( !targets.length ) {
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.ActionWarningNoToken"));
  }
  return targets;
}*/

/** Handle clicking of dice tooltip buttons
  * @param {Event} event
  * @private
  */
async function onExpandClick(message:ChatMessage) {
  // Toggle the message flag

  if (message.flavor.includes('class="dice-chattip" style="display:none"')) {
    message.update({flavor: message.flavor.replace('class="dice-chattip" style="display:none"', 'class="dice-chattip" style="display:contents"')});
  } else {
    message.update({flavor: message.flavor.replace('class="dice-chattip" style="display:contents"', 'class="dice-chattip" style="display:none"')});
  }
}
/**
 * Make second skill roll from chat card
 * @param {ChatMessage} message    The originating message
 * @param {string} type The type of decondary roll, chain or opposed
 * @param {boolean} showDialog whether or not to show skill roll dialog
 * @returns {void}
 */
async function makeSecondaryRoll(message:ChatMessage, type:string, showDialog:boolean): Promise<void> {
  const secondActor:TwodsixActor = getControlledTraveller();
  if (!secondActor) {
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoActorSelected"));
    return;
  }

  const skillList = await secondActor.getSkillNameList();
  const selectedSkillUuid = await skillDialog(skillList);
  const originalEffect = message.getFlag("twodsix", "effect");
  if (selectedSkillUuid === "") {
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.NoSkillSelected"));
    return;
  }
  const selectedSkill:TwodsixItem = await fromUuid(selectedSkillUuid);
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
        rollModifiers: {chain: getChainRollBonus(originalEffect)}
      });
      break;
    default:
      break;
  }
  const settings:TwodsixRollSettings = await TwodsixRollSettings.create(showDialog, tempSettings, selectedSkill, undefined, <TwodsixActor>secondActor);
  if (!settings.shouldRoll) {
    return;
  }
  const roll:TwodsixDiceRoll = await selectedSkill.skillRoll(showDialog, settings, true);
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
 * @returns {string} the uuid of the selected skill item
 */
async function skillDialog(skillList:object):Promise<string> {
  let returnValue = "";
  let options = ``;
  for (const [key, value] of Object.entries(skillList)) {
    options += `<option value="${key}">${value}</option>`;
  }
  const select = `<select name="item-select">${options}</select>`;
  const content = `<form><div class="form-group"><label>${game.i18n.localize("TWODSIX.Rolls.SkillName")} (${game.i18n.localize("TWODSIX.Actor.Skills.Level")}): ${select}</label></div></form>`;

  const buttons = {
    ok: {
      label: game.i18n.localize("TWODSIX.Rolls.SelectSkill"),
      icon: '<i class="fa-solid fa-list"></i>',
      callback: async (htmlObject) => {
        const skillId = htmlObject[0].querySelector("select[name='item-select']").value;
        returnValue = skillId;
      }
    },
    cancel: {
      icon: '<i class="fa-solid fa-xmark"></i>',
      label: game.i18n.localize("Cancel"),
      callback: () => {
        returnValue = '';
      }
    },
  };

  return new Promise<void>((resolve) => {
    new Dialog({
      title: game.i18n.localize("TWODSIX.Rolls.SelectSkill"),
      content: content,
      buttons: buttons,
      default: 'ok',
      close: () => {
        resolve(returnValue);
      },
    }).render(true);
  });
}
/**
 * Returns chain roll DM based on effect and rileset
 * @param {number} effect    effect from assisting / first roll
 * @returns {number} DM for second roll base on first roll
 */
function getChainRollBonus(effect:number): number {
  let ranges = {};
  switch (game.settings.get("twodsix", "ruleset")) {
    case "OTHER": //MgT2
      ranges ={"-6": -3, "-5 to -2": -2, "-1": -1, "0": 1, "1 to 5": 2, "6+": 3};
      break;
    case "CLASSIC": //Traveller SRD
      ranges ={"-6": -3, "-5 to -2": -2, "-1": -1, "0": 0, "1 to 5": 1, "6+": 2};
      break;
    case "CE":
      ranges ={"-6": -2, "-5 to -2": -1, "-1": -1, "0": 1, "1 to 5": 1, "6+": 2};
      break;
    case "CLU":
    case "CD":
      return (effect < 0 ? 0 : 1);
    case "CEFTL":
    case "CEATOM":
    case "CL":
    case "BARBARIC":
    case "SOC":
      return 0;
  }

  if (effect <= -6) {
    return ranges["-6"];
  } else if (effect <= -2) {
    return ranges["-5 to -2"];
  } else if (effect === -1) {
    return ranges["-1"];
  } else if (effect === 0) {
    return ranges["0"];
  } else if (effect <= 5) {
    return ranges["1 to 5"];
  } else if (effect >= 6) {
    return ranges["6+"];
  }
}

/**
 * Makes roll per chat message flag settings using default actor
 * @param {ChatMessage} message    clicked Chat message
 */
async function makeRequestedRoll(message:ChatMessage):void {
  const messageSettings = message.getFlag("twodsix", "rollSettings");
  const tmpSettings = {
    difficulty: messageSettings.difficulty,
    rollType: messageSettings.rollType,
    rollMode: messageSettings.rollMode,
    skillRoll: messageSettings.skillName !== "---",
    rollModifiers: {
      characteristic: "NONE",
      other: messageSettings.other
    }
  };
  const rollingActorsUuids = messageSettings.userActorList[game.user.id];

  for (const actorUuid of rollingActorsUuids) {
    const actor = <TwodsixActor>fromUuidSync(actorUuid);
    const selectedSkill = messageSettings.skillName !== "---" ? await actor.items.find((it) => it.name === messageSettings.skillName && it.type === "skills")  ?? actor.items.get(actor.system.untrainedSkill) : undefined;
    let selectedCharacteristic = messageSettings.characteristic !== "---" ? messageSettings.characteristic : "NONE";
    if (selectedSkill && selectedCharacteristic === "NONE") {
      selectedCharacteristic = selectedSkill.system.characteristic ?? "NONE";
    }
    tmpSettings.rollModifiers.characteristic = selectedCharacteristic;
    const rollSettings = await TwodsixRollSettings.create(false, tmpSettings, selectedSkill, undefined, actor);
    if (rollSettings.shouldRoll) {
      const diceRoll = new TwodsixDiceRoll(rollSettings, actor);
      diceRoll.sendToChat(TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))]);
    }
  }
}
