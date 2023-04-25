// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import {TWODSIX} from "../config";
//import {DICE_ROLL_MODES} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import { TwodsixRollSettings, _genUntranslatedCharacteristicList } from "../utils/TwodsixRollSettings";
//import {getKeyByValue} from "./sheetUtils";
import { simplifySkillName } from "../utils/utils.ts";

Hooks.on("getSceneControlButtons", (controls) => {
  if (game.user.isGM) {
    controls.find((c) => c.name === "token").tools.push({
      name: "requestRoll",
      title: "TWODSIX.Chat.Roll.RequestRoll",
      icon: "fa-solid fa-dice",
      button: true,
      visible: game.user.isGM,
      onClick: async () => {
        await requestRoll();
      }
    });
  }
});

async function requestRoll(): Promise<void> {
  const selectedPlayers = await getSelectedPlayers();
  //console.log(selectedPlayers);
  const allPlayerActorNames = await getAllPlayerActorNames();
  //console.log(allPlayerActorNames);
  const skillsList = await getAllSkills();
  //console.log(skillsList);
  const samplePlayer = game.users.find(user => !user.isGM && user.active);
  if (samplePlayer) {
    const selections = await throwDialog(samplePlayer.character, skillsList, selectedPlayers, allPlayerActorNames);
    console.log(selections);
  } else {
    //no valid players
  }
}

async function getSelectedPlayers(): Promise<string[]> {
  const tokens = canvas.tokens.controlled;
  const selectedPlayers = [];
  if (tokens.length > 0) {
    const activePlayers = await game.users.filter(user => !user.isGM && user.active);
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
    //const matchingActor = await game.actors.find( actor => actor.ownership[player.id] === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER  && actor.type === "traveller");
    if (player.character) {
      Object.assign(actorPlayerNames, {[player.id]: player.character.name});
    }
  }
  return actorPlayerNames;
}

async function getAllSkills(): Promise<string[]> {
  const returnValue = {"NONE": ["---"]};
  let selectedActors = await canvas.tokens.controlled.map((t) => t.actor);
  if (selectedActors.length === 0) {
    selectedActors = await game.users.filter(user => !user.isGM && user.active).map((u) => u.character);
  }
  for (const actor of selectedActors) {
    for (const skill of actor.itemTypes.skills) {
      if (!(skill.name in returnValue)) {
        Object.assign(returnValue, { [simplifySkillName(skill.name)]: skill.name});
      }
    }
  }
  return returnValue;
}

async function throwDialog(actor:TwodsixActor, skillsList:string[], selectedPlayerIds:string[], allPlayerActorNames:any):Promise<void> {
  const template = 'systems/twodsix/templates/chat/request-roll-dialog.html';
  const dialogData = {
    initialPlayers: selectedPlayerIds,
    allPlayerActorNames: allPlayerActorNames,
    rollType: "Normal",
    rollTypes: TWODSIX.ROLLTYPES,
    difficulty: "Average",
    difficulties: TWODSIX.DIFFICULTIES[(<number>game.settings.get('twodsix', 'difficultyListUsed'))],
    skillsList: skillsList,
    rollMode: game.settings.get('core', 'rollMode'),
    rollModes: CONFIG.Dice.rollModes,
    characteristicList: _genUntranslatedCharacteristicList(),
    initialChoice: "NONE",
    initialSkill: "NONE",
  };
  const returnValue = {};
  const buttons = {
    ok: {
      label: game.i18n.localize("TWODSIX.Rolls.Roll"),
      icon: '<i class="fa-solid fa-dice"></i>',
      callback: (buttonHtml) => {
        returnValue.selectedPlayers = buttonHtml.find('[name="selectedPlayers"]').val();
        returnValue.difficulty = dialogData.difficulties[buttonHtml.find('[name="difficulty"]').val()];
        returnValue.rollType = buttonHtml.find('[name="rollType"]').val();
        returnValue.rollMode = buttonHtml.find('[name="rollMode"]').val();
        returnValue.characteristic = buttonHtml.find('[name="characteristic"]').val();
        returnValue.skillName = skillsList[buttonHtml.find('[name="selectedSkill"]').val()];
        returnValue.shouldRoll = true;
      }
    },
    cancel: {
      icon: '<i class="fa-solid fa-xmark"></i>',
      label: game.i18n.localize("Cancel"),
      callback: () => {
        returnValue.shouldRoll = false;
      }
    },
  };

  const html = await renderTemplate(template, dialogData);
  return new Promise<void>((resolve) => {
    new Dialog({
      title: game . i18n.localize("TWODSIX.Chat.Roll.RequestRoll"),
      content: html,
      buttons: buttons,
      default: 'ok',
      close: () => {
        resolve(returnValue);
      },
    }).render(true);
  });
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
