import TwodsixActor from "../entities/TwodsixActor";

Hooks.on('createActor', async (actor: TwodsixActor) => {
  if (actor.data.type == "traveller") {
    await actor.createUntrainedSkill();
  }
});
