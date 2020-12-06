import {TwodsixItemType} from "./TwodsixItemTypes";

export interface TwodsixItemData extends ItemData {
  type:TwodsixItemType;
  hasOwner:boolean;
}
