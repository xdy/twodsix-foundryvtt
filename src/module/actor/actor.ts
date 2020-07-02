/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export default class TwodsixActor extends Actor {

    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData() {
        super.prepareData();

        const actorData = this.data;
        const {data} = actorData;

        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        switch (actorData.type) {
            case 'character':
                this._prepareCharacterData(actorData);
                break;
            // case 'npc':
            //     this._prepareNpcData(actorData);
            //     break;
            // case 'animal':
            //     this._prepareAnimalData(actorData);
            //     break;
            // case 'vehicle':
            //     this._prepareVehicleData(actorData);
            //     break;
            // case 'ship':
            //     this._prepareShipData(actorData);
            //     break;
            default:
                console.log("Unhandled actorData.type in prepareData:" + actorData.type)
        }

    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData: ActorData) {
        const {data} = actorData;

        // Loop through characteristics scores, and add their modifiers to our sheet output.
        for (const abl of Object.values(data.characteristics as Record<any, any>)) {
            abl.mod = Math.floor((abl.value - 6) / 3);
        }

        data.upp = this._upp(data);

    }

    _upp(actorData: ActorData) {
        const {data} = actorData;
        for (const abl of Object.values(data.characteristics as Record<any, any>)) {
            if (abl.short != 'PSI') data.upp += this._pseudoHex(abl.value);
        }
        return data;
    }

    _pseudoHex(value: number) {
        switch (value) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
                return value;
            case 10:
                return "A";
            case 11:
                return "B";
            case 12:
                return "C";
            case 13:
                return "D";
            case 14:
                return "E";
            case 15:
                return "F";
            case 16:
                return "G";
            case 17:
                return "H";
            case 18:
                return "J";
            case 19:
                return "K";
            case 20:
                return "L";
            case 21:
                return "M";
            case 22:
                return "N";
            case 23:
                return "P";
            case 24:
                return "Q";
            case 25:
                return "R";
            case 26:
                return "S";
            case 27:
                return "T";
            case 28:
                return "U";
            case 29:
                return "V";
            case 30:
                return "W";
            case 31:
                return "X";
            case 32:
                return "Y";
            case 33:
                return "Z";
            default:
                throw "value " + value + " is not usable as a pseudohexadecimal value";
        }
    }

    _fromPseudoHex(value: string) {
        switch (value) {
            case "0":
                return 0;
            case "1":
                return 1;
            case "2":
                return 2;
            case "3":
                return 3;
            case "4":
                return 4;
            case "5":
                return 5;
            case "6":
                return 6;
            case "7":
                return 7;
            case "8":
                return 8;
            case "9":
                return 9;
            case "A":
                return 10;
            case "B":
                return 11;
            case "C":
                return 12;
            case "D":
                return 13;
            case "E":
                return 14;
            case "F":
                return 15;
            case "G":
                return 16;
            case "H":
                return 17;
            case "J":
                return 18;
            case "K":
                return 19;
            case "L":
                return 20;
            case "M":
                return 21;
            case "N":
                return 22;
            case "P":
                return 23;
            case "Q":
                return 24;
            case "R":
                return 25;
            case "S":
                return 26;
            case "T":
                return 27;
            case "U":
                return 28;
            case "V":
                return 29;
            case "W":
                return 30;
            case "X":
                return 31;
            case "Y":
                return 32;
            case "Z":
                return 33;
            default:
                throw "value " + value + " is not a pseudohexadecimal value";
        }
    }


    _nobleTitle(soc: number, gender: string) {
        switch (soc) {
            case 10:
                return gender == "M" ? "Lord" : "Lady";
            case 11:
                return gender == "M" ? "Sir" : "Dame";
            case 12:
                return gender == "M" ? "Baron" : "Baroness";
            case 13:
                return gender == "M" ? "Marquis" : "Marchioness";
            case 14:
                return gender == "M" ? "Count" : "Countess";
            case 15:
                return gender == "M" ? "Duke" : "Duchess";
            case 16:
                return gender == "M" ? "Archduke" : "Archduchess";
            case 17:
                return gender == "M" ? "Crown Prince" : "Crown Princess";
            case 18:
                return gender == "M" ? "Emperor" : "Empress";
            default:
                return "";
        }
    }

}