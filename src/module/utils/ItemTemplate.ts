// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";

/**
 * A helper class for building Regions for item AOE.  Adapted from D5e system then heavly ChatGPT for v14
 */
export default class ItemTemplate extends foundry.canvas.placeables.Region {


  // -------------------- REGION CREATION --------------------

  /**
   * Factory method to create an ItemTemplate instance using provided data from a TwodsixItem instance.
   * Uses foundry.utils.deepClone for safe data handling.
   * @param {TwodsixItem} item - The Item object for which to construct the template.
   * @param {object} [options={}] - Options to modify the created template.
   * @returns {Promise<ItemTemplate|null>} The template object, or null if the item does not produce a template.
   */
  static async fromItem(item: TwodsixItem, options: object = {}): Promise<ItemTemplate | null> {
    const target = item.system.target ?? {};
    // Only pass minimal intent to migration: target, name, uuid
    const itemTemplateData = {
      target,
      name: item.name || "Unnamed Region",
      uuid: item.uuid
    };

    // Migrate itemTemplateData to Foundry regionData
    const regionData = this.generateItemTemplateData(itemTemplateData);
    if (!regionData) {
      console.error("Failed to migrate ItemTemplate data:", itemTemplateData);
      return null;
    }

    // Create the region document
    const regionDoc = new foundry.documents.RegionDocument(foundry.utils.deepClone(regionData), { parent: canvas.scene });
    // Create the placeable Region object (ItemTemplate extends Region)
    const region = new this(regionDoc);
    region.item = item;
    region.actorSheet = item.actor?.sheet || null;
    return region;
  }

  /* -------------------------------------------- */

  /**
   * Creates a preview of the region template and returns the placed region document after confirmation.
   * Minimizes the actor sheet before placement and maximizes it after.
   * Uses foundry.utils and canvas.regions for region creation.
   * @returns {Promise<RegionDocument|null>} A promise that resolves with the placed region or null if cancelled.
   */
  async drawPreview(): Promise<RegionDocument|null> {
    const regionData = this.document?.toObject();
    // Minimize actor sheet if open
    if (this.actorSheet?.state > 0) {
      this.actorSheet?.minimize();
    }
    // Suppress the Region Legend menu if open (do this before placement)
    if (canvas?.regions?.legend?.close) {
      await canvas.regions.legend.close();
    }
    let placedRegion = null;
    try {
      placedRegion = await canvas.regions.placeRegion(regionData, { create: true });
    } catch (e) {
      return null;
    }
    // Maximize the actor sheet after placement
    if (this.actorSheet) {
      await this.actorSheet.maximize();
    }
    return placedRegion;
  }
  // -------------------- TARGETING --------------------

  /**
   * Helper to target tokens after region placement.
   * Call this with the placed region PlaceableObject returned from drawPreview.
   * Uses center-only targeting logic for accuracy.
   * Example:
   *   const placedRegion = await template.drawPreview();
   *   if (placedRegion) ItemTemplate.targetTokensForPlacedRegion(placedRegion);
   */
  static targetTokensForPlacedRegion(placedRegion: any): void {
    if (!placedRegion) {
      console.warn("[Twodsix] targetTokensForPlacedRegion: No region provided");
      return;
    }
    const tokens = canvas.tokens?.placeables;
    const arrayOfTokenIds: string[] = [];
    if (tokens?.length > 0) {
      for (const tok of tokens) {
        const center = tok.center;
        let hit = false;
        if (placedRegion.document?.polygonTree?.testPoint) {
          hit = placedRegion.document.polygonTree.testPoint(center);
        } else {
          console.warn(`[Twodsix] No valid geometry method for region when checking token ${tok.id}`);
        }
        if (hit) {
          arrayOfTokenIds.push(tok.id);
        }
      }
      game.user?._onUpdateTokenTargets(arrayOfTokenIds);
    } else {
      console.warn("[Twodsix] No tokens found on canvas for targeting");
    }
  }

  /**
   * Check if a token's center is inside the template region using the canonical Foundry VTT v14+ method.
   * Uses only the token center for targeting (strict method).
   * @param {PlaceableObject} token - The token to check.
   * @param {PlaceableObject} region - The region PlaceableObject.
   * @returns {boolean} True if the token's center is inside the region, false otherwise.
   */
  // checkTokenInTemplate is no longer needed; use containsPoint or polygonTree directly in targeting.

  // -------------------- GENERATE TEMPLATE DATA --------------------

  /**
   * Generate ItemTemplate data to Region data.
   * Uses foundry.utils.deepClone and math utilities for safe conversion.
   * @param {object} template - The ItemTemplate data.
   * @param {object} [context] - The migration context.
   * @param {BaseGrid} [context.grid] - The grid.
   * @param {boolean} [context.gridTemplates] - Grid-shaped?
   * @param {"round"|"flat"} [context.coneTemplateType] - The cone curvature.
   * @returns {object|null} The Region data or null if migration fails.
   */
  static generateItemTemplateData(template: object, {grid=canvas.scene?.grid ?? BaseScene.defaultGrid, gridTemplates=false, coneTemplateType="round"}: { grid?: BaseGrid; gridTemplates?: boolean; coneTemplateType?: "round" | "flat"; }={}): object | null {
    try {
      // Extract raw intent
      const { target = {}, name: regionName = "Unnamed Region", uuid = "" } = template;
      const regionShape = TWODSIX.areaTargetTypes?.[target.type]?.template;
      if (!regionShape) {
        console.error("No region shape found for target:", target);
        return null;
      }
      const x = 0;
      const y = 0;
      const elevation = 0;
      const distance = Math.abs(target.value || 0);
      const direction = 0;
      const angle = target.angle || 90;
      const width = target.width || 0;
      const fillColor = game.user?.color || "#ff0000";
      const hidden = false;
      const flags = { twodsix: { origin: uuid }, core: {MeasuredTemplate: true }};

      // Use gridlessGrid if grid is not gridless
      const gridBased = gridTemplates === true;
      if (!gridBased && !grid.isGridless) {
        grid = canvas.scene.gridlessGrid; // Use the gridlessGrid property from the Scene class
      }
      const distancePixels = grid.size / grid.distance;
      let shape;
      switch (regionShape) {
        case "circle":
          shape = {type: "circle", x, y, radius: distance * distancePixels, gridBased};
          break;
        case "cone": {
          const curvature = gridBased || (coneTemplateType === "round") ? "round" : "flat";
          shape = {type: "cone", x, y, radius: distance * distancePixels, angle, rotation: direction, curvature, gridBased};
          break;
        }
        case "rect": {
          const {x: x1, y: y1} = grid.getTranslatedPoint({x, y}, direction, distance);
          let rectWidth = grid.measurePath([{x, y}, {x: x1, y}]).distance * distancePixels;
          let rectHeight = grid.measurePath([{x, y}, {x, y: y1}]).distance * distancePixels;
          const rotation = direction.toNearest(90, "floor");
          if ((rotation === 90) || (rotation === 270)) {
            [rectWidth, rectHeight] = [rectHeight, rectWidth];
          }
          shape = {type: "rectangle", x, y, width: rectWidth, height: rectHeight, anchorX: 0, anchorY: 0, rotation, gridBased};
          break;
        }
        case "ray":
          shape = {type: "line", x, y, length: distance * distancePixels, width: width * distancePixels, rotation: direction, gridBased};
          break;
        default:
          console.error("Unsupported template type:", regionShape);
          return null;
      }

      // Create the Region data
      return {
        name: regionName || `${shape.type.capitalize()} Template`,
        color: fillColor,
        shapes: [shape],
        elevation: {bottom: elevation, top: null},
        restriction: {enabled: false, type: "move", priority: 0},
        behaviors: [],
        visibility: hidden ? CONST.REGION_VISIBILITY.OBSERVER : CONST.REGION_VISIBILITY.ALWAYS,
        displayMeasurements: true,
        locked: false,
        ownership: {default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE},
        flags: foundry.utils.deepClone(flags)
      };
    } catch (err) {
      console.error("Error migrating ItemTemplate data:", err);
      return null;
    }
  }

  // Placement and event handling are now handled by core Region/canvas logic. Only actor sheet minimization/maximization is custom.
}

/**
 * Returns the center and corner points of a token for geometric checks.
 * (Currently unused, but kept for future flexibility if not restriced to center point.)
 * @param {Token|PlaceableObject} token - The token to get points for.
 * @returns {Array<{x: number, y: number}>} Array of points (center and corners).
 */
/*function getTokenPoints(token) {
  const points = [
    { x: token.center.x, y: token.center.y },
    { x: token.x, y: token.y },
    { x: token.x + token.width, y: token.y },
    { x: token.x, y: token.y + token.height },
    { x: token.x + token.width, y: token.y + token.height }
  ];
  return points;
}*/
