//Assorted utility functions likely to be helpful when displaying characters

import {TwodsixItemData} from "src/types/twodsix";

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
  let modifier = Math.floor((characteristic - 6) / 3);
  if (characteristic === 0) {
    modifier = (<number>game.settings.get('twodsix', 'modifierForZeroCharacteristic'));
  }
  return modifier;
}

// export function calcModForPseudoHex(characteristicPseudoHex:string):number {
//   const characteristic = fromPseudoHex(characteristicPseudoHex);
//   return calcModFor(characteristic);
// }

export function getKeyByValue(object:{ [x:string]:unknown; }, value:unknown):string {
  //TODO This assumes I always find the value. Bad form really.
  return <string>Object.keys(object).find(key => JSON.stringify(object[key]) === JSON.stringify(value));
}

export function getDataFromDropEvent(event:DragEvent):Record<string, any> {
  try {
    return JSON.parse(event.dataTransfer.getData('text/plain'));
  } catch (err) {
    throw new Error(game.i18n.localize("TWODSIX.Errors.DropFailedWith").replace("_ERROR_MSG_", err));
  }
}

export async function getItemDataFromDropData(data:Record<string, any>):Promise<TwodsixItemData> {
  if (data.pack) {
    // compendium
    const pack = game.packs.find((p) => p.collection === data.pack);
    if (pack.metadata.type !== 'Item') {
      throw new Error(game.i18n.localize("TWODSIX.Errors.DraggedCompendiumIsNotItem"));
    }
    // @ts-ignore
    const item = await pack.getDocument(data.id);
    // @ts-ignore
    return duplicate(item.data);
  } else if (data.data) {
    // other actor
    return duplicate(data.data);
  } else {
    // items directory
    const item = game.items.get(data.id);
    if (!item) {
      throw new Error(game.i18n.localize("TWODSIX.Errors.CouldNotFindItem").replace("_ITEM_ID_", data.id));
    }
    return duplicate(item.data) as TwodsixItemData;
  }
}
