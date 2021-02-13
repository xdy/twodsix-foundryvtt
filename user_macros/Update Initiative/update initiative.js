async function adjust_init() {
  let combats = await game.combats.active.data.combatants;
  for (let comb of combats) {
    let tacSkill =
        await comb.actor.data.items.find(item => item.name === 'Tactics');
    if (tacSkill != null && comb.initiative != null) {
      let tacValue = tacSkill.data.value + comb.initiative;
      await game.combats.active.setInitiative(comb._id, tacValue);
    }
  }
}

adjust_init();
