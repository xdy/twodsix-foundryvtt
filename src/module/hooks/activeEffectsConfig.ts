// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on(`renderActiveEffectConfig`, (app, _html, _data) => {
  app.setPosition({width: 700});
});
