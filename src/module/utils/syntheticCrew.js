import { buildUntrainedSkillData } from "../entities/actors/actor-base";

/**
 * Build an unsaved Traveller used to perform ship actions for a position with no assigned crew.
 * Its Untrained skill carries the position's uncrewed skill level, so it acts as a universal skill level.
 * @param {TwodsixItem} position - the ship position item
 * @returns {TwodsixActor} an in-memory actor (never persisted)
 */
export function createSyntheticCrew(position) {
  const untrained = buildUntrainedSkillData();
  untrained.name = game.i18n.localize("TWODSIX.Ship.UncrewedSkillName");
  untrained.system.value = position?.system?.crewSkillLevel ?? 0;
  const name = game.i18n.localize("TWODSIX.Ship.UncrewedPositionName").replace("_POSITION_NAME_", position?.name ?? "");
  return new CONFIG.Actor.documentClass({
    name: name,
    type: "traveller",
    flags: {twodsix: {syntheticCrew: true}},
    system: {untrainedSkill: untrained._id},
    items: [untrained]
  });
}

/**
 * @param {TwodsixActor} actor
 * @returns {boolean} true if the actor is an unsaved synthetic crew actor
 */
export function isSyntheticCrew(actor) {
  return actor?.getFlag?.("twodsix", "syntheticCrew") === true;
}

/**
 * Chat speaker for an actor, using an alias for synthetic crew since they are not in the world.
 * @param {TwodsixActor} actor
 * @returns {object}
 */
export function getCrewSpeaker(actor) {
  return isSyntheticCrew(actor)
    ? {scene: null, token: null, actor: null, alias: actor.name}
    : ChatMessage.getSpeaker({actor});
}
