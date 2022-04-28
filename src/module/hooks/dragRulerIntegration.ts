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
        switch (rulesSet) {
          case "CD":
          case "CA":
          case "CEQ":
          case "CEFTL":
          case "CEL":
          case "CEATOM":
          case "CLU":
            return [
              { range: movementSpeed, color: "walk" },
              { range: movementSpeed * 2, color: "dash" }
            ];
          case "CE":
            return [
              { range: movementSpeed, color: "walk" },
              { range: movementSpeed * 2, color: "dash" },
              { range: movementSpeed * 3, color: "run" }
            ];
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
