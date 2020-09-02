// Namespace TWODSIX Configuration Values

export const TWODSIX:any = {};

/**
 * The sets of rules variants one can use
 * Not currently used for anything. TODO Remove?
 * @type {Object}
 */
TWODSIX.VARIANTS = {
    "ce": "Cepheus Engine",
}

TWODSIX.ROLLTYPES = {
    Advantage: "3d6kh2",
    Normal: "2d6",
    Disadvantage: "3d6kl2"
}

//This is defined the CE way, but it's mathematically equivalent to other variants.
TWODSIX.DIFFICULTIES = {
    Simple: 6,
    Easy: 4,
    Routine: 2,
    Average: 0,
    Difficult: -2,
    VeryDifficult: -4,
    Formidable: -6,
    Impossible: -8
}

