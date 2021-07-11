declare global {
  interface SourceConfig {
    Actor: TwodsixActorDataSource;
  }
}

export type TwodsixActorDataSource =
  | TwodsixCharacterDataSource
  | TwodsixVehicleDataSource;

interface TwodsixCharacterDataSource {
  data: CharacterDataSourceData;
  type: 'traveller';
}

interface TwodsixVehicleDataSource {
  data: ShipDataSourceData;
  type: 'vehicle';
}

export interface CharacterDataSourceData {
  name: string,
  homeWorld: string,
  species: string,
  age: {
    value: number,
    min: number,
  },
  hits: {
    value: number,
    min: number,
    max: number,
  },
  gender: string,
  radiationDose: {
    value: number,
    max: number,
    min: number,
  },
  primaryArmor: {
    value: number,
  },
  secondaryArmor: {
    value: number,
  },
  radiationProtection: {
    value: number,
  },
  contacts: string,
  allies: string,
  enemies: string,
  untrainedSkill: string,
  description: string,
  bio: string,
  notes: string,
  finances: {
    cash: string,
    pension: string,
    debt: string,
    payments: string,
    livingCosts: string,
    financialNotes: string //TODO
  },
  characteristics: {
    strength: {
      key: string,
      value: number,
      damage: number,
      label: string,
      shortLabel: string
    },
    dexterity: {
      key: string,
      value: number,
      damage: number,
      label: string,
      shortLabel: string
    },
    endurance: {
      key: string,
      value: number,
      damage: number,
      label: string,
      shortLabel: string
    },
    intelligence: {
      key: string,
      value: number,
      damage: number,
      label: string,
      shortLabel: string
    },
    education: {
      key: string,
      value: number,
      damage: number,
      label: string,
      shortLabel: string
    },
    socialStanding: {
      key: string,
      value: number,
      damage: number,
      label: string,
      shortLabel: string
    },
    psionicStrength: {
      key: string,
      value: number,
      damage: number,
      label: string,
      shortLabel: string
    }
  }
}

//TODO
export interface ShipDataSourceData {
  size: number;
}
