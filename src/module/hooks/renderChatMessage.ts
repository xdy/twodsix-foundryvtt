// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on('renderChatMessage', (app, html, msg) => {
  const damageMessage = html.find(".damage-message")[0];
  if (damageMessage) {
    damageMessage.setAttribute("draggable", "true");

    damageMessage.addEventListener('dragstart', ev => {
      return ev.dataTransfer.setData("text/plain", app.data.flags.transfer);
    });
  }
});
