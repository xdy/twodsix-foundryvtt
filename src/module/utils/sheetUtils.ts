// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
//Assorted utility functions likely to be helpful when displaying characters
import { TWODSIX } from "../config";
import { advantageDisadvantageTerm } from "../i18n";
import { camelCase } from "../settings/settingsUtils";
import { simplifySkillName } from "./utils";

// export function pseudoHex(value:number):string {
//   switch (value) {
//     case 0:
//     case 1:
//     case 2:
//     case 3:
//     case 4:
//     case 5:
//     case 6:
//     case 7:
//     case 8:
//     case 9:
//       return String(value);
//     case 10:
//       return "A";
//     case 11:
//       return "B";
//     case 12:
//       return "C";
//     case 13:
//       return "D";
//     case 14:
//       return "E";
//     case 15:
//       return "F";
//     case 16:
//       return "G";
//     case 17:
//       return "H";
//     case 18:
//       return "J";
//     case 19:
//       return "K";
//     case 20:
//       return "L";
//     case 21:
//       return "M";
//     case 22:
//       return "N";
//     case 23:
//       return "P";
//     case 24:
//       return "Q";
//     case 25:
//       return "R";
//     case 26:
//       return "S";
//     case 27:
//       return "T";
//     case 28:
//       return "U";
//     case 29:
//       return "V";
//     case 30:
//       return "W";
//     case 31:
//       return "X";
//     case 32:
//       return "Y";
//     case 33:
//       return "Z";
//     default:
//       throw new Error(game.i18n.localize("TWODSIX.SheetUtils.ValueNotUsable"));
//   }
// }

// export function fromPseudoHex(value:string):number {
//   switch (value) {
//     case "0":
//       return 0;
//     case "1":
//       return 1;
//     case "2":
//       return 2;
//     case "3":
//       return 3;
//     case "4":
//       return 4;
//     case "5":
//       return 5;
//     case "6":
//       return 6;
//     case "7":
//       return 7;
//     case "8":
//       return 8;
//     case "9":
//       return 9;
//     case "A":
//       return 10;
//     case "B":
//       return 11;
//     case "C":
//       return 12;
//     case "D":
//       return 13;
//     case "E":
//       return 14;
//     case "F":
//       return 15;
//     case "G":
//       return 16;
//     case "H":
//       return 17;
//     case "J":
//       return 18;
//     case "K":
//       return 19;
//     case "L":
//       return 20;
//     case "M":
//       return 21;
//     case "N":
//       return 22;
//     case "P":
//       return 23;
//     case "Q":
//       return 24;
//     case "R":
//       return 25;
//     case "S":
//       return 26;
//     case "T":
//       return 27;
//     case "U":
//       return 28;
//     case "V":
//       return 29;
//     case "W":
//       return 30;
//     case "X":
//       return 31;
//     case "Y":
//       return 32;
//     case "Z":
//       return 33;
//     default:
//       throw new Error(game.i18n.localize("TWODSIX.SheetUtils.NotPseudoHexa"));
//       throw new Error(`value ${value} is not a pseudo-hexadecimal value`);
//   }
// }

// export function nobleTitle(soc:number, gender:string):string {
//   switch (soc) {
//     case 10:
//       return gender === "M" ? "Lord" : "Lady";
//     case 11:
//       return gender === "M" ? "Sir" : "Dame";
//     case 12:
//       return gender === "M" ? "Baron" : "Baroness";
//     case 13:
//       return gender === "M" ? "Marquis" : "Marchioness";
//     case 14:
//       return gender === "M" ? "Count" : "Countess";
//     case 15:
//       return gender === "M" ? "Duke" : "Duchess";
//     case 16:
//       return gender === "M" ? "Archduke" : "Archduchess";
//     case 17:
//       return gender === "M" ? "Crown Prince" : "Crown Princess";
//     case 18:
//       return gender === "M" ? "Emperor" : "Empress";
//     default:
//       return "";
//   }
// }

export function calcModFor(characteristic:number):number {
  let modifier = 0;
  if (game.settings.get('twodsix', 'ruleset' ) !== 'CT') {
    modifier = Math.floor((characteristic - 6) / 3);
    if (characteristic <= 0) {
      modifier = (<number>game.settings.get('twodsix', 'modifierForZeroCharacteristic'));
    }
  }
  return modifier;
}

// export function calcModForPseudoHex(characteristicPseudoHex:string):number {
//   const characteristic = fromPseudoHex(characteristicPseudoHex);
//   return calcModFor(characteristic);
// }


export function getDataFromDropEvent(ev:DragEvent):Record<string, any> {
  try {
    return JSON.parse(ev.dataTransfer?.getData('text/plain'));
  } catch (err) {
    const pdfRef = ev.dataTransfer?.getData('text/html');
    if (pdfRef) {
      return getHTMLLink(pdfRef);
    } else {
      const uriRef = ev.dataTransfer?.getData('text/uri-list');
      if (uriRef) {
        return ({
          type: "html",
          href: uriRef,
          label: "Weblink"
        });
      }
      throw new Error(game.i18n.localize("TWODSIX.Errors.DropFailedWith").replace("_ERROR_MSG_", err));
    }
  }
}

export async function getDocFromDropData(dropData:Record<string, any>):Promise<TwodsixActor|TwodsixItem> {
  let doc;
  if (game.modules.get("monks-enhanced-journal")?.active && dropData.itemId && dropData.uuid.includes("JournalEntry")) {
    const journalEntry = await fromUuid(dropData.uuid);
    const lootItems = journalEntry.getFlag('monks-enhanced-journal', 'items'); // Note that MEJ items are JSON data and not full item documents
    doc = lootItems.find((it) => it._id === dropData.itemId);
    if (doc.system.consumables?.length > 0) {
      doc.system.consumables = [];
    }
  } else if (dropData.uuid) {
    doc = await fromUuid(dropData.uuid); //must use async function to drop from compendiums directly
  } else {
    if (dropData.type === "Item") {
      doc = game.items.get(dropData._id ?? dropData.data?._id); //not certain why needed for v13
    } else if (dropData.type === "Actor") {
      doc = game.actors.get(dropData._id ?? dropData.data?._id); //not certain why needed for v13
    }
  }

  if (!doc) {
    throw new Error(game.i18n.localize("TWODSIX.Errors.CouldNotFindItem").replace("_ITEM_ID_", dropData.uuid));
  }
  //handle drop from compendium
  if (doc.pack) {
    const pack = game.packs.get(doc.pack);
    doc = await pack?.getDocument(doc._id);
  }
  //const itemCopy = foundry.utils.duplicate(item); ///Should this be copy???
  //Object.assign(itemCopy, {uuid: item.uuid, id: item._id});
  return doc;
}

export function getHTMLLink(dropString:string): Record<string,unknown> {
  const re = new RegExp(/<a href="(.+?)">(.*?)<\/a>/gm);
  const parsedResult: RegExpMatchArray | null = re.exec(dropString);
  const isPDF = dropString.includes("/pdfjs/");
  if (parsedResult){
    return ({
      type: isPDF ? "pdf" : "html",
      href: parsedResult[1] ?? "",
      label: parsedResult[2] ?? ""
    });
  } else {
    return ({
      type: isPDF ? "pdf" : "html",
      href: "",
      label: ""
    });
  }
}

export function openPDFLink(ev: Event, target:HTMLElement): void {
  const sourceString = target.closest(".item-reference")?.dataset?.link;
  if (sourceString) {
    const [code, page] = sourceString.split(' ');
    const selectedPage = parseInt(page);
    if (ui["pdfpager"]) {
      ui["pdfpager"].openPDFByCode(code, {page: selectedPage});
      //byJournalName(code, selectedPage);
    } else {
      ui.notifications.warn("TWODSIX.Warnings.PDFPagerNotInstalled", {localize: true});
    }
  } else {
    ui.notifications.warn("TWODSIX.Warnings.NoSpecfiedLink", {localize: true});
  }
}

export async function deletePDFLink(ev: Event, target:HTMLElement): void {
  const index = parseInt(target.dataset.index);
  if (index > -1) {
    const newRefArray = foundry.utils.duplicate(this.document.system.docReference);
    newRefArray.splice(index, 1);
    await this.document.update({"system.docReference": newRefArray});
  }
}

export async function addPDFLink(/*ev: Event, target:HTMLElement*/): void {
  const newRefArray = foundry.utils.duplicate(this.document.system.docReference);
  newRefArray.push("");
  await this.document.update({"system.docReference": newRefArray});
}

export async function changeReference(ev: Event):Promise<void> {
  ev.preventDefault();
  //ev.stopImmediatePropagation();
  const newValue:string = ev.target.value;
  const index:number = ev.target.dataset.index;
  if(index) {
    const newRefArray = foundry.utils.duplicate(this.document.system.docReference);
    newRefArray[index] = newValue;
    await this.document.update({'system.docReference': newRefArray});
  } else {
    console.log("No update index");
  }
}

export async function openJournalEntry():Promise<void> {
  if (this.document.system.pdfReference.type === 'JournalEntry') {
    const journalToOpen = await fromUuid(this.document.system.pdfReference.href);
    if (journalToOpen) {
      journalToOpen.sheet.render({force: true});
    } else {
      ui.notifications.warn("TWODSIX.Warnings.NoJournalFound", {localize: true});
    }
  }
}

export async function deleteReference(ev: PointerEvent): Promise<void> {
  ev.preventDefault();
  if (this.document.system.pdfReference.href !== "") {
    await this.document.update({"system.pdfReference.type": "", "system.pdfReference.href": "", "system.pdfReference.label": ""});
  } else {
    ui.notifications.warn("TWODSIX.Warnings.NoSpecfiedLink", {localize: true});
  }
}

export function isDisplayableSkill(skill:Skills): boolean {
  if (skill.getFlag("twodsix", "untrainedSkill")) {
    return false;
  } else if (skill.system.trainingNotes !== ""  || skill.system.value >= 0 || skill.actor?.system.skills[simplifySkillName(skill.name)] > 0) {
    return true;
  } else if (!game.settings.get('twodsix', 'hideUntrainedSkills')) {
    return true;
  } else {
    return false;
  }
}

export async function confirmRollFormula(initFormula:string, title:string):Promise<string> {
  const returnText:string = await new Promise((resolve) => {
    new foundry.applications.api.DialogV2({
      window: {title: title},
      content:
        `<label for="outputFormula">Formula</label><input type="text" name="outputFormula" value="` + initFormula + `"></input>`,
      buttons: [
        {
          action: "roll",
          icon: "fa-solid fa-dice",
          label: "TWODSIX.Rolls.Roll",
          default: true,
          callback: (event, button, dialog) => {
            resolve(dialog.element.querySelector('[name="outputFormula"]')?.value);
          }
        }
      ],
    }).render({force: true});
  });
  return (returnText ?? "");
}

export async function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * Function to return an object of the damage types from setting: 'damageTypeOptions'
 * @param {boolean} isWeapon  Whether the item is a weapon. If so, add {NONE: "---"} to list.
 * @returns {object} An object with the damage type key, label pairs
 * @export
 */
export function getDamageTypes(isWeapon:boolean): object {
  if (game.settings.get('twodsix', 'ruleset') === 'CU') {
    return TWODSIX.CU_DAMAGE_TYPES;
  } else {
    const returnObject = {};
    const damageTypeOptions:string = game.settings.get('twodsix', 'damageTypeOptions');
    if (damageTypeOptions !== "") {
      let protectionTypeLabels:string[] = damageTypeOptions.split(',');
      protectionTypeLabels = protectionTypeLabels.map((s:string) => s.trim());
      for (const type of protectionTypeLabels) {
        Object.assign(returnObject, {[camelCase(type)]: type});
      }
    }
    if (isWeapon) {
      Object.assign(returnObject, {"NONE": "---"});
    }
    return returnObject;
  }
}

/**
 * Function to return an object for roll type {{selctOptions}}, localized and using system settings
 * @returns {object} An object with the roll type type key and localized label pairs
 * @export
 */
export function getRollTypeSelectObject(): object {
  const returnObj = {};
  Object.keys(TWODSIX.ROLLTYPES).forEach((key) => {
    returnObj[key] = advantageDisadvantageTerm(key);
  });
  return returnObj;
}

/**
 * Function to return an object for difficulty type {{selctOptions}}, localized and using system settings
 * @param {object} difficultyList A specific difficulty list from TWODSIX.DIFFICULTIES
 * @returns {object} An object with the difficulty type key and localized label (value) pairs
 * @export
 */
export function getDifficultiesSelectObject(difficultyList?:any = TWODSIX.DIFFICULTIES[game.settings.get('twodsix', 'difficultyListUsed')]): object {
  const returnObj = {};
  const useTargetDiff:boolean = game.settings.get('twodsix', 'difficultiesAsTargetNumber');
  Object.keys(difficultyList).forEach((key) => {
    const value = difficultyList[key];
    const label = useTargetDiff ? `${value.target}+` : `${value.mod >=0 ? `+` : ``}${value.mod}`;
    returnObj[key] = `${game.i18n.localize(key)} (${label})`;
  });
  return returnObj;
}

/**
 * Function to return an object for consumables to use for attack/use
 * @param {TwodsixItem} item an item with consumables
 * @returns {object} An object with the difficulty the id as key and name pairs
 * @export
 */
export function getConsumableOptions(item:TwodsixItem): object {
  const returnObj = {"": "---"};
  if (item.system.consumableData?.length > 0) {
    for (const consumable of item.system.consumableData) {
      returnObj[consumable.id] = consumable.name;
    };
  }
  return returnObj;
}

/**
 * Function to return an object for range types list, abbreviated
 * @param {string} labelType a string key for label type "short" or "long"
 * @returns {object} An object with the range type as key and short label localization string
 * @export
 */
export function getRangeTypes(labelType:string = 'short'): object {
  switch (game.settings.get('twodsix', 'rangeModifierType')) {
    case 'CT_Bands':
      return TWODSIX.CT_WEAPON_RANGE_TYPES[labelType];
    case 'CE_Bands':
      return TWODSIX.CE_WEAPON_RANGE_TYPES[labelType];
    case 'CU_Bands':
      return TWODSIX.CU_WEAPON_RANGE_TYPES[labelType];
    default:
      return {};
  }
}
