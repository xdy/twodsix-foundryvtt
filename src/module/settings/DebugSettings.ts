// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import AdvancedSettings from "./AdvancedSettings";
import {booleanSetting, stringSetting} from "./settingsUtils";
import {refreshWindow} from "./DisplaySettings";
//import { applyToAllActors } from ".../migration-utils";

export default class DebugSettings extends AdvancedSettings {
  static create() {
    DebugSettings.settings = DebugSettings.registerSettings();
    return DebugSettings;
  }

  constructor(object, options?) {
    super(object, DebugSettings.settings, options);
  }

  /** @override */
  getData() {
    const data = super.getData();
    data.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.debugSettings.intro`)}</h2><br>`;
    return data;
  }

  static registerSettings(): string[] {
    const settings: string[] = [];
    settings.push(booleanSetting('ExperimentalFeatures', false));
    settings.push(stringSetting('systemMigrationVersion', game.system.version));
    settings.push(booleanSetting('useModuleFixStyle', false, false, 'world', refreshWindow));
    settings.push(booleanSetting('useShipAutoCalcs', false, false, 'world', refreshWindow));
    settings.push(booleanSetting('useProseMirror', false));
    settings.push(booleanSetting('allowDropOnIcon', false));
    settings.push(booleanSetting('allowDragDropOfLists', false));
    settings.push(booleanSetting('useItemActiveEffects', false, false, 'world', deactivateItemAE));
    return settings;
  }
}

async function deactivateItemAE () {
  if (!game.settings.get('twodsix', 'useItemActiveEffects')) {
    await applyToAllActors(deleteSystemAE);
  }
}

async function deleteSystemAE(actor: TwodsixActor): Promise<void> {
  const idsToDelete:string[] = [];
  const systemAEs = actor.effects.filter( (e:ActiveEffect) => e.getFlag("twodsix", "sourceId"));
  for (const eff of systemAEs) {
    idsToDelete.push(eff.id);
  }
  actor.deleteEmbeddedDocuments('ActiveEffect', idsToDelete);
}

async function applyToAllActors(fn: ((actor:TwodsixActor) => Promise<void>)): Promise<void> {
  const allActors = (game.actors?.contents ?? []) as TwodsixActor[];

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      if (token.actor && !token.actorLink) {
        allActors.push(token.actor as TwodsixActor);
      }
    }
  }

  const actorPacks = game.packs.filter(pack => pack.metadata.type === 'Actor' && !pack.locked);
  for (const pack of actorPacks) {
    for (const actor of await pack.getDocuments()) {
      allActors.push(actor as unknown as TwodsixActor);
    }
  }

  for (const actor of allActors) {
    await fn(actor);
  }

  return Promise.resolve();
}
