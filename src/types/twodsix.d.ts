//MUST match what's in the template.json (or, at least not contradict it). TODO Should build this from the template.json I guess
export type TwodsixItemType = "equipment" | "weapon" | "armor" | "augment" | "storage" | "tool" | "junk" | "skills" | "consumable";

// @ts-ignore
export interface TwodsixItemData extends ItemData {
  type:TwodsixItemType;
  hasOwner:boolean;
  id:string;
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
  id?:any;
  items?:any;
  tokens?:any[];
};



