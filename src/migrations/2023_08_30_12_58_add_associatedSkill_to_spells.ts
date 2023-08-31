// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { applyToAllItems } from "../module/utils/migration-utils";

async function refactorSpellSkill(item: TwodsixItem): Promise<void> {
  if (item.system.associatedSkillName === "" && item.type === 'spell') {
    const defaultSkill = await game.settings.get("twodsix", "sorcerySkill") ?? "";
    await item.update({'system.associatedSkillName': defaultSkill});
  }
}

export async function migrate(): Promise<void> {
  await applyToAllItems(refactorSpellSkill);
  console.log("Associated skill for spells migrated");
  return Promise.resolve();
}
