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
      const rulesSet = game.settings.get("twodsix", "ruleset");
      let movementSpeed = 0;

      if (actorType === "ship") {
        movementSpeed = token.actor.data.data.shipStats.drives.jDrive.rating;
        if (token.scene.data.gridUnits === "pc") {
          return [
            { range: movementSpeed, color: "jump" },
          ];
        } else {
          return [];
        }
      } else if (actorType === "traveller") {
        movementSpeed = token.actor.data.data.movement.walk;
        const actorData = (<Traveller>actor.data.data);
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
          case "OTHER":
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
          case "CEQ":
          case "CEFTL":
          default:
            return [
              { range: movementSpeed, color: "walk" },
              { range: movementSpeed * 2, color: "dash" }
            ];
        }
      }
    }
  }
  //@ts-ignore
  dragRuler.registerSystem("twodsix", TwodsixSpeedProvider);
});
