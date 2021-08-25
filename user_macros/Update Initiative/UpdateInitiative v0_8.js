/* eslint-disable semi */
/* eslint-disable no-undef */
// Update initiative rolls to add the tactics level for each actor to the roll
// version for FVTT v0.8

async function adjustInitiative () {
  const fighters = await game.combat.data.combatants;
  for (const comb of fighters) {
    const tacSkill =
          await comb.actor.data.items.find(item => item.name === 'Tactics');
    if (tacSkill != null && comb.initiative != null) {
      const tacValue = tacSkill.data.data.value + comb.initiative;
      await game.combat.setInitiative(comb.id, tacValue);
    }
  }
}

adjustInitiative();
