// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

Hooks.on("getSceneControlButtons", (controls) => {
  if (game.user.isGM) {
    controls.find((c) => c.name === "token").tools.push({
      name: "requestRoll",
      title: "TWODSIX.Chat.Roll.RequestRoll",
      icon: "fa-solid fa-dice",
      button: true,
      visible: game.user.isGM,
      onClick: async () => {
        console.log("Made it to Click!");
        await requestRoll();
      }
    });
  }
});

async function requestRoll(): Promise<void> {
  const selectedPlayers = await getSelectedPlayers();
  console.log(selectedPlayers);
  const allPlayerActorNames = await getAllPlayerActorNames();
  console.log(allPlayerActorNames);
  const skillsList = await getAllSkills();
  console.log(skillsList);
}

async function getSelectedPlayers(): Promise<string[]> {
  const tokens = canvas.tokens.controlled;
  const selectedPlayers = [];
  if (tokens.length > 0) {
    const activePlayers = await game.users.filter(user => !user.isGM && user.active );
    for (const player of activePlayers) {
      const matchingToken = await tokens.find((t) => t.actor.hasPlayerOwner && t.actor.ownership[player.id] === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER);
      if (matchingToken) {
        selectedPlayers.push(player.id);
      }
    }
  }
  return selectedPlayers;
}

async function getAllPlayerActorNames(): Promise<any> {
  const actorPlayerNames = {};
  const activePlayers = await game.users.filter(user => !user.isGM && user.active );
  for (const player of activePlayers) {
    const matchingActor = await game.actors.find( actor => actor.ownership[player.id] === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER);
    if (matchingActor) {
      Object.assign(actorPlayerNames, {[player.id]: matchingActor.name});
    }
  }
  return actorPlayerNames;
}

async function getAllSkills(): Promise<string[]> {
  const tokens = canvas.tokens.controlled;
  const returnValue = [];
  for (const token of tokens ) {
    for (const skill of token.actor.itemTypes.skills) {
      if (!returnValue.includes(skill.name)) {
        returnValue.push(skill.name);
      }
    }
  }
  returnValue.sort();
  return returnValue;
}




/*const newControl: SceneControl =
    {
      activeTool: "select",
      name: "gmTools",
      title: "TWODSIX.Chat.Roll.GMUtils",
      icon: "fa-solid fa-wand-magic",
      button: true,
      visible: game.user.isGM,
      layer: "tokens",
      tools: [
        {
          name: "requestRoll",
          title: "TWODSIX.Chat.Roll.RequestRoll",
          icon: "fa-solid fa-dice",
          button: true,
          visible: game.user.isGM,
          //layer: "gm-utils",
          onClick: async () => {
            console.log("Made it to Click!");
            requestRoll();
          }
        }
      ]
    };
    controls.push(newControl);*/
