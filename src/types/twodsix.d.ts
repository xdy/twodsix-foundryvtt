import { TWODSIX } from "../module/config";
import RulesetSettings from "../module/settings/RulsetSettings";
import DisplaySettings from "../module/settings/DisplaySettings";
import ItemSettings from "../module/settings/ItemSettings";
import { TwodsixActorSheet } from "../module/sheets/TwodsixActorSheet";
import { TwodsixShipSheet } from "../module/sheets/TwodsixShipSheet";
import TwodsixItem from "../module/entities/TwodsixItem";
import {rollItemMacro} from "../module/utils/rollItemMacro";
import ItemTwodsixDataSource = dataTwodsix.ItemTwodsixDataSource;
import ActorTwodsixDataSource = dataTwodsix.ActorTwodsixDataSource;
import { TwodsixItemSheet } from "src/module/sheets/TwodsixItemSheet";

declare global {

  interface LenientGlobalVariableTypes {
    game: never;
    canvas: never;
    ui: never;
    i18n: never;
  }

  // _source of the Items and Actors
  interface SourceConfig {
    Item: ItemTwodsixDataSource;
    Actor: ActorTwodsixDataSource;
  }

  interface DataConfig {
    Actor: ActorTwodsixDataSource;
    Item: ItemTwodsixDataSource;
  }

  interface DocumentClassConfig {
    TwodsixItem: typeof Item;
    TwodsixActor: typeof Actor;
  }

  interface FlagConfig {
    Item: {
      Twodsix: {
        newItem: boolean;
        untrainedSkill: boolean;
      };
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ClientSettings {
    interface Values {
      'twodsix.ExperimentalFeatures': boolean;
      'twodsix.ShowDamageType': boolean;
      'twodsix.ShowLawLevel': boolean;
      'twodsix.ShowRangeBandAndHideRange': boolean;
      'twodsix.ShowRateOfFire': boolean;
      'twodsix.ShowRecoil': boolean;
      'twodsix.ShowWeaponType': boolean;
      'twodsix.automateDamageRollOnHit': boolean;
      'twodsix.criticalNaturalAffectsEffect': boolean;
      'twodsix.defaultTokenSettings': boolean;
      'twodsix.difficultiesAsTargetNumber': boolean;
      'twodsix.hideUntrainedSkills': boolean;
      'twodsix.invertSkillRollShiftClick': boolean;
      'twodsix.lifebloodInsteadOfCharacteristics': boolean;
      'twodsix.showAlternativeCharacteristics': boolean;
      'twodsix.showContaminationBelowLifeblood': boolean;
      'twodsix.showHeroPoints': boolean;
      'twodsix.showLifebloodStamina': boolean;
      'twodsix.showMissingCompendiumWarnings': boolean;
      'twodsix.showSingleComponentColumn': boolean;
      'twodsix.useFoundryStandardStyle': boolean;
      'twodsix.useSystemDefaultTokenIcon': boolean;
      'twodsix.useWoundedStatusIndicators': boolean;
      'twodsix.absoluteBonusValueForEachTimeIncrement': number;
      'twodsix.absoluteCriticalEffectValue': number;
      'twodsix.maxSkillLevel': number;
      'twodsix.modifierForZeroCharacteristic': number;
      'twodsix.weightModifierForWornArmor': number;
      'twodsix.autofireRulesUsed': string; //TODO Should be more specific, really
      'twodsix.difficultyListUsed': number; //TODO Should be more specific, really
      'twodsix.ruleset': string; //TODO Should be more specific, really
      'twodsix.alternativeShort1': string;
      'twodsix.alternativeShort2': string;
      'twodsix.initiativeFormula': string;
      'twodsix.systemMigrationVersion': string;
      'twodsix.termForAdvantage': string;
      'twodsix.termForDisadvantage': string;
      'twodsix.debugSettings': RulesetSettings
      'twodsix.displaySettings': DisplaySettings
      'twodsix.itemSettings': ItemSettings
      'twodsix.rulesetSettings': RulesetSettings
    }
  }
}

declare interface TwodsixItemSheetData {
  'twodsix.TwodsixItemSheet': {
    id: 'twodsix.TwodsixItemSheet';
    default: boolean;
    cls: TwodsixItemSheet;
    label: string;
  }
}

declare interface Game {
  twodsix: {
    applications: {
      TwodsixActorSheet: TwodsixActorSheet;
      TwodsixShipSheet: TwodsixShipSheet;
    }
    config: TWODSIX
    entities: {
      TwodsixActor: TwodsixActor;
      TwodsixItem: TwodsixItem;
    };
    macros: {
      rollItemMacro: typeof rollItemMacro;
    };
    rollItemMacro: typeof rollItemMacro;
  };
  CONFIG: {
    TWODSIX: TWODSIX;
    Actor: {
      documentClass: TwodsixActor;
      sheetClasses: {
        traveller: {
          'twodsix.TwodsixActorSheet': {
            id: 'twodsix.TwodsixActorSheet';
            default: boolean;
            cls: TwodsixActorSheet;
            label: string;
          };
        };
        ship: {
          'twodsix.TwodsixShipSheet': {
            id: 'twodsix.TwodsixShipSheet';
            default: boolean;
            cls: TwodsixShipSheet;
            label: string;
          };
        };
      };
    };

    Item: {
      documentClass: TwodsixItem;
      sheetClasses: {
        equipment: TwodsixItemSheetData;
        weapon: TwodsixItemSheetData;
        armor: TwodsixItemSheetData;
        augment: TwodsixItemSheetData;
        storage: TwodsixItemSheetData;
        tool: TwodsixItemSheetData;
        junk: TwodsixItemSheetData;
        skills: TwodsixItemSheetData;
        trait: TwodsixItemSheetData;
        consumable: TwodsixItemSheetData;
        component: TwodsixItemSheetData;
      };
    };
  };
}

// declare interface Game {
//   twodsix:{ TwodsixActor:typeof /*Twodsix*/Actor; TwodsixItem:typeof TwodsixItem; rollItemMacro:(itemId:string) => Promise<void> }
// }


//MUST match what's in the template.json (or, at least not contradict it). TODO Should build this from the template.json I guess
// export type TwodsixItemType =
//   "equipment"
//   | "weapon"
//   | "armor"
//   | "augment"
//   | "storage"
//   | "tool"
//   | "junk"
//   | "skills"
//   | "trait"
//   | "consumable"
//   | "component";

// export interface TwodsixItemData extends ItemData {
//   type: TwodsixItemType;
//   hasOwner: boolean;
//   id: string;
// }

// export type CharacteristicType =
//   {
//     value: number;
//     inputCurrent: number;
//     damage: number;
//     current: number;
//     mod: number;
//     shortLabel: string;
//   }

export type UpdateData = {
  id?: any;
  items?: any;
  tokens?: any[];
};



