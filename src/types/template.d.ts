//Everything except the namespace is generated from template.json using https://app.quicktype.io/?l=ts


// Actors
export interface TravellerDataSource {
  type:'traveller';
  system:Traveller;
}

export interface ShipDataSource {
  type:'ship';
  system:Ship;
}
export interface VehicleDataSource {
  type:'vehicle';
  system:Vehicle;
}
export interface AnimalDataSource {
  type:'animal';
  system:Animal;
}

export interface RobotDataSource {
  type:'robot';
  system:Robot;
}

export interface SpaceObjectDataSource {
  type:'space-object';
  system:SpaceObject;
}

export  type ActorTwodsixDataSource = TravellerDataSource | ShipDataSource | VehicleDataSource | AnimalDataSource | RobotDataSource;

// Items
export interface EquipmentDataSource {
  type:'equipment';
  system:Equipment;
}

export interface ArmorDataSource {
  type:'armor';
  system:Armor;
}

export interface AugmentDataSource {
  type:'augment';
  system:Augment;
}

export interface StorageItemDataSource {
  type:'storage';
  system:Equipment;
}

export interface ToolDataSource {
  type:'tool';
  system:Equipment;
}

export interface JunkDataSource {
  type:'junk';
  system:Equipment;
}

export interface SkillsDataSource {
  type:'skills';
  system:Skills;
}

export interface TraitDataSource {
  type:'trait';
  system:Trait;
}

export interface SpellDataSource {
  type:'spell';
  system:Spell;
}

export interface ConsumableDataSource {
  type:'consumable';
  system:Consumable;
}

export interface ComponentDataSource {
  type:'component';
  system:Component;
}

export interface WeaponDataSource {
  type:'weapon';
  system:Weapon;
}

export interface ShipPositionDataSource {
  type: 'ship_position';
  system: ShipPosition;
}

export interface ComputerDataSource {
  type: 'computer';
  system: Computer;
}

export type ItemTwodsixDataSource = ArmorDataSource
  | AugmentDataSource
  | ComponentDataSource
  | ConsumableDataSource
  | EquipmentDataSource
  | ToolDataSource
  | JunkDataSource
  | SkillsDataSource
  | StorageItemDataSource
  | TraitDataSource
  | SpellDataSource
  | WeaponDataSource
  | ShipPositionDataSource
  | ComputerDataSource
  ;

export type Gear = Armor
  | Equipment
  | Tool
  | Weapon
  | Component
  | Computer
  ;

export type UsesConsumables = Armor
  | Equipment
  | Tool
  | Weapon
  | Computer
  ;

// If/when template.json is edited, this file needs to be edited to match.
// Everything below these comments was initially generated from template.json using https://app.quicktype.io/?l=ts, possibly edited, possibly unused, needs to be maintained MANUALLY if/when template.json changes.
// Known changes: extends GearTemplate has been added in several places, changes around equipped.
export interface Twodsix {
  actor:Actor;
  item:Item;
}

export interface Actor {
  types:string[];
  traveller:Traveller;
  ship:Ship;
  vehicle:Vehicle;
  animal:Animal;
  "space-object":SpaceObject;
}

export type ShipPositionActorIds = Record<string, string>
export interface Ship {
  name:string;
  deckPlan:string;
  techLevel:number;
  crew:Crew;
  crewLabel:Crew;
  notes:string;
  cargo:string;
  finances:string;
  shipValue:string;
  maintenanceCost:string;
  mortgageCost:string;
  isMassProduced:boolean;
  reqPower:ReqPower;
  weightStats: WeightStats;
  shipStats:ShipStats;
  shipPositionActorIds: ShipPositionActorIds;
}

export interface Crew {
  captain:string;
  pilot:string;
  astrogator:string;
  engineer:string;
  maintenance:string;
  gunner:string;
  medic:string;
  admin:string;
  steward:string;
  broker:string;
  marine:string;
  other:string;
}

export interface ReqPower {
  systems:number;
  mDrive:number;
  jDrive:number;
  sensors:number;
  weapons:number;
}

export interface WeightStats {
  systems:number;
  cargo:number;
  fuel:number;
  available:number;
  vehicles:number;
}

export interface ShipStats {
  hull:Hits;
  fuel:Fuel;
  power:Hits;
  armor:Staterooms;
  fuelTanks:Staterooms;
  mass:Staterooms;
  drives: Drives;
  bandwidth:Hits;
}

export interface Staterooms {
  name:string;
  weight:string;
  cost:string;
  power?:string;
  value?:number;
  min?:number;
  max?:number;
}

export interface Drives {
  jDrive:Propulsion;
  mDrive:Propulsion;
  overdrive:boolean;
}

export interface Propulsion {
  rating:number;
}

export interface Hits {
  value:number;
  min:number;
  max:number;
  lastDelta?:number;
}

export interface Fuel {
  value:number;
  min:number;
  max:number;
  isRefined:boolean;
}

export interface Traveller {
  name:string;
  homeWorld:string;
  nationality:string;
  species:string;
  age:Age;
  hits:Hits;
  gender:string;
  radiationDose:Hits;
  encumbrance:Encumbrance;
  primaryArmor:PrimaryArmor;
  secondaryArmor:SecondaryArmor;
  heroPoints:number;
  radiationProtection:PrimaryArmor;
  contacts:string;
  allies:string;
  enemies:string;
  untrainedSkill:string;
  description:string;
  bio:string;
  notes:string;
  finances:Finances;
  characteristics:Characteristics;
  skillRollTypes:Record<string,string>;
  characteristicEdit:boolean;
  movement:MovementData;
  hideStoredItems: StoredItemView;
  conditions: Conditions;
  experience: ExperiencePoints;
  xpNotes:string;
}

export interface Conditions {
  woundedEffect:number;
  encumberedEffect:number;
}

export interface ExperiencePoints {
  value: number;
  totalEarned: number;
}

export interface Animal {
  name:string;
  homeWorld:string;
  animalType:AnimalType;
  location:string;
  size:string;
  numberAppearing:string;
  hits:Hits;
  radiationDose:Hits;
  encumbrance:Encumbrance;
  primaryArmor:PrimaryArmor;
  secondaryArmor:PrimaryArmor;
  radiationProtection:PrimaryArmor;
  untrainedSkill:string;
  description:string;
  notes:string;
  characteristics:Characteristics;
  woundedEffect:number;
  characteristicEdit:boolean;
  movement:MovementData;
  reaction:ReactionData;
  moraleDM:string;
}

export interface Robot {
  name:string;
  size:string;
  hits:Hits;
  radiationDose:Hits;
  encumbrance:Encumbrance;
  primaryArmor:PrimaryArmor;
  secondaryArmor:PrimaryArmor;
  radiationProtection:PrimaryArmor;
  untrainedSkill:string;
  description:string;
  notes:string;
  characteristics:Characteristics;
  woundedEffect:number;
  characteristicEdit:boolean;
  movement:MovementData;
  price:string;
  chassis:string;
  locomotionType:string;
  techLevel:number;
  operationalTime:string;
}

export interface SpaceObject extends LinkTemplate {
  techLevel:number;
  features:string;
  count:Encumbrance;
  description:string;
  notes:string;
  thrust:number;
  roundsActive:number;
  movement:MovementData;
  damage:string;
}

export interface ReactionData {
  attack:number;
  flee:number;
}

export interface AnimalType {
  niche:string;
  subtype:string;
}

export interface MovementData {
  burrow:number;
  climb:number;
  fly:number;
  swim:number;
  walk:number;
  units:string;
  hover:boolean;
}

export interface Age {
  value:number;
  min:number;
}

export interface StoredItemView {
  weapon:boolean;
  armor:boolean;
  augment:boolean;
  equipment:boolean;
  consumable:boolean;
  attachment:boolean;
}

export interface Characteristics {
  strength:Characteristic;
  dexterity:Characteristic;
  endurance:Characteristic;
  intelligence:Characteristic;
  education:Characteristic;
  socialStanding:Characteristic;
  psionicStrength:Characteristic;
  stamina:Characteristic;
  lifeblood:Characteristic;
  alternative1:Characteristic;
  alternative2:Characteristic;
}

export interface Characteristic {
  key:string;
  value:number;
  damage:number;
  label:string;
  shortLabel:string;
  displayShortLabel:string;
  current:number; //Not in template.json
  mod:number; //Not in template.json
}

export interface Encumbrance {
  value:number;
  max:number;
}

export interface Finances {
  cash:string;
  pension:string;
  debt:string;
  payments:string;
  livingCosts:string;
  financialNotes:string;
}

export interface PrimaryArmor {
  value:number;
}

export interface SecondaryArmor {
  value:number;
  protectionTypes:string[];
}

export interface ShipAction {
  order: number;
  name: string;
  icon: string;
  type: string;
  command: string;
  id?: string;
  placeholder?: string;
}

export type ShipActions = Record<string, ShipAction>;

export interface ShipPosition {
  name: string;
  icon: string;
  actions: ShipActions;
  sortedActions?: ShipAction[];
  order: number;
  actors?: Traveller[];
}

export interface Vehicle extends LinkTemplate {
  name:string;
  cargoList:string;
  cargoCapacity:string;
  cost: string;
  crew:VehicleCrew;
  damageStats:VehicleDamageStats;
  features:string;
  maneuver:VehicleManeuver;
  skillToOperate:string;
  systemStatus: VehicleSystemStatus;
  weapons:string;
  openVehicle:boolean;
  techLevel:string;
  traits:string;
  weight:string;
  shippingSize:string;
}

export interface VehicleCrew {
  operators:string;
  passengers:string;
}
export interface VehicleDamageStats {
  armor: Hits;
  hull: Hits;
  structure: Hits;
  armorLabel: string;
  threshold: Threshold;
}
export interface VehicleSystemStatus {
  cargo: string;
  cockpit: string;
  computers: string;
  electronics: string;
  limbs: string;
  locomotion: string;
  powerPlant: string;
  sensors: string;
  weapons: string;
}

export interface VehicleManeuver {
  speed:string;
  speedUnits:string;
  range:string;
  rangeUnits:string;
  agility:string;
}

export interface Threshold {
  regular: number;
  critical: number;
}

export interface Item {
  types:string[];
  templates:Templates;
  equipment:Equipment;
  tool:Equipment;
  weapon:Weapon;
  armor:Armor;
  augment:Augment;
  skills:Skills;
  trait:Trait;
  spell:Spell;
  consumable:Consumable;
  component:Component;
  computer:Computer;
}

export interface Armor extends GearTemplate, LinkTemplate {
  templates:string[];
  armor:number;
  secondaryArmor:PrimaryArmor;
  radiationProtection:PrimaryArmor;
  type:string;
  useConsumableForAttack:string;
  location:string[];
  isPowered:boolean;
}

export interface Augment extends GearTemplate, LinkTemplate {
  templates:string[];
  auglocation:string;
  type:string;
  bonus:string;
  location:string[];
}

export interface Component extends GearTemplate, LinkTemplate {
  templates:string[];
  subtype:string;
  powerDraw:number;
  rating:string;
  availableQuantity:string;
  damage:string;
  radDamage:string;
  hits:number;
  range:string;
  status:string;
  weightIsPct:boolean;
  isIllegal:boolean;
  purchasePrice:string;
  cargoLocation:string;
  generatesPower:boolean;
  isRefined:boolean;
  features:string;
  pricingBasis:string;
  isBaseHull:boolean;
  rollModifier:string;
  rateOfFire: string;
  armorPiercing: number;
  actorLink: string;
  hardened: boolean;
  associatedSkillName:string;
  ammunition:Encumbrance;
  isPopup:boolean;
  isExtended:boolean;
  bandwidth: number;
}

export interface Consumable extends GearTemplate, LinkTemplate {
  templates:string[];
  currentCount:number;
  max:number;
  type:string;
  subtype:string;
  location:string[];
  armorPiercing:number;
  bonusDamage:string;
  isAttachment:boolean;
  bandwidth:number;
  softwareActive:boolean;
  damageType:string;
}

export interface Equipment extends GearTemplate, LinkTemplate {
  templates:string[];
  type:string;
  useConsumableForAttack:string;
  location:string[];
  priorType?:string;
}

export interface Tool extends GearTemplate, LinkTemplate {
  templates:string[];
  type:string;
  useConsumableForAttack:string;
  location:string[];
}

export interface Skills extends LinkTemplate {
  templates:string[];
  value:number;
  characteristic:string;
  type:string;
  description:string;
  shortdescr:string;
  subtype:string;
  key:string;
  difficulty:string;
  rolltype:string;
  trainingNotes:string;
}

export interface Templates {
  gearTemplate:GearTemplate;
  referenceTemplate:LinkTemplate;
  targetTemplate: TargetTemplate
}

export interface LinkTemplate {
  docReference:string;
  pdfReference:PDFLink;
}

export interface PDFLink {
  type:string;
  href:string;
  label:string;
}

export interface GearTemplate {
  consumableData:ConsumableDataSource;
  attachmentData:ConsumableDataSource;
  name:string;
  techLevel:number;
  description:string;
  shortdescr:string;
  quantity:number;
  weight:number;
  price:string;
  traits:any[];
  consumables:any[];
  skillModifier:number;
  skill:string;
  associatedSkillName:string;
  equipped:Equipped;
}

export interface TargetTemplate {
  target: TemplateData
}

export interface TemplateData {
  value: number,
  width: number,
  units: string,
  type: string
}
export enum Equipped {
  equipped = "equipped",
  ship = "ship",
  backpack = "backpack"
}

export interface Trait extends LinkTemplate {
  templates:string[];
  value:number;
  type:string;
  description:string;
  prereq:string;
  shortdescr:string;
  subtype:string;
  key:string;
}

export interface Spell extends LinkTemplate, TargetTemplate {
  templates:string[];
  value:number;
  type:string;
  description:string;
  circle:string;
  duration:string;
  shortdescr:string;
  subtype:string;
}

export interface Weapon extends GearTemplate, LinkTemplate, TargetTemplate {
  templates:string[];
  range:number;
  damage:string;
  damageBonus:number;
  magazineSize:number;
  ammo:number;
  useConsumableForAttack:string;
  magazineCost:number;
  type:string;
  location:string[];
  lawLevel:number;
  rangeBand:string;
  weaponType:string;
  damageType:string;
  rateOfFire:string;
  recoil:boolean;
  features:string;
  armorPiercing:number;
}

export interface Computer extends GearTemplate, LinkTemplate {
  templates:string[];
  processingPower:number;
}
