import {
  CharacterDataSourceData,
  ShipDataSourceData,
} from './actor-data-source';

declare global {
  interface DataConfig {
    Actor: TwodsixActorDataProperties;
  }
}

export type TwodsixActorDataProperties =
  | TwodsixCharacterDataSource
  | TwodsixShipDataSource;

interface TwodsixCharacterDataSource {
  data: CharacterDataPropertiesData;
  type: 'traveller';
}

interface TwodsixShipDataSource {
  data: ShipDataPropertiesData;
  type: 'ship';
}

type CharacterDataPropertiesData = CharacterDataSourceData

type ShipDataPropertiesData = ShipDataSourceData
