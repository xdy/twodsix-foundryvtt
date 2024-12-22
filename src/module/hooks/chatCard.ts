// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

Hooks.on("renderChatLog", (_app, htmlElement, _data) => {
  const html = $(htmlElement);
  html.on("click", ".item-name", onChatCardToggleContent);
});
Hooks.on("renderChatPopout", (_app, htmlElement, _data) => {
  const html = $(htmlElement);
  html.on("click", ".item-name", onChatCardToggleContent);
});

/* -------------------------------------------- */
/*  Chat Message Helpers                        */
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
