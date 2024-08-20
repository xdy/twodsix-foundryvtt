// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import { Traveller } from "src/types/template";

Hooks.once("dragRuler.ready", (SpeedProvider) => {
  class TwodsixSpeedProvider extends SpeedProvider {
    get colors() {
      return [
        { id: "walk", default: 0x00FF00, name: "TWODSIX.speeds.walk" },
        { id: "dash", default: 0xFFFF00, name: "TWODSIX.speeds.dash" },
        { id: "run", default: 0xFF8000, name: "TWODSIX.speeds.run" },
        { id: "jump", default: 0x00FF00, name: "TWODSIX.speeds.jump" }
      ];
    }

    getRanges(token) {
      const actor = (<TwodsixActor>token.actor);
      const actorType = actor.type;
      const rulesSet = game.settings.get('twodsix', 'ruleset');
      let movementSpeed = 0;

      if (actorType === "ship") {
        movementSpeed = token.actor.system.shipStats.drives.jDrive.rating;
        if (token.scene.grid.units === "pc") {
          return [
            { range: movementSpeed, color: "jump" },
          ];
        } else {
          return [];
        }
      } else if (actorType === "vehicle") {
        return [];
      } else if (["traveller", "animal", "robot"].includes(actorType)) {
        movementSpeed = token.actor.system.movement.walk;
        const actorData = (<Traveller>actor.system);
        switch (rulesSet) {
          case "CEATOM":
          case "BARBARIC":
            if ((actorData.encumbrance.value > actorData.encumbrance.max) && game.settings.get("twodsix", "useEncumbrance")) {
              return [];
            } else if ((actorData.encumbrance.value > actorData.encumbrance.max / 2) && game.settings.get("twodsix", "useEncumbrance")) {
              movementSpeed *= 0.5;
            }
            return [
              { range: movementSpeed, color: "walk" },
              { range: movementSpeed * 2, color: "dash" }
            ];
          case "CD":
          case "CEL":
          case "CLU":
          case "CDEE":
          case "AC":
            if ((actorData.encumbrance.value > actorData.encumbrance.max) && game.settings.get("twodsix", "useEncumbrance")) {
              return [];
            } else if ((actorData.encumbrance.value > actorData.encumbrance.max / 3) && game.settings.get("twodsix", "useEncumbrance")) {
              return [
                { range: movementSpeed, color: "walk" }
              ];
            } else {
              return [
                { range: movementSpeed, color: "walk" },
                { range: movementSpeed * 2, color: "dash" }
              ];
            }
          case "CE":
            if ((actorData.encumbrance.value > actorData.encumbrance.max) && game.settings.get("twodsix", "useEncumbrance")) {
              return [];
            } else if ((actorData.encumbrance.value > actorData.encumbrance.max / 2) && game.settings.get("twodsix", "useEncumbrance")) {
              return [
                { range: 1.5, color: "walk" }
              ];
            } else if ((actorData.encumbrance.value > actorData.encumbrance.max / 6) && game.settings.get("twodsix", "useEncumbrance")) {
              movementSpeed *= 0.75;
            }
            return [
              { range: movementSpeed, color: "walk" },
              { range: movementSpeed * 2, color: "dash" },
              { range: movementSpeed * 3, color: "run" }
            ];
          case "OTHER":
            if ((actorData.encumbrance.value > actorData.encumbrance.max) && game.settings.get("twodsix", "useEncumbrance")) {
              return [];
            } else if ((actorData.encumbrance.value > actorData.encumbrance.max * parseFloat(game.settings.get("twodsix", "encumbFractionOneSquare"))) && game.settings.get("twodsix", "useEncumbrance")) {
              return [
                { range: 1.5, color: "walk" }
              ];
            } else if ((actorData.encumbrance.value > actorData.encumbrance.max * parseFloat(game.settings.get("twodsix", "encumbFraction75pct"))) && game.settings.get("twodsix", "useEncumbrance")) {
              movementSpeed *= 0.75;
            }
            return [
              { range: movementSpeed, color: "walk" },
              { range: movementSpeed * 2, color: "dash" },
              { range: movementSpeed * 3, color: "run" }
            ];
          case "CEQ":
          case "CEFTL":
          case "CT": //NEED TO CHECK THIS
          default:
            return [
              { range: movementSpeed, color: "walk" },
              { range: movementSpeed * 2, color: "dash" }
            ];
        }
      } else {
        return [];
      }
    }
  }
  //@ts-ignore
  dragRuler.registerSystem("twodsix", TwodsixSpeedProvider);
});
