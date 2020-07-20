/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
import {calcModFor} from "../utils/sheetUtils";

export default class TwodsixActor extends Actor {

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData():void {
        super.prepareData();

        const actorData = this.data;

        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        switch (actorData.type) {
            case 'character':
                this._prepareCharacterData(actorData);
                break;
            // case 'npc':
            //    // TODO Should share a lot of functionality with character
            //     this._prepareNpcData(actorData);
            //     break;
            // case 'animal':
                // TODO This is for animals 'without characteristics', like in mongoose 2. If they have characteristics, they're npcs.
            //     this._prepareAnimalData(actorData);
            //     break;
            // case 'vehicle':
            //     this._prepareVehicleData(actorData);
            //     break;
            // case 'ship':
            //     this._prepareShipData(actorData);
            //     break;
            default:
                console.log(`Unhandled actorData.type in prepareData:${actorData.type}`)
        }

    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData:ActorData):void {
        // Get the Actor's data object
        const { data } = actorData;

        for (const cha of Object.values(data.characteristics as Record<any, any>)) {
            cha.mod = calcModFor(cha.value)
        }
    }


}