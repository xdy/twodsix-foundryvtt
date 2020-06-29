import {twodsixActorSheet} from "./actor/actor-sheet";
export default function registerActors(){
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("twodsix", twodsixActorSheet, {makeDefault: true});
}

