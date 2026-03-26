
import { applyToAllItems } from "../module/utils/migration-utils";

async function refactorSpellSkill(item) {
  if (item.system.associatedSkillName === "" && item.type === 'spell') {
    const defaultSkill = (await game.settings.get("twodsix", "sorcerySkill")) ?? "";
    await item.update({'system.associatedSkillName': defaultSkill});
  }
}

export async function migrate() {
  await applyToAllItems(refactorSpellSkill);
  console.log("Associated skill for spells migrated");
  return Promise.resolve();
}
