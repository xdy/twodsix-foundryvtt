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
                console.log(`Unhandled actorData.type in prepareData:${actorData.type}`)
        }

    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData:ActorData) {
        const {data} = actorData;

        // TODO Temporary hardcoding
        data.UCF = "Bruce Ayala \t786A9A \tAge 38\n" +
            "\tEntertainer (5 terms) \tCr70,000\n" +
            "\tAthletics-1, Admin-1, Advocate-1, Bribery-1, Carousing-3, Computer-2, Gambling-0, Grav Vehicle-0, Liaison-2, Linguistics-0, Streetwise-0\n" +
            "\tHigh passage (x2)";
        data.notes = [];

        this._parseUCF(data, data.UCF)
    }

    _modForCharacteristic(upp:string, pos:number):number {
        // TODO If characteristic is 0 and not cepheus, set mod to -3
        return (this._fromPseudoHex(upp.substr(pos)) - 6) / 3;
    }

    // TODO Move somewhere more appropriate
    static readonly CHARACTERISTICS = ["STR", "DEX", "END", "INT", "EDU", "SOC"];

    _parseUCF(data:any, ucf:string):any {
        const ucfData = data;
        const ucfline = ucf.replace(/(\r\n|\n|\r)/gm, "");
        const strings:string[] = ucfline.split("\t");
        ucfData.name = strings[0];

        const characteristics:any[] = [];
        const upp:string = strings[1];
        for (let i = 0; i < upp.trim().split('').length; i++) {
            const value:number = this._fromPseudoHex(upp.trim().split('')[i]);
            const second:string = TwodsixActor.CHARACTERISTICS[i];
            characteristics.push([second, value]);
        }
        ucfData.characteristics = characteristics;
        ucfData.upp = upp;

        ucfData.age = strings[2]
        ucfData.career = strings[3];
        ucfData.funds = strings[4];

        const skills = [];
        strings[5].split(",").forEach(x => {
            const keyValue = x.split("-").map(y => y.trim());
            skills.push([keyValue[0], keyValue[1]]);
        })
        ucfData.skills = skills;

        // TODO Do more with traits and equipment
        if (strings.length === 8) {
            ucfData.traits = strings[6];
            ucfData.equipment = strings[7];
        } else {
            ucfData.equipment = strings[6];
        }
        // TODO Parse this out and do something with it... (Like, if 'laser pistol', look in compendium, find 'laser pistol', find damage of that, and set it to "laser pistol":"3d6", or whatever the damage is.)
        ucfData.tools = [""];

        // TODO All the stuff below this should probably be in a json file, not hardcoded.

        // TODO Only cepheus for now, should support other lists
        // Should maybe hide column if only one value?
        const difficulties = [];
        ["Routine:6", "Average:8", "Difficult:10", "Very Difficult:12", "Formidable:14"].forEach(x => {
            const keyValue = x.split(":");
            difficulties.push([keyValue[0], keyValue[1]]);
        })
        ucfData.difficulties = difficulties;
        // TODO For cepheus, should really give DM instead of changing value. But, meh, not now.

        ucfData.modifiers = Array.from(Array(19).keys()).map(x => x - 9);

        // TODO Only cepheus for now, should support other lists
        // Should maybe hide column if empty or only one value?
        ucfData.increments = ["seconds", "rounds", "minutes", "kiloseconds", "hours", "days", "weeks", "months", "quarters"];
        ucfData.incrementmodifiers = Array.from(Array(17).keys()).map(x => x - 8);


        return ucfData;
    }

    _pseudoHex(value:number) {
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
                throw new Error(`value ${value} is not usable as a pseudohexadecimal value`);
        }
    }

    _fromPseudoHex(value:string) {
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
                throw new Error(`value ${value} is not a pseudohexadecimal value`);
        }
    }


    _nobleTitle(soc:number, gender:string) {
        switch (soc) {
            case 10:
                return gender === "M" ? "Lord" : "Lady";
            case 11:
                return gender === "M" ? "Sir" : "Dame";
            case 12:
                return gender === "M" ? "Baron" : "Baroness";
            case 13:
                return gender === "M" ? "Marquis" : "Marchioness";
            case 14:
                return gender === "M" ? "Count" : "Countess";
            case 15:
                return gender === "M" ? "Duke" : "Duchess";
            case 16:
                return gender === "M" ? "Archduke" : "Archduchess";
            case 17:
                return gender === "M" ? "Crown Prince" : "Crown Princess";
            case 18:
                return gender === "M" ? "Emperor" : "Empress";
            default:
                return "";
        }
    }

}