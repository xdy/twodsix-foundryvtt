// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import {TWODSIX} from "../config";
//import {DICE_ROLL_MODES} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import { _genUntranslatedCharacteristicList } from "../utils/TwodsixRollSettings";
//import {getKeyByValue} from "./sheetUtils";
import { simplifySkillName, sortObj } from "../utils/utils.ts";

Hooks.on("getSceneControlButtons", (controls) => {
  if (game.user.isGM) {
    controls.find((c) => c.name === "token").tools.push({
      name: "requestRoll",
      title: "TWODSIX.Chat.Roll.RequestRoll" + (game.settings.get("core", "showToolclips") ? "Clip" : ""),
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
  const tokenData = getSelectedTokenData();
  const skillsList = await getAllSkills();
  if (Object.keys(tokenData).length > 0) {
    const selections = await throwDialog(skillsList, tokenData);
    if (selections.shouldRoll) {
      selections.userActorList = getUserActorList(selections, tokenData);
      let flavor = `<section>${game.i18n.localize("TWODSIX.Chat.Roll.GMRequestsRoll")}<section>`;
      if (selections.skillName !== "---") {
        flavor = flavor.replace("_TYPE_", selections.skillName);
      } else if (selections.characteristic !== "NONE") {
        flavor = flavor.replace("_TYPE_", selections.characteristic);
      } else {
        flavor = flavor.replace("_TYPE_", game.i18n.localize("TWODSIX.Chat.Roll.normal"));
      }
      flavor += `<section class="card-buttons"><button data-action="abilityCheck" data-tooltip="${game.i18n.localize("TWODSIX.Chat.Roll.AbilityCheck")}"><i class="fa-solid fa-dice"></i></button><section>`;
      ChatMessage.create({
        flavor: flavor,
        flags: {
          twodsix: {
            rollSettings: selections
          }
        },
        whisper: Object.keys(selections.userActorList)
      });
    }
  } else {
    //no valid players
  }
}

function getUserActorList (selections:any, tokenData:any): any {
  //Note that unlinked token.actor uuid's are links to token not actor.
  const returnData = {};
  for (const tokenId of selections.selectedTokens) {
    if (tokenData[tokenId].userId ) {
      if (tokenData[tokenId].userId in returnData) {
        returnData[tokenData[tokenId].userId].push(tokenData[tokenId].token.actor.uuid);
      } else {
        returnData[tokenData[tokenId].userId] = [tokenData[tokenId].token.actor.uuid];
      }
    }
  }
  return returnData;
}

async function getAllSkills(): Promise<object> {
  const skillList = {};
  let selectedActors = await canvas.tokens.controlled.map((t) => t.actor);
  if (selectedActors.length === 0) {
    selectedActors = await game.users.filter(user => !user.isGM && user.active).map((u) => u.character);
  }
  for (const actor of selectedActors) {
    for (const skill of actor.itemTypes.skills) {
      if (!(simplifySkillName(skill.name) in skillList)) {
        Object.assign(skillList, { [simplifySkillName(skill.name)]: skill.name});
      }
    }
  }
  const sortedSkills = sortObj(skillList);
  return {"NONE": "---", ...sortedSkills};
}

async function throwDialog(skillsList:string[], tokenData:any):Promise<any> {
  const template = 'systems/twodsix/templates/chat/request-roll-dialog.html';
  const tokenNames = {};
  for (const tokenId in tokenData) {
    tokenNames[tokenId] = tokenData[tokenId].token.name ?? tokenData[tokenId].token.actor.name;
  }
  const dialogData = {
    initialTokens: Object.keys(tokenData),
    allTokenNames: tokenNames,
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
    other: 0
  };
  const returnValue = {};
  const buttons = {
    ok: {
      label: game.i18n.localize("TWODSIX.Chat.Roll.RequestRoll"),
      icon: '<i class="fa-solid fa-message"></i>',
      callback: (buttonHtml) => {
        returnValue.selectedTokens = buttonHtml.find('[name="selectedTokens"]').val();
        returnValue.difficulty = dialogData.difficulties[buttonHtml.find('[name="difficulty"]').val()];
        returnValue.rollType = buttonHtml.find('[name="rollType"]').val();
        returnValue.rollMode = buttonHtml.find('[name="rollMode"]').val();
        returnValue.characteristic = buttonHtml.find('[name="characteristic"]').val();
        returnValue.skillName = skillsList[buttonHtml.find('[name="selectedSkill"]').val()];
        returnValue.shouldRoll = returnValue.selectedTokens.length > 0;
        returnValue.other = parseInt(buttonHtml.find('[name="other"]').val());
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

function getSelectedTokenData(): any {
  const returnValue = {};
  const validTokens = canvas.tokens.controlled.filter((t) => ["traveller", "animal", "robot"].includes(t.actor.type));
  for (const token of validTokens) {
    returnValue[token.id] = {
      userId: getControllingUser(token),
      token: token,
    };
  }
  return returnValue;
}

function getControllingUser(token:Token): string {
  let userId = "";
  const owningUsers = game.users.filter((user) => !user.isGM && user.active && (token.actor.ownership[user.id] === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER || (token.actor.ownership.default === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER  && !(user.id in token.actor.ownership))));
  if (owningUsers.length > 1) {
    const characterUser = owningUsers.find((user) => user.character.id === token.actor.id);
    if (characterUser) {
      userId = characterUser.id;
    } else {
      const randomSelection = new Roll("1d@length - 1", {length: owningUsers.length}).evaluate({async: false}).total;
      userId = owningUsers[randomSelection].id;
    }
  } else if (owningUsers.length === 1) {
    userId = owningUsers[0].id;
  } else {
    userId = game.users.find((user) => user.isGM && user.active && token.actor.ownership[user.id] === CONST.DOCUMENT_PERMISSION_LEVELS.OWNER).id;
  }
  return userId;
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
