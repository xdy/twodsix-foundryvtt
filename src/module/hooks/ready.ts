// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import migrateWorld from "../migration";
import {createItemMacro} from "../utils/createItemMacro";
import { applyToAllActors } from "../utils/migration-utils";
import { correctMissingUntrainedSkill } from "../entities/TwodsixActor";

Hooks.once("ready", async function () {
  //Prevent a conflict with Twodsix conditions
  if (game.modules.get("combat-utility-belt")?.active) {
    if (game.settings.get("combat-utility-belt", "removeDefaultEffects")) {
      game.settings.set("combat-utility-belt", "removeDefaultEffects", false);
    }
  }

  //*Set default damage options localized
  if (game.settings.get("twodsix", "damageTypeOptions") === "") {
    game.settings.set("twodsix", "damageTypeOptions", game.i18n.localize("TWODSIX.Settings.defaultDamageOptions"));
  }

  if (!Roll.validate(game.settings.get('twodsix', 'maxEncumbrance'))) {
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.EncumbranceFormulaInvalid"));
  }

  // Determine whether a system migration is required and feasible

  let worldVersion = <string>game.settings.get("twodsix", "systemMigrationVersion");
  if (worldVersion == "null" || worldVersion == null) {
    worldVersion = "";
  }

  // Perform the migration
  if (game.user?.isGM) {
    await migrateWorld(worldVersion);
  }

  // Check for missing untrained skills
  if (game.user?.isGM) {
    await applyToAllActors(async (actor: TwodsixActor) => {
      await correctMissingUntrainedSkill(actor);
    });
  }

  //Toggle token actors' effect to correct off calc on refresh
  if (game.user?.isGM) {
    await applyToAllActors(toggleTokenEffect);
  }

  // A socket hook proxy
  game.socket?.on("system.twodsix", (data) => {
    Hooks.call(data[0], ...data.slice(1));
  });

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));

});

//This function is a kludge to reset token actors overrides not being calculated correctly on initialize
async function toggleTokenEffect(actor:TwodsixActor): Promise<void> {
  if (actor.isToken  && actor.isOwner) {
    const tokenEffects = Array.from(actor.allApplicableEffects());
    if (tokenEffects.length > 0) {
      await tokenEffects[0].update({'disabled': !tokenEffects[0].disabled});
      await tokenEffects[0].update({'disabled': !tokenEffects[0].disabled});
    }
  }
}
