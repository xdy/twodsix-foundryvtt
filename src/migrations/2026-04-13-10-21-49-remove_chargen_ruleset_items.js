export async function migrate() {
  // Delete from world
  const worldItems = game.items.filter(i => i.type === 'chargen_ruleset');
  for (const item of worldItems) {
    console.log(`twodsix | Migration: Deleting world-level chargen_ruleset item "${item.name}" (${item.id})`);
    await item.delete();
  }

  // Delete from actors
  for (const actor of game.actors) {
    const actorItems = actor.items.filter(i => i.type === 'chargen_ruleset');
    for (const item of actorItems) {
      console.log(`twodsix | Migration: Deleting chargen_ruleset item "${item.name}" (${item.id}) from actor "${actor.name}" (${actor.id})`);
      await item.delete();
    }
  }

  console.log('twodsix | Chargen Ruleset Item Cleanup Migration Complete');
  return Promise.resolve();
}
