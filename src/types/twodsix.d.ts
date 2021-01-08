//MUST match what's in the template.json (or, at least not contradict it). TODO Should build this from the template.json I guess
export type TwodsixItemType = "equipment" | "weapon" | "armor" | "augment" | "storage" | "tool" | "junk" | "skills" | "consumable";

export interface TwodsixItemData extends ItemData {
  type:TwodsixItemType;
  hasOwner:boolean;
  _id:string;
}

export type CharacteristicType =
  {
    value:number;
    damage:number;
    current:number;
    mod:number;
    shortLabel:string;
  }

export type UpdateData = {
  _id?:any;
  items?:any;
  tokens?:any[];
};

//Success is not 0 to avoid falsiness.
export const enum Crit {
  success = 1,
  fail = 2
}
