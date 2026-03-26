
export async function migrate() {
  for (const settingKey of ['massProductionDiscount', 'encumbFractionOneSquare', 'encumbFraction75pct']) {
    if ((typeof (await game.settings.get('twodsix', settingKey))) === "number") {
      const numValue = await game.settings.get('twodsix', settingKey);
      await game.settings.set('twodsix', settingKey, numValue.toString());
      console.log(`Migrated ${numValue} for ${settingKey} to string`);
    }
  }
  return Promise.resolve();
}
