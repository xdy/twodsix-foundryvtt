//eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

Hooks.on("closeActiveEffectConfig", (activeEffectConfig, _changes, _options, _userId: string) => {
  if (activeEffectConfig.document.modifiesActor) {
    activeEffectConfig.document.target.sheet.render(false);
  }
});
