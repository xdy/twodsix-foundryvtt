// (sleep helper removed; no longer needed)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";

/**
 * A helper class for building MeasuredTemplates for item AOE.  Adapted from D5e system
 */
export default class ItemTemplate extends foundry.documents.RegionDocument {
  /**
   * Check if a token is inside the template region using the canonical Foundry VTT v14+ method.
   * @param token The token to check.
   * @param region The region PlaceableObject.
   */
  static checkTokenInTemplate(token: PlaceableObject, region: PlaceableObject): boolean {
    const doc = (region as any).document || region;
    if (!doc || !doc.polygonTree || typeof doc.polygonTree.testPoint !== "function") {
      return false;
    }
    // Check token center and corners
    const points = [
      { x: token.center.x, y: token.center.y },
      { x: token.x, y: token.y },
      { x: token.x + token.width, y: token.y },
      { x: token.x, y: token.y + token.height },
      { x: token.x + token.width, y: token.y + token.height }
    ];
    return points.some(pt => doc.polygonTree.testPoint(pt));
  }

  /* -------------------------------------------- */

  /**
   * The initially active CanvasLayer to re-activate after the workflow is complete.
   * @type {CanvasLayer}
   */



  /* -------------------------------------------- */

  /**
   * The initially active CanvasLayer to re-activate after the workflow is complete.
   * @type {CanvasLayer}
   */
  #initialLayer;

  /* -------------------------------------------- */

  /**
   * Track the bound event handlers so they can be properly canceled later.
   * @type {object}
   */
  #events;

  /* -------------------------------------------- */

  /**
   * A factory method to create an AbilityTemplate instance using provided data from a TwodsixItem instance
   * @param {TwodsixItem} item               The Item object for which to construct the template
   * @param {object} [options={}]       Options to modify the created template.
   * @returns {ItemTemplate|null}    The template object, or null if the item does not produce a template
   */
  static async fromItem(item: TwodsixItem, options: object = {}): Promise<ItemTemplate | null> {
    //console.log("Creating ItemTemplate from item:", item);
    const target = item.system.target ?? {};
    //console.log("Target data:", target);
    const regionShape = TWODSIX.areaTargetTypes[target.type]?.template;
    //console.log("Region shape:", regionShape);
    if (!regionShape) {
      console.error("No region shape found for item:", item);
      return null;
    }

    // Prepare initial region data
    const regionData = {
      name: item.name || "Unnamed Region",
      type: regionShape,
      x: 0,
      y: 0,
      distance: target.value,
      direction: 0,
      angle: target.angle || 90,
      width: target.width || 0,
      elevation: 0,
      fillColor: game.user?.color,
      hidden: false,
      flags: { twodsix: { origin: item.uuid } }
    };

    // Migrate data using the migration logic
    const migratedData = this.migrateItemTemplateData(regionData);
    if (!migratedData) {
      console.error("Failed to migrate ItemTemplate data:", regionData);
      return null;
    }

    //console.log("Migrated region data:", migratedData);

    // Create the region
    const region = new foundry.documents.RegionDocument(foundry.utils.deepClone(migratedData), { parent: canvas.scene });
    //console.log("Region created:", region);

    // Ensure the returned object is an instance of ItemTemplate
    const object = new this(region);
    //console.log("Returned object type:", object.constructor.name);
    //console.log("Prototype chain:", Object.getPrototypeOf(object));
    object.item = item;
    object.actorSheet = item.actor?.sheet || null;
    return object;
  }

  /* -------------------------------------------- */

  /**
   * Creates a preview of the spell template.
   * @returns {Promise}  A promise that resolves with the final measured template if created.
   */
  /**
   * Creates a preview of the spell template and returns the placed region after confirmation.
   * Maximizes the actor sheet after placement.
   * @returns {Promise<Region|null>}  A promise that resolves with the placed region or null if cancelled.
   */
  /**
   * Creates a preview of the spell template and returns the placed region after confirmation.
   * Maximizes the actor sheet after placement, with a small delay to avoid UI race conditions.
   * @returns {Promise<Region|null>}  A promise that resolves with the placed region or null if cancelled.
   */
  async drawPreview(): Promise<any> {
    const regionData = this.toObject();
    // Minimize actor sheet if open
    if (this.actorSheet?.state > 0) {
      this.actorSheet?.minimize();
      //console.log("Actor sheet minimized:", this.actorSheet);
    }
    let placedRegion = null;
    try {
      placedRegion = await canvas.regions.placeRegion(regionData, { create: true });
    } catch (e) {
      // Placement cancelled or failed
      return null;
    }
    // Suppress the Region Legend menu if open
    if (canvas?.regions?.legend?.close) {
      canvas.regions.legend.close();
    }
    // Maximize the actor sheet after placement
    if (this.actorSheet) {
      await this.actorSheet.maximize();
    }
    return placedRegion;
  }
  /**
   * Helper to target tokens after region placement.
   * Call this with the placed region PlaceableObject returned from drawPreview.
   * Example:
   *   const placedRegion = await template.drawPreview();
   *   if (placedRegion) ItemTemplate.targetTokensForPlacedRegion(placedRegion);
   */
  static targetTokensForPlacedRegion(placedRegion: any): void {
    if (placedRegion && placedRegion.shape) {
      targetTokensInTemplate(placedRegion);
    }
  }

  /* -------------------------------------------- */

  /**
   * Activate listeners for the template preview
   * @param {CanvasLayer} initialLayer  The initially active CanvasLayer to re-activate after the workflow is complete
   * @returns {Promise}                 A promise that resolves with the final measured template if created.
   */
  activatePreviewListeners(initialLayer: CanvasLayer): Promise<any> {
    return new Promise((resolve, reject) => {
      this.#initialLayer = initialLayer;
      this.#events = {
        cancel: this._onCancelPlacement.bind(this),
        confirm: this._onConfirmPlacement.bind(this),
        move: this._onMovePlacement.bind(this),
        resolve,
        reject,
        rotate: this._onRotatePlacement.bind(this)
      };

      // Activate listeners for the new region document
      canvas.stage.on("mousemove", this.#events.move);
      canvas.stage.on("mousedown", this.#events.confirm);
      canvas.app.view.oncontextmenu = this.#events.cancel;
      canvas.app.view.onwheel = this.#events.rotate;
    });
  }

  /* -------------------------------------------- */

  /**
   * Shared code for when template placement ends by being confirmed or canceled.
   * @param {Event} event  Triggering event that ended the placement.
   */
  async _finishPlacement(event) {
    this.layer._onDragLeftCancel(event);
    canvas.stage.off("mousemove", this.#events.move);
    canvas.stage.off("mousedown", this.#events.confirm);
    canvas.app.view.oncontextmenu = null;
    canvas.app.view.onwheel = null;
    this.#initialLayer.activate();
    if (this.actorSheet?.state > 0) {
      await this.actorSheet.maximize();
    }
  }

  /* -------------------------------------------- */

  /**
   * Rotate the template preview by 3˚ increments when the mouse wheel is rotated.
   * @param {Event} event  Triggering mouse event.
   */
  _onRotatePlacement(event) {
    if ( event.ctrlKey ) {
      event.preventDefault(); // Avoid zooming the browser window
    }
    event.stopPropagation();
    const delta = canvas.grid.type > CONST.GRID_TYPES.SQUARE ? 30 : 15;
    const snap = event.shiftKey ? delta : 5;
    const update = {direction: this.document.direction + (snap * Math.sign(event.deltaY))};
    this.document.updateSource(update);
    this.refresh();
  }

  /* -------------------------------------------- */

  /**
   * Confirm placement when the left mouse button is clicked.
   * @param {Event} event  Triggering mouse event.
   */
  async _onConfirmPlacement(event) {
    //console.log("Confirming placement for ItemTemplate:", this);
    await this._finishPlacement(event);
    const destination = this.getSnappedPosition(this.document);
    //console.log("Snapped position:", destination);
    this.document.updateSource(destination);
    //console.log("Document source updated:", this.document);
    const newTemplates = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [this.document.toObject()]);
    //console.log("New templates created:", newTemplates);
    this.#events.resolve(newTemplates[0]);
  }

  /* -------------------------------------------- */

  /**
   * Cancel placement when the right mouse button is clicked.
   * @param {Event} event  Triggering mouse event.
   */
  async _onCancelPlacement(event) {
    await this._finishPlacement(event);
    this.#events.reject();
  }

  /**
   * Migrate ItemTemplate data to Region data.
   * @param {object} template                             The ItemTemplate data
   * @param {object} [context]                            The migration context
   * @param {BaseGrid} [context.grid]                     The grid
   * @param {boolean} [context.gridTemplates]             Grid-shaped?
   * @param {"round"|"flat"} [context.coneTemplateType]   The cone curvature
   * @returns {object|null}                               The Region data or null if migration fails
   */
  static migrateItemTemplateData(template, {grid=canvas.scene?.grid ?? BaseScene.defaultGrid, gridTemplates=false, coneTemplateType="round"}={}) {
    try {
      const t = template.type || "circle";
      const x = Math.round(template.x || 0);
      const y = Math.round(template.y || 0);
      const elevation = template.elevation || 0;
      const distance = Math.abs(template.distance || 0);
      const direction = Math.normalizeDegrees(template.direction || 0);
      const angle = Math.clamp(template.angle === null ? 90 : (template.angle || 0), 0, 360);
      const width = Math.abs(template.width || 0);
      const fillColor = template.fillColor || "#ff0000";
      const hidden = template.hidden || false;

      // Use gridlessGrid if grid is not gridless
      const gridBased = gridTemplates === true;
      if (!gridBased && !grid.isGridless) {
        grid = canvas.scene.gridlessGrid; // Use the gridlessGrid property from the Scene class
      }
      const distancePixels = grid.size / grid.distance;
      let shape;
      switch (t) {
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
          console.error("Unsupported template type:", t);
          return null;
      }

      // Create the Region data
      return {
        name: template.name || `${shape.type.capitalize()} Template`,
        color: fillColor,
        shapes: [shape],
        elevation: {bottom: elevation, top: null},
        restriction: {enabled: false, type: "move", priority: 0},
        behaviors: [],
        visibility: hidden ? CONST.REGION_VISIBILITY.OBSERVER : CONST.REGION_VISIBILITY.ALWAYS,
        displayMeasurements: true,
        locked: false,
        ownership: {default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE},
        flags: foundry.utils.deepClone(template.flags || {})
      };
    } catch (err) {
      console.error("Error migrating ItemTemplate data:", err);
      return null;
    }
  }
}

/**
 * Determines whether a token is within the template.
 * @param {Token} token  token on canvas.
 * @param {ItemTemplate} template  token on canvas.
 * @returns {boolean}   whether token in inside template
 */
function checkTokenInTemplate(token: Token, region: any): boolean {
  // Use the PlaceableObject for the region if available
  const regionObj = region.object ?? region;
  if (!regionObj || typeof regionObj.containsPoint !== "function") {
    // Fallback: try to use shape.contains if available
    const shape = regionObj.shape ?? regionObj.document?.shape;
    if (shape && typeof shape.contains === "function") {
      // Test token center
      const center = token.center;
      return shape.contains(center.x, center.y);
    }
    return false;
  }
  // Test token center and corners for large tokens
  const points = [];
  const {x, y, width, height} = token;
  const gridSize = canvas.grid.size;
  // Center
  points.push(token.center);
  // Corners (for tokens larger than 1x1)
  if (token.document.width > 1 || token.document.height > 1) {
    points.push({x: x, y: y});
    points.push({x: x + width, y: y});
    points.push({x: x, y: y + height});
    points.push({x: x + width, y: y + height});
  }
  // If any point is inside the region, consider the token targeted
  return points.some(pt => regionObj.containsPoint(pt));
}
/**
 * Sets all tokens within the template to targeted.
 * @param {MeasuredTemplate} template  token on canvas.
 */
export function targetTokensInTemplate(region: any): void {
  // Ensure the Token layer is active before targeting
  if (canvas.tokens && typeof canvas.tokens.activate === 'function') {
    canvas.tokens.activate({ tool: 'select' });
  }
  // Use the PlaceableObject for the region if available
  const regionObj = region.object ?? region;
  if (!regionObj) {
    console.warn("[Twodsix] No region object found for targeting");
    return;
  }
  // Try to get the polygonTree from the region's document or object
  const doc = regionObj.document || regionObj;
  if (!doc.polygonTree || typeof doc.polygonTree.testPoint !== "function") {
    console.warn("[Twodsix] Region object has no polygonTree for geometric checks", doc);
    return;
  }
  const tokens = canvas.tokens?.placeables;
  const arrayOfTokenIds: string[] = [];
  if (tokens?.length > 0) {
    for (const tok of tokens) {
      // Check token center and corners
      const points = [
        { x: tok.center.x, y: tok.center.y },
        { x: tok.x, y: tok.y },
        { x: tok.x + tok.width, y: tok.y },
        { x: tok.x, y: tok.y + tok.height },
        { x: tok.x + tok.width, y: tok.y + tok.height }
      ];
      if (points.some(pt => doc.polygonTree.testPoint(pt))) {
        arrayOfTokenIds.push(tok.id);
      }
    }
    if (arrayOfTokenIds.length === 0) {
      console.info("[Twodsix] No tokens found in region");
    } else {
      console.info(`[Twodsix] Targeting tokens in region: ${arrayOfTokenIds.join(", ")}`);
    }
    game.user?._onUpdateTokenTargets(arrayOfTokenIds);
  } else {
    console.warn("[Twodsix] No tokens found on canvas for targeting");
  }
}
