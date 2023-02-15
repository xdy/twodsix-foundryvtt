// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import TwodsixItem from "../entities/TwodsixItem";

Hooks.on("renderChatLog", (app, html, data) => {
  html.on("click", ".card-buttons button", onChatCardAction);
  html.on("click", ".item-name", onChatCardToggleContent);
});
Hooks.on("renderChatPopout", (app, html, data) => {
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

  // Recover the actor for the chat card
  const actor = await getChatCardActor(message);
  if ( !actor ) {
    return;
  }

  // Validate permission to proceed with the roll
  const isTargetted = action === "save";
  if ( !( isTargetted || game.user.isGM || actor.isOwner ) ) {
    return;
  }
  // Get the Item from stored flag data
  const storedData = message.getFlag("twodsix", "itemUUID");
  const item:TwodsixItem = storedData ? await fromUuid(storedData) : {};
  if ( !item ) {
    const err = game.i18n.format("DND5E.ActionWarningNoItem", {item: card.dataset.itemId, name: actor.name});
    return ui.notifications.error(err);
  }

  // Handle different actions
  let targets;
  const useInvertedShiftClick:boolean = (<boolean>game.settings.get('twodsix', 'invertSkillRollShiftClick'));
  const showFormulaDialog = useInvertedShiftClick ? event["shiftKey"] : !event["shiftKey"];
  const bonusDamage:string = message.getFlag("twodsix", "bonusDamage");
  const effect = message.getFlag("twodsix", "effect") ?? 0;
  const totalBonusDamage = (bonusDamage !== "0" && bonusDamage !== "") ? `${effect} + ${bonusDamage}` : `${effect}`;
  switch ( action ) {
    case "attack":
      break;
    case "damage":
      await item.rollDamage((<DICE_ROLL_MODES>game.settings.get('core', 'rollMode')), totalBonusDamage, true, showFormulaDialog);
      break;
    case "versatile":
      break;
    case "formula":
    case "save":
      targets = getChatCardTargets();
      for ( const token of targets ) {
        const speaker = ChatMessage.getSpeaker({scene: canvas.scene, token: token.document});
        await token.actor.rollAbilitySave(button.dataset.ability, { event, speaker });
      }
      break;
    case "toolCheck":
      await item.rollToolCheck({event}); break;
    case "placeTemplate":
      try {
        await ItemTemplate.fromItem(item)?.drawPreview();
      } catch(err) {/*blank*/}
      break;
    case "abilityCheck":
      targets = getChatCardTargets();
      for ( const token of targets ) {
        const speaker = ChatMessage.getSpeaker({scene: canvas.scene, token: token.document});
        await token.actor.rollAbilityTest(button.dataset.ability, { event, speaker });
      }
      break;
    case "expand":
      onExpandClick(event);
      break;
  }

  // Re-enable the button
  //button.disabled = false;
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
  const content = card.querySelector(".card-content");
  content.style.display = content.style.display === "none" ? "block" : "none";
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
function getChatCardTargets(): Token[] {
  let targets = canvas.tokens.controlled.filter(t => !!t.actor);
  if ( !targets.length && game.user.character ) {
    targets = targets.concat(game.user.character.getActiveTokens());
  }
  if ( !targets.length ) {
    ui.notifications.warn(game.i18n.localize("DND5E.ActionWarningNoToken"));
  }
  return targets;
}

/** Handle clicking of dice tooltip buttons
  * @param {Event} event
  * @private
  */
function onExpandClick(event: Event) {
  event.preventDefault();

  // Toggle the message flag
  const roll = event.currentTarget;
  //message._rollExpanded = !message._rollExpanded;

  // Expand or collapse chattips
  const chattips = roll.querySelectorAll(".dice-chattip");
  for ( const tip of chattips ) {
    if ( $(tip).css("display") !== "none" ) {
      //$(tip).slideDown(200);
      $(tip).css("display", "none");
    } else {
      //$(tip).slideUp(200);
      $(tip).css("display", "contents");
    }
    //tip.classList.toggle("expanded", message._rollExpanded);
  }
}
