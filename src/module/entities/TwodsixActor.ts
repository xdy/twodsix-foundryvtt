/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
import {calcModFor, getKeyByValue} from "../utils/sheetUtils";
import {TWODSIX} from "../config";
import {TwodsixRollSettings} from "../utils/TwodsixRollSettings";
import {TwodsixDiceRoll} from "../utils/TwodsixDiceRoll";
import TwodsixItem from "./TwodsixItem";
import { Stats } from "../utils/actorDamage";

export default class TwodsixActor extends Actor {
  /**
   * Augment the basic actor data with additional dynamic data.
   */
  prepareData():void {
    super.prepareData();

    const actorData = this.data;
    // const data = actorData.data;
    // const flags = actorData.flags;

    // Make separate methods for each Actor type (traveller, npc, etc.) to keep
    // things organized.
    switch (actorData.type) {
      case 'traveller':
        this._prepareTravellerData(actorData);
        break;
      case 'ship':
        break;
      default:
        console.log(game.i18n.localize("Twodsix.Actor.UnknownActorType") + " " + actorData.type);
    }

  }

  /**
   * Prepare Character type specific data
   */
  _prepareTravellerData(actorData:any):void {
    // Get the Actor's data object
    const {data} = actorData;

    for (const cha of Object.values(data.characteristics as Record<any, any>)) {
      cha.current = cha.value - cha.damage;
      cha.mod = calcModFor(cha.current);
      
      //Check to see if inputCurrent is defined and synced
      if (cha.inputCurrent === undefined || cha.inputCurrent === "") {
        cha.inputCurrent = cha.current;
      }
    }
  }

  protected async _onCreate(data, options, user) {
    switch (this.data.type) {
      case "traveller":
        await this.createUntrainedSkill();
        await this.update({
          'img': 'systems/twodsix/assets/icons/default_actor.png',
        });
        break;
      case "ship":
        await this.update({
          'img': 'systems/twodsix/assets/icons/default_ship.png',
        });
        break;
    }
    if(game.settings.get("twodsix", "useSystemDefaultTokenIcon")) {
      await this.update({
        'token.img': CONST.DEFAULT_TOKEN //'icons/svg/mystery-man.svg'
      });
    }
  }

  protected async damageActor(damage:number, showDamageDialog=true):Promise<void> {
    if (showDamageDialog) {
      const damageData = {
        damage: damage,
        damageId: "damage-" + Math.random().toString(36).substring(2, 15)
      };

      if (this.isToken) {
        damageData["tokenId"] = this.token.id;
      } else {
        damageData["actorId"] = this.id;
      }
      game.socket.emit("system.twodsix", ["createDamageDialog", damageData]);
      Hooks.call('createDamageDialog', damageData);
    } else {
      const stats = new Stats(this, damage);
      stats.applyDamage();
    }
  }

  public getCharacteristicModifier(characteristic:string):number {
    if (characteristic === 'NONE') {
      return 0;
    } else {
      const keyByValue = getKeyByValue(TWODSIX.CHARACTERISTICS, characteristic);
      return calcModFor(this.data.data.characteristics[keyByValue].current);
    }
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  public async characteristicRoll(tmpSettings:any, showThrowDialog:boolean, showInChat = true):Promise<TwodsixDiceRoll> {
    if (!tmpSettings["characteristic"]) {
      ui.notifications.error(game.i18n.localize("TWODSIX.Errors.NoCharacteristicForRoll"));
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
    console.log("DEBUG CHARACTERISTICS ROLL:", diceRoll);
    return diceRoll;
  }

  public getUntrainedSkill():TwodsixItem {
    return this.items.get(this.data.data.untrainedSkill) as TwodsixItem;
  }

  public async createUntrainedSkill(): Promise<void> {
    const untrainedSkill = await this.buildUntrainedSkill();
    await this.update({"data.untrainedSkill": untrainedSkill.id});
  }

  public async buildUntrainedSkill():Promise<TwodsixItem> {
    if (this.data.data.untrainedSkill) {
      return;
    }
    const data = {
      "name": game.i18n.localize("TWODSIX.Actor.Skills.Untrained"),
      "type": "skills",
      "flags": {'twodsix.untrainedSkill': true}
    };


    //const data1 = await this.createOwnedItem(data) as unknown as TwodsixItem;
    // TODO Something like the below, but actually working... (I still get collection.set is not a function)
    // const data1 = await this.createEmbeddedDocument("Item", [ { "data": data } ]);
    // @ts-ignore Until 0.8 types
    const data1 = await (this.createEmbeddedDocuments("Item",[data]));
    return data1[0];
  }

  private static _applyToAllActorItems(func: (actor:TwodsixActor, item:TwodsixItem) => void):void {
    game.actors.forEach(actor => {
      // @ts-ignore
      actor.items.forEach((item:TwodsixItem) => {
        // @ts-ignore
        func(actor, item);
      });
    });
  }

  public static resetUntrainedSkill():void {
    TwodsixActor._applyToAllActorItems((actor:TwodsixActor, item:TwodsixItem) => {
      if (item.type === "skills") {
        return;
      }
      const skill = actor.items.get(item.data.data.skill);
      if (skill && skill.getFlag("twodsix", "untrainedSkill")) {
        item.update({ "data.skill": "" }, {});
      }
    });
  }

  public static setUntrainedSkillForWeapons():void {
    TwodsixActor._applyToAllActorItems((actor:TwodsixActor, item:TwodsixItem) => {
      if (item.type === "weapon" && !item.data.data.skill && actor.type === "traveller") {
        item.update({"data.skill": actor.getUntrainedSkill().id}, {});
      }
    });
  }
}
