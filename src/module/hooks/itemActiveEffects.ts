// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

Hooks.on("updateActiveEffect", (activeEffect, changes, options, userId: string) => {
  if (game.user.id === userId  && activeEffect.parent?.documentName === "Actor") {
    if (!changes.flags && !options.dontSync && game.settings.get('twodsix', 'useItemActiveEffects')) { //changes.flags condition needed, when??
      const itemActiveEffectId = activeEffect.getFlag("twodsix", "sourceId");
      if (itemActiveEffectId) {
        const match = activeEffect.origin?.match(/Item\.(.+)/);
        if (match) {
          const item = (<TwodsixActor>activeEffect.parent)?.items.get(match[1]);
          delete changes._id;
          const newEffects = item?.effects.map(effect => {
            if (effect.id === itemActiveEffectId) {
              return foundry.utils.mergeObject(effect.toObject(), changes);
            } else {
              return effect.toObject();
            }
          });
          item?.update({"effects": newEffects}, {recursive: true});
        }
      }
    }
  }
});
