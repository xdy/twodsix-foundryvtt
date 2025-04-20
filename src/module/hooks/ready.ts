// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import migrateWorld from "../migration";
import {createItemMacro} from "../utils/createItemMacro";
import { applyToAllActors } from "../utils/migration-utils";
import { correctMissingUntrainedSkill } from "../entities/TwodsixActor";
import { setDocumentPartials, updateStatusIcons } from "../settings/DisplaySettings";
import { switchCss } from "../settings";
import { generateTargetDMObject } from "../utils/targetModifiers";
import { TWODSIX } from "../config";

Hooks.once("ready", async function () {
  //Prevent a conflict with Twodsix conditions
  if (game.modules.get("combat-utility-belt")?.active) {
    if (game.settings.get("combat-utility-belt", "removeDefaultEffects")) {
      game.settings.set("combat-utility-belt", "removeDefaultEffects", false);
    }
  }

  //*Set default damage options localized
  if (game.settings.get("twodsix", "damageTypeOptions") === ""  && game.settings.get('twodsix', 'ruleset') !== 'CU') {
    game.settings.set("twodsix", "damageTypeOptions", game.i18n.localize("TWODSIX.Settings.defaultDamageOptions"));
  }

  if (!Roll.validate(game.settings.get('twodsix', 'maxEncumbrance'))) {
    ui.notifications.warn("TWODSIX.Warnings.EncumbranceFormulaInvalid", {localize: true});
  }

  // Determine whether a system migration is required and feasible
  let worldVersion = <string>game.settings.get("twodsix", "systemMigrationVersion");
  if (worldVersion == "null" || worldVersion == null) {
    worldVersion = "";
  }

  // Perform the migration
  if (game.users.activeGM?.isSelf) {
    await migrateWorld(worldVersion);
  }

  // Check for missing untrained skills
  if (game.users.activeGM?.isSelf) {
    await applyToAllActors(async (actor: TwodsixActor) => {
      await correctMissingUntrainedSkill(actor);
    });
  }

  //Toggle actors' effect to correct off calc on refresh, should be fixed in version 11.306 onward for tokens
  if (game.users.activeGM?.isSelf) {
    if (game.release.build < 306) {
      await applyToAllActors(toggleTokenEffect);
    }
    //await applyToAllActors(toggleActorEffect);
  }

  // A socket hook proxy
  game.socket?.on("system.twodsix", (data) => {
    Hooks.call(data[0], ...data.slice(1));
  });

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (_bar, data, slot) => createItemMacro(data, slot));

  //set status icons
  if (game.settings.get('twodsix', 'reduceStatusIcons')) {
    updateStatusIcons();
  }

  //Customize style for core language
  switch (game.settings.get('core', 'language')) {
    case 'en':
      break;
    case 'es':
      switchCss("systems/twodsix/styles/twodsix_es_changes.css");
      break;
    case 'de':
      switchCss("systems/twodsix/styles/twodsix_de_changes.css");
      break;
    case 'sv':
      switchCss("systems/twodsix/styles/twodsix_sv_changes.css");
      break;
    case 'fr':
      switchCss("systems/twodsix/styles/twodsix_fr_changes.css");
      break;
    default:
      break;
  }

  //Set up custom partial on item tab
  if (game.settings.get('twodsix', 'showTLonItemsTab')) {
    setDocumentPartials();
  }

  //Force colorScheme setting
  const uiSettings = foundry.utils.duplicate(game.settings.get("core", "uiConfig"));
  const useStandardStyle = game.settings.get('twodsix', 'useFoundryStandardStyle');
  uiSettings.colorScheme.applications = useStandardStyle ? 'light' : 'dark';
  uiSettings.colorScheme.interface = useStandardStyle ? 'light' : 'dark';
  await game.settings.set("core", "uiConfig", uiSettings);

  //Add index
  for (const pack of game.packs) {
    if (pack.metadata.type === 'Item') {
      pack.getIndex({fields: ['system.techLevel']});
    }
  }

  //create custom DM List Object
  generateTargetDMObject();

  //Reset chain bonus if empty string
  if (game.settings.get('twodsix', 'chainBonus') === "") {
    const ruleset = game.settings.get('twodsix', 'ruleset');
    const rulesetChainBonus = TWODSIX.RULESETS[ruleset]?.settings.chainBonus;
    game.settings.set('twodsix', 'chainBonus', rulesetChainBonus ?? "");
  }

  //Check default actor sheet types
  //checkDefaultActorSheetTypes();
});

//This function is a kludge to reset token actors overrides not being calculated correctly on initialize
async function toggleTokenEffect(actor:TwodsixActor): Promise<void> {
  await toggleFirstActiveEffect(actor, true);
}

//This function is a kludge to reset linked actors overrides not being calculated correctly on initialize
//async function toggleActorEffect(actor:TwodsixActor): Promise<void> {
//  await toggleFirstActiveEffect(actor, false);
//}

/**
 * Toggles first AE on actor so that AE are correctly calculated on load.  This is a hack to fix an issue with FVTT or Twodsix that I can't find
 * @param {TwodsixActor} actor the actor to toggle
 * @param {boolean} isToken whether the actor is unlinked (Token actor) or not
 * @function
 */
async function toggleFirstActiveEffect(actor:TwodsixActor, isToken: boolean): Promise<void> {
  if (actor.isToken === isToken  && actor.isOwner) {
    const actorEffects = Array.from(actor.allApplicableEffects());
    if (actorEffects.length > 0) {
      await actorEffects[0].update({'disabled': !actorEffects[0].disabled});
      await actorEffects[0].update({'disabled': !actorEffects[0].disabled});
    }
  }
}

/**
 * Check that the default actor sheet type exists in Actors.registeredSheets. If not,
 * try to find a match in registered sheets.  Also, make migration from TwodsixActorSheet to TwodsixTravellerSheet
 * @function
 * @async
 */
/*async function checkDefaultActorSheetTypes(): Promise<void> {
  const defaultSheets = foundry.utils.duplicate(game.settings.get("core", "sheetClasses"));
  const defaultActorSheets = defaultSheets?.Actor;
  let changed = false;
  for (const key in defaultActorSheets) {
    const sheetClassName = defaultActorSheets[key].substring(8); //"prefixed with twodsix."
    if (!Actors.registeredSheets.find(sheet => sheet.name === sheetClassName)) {
      if ((Actors.registeredSheets.find(sheet => sheet.name === '_' + sheetClassName))) {
        defaultActorSheets[key] = `twodsix._${sheetClassName}`;
        changed = true;
      } else if (key === 'traveller' && Actors.registeredSheets.find(sheet => sheet.name === '_TwodsixTravellerSheet')) {
        defaultActorSheets[key] = `twodsix._TwodsixTravellerSheet`;
        changed = true;
      } else if (key === 'traveller' && Actors.registeredSheets.find(sheet => sheet.name === 'TwodsixTravellerSheet')) {
        defaultActorSheets[key] = `twodsix.TwodsixTravellerSheet`;
        changed = true;
      }
    }
  }
  if (changed) {
    const newSettings = foundry.utils.mergeObject(defaultSheets, {Actor: defaultActorSheets});
    await game.settings.set('core', 'sheetClasses', newSettings);
  }
}*/
