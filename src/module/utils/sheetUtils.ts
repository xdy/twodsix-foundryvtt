//Assorted utility functions likely to be helpful when displaying characters


export function pseudoHex(value:number):string {
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
            return String(value);
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

export function fromPseudoHex(value:string):number {
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

export function nobleTitle(soc:number, gender:string):string {
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

export function calcModFor(characteristic:number):number {
    // TODO If characteristic is 0 and not cepheus, set mod to -3
    return Math.floor((characteristic - 6) / 3);
}

export function calcModFromString(characteristic:string):number {
    // TODO If characteristic is 0 and not cepheus, set mod to -3
    const number = fromPseudoHex(characteristic);
    return (number - 6) / 3;
}

//TODO The terms used for this should be configurable
export enum Rolltype {
    Advantage = "3d6kh2",
    Normal = "2d6",
    Disadvantage = "3d6kl2",
}

//TODO This is defined the CE way, but it's mathematically equivalent to other variants.
export enum Difficulties {
    Simple = 6,
    Easy = 4,
    Routine = 2,
    Average = 0,
    Difficult = -2,
    VeryDifficult = -4,
    Formidable = -6,
    Impossible = -8
}





