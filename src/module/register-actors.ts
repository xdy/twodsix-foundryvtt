import {twodsixActorSheet} from "./actor/actor-sheet.js";
export function registerActors(){
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("twodsix", twodsixActorSheet, {makeDefault: true});
}

