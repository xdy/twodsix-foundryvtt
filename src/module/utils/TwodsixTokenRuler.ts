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
 * A function to determine if the actor is encumbered and adjust movement speed accordingly.
 * @param {Traveller} actorData The actor's data.
 * @param {number} movementSpeed The base movement speed of the actor.
 * @param {string} rulesSet The ruleset being used.
 * @returns {number} The adjusted movement speed.
 */
function adjustMovementForEncumbrance(actorData: Traveller, movementSpeed: number, rulesSet: string): number {
  if (!game.settings.get("twodsix", "useEncumbrance")) {
    return movementSpeed;
  }

  const encumbrance = actorData.encumbrance.value;
  const maxEncumbrance = actorData.encumbrance.max;

  switch (rulesSet) {
    case "CEATOM":
    case "BARBARIC":
      if (encumbrance > maxEncumbrance) {
        return 0; // Cannot move
      } else if (encumbrance > maxEncumbrance / 2) {
        return movementSpeed * 0.5;
      }
      break;
    case "CE":
      if (encumbrance > maxEncumbrance) {
        return 0; // Cannot move
      } else if (encumbrance > maxEncumbrance / 2) {
        return 1.5; // Limited to walking
      } else if (encumbrance > maxEncumbrance / 6) {
        return movementSpeed * 0.75;
      }
      break;
    case "OTHER": {
      const fractionOneSquare = parseFloat(game.settings.get("twodsix", "encumbFractionOneSquare"));
      const fraction75pct = parseFloat(game.settings.get("twodsix", "encumbFraction75pct"));
      if (encumbrance > maxEncumbrance) {
        return 0; // Cannot move
      } else if (encumbrance > maxEncumbrance * fractionOneSquare) {
        return 1.5; // Limited to walking
      } else if (encumbrance > maxEncumbrance * fraction75pct) {
        return movementSpeed * 0.75;
      }
      break;
    }
    default:
      if (encumbrance > maxEncumbrance) {
        return 0; // Cannot move
      }
  }

  return movementSpeed;
}

/**
 * A function to determine the movement color based on distance and movement speed.
 * @param {number} distance The distance (cost) in grid units.
 * @param {number} movementSpeed The adjusted movement speed.
 * @param {boolean} canRun Whether the actor can run.
 * @returns {Color} The Pixi color to use for shading.
 */
function determineMovementColor(distance: number, movementSpeed: number, canRun: boolean): Color {
  if (distance <= movementSpeed) {
    return colors["walk"];
  } else if (distance <= 2 * movementSpeed) {
    return colors["dash"];
  } else if (canRun && distance <= 3 * movementSpeed) {
    return colors["run"];
  } else {
    return colors["not"];
  }
}

/**
 * A function that returns a Pixi valid color field for different movement distances accounting for encumbrance.
 * @param {Token} token The token being moved.
 * @param {number} distance The distance (cost) in the grid's units being moved.
 * @returns {Color} The Pixi valid color.
 */
function getMoveColorType(token: TokenData, distance: number): Color {
  const actor = (<TwodsixActor>token.actor);
  const actorType = actor.type;
  const rulesSet = game.settings.get('twodsix', 'ruleset');
  let movementSpeed = 0;

  if (actorType === "ship") {
    movementSpeed = token.actor.system.shipStats.drives.jDrive?.rating;
    if (token.scene.grid.units === "pc" && movementSpeed) {
      return distance <= movementSpeed ? colors["jump"] : colors["not"];
    }
    return;
  } else if (actorType === "vehicle") {
    return;
  } else if (["traveller", "animal", "robot"].includes(actorType)) {
    movementSpeed = token.actor.system.movement.walk;
    const actorData = (<Traveller>actor.system);

    movementSpeed = adjustMovementForEncumbrance(actorData, movementSpeed, rulesSet);

    if (movementSpeed === 0) {
      return colors["not"];
    }

    const canRun = ["CEATOM", "BARBARIC", "CE", "CU"].includes(rulesSet);
    return determineMovementColor(distance, movementSpeed, canRun);
  }

  return;
}
