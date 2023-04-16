import RulesetSettings from "../module/settings/RulsetSettings";
import DisplaySettings from "../module/settings/DisplaySettings";
import ItemSettings from "../module/settings/ItemSettings";
import { TwodsixActorSheet } from "../module/sheets/TwodsixActorSheet";
import { TwodsixShipSheet } from "../module/sheets/TwodsixShipSheet";
import { TwodsixVehicleSheet } from "../module/sheets/TwodsixVehicleSheet";
import { TwodsixAnimalSheet } from "../module/sheets/TwodsixAnimalSheet";
import { TwodsixRobotSheet } from "../module/sheets/TwodsixRobotSheet";
import TwodsixItem from "../module/entities/TwodsixItem";
import {rollItemMacro} from "../module/utils/rollItemMacro";
import { TwodsixItemSheet } from "../module/sheets/TwodsixItemSheet";
import {ActorTwodsixDataSource, ItemTwodsixDataSource, ShipAction} from "./template";
import {TWODSIX} from "../module/config";
import { TwodsixShipPositionSheet } from "../module/sheets/TwodsixShipPositionSheet";

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
      'twodsix.showAlternativeCharacteristics': string;
      'twodsix.showContaminationBelowLifeblood': boolean;
      'twodsix.showHeroPoints': boolean;
      'twodsix.showLifebloodStamina': boolean;
      'twodsix.showMissingCompendiumWarnings': boolean;
      'twodsix.showSingleComponentColumn': boolean;
      'twodsix.showBandwidth': boolean;
      'twodsix.useFoundryStandardStyle': boolean;
      'twodsix.useSystemDefaultTokenIcon': boolean;
      'twodsix.useWoundedStatusIndicators': boolean;
      'twodsix.useWoundedEncumbranceIndicators': boolean;
      'twodsix.encumbranceFraction': string;
      'twodsix.encumbranceModifier': number;
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
      'twodsix.maxComponentHits':number;
      'twodsix.initiativeFormula': string;
      'twodsix.systemMigrationVersion': string;
      'twodsix.termForAdvantage': string;
      'twodsix.termForDisadvantage': string;
      'twodsix.debugSettings': RulesetSettings;
      'twodsix.displaySettings': DisplaySettings;
      'twodsix.itemSettings': ItemSettings;
      'twodsix.rulesetSettings': RulesetSettings;
      'twodsix.minorWoundsRollModifier': number;
      'twodsix.seriousWoundsRollModifier': number;
      'twodsix.mortgagePayment': number;
      'twodsix.massProductionDiscount': number;
      'twodsix.maxEncumbrance': string;
      'twodsix.useEncumbrance': boolean;
      'twodsix.defaultMovement': number;
      'twodsix.defaultMovementUnits': string;
      'twodsix.addEffectForShipDamage': boolean;
      'twodsix.unarmedDamage': string;
      'twodsix.autoAddUnarmed': boolean;
      'twodsix.showTimeframe': boolean;
      'twodsix.showStatusIcons': boolean;
      'twodsix.showHullAndArmor': string;
      'twodsix.addEffectToManualDamage':boolean;
      'twodsix.showRangeSpeedNoUnits':boolean;
      'twodsix.showInitiativeButton':boolean;
      'twodsix.showSkillCountsRanks':boolean;
      'twodsix.showComponentSummaryIcons':boolean;
      'twodsix.showSpells':boolean;
      'twodsix.sorcerySkill':string;
      'twodsix.useNationality':boolean;
      'twodsix.animalsUseHits': boolean;
      'twodsix.robotsUseHits': boolean;
      'twodsix.animalsUseLocations':boolean;
      'twodsix.displayReactionMorale': boolean;
      'twodsix.showComponentRating': boolean;
      'twodsix.showComponentDM': boolean;
      'twodsix.transferDroppedItems': boolean;
      'twodsix.allowDragDropOfLists':boolean;
      'twodsix.useDodgeParry':boolean;
      'twodsix.showModifierDetails':boolean;
      'twodsix.defaultColor':string;
      'twodsix.lightColor':string;
      'twodsix.useItemActiveEffects':boolean;
      'twodsix.showFeaturesInChat':boolean;
      'twodsix.showHitsChangesInChat':boolean;
      'twodsix.encumbFractionOneSquare':number;
      'twodsix.encumbFraction75Pct':number;
      'twodsix.useTabbedViews':boolean;
      'twodsix.damageTypeOptions':string;
    }
  }
}

declare interface TwodsixShipSheetSettings {
  showSingleComponentColumn: boolean;
  useFoundryStandardStyle: boolean;
  showWeightUsage: boolean;
  useProseMirror: boolean;
  useShipAutoCalc: boolean;
}
declare interface TwodsixVehicleSheetSettings {
  showHullAndArmor: string;
}

declare interface TwodsixSpaceObjectSheetSettings {
  useProseMirror?: boolean;
}

declare interface TwodsixShipSheetData extends ActorSheet.Data {
  dtypes: ["String", "Number", "Boolean"];
  settings: TwodsixShipSheetSettings;
  shipPositions: Item[];
  storage: Collection<Item>;
  richText: any;
}

declare interface TwodsixVehicleSheetData extends ActorSheet.Data {
  dtypes: ["String", "Number", "Boolean"];
  settings: TwodsixVehicleSheetSettings;
  shipPositions: Item[];
  storage: Collection<Item>;
}

declare interface TwodsixSpaceObjectSheetData extends ActorSheet.Data {
  dtypes: ["String", "Number", "Boolean"];
  settings: TwodsixSpaceObjectSheetSettings;
  richText: any;
}

declare interface ExtraData {
  actor?: TwodsixActor;
  ship?: TwodsixActor;
  event: Event;
  actionName?: string;
  positionName?: string;
  diceModifier?: string;
  component?:TwodsixItem;
}

declare interface AvailableShipActionData {
  action: (text:string, extra:ExtraData) => Promise<void>;
  name: string;
  placeholder: string;
}

type AvailableShipActions = Record<string, AvailableShipActionData>;

declare interface TwodsixShipPositionSheetData extends ItemSheet.Data {
  availableActions: AvailableShipActions;
  components: Item[];
  sortedActions: ShipAction[];
  hasShipActor: boolean;
  actors?: TwodsixActor[];
}

declare interface TwodsixItemSheetData {
  'twodsix.TwodsixItemSheet': {
    id: 'twodsix.TwodsixItemSheet';
    default: boolean;
    cls: TwodsixItemSheet;
    label: string;
  }
}

declare interface TwodsixShipPositionSheetData {
  'twodsix.TwodsixShipPositionSheet': {
    id: 'twodsix.TwodsixShipPositionSheet';
    default: boolean;
    cls: TwodsixShipPositionSheet;
    label: string;
  }
}

declare interface Game {
  twodsix: {
    applications: {
      TwodsixActorSheet: TwodsixActorSheet;
      TwodsixShipSheet: TwodsixShipSheet;
      TwodsixVehicleSheet: TwodsixVehicleSheet;
      TwodsixAnimalSheet: TwodsixAnimalSheet;
      TwodsixRobotSheet: TwodsixRobotSheet;
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
        vehicle: {
          'twodsix.TwodsixVehicleSheet': {
            id: 'twodsix.TwodsixVehicleSheet';
            default: boolean;
            cls: TwodsixVehicleSheet;
            label: string;
          };
        };
        animal: {
          'twodsix.TwodsixAnimalSheet': {
            id: 'twodsix.TwodsixAnimalSheet';
            default: boolean;
            cls: TwodsixAnimalSheet;
            label: string;
          };
        };
        robot: {
          'twodsix.TwodsixRobotSheet': {
            id: 'twodsix.TwodsixRobotSheet';
            default: boolean;
            cls: TwodsixRobotSheet;
            label: string;
          };
        };
        "space-object": {
          'twodsix.TwodsixVehicleSheet': {
            id: 'twodsix.TwodsixSpaceObjectSheet';
            default: boolean;
            cls: TwodsixSpaceObjectSheet;
            label: string;
          };
        }
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
        spell: TwodsixItemSheetData;
        consumable: TwodsixItemSheetData;
        component: TwodsixItemSheetData;
        shipPosition: TwodsixShipPositionSheetData;
        computer: TwodsixItemSheetData;
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



