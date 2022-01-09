import { applyToAllActors } from "../migration-utils";
import TwodsixActor from "src/module/entities/TwodsixActor";
import { Trait } from "../types/template";

async function applyActiveEffects(actor:TwodsixActor): Promise<void> {
  if (actor.type === "traveller") {
    for (const item of actor.items.filter((itm:TwodsixItem) => itm.type === "trait")) {
      if (!(<Trait>item.data.data).effectId) {
        const effects = await actor.createEmbeddedDocuments("ActiveEffect", [{
          origin: item.uuid,
          icon: item.img,
          tint: "#ffffff",
          label: item.name
        }]);
        await item.update({ "data.effectId": effects[0].id });
      }
    }
  }
  return Promise.resolve();
}

export async function migrate(): Promise<void> {
  await applyToAllActors(applyActiveEffects);

  return Promise.resolve();
}
