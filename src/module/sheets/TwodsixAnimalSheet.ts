// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { AbstractTwodsixActorSheet } from "./AbstractTwodsixActorSheet";
import { Animal } from "src/types/template";

export class TwodsixAnimalSheet extends foundry.applications.api.HandlebarsApplicationMixin(AbstractTwodsixActorSheet) {

  static DEFAULT_OPTIONS =  {
    sheetType: "TwodsixAnimalSheet",
    classes: ["twodsix", "sheet", "animal-actor"],
    dragDrop: [{dragSelector: ".item-name", dropSelector: null}],
    position: {
      width: 720,
      height: 470
    },
    window: {
      resizable: true,
      icon: "fa-solid fa-hippo"
    },
    form: {
      submitOnChange: true,
      submitOnClose: true
    },
    actions: {
      rollReaction: this._onRollReaction,
      rollMorale: this._onRollMorale
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/actors/animal-sheet.hbs",
      //scrollable: ['']
    }
  };

  /** @override */
  async _prepareContext(options):any {
    const context = await super._prepareContext(options);
    if (game.settings.get('twodsix', 'useProseMirror')) {
      const TextEditorImp = foundry.applications.ux.TextEditor.implementation;
      context.richText = {
        description: await TextEditorImp.enrichHTML(context.system.description, {secrets: this.document.isOwner}),
        notes: await TextEditorImp.enrichHTML(context.system.notes, {secrets: this.document.isOwner})
      };
    }

    // Add relevant data from system settings
    Object.assign(context.settings, {
      useHits: game.settings.get('twodsix', 'animalsUseHits'),
      animalsUseLocations: game.settings.get('twodsix', 'animalsUseLocations'),
      displayReactionMorale: game.settings.get('twodsix', 'displayReactionMorale'),
      useAllAnimalTypes: game.settings.get('twodsix', 'animalTypesIndependentofNiche')
    });

    return context;
  }

  static async _onRollReaction(): Promise<void> {
    const reaction = (<Animal>this.actor.system).reaction;
    let rollString = "2d6";
    if (this.actor.system.woundedEffect) {
      rollString += " + @woundedEffect";
    }
    const roll = await (new Roll(rollString, this.actor.getRollData()).roll({rollMode: CONST.DICE_ROLL_MODES.PRIVATE}));

    let flavor = "";

    if (isNaN(reaction.flee) || isNaN(reaction.attack) || reaction.flee >= reaction.attack) {
      ui.notifications.warn("TWODSIX.Warnings.InvalidReactionInputs", {localize: true});
    } else {
      if (roll.total >= reaction.attack) {
        flavor = game.i18n.localize("TWODSIX.Animal.AttacksMessage");
      } else if (roll.total <= reaction.flee) {
        flavor = game.i18n.localize("TWODSIX.Animal.FleesMessage");
      } else {
        flavor = game.i18n.localize("TWODSIX.Animal.NoReactionMessage");
      }
      await roll.toMessage({
        title: game.i18n.localize("TWODSIX.Animal.Reaction"),
        speaker: ChatMessage.getSpeaker({ alias: this.actor.name}),
        flavor: flavor,
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      }, {rollMode: CONST.DICE_ROLL_MODES.PRIVATE}
      );
    }
  }

  static async _onRollMorale(): Promise<void> {
    let rollString = "2d6";
    if (this.actor.system.woundedEffect) {
      rollString += " + @woundedEffect";
    }
    if (this.actor.system.moraleDM) {
      rollString += " + @moraleDM";
    }
    const roll = await new Roll(rollString, this.actor.getRollData()).roll({rollMode: CONST.DICE_ROLL_MODES.PRIVATE});

    let flavor = "";
    if (roll.total <= 5) {
      flavor = game.i18n.localize("TWODSIX.Animal.Retreat");
    } else if (roll.total <=8) {
      flavor = game.i18n.localize("TWODSIX.Animal.FightingWithdrawal");
    } else if (roll.total <= 11) {
      flavor = game.i18n.localize("TWODSIX.Animal.KeepFighting");
    } else if (roll.total <= 15) {
      flavor = game.i18n.localize("TWODSIX.Animal.Advance");
    } else {
      flavor = game.i18n.localize("TWODSIX.Animal.FightToTheDeath");
    }
    await roll.toMessage({
      title: game.i18n.localize("TWODSIX.Animal.MoraleRoll"),
      speaker: ChatMessage.getSpeaker({ alias: this.actor.name}),
      flavor: flavor,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER,
      rolls: [roll]
    },
    {rollMode: CONST.DICE_ROLL_MODES.PRIVATE}
    );
  }
}
