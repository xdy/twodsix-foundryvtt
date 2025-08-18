// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import {TWODSIX} from "../config";
import { getDifficultiesSelectObject, getRollTypeSelectObject } from "../utils/sheetUtils";
//import {DICE_ROLL_MODES} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/constants.mjs";
import { _genUntranslatedCharacteristicList } from "../utils/TwodsixRollSettings";
//import {getKeyByValue} from "./utils";
import { simplifySkillName, sortObj } from "../utils/utils.ts";

Hooks.on("getSceneControlButtons", (controls) => {
  if (game.user.isGM) {
    controls.tokens.tools.requestRoll = {
      name: "requestRoll",
      title: "TWODSIX.Chat.Roll.RequestRoll",
      icon: "fa-solid fa-dice",
      button: true,
      visible: game.user.isGM,
      toolclip: {
        src: "systems/twodsix/assets/toolclips/requestRollToolClip.webm",
        heading: "TWODSIX.Chat.Roll.RequestRoll",
        items: foundry.applications.ui.SceneControls.buildToolclipItems([{paragraph: "TWODSIX.Chat.Roll.RequestRollDescription"}, "selectAlt", "selectMultiple"])
      },
      onChange: async (event, active) => {
        if (active) {
          await requestRoll();
        }
      }
    };
  }
});

async function requestRoll(): Promise<void> {
  const tokenData = getSelectedTokenData();
  const skillsList = getAllSkills();
  const itemsList = getAllRollableItems();
  if (Object.keys(tokenData).length > 0) {
    const selections = await throwDialog(skillsList, itemsList, tokenData);
    if (selections.shouldRoll) {
      selections.userActorList = getUserActorList(selections, tokenData);
      let flavor = `<section>${game.i18n.localize("TWODSIX.Chat.Roll.GMRequestsRoll")}<section>`;
      if (selections.itemId && selections.itemId !== "NONE") {
        flavor = flavor.replace("_TYPE_", itemsList[selections.itemId]);
      } else if (selections.skillName !== "---") {
        flavor = flavor.replace("_TYPE_", selections.skillName);
      } else if (selections.characteristic !== "NONE") {
        flavor = flavor.replace("_TYPE_", selections.characteristic);
      } else {
        flavor = flavor.replace("_TYPE_", game.i18n.localize("TWODSIX.Chat.Roll.normal"));
      }
      flavor += `<section class="card-buttons"><button type="button" data-action="abilityCheck" data-tooltip="${game.i18n.localize("TWODSIX.Chat.Roll.AbilityCheck")}"><i class="fa-solid fa-dice"></i></button><section>`;
      ChatMessage.create({
        flavor: flavor,
        flags: {
          twodsix: {
            rollSettings: selections
          }
        },
        whisper: Object.keys(selections.userActorList),
        sound: "sounds/notify.wav"
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

function getAllSkills(): Promise<object> {
  const skillList = {};
  let selectedActors = canvas.tokens.controlled.map((t) => t.actor);
  if (selectedActors.length === 0) {
    selectedActors = game.users.filter(user => !user.isGM && user.active).map((u) => u.character);
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

function getAllRollableItems(): object {
  const itemList = {};
  let selectedActors = canvas.tokens.controlled.map((t) => t.actor);
  if (selectedActors.length === 0) {
    selectedActors = game.users.filter(user => !user.isGM && user.active).map((u) => u.character);
  }
  for (const actor of selectedActors) {
    for (const item of actor.items) {
      // Adjust this filter as needed for your system's rollable items
      if (["weapon", "tool", "equipment", "computer", "augment"].includes(item.type)) {
        if (!(item.name in itemList)) {
          itemList[item.id] = item.name;
        }
      }
    }
  }
  // Optionally sort
  return { "NONE": "---", ...sortObj(itemList) };
}

async function throwDialog(skillsList:string[], itemsList:string[], tokenData:any):Promise<any> {
  const template = 'systems/twodsix/templates/chat/request-roll-dialog.hbs';
  const tokenNames = {};
  for (const tokenId in tokenData) {
    tokenNames[tokenId] = tokenData[tokenId].token.name ?? tokenData[tokenId].token.actor.name;
  }
  const dialogData = {
    initialTokens: Object.keys(tokenData),
    allTokenNames: tokenNames,
    rollType: "Normal",
    rollTypes: getRollTypeSelectObject(),
    difficulty: "Average",
    difficultyList: getDifficultiesSelectObject(),
    skillsList: skillsList,
    itemsList: itemsList,
    showItemList: Object.keys(tokenData).length === 1,
    rollMode: game.settings.get('core', 'rollMode'),
    rollModes: CONFIG.Dice.rollModes,
    characteristicList: _genUntranslatedCharacteristicList(),
    initialChoice: "NONE",
    initialSkill: "NONE",
    initialItem: "NONE",
    other: 0
  };
  const returnValue = {};
  const buttons = [
    {
      action: "ok",
      label: "TWODSIX.Chat.Roll.RequestRoll",
      icon: "fa-solid fa-message",
      default: true,
      callback: (event, button, dialog) => {
        const formElements = dialog.element.querySelector(".standard-form").elements;
        returnValue.selectedTokens = formElements["selectedTokens"] ? Array.from(formElements["selectedTokens"].selectedOptions)?.map((({ value }) => value)) : [];
        returnValue.difficulty = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')][formElements["difficulty"]?.value];
        returnValue.rollType = formElements["rollType"]?.value;
        returnValue.rollMode = formElements["rollMode"]?.value;
        returnValue.characteristic = formElements["characteristic"]?.value;
        returnValue.selectedSkill = formElements["selectedSkill"]?.value;
        returnValue.skillName = skillsList[formElements["selectedSkill"]?.value];
        if (dialogData.showItemList) {
          returnValue.itemId = formElements["selectedItem"]?.value;
          returnValue.itemName = itemsList[returnValue.itemId];
        }
        returnValue.shouldRoll = returnValue.selectedTokens.length > 0;
        returnValue.other = parseInt(formElements["other"]?.value || 0);
      }
    },
    {
      action: "cancel",
      icon: "fa-solid fa-xmark",
      label: "Cancel",
      callback: () => {
        returnValue.shouldRoll = false;
      }
    }
  ];

  const html = await foundry.applications.handlebars.renderTemplate(template, dialogData);
  await foundry.applications.api.DialogV2.wait({
    window: {title: "TWODSIX.Chat.Roll.RequestRoll", icon: "fa-solid fa-dice"},
    content: html,
    buttons: buttons,
    render: handleRender,
    submit: () => {
      Promise.resolve();
    },
    rejectClose: false
  });
  return returnValue;
}

/**
 * Initializes form event handlers for skill and item selection in the DialogV2 UI.
 * Dynamically updates form fields (characteristic, difficulty, rollType, selectedSkill)
 * based on the selected skill or item, and the currently selected actor.
 *
 * @param ev - The original render event (unused here but provided by Foundry).
 * @param htmlRend - The rendered DialogV2 object containing the form elements.
 */
function handleRender(ev: Event, htmlRend: DialogV2): void {
  /**
   * Retrieves the form elements from the standard form within the dialog.
   *
   * @returns The collection of form controls.
   */
  const getFormElements = (): HTMLFormControlsCollection =>
    htmlRend.element.querySelector(".standard-form")?.elements;

  /**
   * Gets the currently selected actor based on the selected token in the form.
   *
   * @param form - The form elements collection.
   * @returns The selected TwodsixActor, or undefined if not found.
   */
  const getSelectedActor = (form: HTMLFormControlsCollection): TwodsixActor | undefined => {
    const tokenId = form["selectedTokens"].selectedOptions[0]?.value;
    return tokenId ? game.canvas.tokens.get(tokenId)?.actor : undefined;
  };

  /**
   * Updates the characteristic, difficulty, roll type, and selectedSkill fields in the form
   * based on the provided skill. If no skill is provided, defaults are used.
   *
   * @param form - The form elements collection.
   * @param skill - The skill to populate the fields with (optional).
   */
  const updateFormFields = (form: HTMLFormControlsCollection, skill?: TwodsixItem): void => {
    form["characteristic"].value = skill?.system.characteristic || "NONE";
    form["difficulty"].value = skill?.system.difficulty || "Average";
    form["rollType"].value = skill?.system.rolltype || "Normal";
    if (skill) {
      form["selectedSkill"].value = simplifySkillName(skill.name) || "NONE";
    }
  };

  /**
   * Event handler for when a skill is selected. Looks up the matching skill
   * on the selected actor and updates the form fields accordingly.
   */
  const onSkillChange = (): void => {
    const form = getFormElements();
    const skillName = form["selectedSkill"]?.value;
    if (skillName && skillName !== "NONE") {
      const actor = getSelectedActor(form);
      const skill = actor?.itemTypes.skills.find(sk => simplifySkillName(sk.name) === skillName);
      updateFormFields(form, skill);
    } else {
      updateFormFields(form);
    }
  };

  /**
   * Event handler for when an item is selected. Finds the associated skill for
   * the selected item on the selected actor and updates the form fields.
   */
  const onItemChange = (): void => {
    const form = getFormElements();
    const itemId = form["selectedItem"]?.value;
    if (itemId && itemId !== "NONE") {
      const actor = getSelectedActor(form);
      const item = actor?.items.get(itemId);
      const skill = actor?.items.get(item?.system.skill);
      updateFormFields(form, skill);
    } else {
      updateFormFields(form);
    }
  };

  // Attach event listeners for form interaction
  htmlRend.element.querySelector(".select-skill")?.addEventListener("change", onSkillChange);
  htmlRend.element.querySelector(".select-item")?.addEventListener("change", onItemChange);
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
  const ownerType = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const owningUsers = game.users.filter((user) => !user.isGM && user.active && token.actor.testUserPermission(user, ownerType));
  if (owningUsers.length > 1) {
    const characterUser = owningUsers.find((user) => user.character.id === token.actor.id);
    if (characterUser) {
      userId = characterUser.id;
    } else {
      const randomSelection = Math.floor(Math.random() * owningUsers.length);
      userId = owningUsers[randomSelection].id;
    }
  } else if (owningUsers.length === 1) {
    userId = owningUsers[0].id;
  } else {
    userId = game.users.find((user) => user.isGM && user.active && token.actor.testUserPermission(user, ownerType))?.id;
    if (!userId) {
      userId = game.users.find((user) => user.isGM && user.active)?.id;
    }
  }
  return userId;
}
