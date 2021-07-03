// Add any additional hooks if necessary
Hooks.on('preCreateActor', async (actor) => {

  if (game.settings.get('twodsix', 'defaultTokenSettings')) {
    let link = false;
    let disposition:number = CONST.TOKEN_DISPOSITIONS.HOSTILE;

    if (actor.type === 'traveller') {
      link = true;
      disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
    }

    mergeObject(actor, {
      'token.displayName': CONST.TOKEN_DISPLAY_MODES.OWNER,
      'token.displayBars': CONST.TOKEN_DISPLAY_MODES.ALWAYS,
      'token.vision': true,
      'token.brightSight': 30,
      'token.dimSight': 0,
      'token.actorLink': link,
      'token.disposition': disposition,
      'token.bar1': {
        attribute: 'hits',
      }
    });
  }
});
