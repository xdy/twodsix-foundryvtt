// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

Hooks.on("getSceneControlButtons", (controls) => {
  if (game.user.isGM) {
    const newControl: SceneControl =
    {
      activeTool: "select",
      name: "gmTools",
      title: "TWODSIX.Chat.Roll.GMUtils",
      icon: "fa-solid fa-wand-magic",
      button: true,
      visible: game.user.isGM,
      layer: "controls",
      tools: [{
        name: "requestRoll",
        title: "TWODSIX.Chat.Roll.RequestRoll",
        icon: "fa-solid fa-dice",
        button: true,
        visible: game.user.isGM,
        //layer: "gm-utils",
        onClick: async () => {
          console.log("Made it to Click!");
        }
      }]
    };
    controls.push(newControl);
  }
});
