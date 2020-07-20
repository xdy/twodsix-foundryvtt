/**
 * Prepare Character type specific data
 */

//The base characteristics
import {TWODSIX} from "../config";
import {calcModFromString, fromPseudoHex} from "./sheetUtils";

TWODSIX.CHARACTERISTICS = ["STR", "DEX", "END", "INT", "EDU", "SOC", "PSI"];

//TODO Change so that it modifies the current character's data.

function testParse(actorData:ActorData):void {
    let {data} = actorData;

    // TODO Temporary hardcoding
    data.UCF = "Bruce Ayala \t786A9A \tAge 38\n" +
        "\tEntertainer (5 terms) \tCr70,000\n" +
        "\tAthletics-1, Admin-1, Advocate-1, Bribery-1, Carousing-3, Computer-2, Gambling-0, Grav Vehicle-0, Liaison-2, Linguistics-0, Streetwise-0\n" +
        "\tHigh passage (x2)";
    data.notes = [];

    data = parseUCF(data, data.UCF);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
function parseUCF(data:any, ucf:string):unknown {
    const ucfData = duplicate(data);
    const ucfline = ucf.replace(/(\r\n|\n|\r)/gm, "");
    const strings:string[] = ucfline.split("\t");
    ucfData.name = strings[0];

    const characteristics:unknown[] = [];
    const upp:string = strings[1];
    for (let i = 0; i < upp.trim().split('').length; i++) {
        const key:string = CONFIG.TWODSIX.characteristics[i];
        const value:number = fromPseudoHex(upp.trim().split('')[i]);
        //characteristics.push([key, value]);
        ucfData.characteristics["key"].value = value;
    }
    ucfData.characteristics = characteristics;
    ucfData.upp = upp;

    ucfData.age = strings[2]
    ucfData.career = strings[3];
    ucfData.funds = strings[4];

    const skills = [];
    strings[5].split(",").forEach(x => {
        const keyValue = x.split("-").map(y => y.trim());
        const skill = {name: keyValue[0], level: keyValue[1], selected: false};
        skills.push(skill);
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

function modForCharacteristicFromUpp(upp:string, pos:number):
    number {
    const characteristic = upp.substr(pos);
    return calcModFromString(characteristic);
}

