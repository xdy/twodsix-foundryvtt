import {DocumentModificationOptions} from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/abstract/document.mjs';
import {ActorDataConstructorData} from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/data/data.mjs/actorData';
import {calcModFor, getKeyByValue} from '../utils/sheetUtils';
import {TWODSIX} from '../config';
import {TwodsixRollSettings} from '../utils/TwodsixRollSettings';
import {TwodsixDiceRoll} from '../utils/TwodsixDiceRoll';
import TwodsixItem from './TwodsixItem';
import {Stats} from '../utils/actorDamage';
import {getGame, getUi} from '../utils/utils';
import {CharacterDataSourceData, ShipDataSourceData} from "./actor-data-source";

declare global {
  interface DocumentClassConfig {
    Actor: typeof TwodsixActor;
  }
}

export default class TwodsixActor extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  /** @override */
  prepareBaseData() {

    // const data = actorData.data;
    // const flags = actorData.flags;

    // Make separate methods for each Actor type (traveller, npc, etc.) to keep
    // things organized.
    switch (this.data.type) {
      case 'traveller':
        this._prepareTravellerData(this.data);
        break;
      case 'ship':
        break;
      // default:
      //   console.log(getGame().i18n.localize('Twodsix.Actor.UnknownActorType') + ' ' + data.type);
    }

  }

  /**
   * Prepare Character type specific data
   */
  _prepareTravellerData(actorData: any): void {
    // Get the Actor's data object
    const {data} = actorData;

    for (const cha of Object.values(data.characteristics as Record<any, any>)) {
      cha.current = cha.value - cha.damage;
      cha.mod = calcModFor(cha.current);
    }
  }

  protected async _onCreate(data) {
    switch (data.type) {
      case 'traveller':
        await this.createUntrainedSkill();
        await this.update({
          'img': 'systems/twodsix/assets/icons/default_actor.png',
          'token.img': 'systems/twodsix/assets/icons/default_actor.png'
        });
        break;
      case 'ship':
        await this.update({
          'img': 'systems/twodsix/assets/icons/default_ship.png',
          'token.img': 'systems/twodsix/assets/icons/default_ship.png'
        });
        break;
    }
  }

  async damageActor(damage: number, showDamageDialog = true): Promise<void> {
    if (showDamageDialog) {
      const damageData = {
        damage: damage,
        damageId: 'damage-' + Math.random().toString(36).substring(2, 15)
      };

      if (this.isToken && this.token) {
        damageData['tokenId'] = this.token.id;
      } else {
        damageData['actorId'] = this.id;
      }
      getGame().socket?.emit('system.twodsix', ['createDamageDialog', damageData]);
      Hooks.call('createDamageDialog', damageData);
    } else {
      const stats = new Stats(this, damage);
      stats.applyDamage();
    }
  }

  public getCharacteristicModifier(characteristic: string): number {
    if (characteristic === 'NONE') {
      return 0;
    } else {
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      const data: (object & CharacterDataSourceData) | (object & ShipDataSourceData) = this.data.data;
      return calcModFor(data.characteristics[keyByValue].current);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async characteristicRoll(tmpSettings: any, showThrowDialog: boolean, showInChat = true): Promise<TwodsixDiceRoll> {
    if (!tmpSettings['characteristic']) {
      getUi().notifications?.error(getGame().i18n.localize('TWODSIX.Errors.NoCharacteristicForRoll'));
      return;
    }
    const settings = await TwodsixRollSettings.create(showThrowDialog, tmpSettings);
    if (!settings.shouldRoll) {
      return;
    }

    const diceRoll = new TwodsixDiceRoll(settings, this);
    if (showInChat) {
      await diceRoll.sendToChat();
    }
    console.log('DEBUG CHARACTERISTICS ROLL:', diceRoll);
    return diceRoll;
  }

  public getUntrainedSkill(): TwodsixItem {
    return this.items.get(this.data.data.untrainedSkill) as TwodsixItem;
  }

  public async createUntrainedSkill(): Promise<void> {
    const untrainedSkill = await this.buildUntrainedSkill();
    await this.update({'data.untrainedSkill': untrainedSkill.id});
  }

  public async buildUntrainedSkill(): Promise<TwodsixItem> {
    if (this.data.data.untrainedSkill) {
      return;
    }
    const data = {
      'name': getGame().i18n.localize('TWODSIX.Actor.Skills.Untrained'),
      'type': 'skills',
      'flags': {'twodsix.untrainedSkill': true}
    };


    //const data1 = await this.createOwnedItem(data) as unknown as TwodsixItem;
    // TODO Something like the below, but actually working... (I still get collection.set is not a function)
    // const data1 = await this.createEmbeddedDocument("Item", [ { "data": data } ]);
    // @ts-ignore Until 0.8 types
    const data1 = await (this.createEmbeddedDocuments('Item', [data]));
    return data1[0];
  }

  private static _applyToAllActorItems(func: (actor: TwodsixActor, item: TwodsixItem) => void): void {
    getGame().actors?.forEach(actor => {
      // @ts-ignore
      actor.items.forEach((item: TwodsixItem) => {
        // @ts-ignore
        func(actor, item);
      });
    });
  }

  public static resetUntrainedSkill(): void {
    TwodsixActor._applyToAllActorItems((actor: TwodsixActor, item: TwodsixItem) => {
      if (item.type === 'skills') {
        return;
      }
      const skill = actor.items.get(item.data.data.skill);
      if (skill && skill.getFlag('twodsix', 'untrainedSkill')) {
        item.update({'data.skill': ''}, {});
      }
    });
  }

  public static setUntrainedSkillForWeapons(): void {
    TwodsixActor._applyToAllActorItems((actor: TwodsixActor, item: TwodsixItem) => {
      if (item.type === 'weapon' && !item.data.data.skill) {
        item.update({'data.skill': actor.getUntrainedSkill().id}, {});
      }
    });
  }

  async _preCreate(
    data: ActorDataConstructorData,
    options: DocumentModificationOptions,
    user: User,
  ) {
    await super._preCreate(data, options, user);

    if (getGame().settings.get('twodsix', 'defaultTokenSettings')) {
      let link = false;
      let disposition: number = CONST.TOKEN_DISPOSITIONS.HOSTILE;

      if (this.data.type === 'traveller') {
        link = true;
        disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
      }

      const tokenData = mergeObject(this.data, {
        'token.displayName': CONST.TOKEN_DISPLAY_MODES.OWNER,
        'token.displayBars': CONST.TOKEN_DISPLAY_MODES.ALWAYS,
        'token.vision': true,
        'token.brightSight': 30,
        'token.dimSight': 0,
        'token.actorLink': link,
        'token.disposition': disposition,
        'token.bar1': {
          attribute: 'hits',
        }
      });

      this.data.token.update(tokenData);
    }
  }

}
