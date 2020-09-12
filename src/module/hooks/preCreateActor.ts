// Add any additional hooks if necessary
Hooks.on('preCreateActor', async (actor, dir) => {

  if (game.settings.get('twodsix', 'defaultTokenSettings')) {
    let link = true;
    let disposition = 1;

    if (actor.type !== 'traveller') {
      link = false;
      disposition = 0;
    }

    actor.token = actor.token || {};
    mergeObject(actor.token, {
      'token.displayName': CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      'token.displayBars': CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      vision: true,
      dimSight: 30,
      brightSight: 0,
      actorLink: link,
      disposition
    });
  }
});
