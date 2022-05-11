import { applyToAllItems } from "../migration-utils";

async function adjustEquipped (item: TwodsixItem): Promise<void> {
  if (item.data.type !== "skills" && item.data.type !== "trait" && item.data.type !== "ship_position") {
    if (Array.isArray(item.data.data.equipped)) {
      item.update({'data.equipped': "equipped"});
    }
  }
  return Promise.resolve();
}
export async function migrate(): Promise<void> {
  await applyToAllItems(adjustEquipped);
  return Promise.resolve();
}
