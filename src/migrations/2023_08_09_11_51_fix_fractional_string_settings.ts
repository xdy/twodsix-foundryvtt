// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

export async function migrate(): Promise<void> {
  for (const settingKey of ['massProductionDiscount', 'encumbFractionOneSquare', 'encumbFraction75pct']) {
    if ((typeof await game.settings.get('twodsix', settingKey)) === "number") {
      const numValue = await game.settings.get('twodsix', settingKey);
      await game.settings.set('twodsix', settingKey, numValue.toString());
      console.log(`Migrated ${numValue} for ${settingKey} to string`);
    }
  }
  return Promise.resolve();
}
