// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

/**
 * The Twodsix extention of the Token ruler.
 * @extends foundry.canvas.placeables.tokens.TokenRuler
 */
export class TwodsixTokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {

  /**
   * Get the style to be used to highlight the grid offset.
   * @param {DeepReadonly<Omit<TokenRulerWaypoint, "index"|"center"|"size"|"ray">>} waypoint    The waypoint
   * @param {DeepReadonly<GridOffset3D>} offset  An occupied grid offset at the given waypoint that is to be highlighted
   * @returns {{color?: PIXI.ColorSource; alpha?: number; texture?: PIXI.Texture; matrix?: PIXI.Matrix | null}}
   *   The color, alpha, texture, and texture matrix to be used to draw the grid space.
   *   If the alpha is 0, the grid space is not highlighted.
   * @protected
   */
  _getGridHighlightStyle(waypoint, offset) {
    let { color, alpha } = super._getGridHighlightStyle(waypoint, offset);
    if (game.settings.get('twodsix', 'showMovementColors')) {
      const user = game.users.get(waypoint.userId);
      color = getMoveColorType(this.token, waypoint.measurement.cost) ?? user?.color ?? 0x000000;
      alpha = 0.5;
    }
    return {color, alpha};
  }
}

const colors = {
  "walk": "lime",
  "dash": "yellow",
  "run": "orange",
  "jump": "lime",
  "not": "red"
};

/**
 * A function that returns a Pixi valid color field for different movement distances accounting for encumbrance
 * @param {Token} token The token being moved
 * @param {number} distance The distance (cost) in the grid's units being moved
 * @returns {Color} The Pixi valid color
 */
function getMoveColorType(token: TokenData, distance:number): Color {
  const actor = (<TwodsixActor>token.actor);
  const actorType = actor.type;
  const rulesSet = game.settings.get('twodsix', 'ruleset');
  let movementSpeed = 0;

  if (actorType === "ship") {
    movementSpeed = token.actor.system.shipStats.drives.jDrive?.rating;
    if (token.scene.grid.units === "pc" && movementSpeed) {
      if (distance <= movementSpeed) {
        return colors["jump"];
      } else {
        return colors["not"];
      }
    } else {
      return;
    }
  } else if (actorType === "vehicle") {
    return;
  } else if (["traveller", "animal", "robot"].includes(actorType)) {
    movementSpeed = token.actor.system.movement.walk;
    const actorData = (<Traveller>actor.system);
    switch (rulesSet) {
      case "CEATOM":
      case "BARBARIC":
        if ((actorData.encumbrance.value > actorData.encumbrance.max) && game.settings.get("twodsix", "useEncumbrance")) {
          return colors["not"];
        } else if ((actorData.encumbrance.value > actorData.encumbrance.max / 2) && game.settings.get("twodsix", "useEncumbrance")) {
          movementSpeed *= 0.5;
        }
        return colorDistance(distance, movementSpeed, true);
      case "CD":
      case "CEL":
      case "CLU":
      case "CDEE":
      case "AC":
        if ((actorData.encumbrance.value > actorData.encumbrance.max) && game.settings.get("twodsix", "useEncumbrance")) {
          return colors["not"];
        } else if ((actorData.encumbrance.value > actorData.encumbrance.max / 3) && game.settings.get("twodsix", "useEncumbrance")) {
          if (distance <= movementSpeed) {
            return colors["walk"];
          } else {
            return colors["not"];
          }
        } else {
          return colorDistance(distance, movementSpeed, false);
        }
      case "CE":
        if ((actorData.encumbrance.value > actorData.encumbrance.max) && game.settings.get("twodsix", "useEncumbrance")) {
          return colors["not"];
        } else if ((actorData.encumbrance.value > actorData.encumbrance.max / 2) && game.settings.get("twodsix", "useEncumbrance")) {
          if (distance <= 1.5) {
            return colors["walk"];
          } else {
            return colors["not"];
          }
        } else if ((actorData.encumbrance.value > actorData.encumbrance.max / 6) && game.settings.get("twodsix", "useEncumbrance")) {
          movementSpeed *= 0.75;
        }
        return colorDistance(distance, movementSpeed, true);
      case "OTHER":
        if ((actorData.encumbrance.value > actorData.encumbrance.max) && game.settings.get("twodsix", "useEncumbrance")) {
          return colors["not"];
        } else if ((actorData.encumbrance.value > actorData.encumbrance.max * parseFloat(game.settings.get("twodsix", "encumbFractionOneSquare"))) && game.settings.get("twodsix", "useEncumbrance")) {
          if (distance <= 1.5) {
            return colors["walk"];
          } else {
            return colors["not"];
          }
        } else if ((actorData.encumbrance.value > actorData.encumbrance.max * parseFloat(game.settings.get("twodsix", "encumbFraction75pct"))) && game.settings.get("twodsix", "useEncumbrance")) {
          movementSpeed *= 0.75;
        }
        return colorDistance(distance, movementSpeed, true);
      case "CU":
        if ((actorData.encumbrance.value > actorData.encumbrance.max) && game.settings.get("twodsix", "useEncumbrance")) {
          return colors["not"];
        } else {
          //note that movement speed already reduced by active effect (if used)
          return colorDistance(distance, movementSpeed, true);
        }
      case "CEQ":
      case "CEFTL":
      case "CT": //NEED TO CHECK THIS
      default:
        return colorDistance(distance, movementSpeed, false);
    }
  } else {
    return;
  }
}

/**
 * A function that returns color for grid shading for different movement types
 * @param {number} distance The distance (cost) in grid units
 * @param {number} movementSpeed The normal movement speed for the actor
 * @returns {Color} The pixi color to use for shading
 */
function colorDistance(distance:number, movementSpeed:number, canRun:boolean):Color {
  if (distance <= movementSpeed) {
    return colors["walk"];
  } else if (distance <= 2 * movementSpeed) {
    return colors["dash"];
  } else if ((distance <= 3 * movementSpeed) && canRun) {
    return colors["run"];
  } else {
    return colors["not"];
  }
}
