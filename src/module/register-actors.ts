import {twodsixActorSheet} from "./actors/actor-sheet";
export default function registerActors(){
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("twodsix", twodsixActorSheet, {makeDefault: true});
}

