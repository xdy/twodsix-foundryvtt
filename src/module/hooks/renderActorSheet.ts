// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated

/*Hooks.on("renderActorSheet", (app, html, _data) => {
  if (app._priorState <= 0) {
    console.log('Details: ', html.find("details"));
    for (const detailItem of html.find("details")) {
      const toggleValue = detailItem.className === "attachment-list" ? game.settings.get('twodsix', 'showAttachmentsList') : game.settings.get('twodsix', 'showConsumablesList');
      if (!toggleValue) {
        detailItem.removeAttribute('open', toggleValue);
      } else {
        detailItem.setAttribute('open', toggleValue);
      }
    }
  }
});*/
