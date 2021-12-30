//Everything except the namespace is generated from template.json using https://app.quicktype.io/?l=ts

declare namespace dataTwodsix {

  // Actors
  interface TravellerDataSource {
    type: 'traveller';
    data: Traveller;
  }

  interface ShipDataSource {
    type: 'ship';
    data: Ship;
  }

  type ActorTwodsixDataSource = TravellerDataSource | ShipDataSource;

  // Items
  interface EquipmentDataSource {
    type: 'equipment';
    data: Equipment;
  }

  interface ArmorDataSource {
    type: 'armor';
    data: Armor;
  }

  interface AugmentDataSource {
    type: 'augment';
    data: Augment;
  }

  interface StorageDataSource {
    type: 'storage';
    data: Storage;
  }

  interface ToolDataSource {
    type: 'tool';
    data: Equipment;
  }

  interface JunkDataSource {
    type: 'junk';
    data: Equipment;
  }

  interface SkillsDataSource {
    type: 'skills';
    data: Skills;
  }

  interface TraitDataSource {
    type: 'trait';
    data: Trait;
  }

  interface ConsumableDataSource {
    type: 'consumable';
    data: Consumable;
  }

  interface ComponentDataSource {
    type: 'component';
    data: Component;
  }

  interface WeaponDataSource {
    type: 'weapon';
    data: Weapon;
  }

  type ItemTwodsixDataSource = ArmorDataSource
    | AugmentDataSource
    | ComponentDataSource
    | ConsumableDataSource
    | EquipmentDataSource
    | ToolDataSource
    | JunkDataSource
    | SkillsDataSource
    | StorageDataSource
    | TraitDataSource
    | WeaponDataSource
    ;

  type Gear = Armor
    | Equipment
    | Storage
    | Weapon
    ;

  type UsesConsumables = Armor
    | Equipment
    | Weapon
    ;

  // If/when template.json is edited, this file needs to be edited to match.
  // Everything below these comments was initially generated from template.json using https://app.quicktype.io/?l=ts, possibly edited, possibly unused.
  // Known changes: extends GearTemplate has been added in several places
  export interface Twodsix {
    actor: Actor;
    item: Item;
  }

  export interface Actor {
    types: string[];
    traveller: Traveller;
    ship: Ship;
  }

  export interface Ship {
    name: string;
    crew: Crew;
    notes: string;
    cargo: string;
    finances: string;
    maintenanceCost: number;
    shipValue: string;
    reqPower: ReqPower;
    other: string;
    shipStats: ShipStats;
    systems: Systems;
    staterooms: Staterooms;
    software: Software;
    commonAreas: CommonAreas;
  }

  export interface CommonAreas {
    number: string;
    weight: string;
    cost: string;
  }

  export interface Crew {
    captain: string;
    pilot: string;
    astrogator: string;
    engineer: string;
    maintenance: string;
    gunner: string;
    medic: string;
    admin: string;
    steward: string;
    broker: string;
    marine: string;
    other: string;
  }

  export interface ReqPower {
    systems: number;
    mDrive: number;
    jDrive: number;
    sensors: number;
    weapons: number;
  }

  export interface ShipStats {
    hull: Hits;
    fuel: Hits;
    power: Hits;
    armor: Staterooms;
    mDrive: Staterooms;
    jDrive: Staterooms;
    powerPlant: Staterooms;
    fuelTanks: Staterooms;
    bridge: Staterooms;
    computer: Staterooms;
    sensors: Staterooms;
    weapons: Weapons;
    ammunition: string;
  }

  export interface Staterooms {
    name: Name;
    weight: string;
    cost: string;
    power?: string;
  }

  export enum Name {
    Empty = "",
    JDrive = "J-Drive",
    MDrive = "M-Drive",
    PowerPlant = "Power-Plant",
  }

  export interface Hits {
    value: number;
    min: number;
    max: number;
  }

  export interface Weapons {
    weapon1: Staterooms;
    weapon2: Staterooms;
    weapon3: Staterooms;
    weapon4: Staterooms;
    weapon5: Staterooms;
    weapon6: Staterooms;
    weapon7: Staterooms;
    weapon8: Staterooms;
  }

  export interface Software {
    name: string;
    cost: string;
  }

  export interface Systems {
    system1: Staterooms;
    system2: Staterooms;
    system3: Staterooms;
    system4: Staterooms;
    system5: Staterooms;
    system6: Staterooms;
    system7: Staterooms;
    system8: Staterooms;
  }

  export interface Traveller {
    name: string;
    homeWorld: string;
    species: string;
    age: Age;
    hits: Hits;
    gender: string;
    radiationDose: Hits;
    encumbrance: Encumbrance;
    primaryArmor: PrimaryArmor;
    secondaryArmor: PrimaryArmor;
    heroPoints: number;
    radiationProtection: PrimaryArmor;
    contacts: string;
    allies: string;
    enemies: string;
    untrainedSkill: string;
    description: string;
    bio: string;
    notes: string;
    finances: Finances;
    characteristics: Characteristics;
  }

  export interface Age {
    value: number;
    min: number;
  }

  export interface Characteristics {
    strength: Characteristic;
    dexterity: Characteristic;
    endurance: Characteristic;
    intelligence: Characteristic;
    education: Characteristic;
    socialStanding: Characteristic;
    psionicStrength: Characteristic;
    stamina: Characteristic;
    lifeblood: Characteristic;
    alternative1: Characteristic;
    alternative2: Characteristic;
  }

  export interface Characteristic {
    key: string;
    value: number;
    damage: number;
    label: string;
    shortLabel: string;
    current: number; //Not in template.json
    mod: number; //Not in template.json
  }

  export interface Encumbrance {
    value: number;
    max: number;
  }

  export interface Finances {
    cash: string;
    pension: string;
    debt: string;
    payments: string;
    livingCosts: string;
    financialNotes: string;
  }

  export interface PrimaryArmor {
    value: number;
  }

  export interface Item {
    types: string[];
    equipped: string[];
    templates: Templates;
    equipment: Equipment;
    tool: Equipment;
    weapon: Weapon;
    armor: Armor;
    augment: Augment;
    skills: Skills;
    trait: Trait;
    consumable: Consumable;
    component: Component;
  }

  export interface Armor extends GearTemplate {
    templates: string[];
    armor: number;
    secondaryArmor: PrimaryArmor;
    radiationProtection: PrimaryArmor;
    type: string;
    useConsumableForAttack: string;
    location: string[];
  }

  export interface Augment extends GearTemplate {
    templates: string[];
    auglocation: string;
    type: string;
    bonus: string;
    location: string[];
  }

  export interface Component extends GearTemplate {
    templates: string[];
    subtype: string[];
    powerDraw: number;
    rating: string;
    availableQuantity: string;
    damage: string;
    status: string[];
  }

  export interface Consumable extends GearTemplate {
    templates: string[];
    currentCount: number;
    max: number;
    type: string;
    subtype: string;
    location: string[];
  }

  export interface Equipment extends GearTemplate {
    templates: string[];
    type: string;
    useConsumableForAttack: string;
    location: string[];
  }

  export interface Skills {
    templates: string[];
    value: number;
    characteristic: string;
    type: string;
    description: string;
    shortdescr: string;
    subtype: string;
    reference: string;
    key: string;
    difficulty: string;
    rolltype: string;
  }

  export interface Templates {
    gearTemplate: GearTemplate;
  }

  export interface GearTemplate {
    consumableData: ConsumableDataSource;
    name: string;
    techLevel: number;
    description: string;
    shortdescr: string;
    quantity: number;
    weight: number;
    price: string;
    traits: any[];
    consumables: any[];
    equipped: Equipped;
    skillModifier: number;
    skill: string;
    associatedSkillName: string;
  }

  export interface Equipped {
    weight: number;
  }

  export interface Trait {
    templates: string[];
    value: number;
    type: string;
    description: string;
    prereq: string;
    shortdescr: string;
    subtype: string;
    reference: string;
    key: string;
  }

  export interface Weapon extends GearTemplate {
    templates: string[];
    range: number;
    damage: string;
    damageBonus: number;
    magazineSize: number;
    ammo: number;
    useConsumableForAttack: string;
    magazineCost: number;
    type: string;
    location: string[];
    lawLevel: number;
    rangeBand: string;
    weaponType: string;
    damageType: string;
    rateOfFire: string;
    recoil: boolean;
  }
}
