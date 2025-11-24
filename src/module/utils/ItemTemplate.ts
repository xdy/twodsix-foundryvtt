// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { TWODSIX } from "../config";

/**
 * A helper class for building MeasuredTemplates for item AOE.  Adapted from D5e system
 */
export default class ItemTemplate extends foundry.documents.RegionDocument {

  /**
   * The initially active CanvasLayer to re-activate after the workflow is complete.
   * @type {CanvasLayer}
   */
  #initialLayer;

  /**
   * Track the bound event handlers so they can be properly canceled later.
   * @type {object}
   */
  #events;

  /**
   * Factory method to create an ItemTemplate instance using provided data from a TwodsixItem instance.
   * Uses foundry.utils.deepClone for safe data handling.
   * @param {TwodsixItem} item - The Item object for which to construct the template.
   * @param {object} [options={}] - Options to modify the created template.
   * @returns {Promise<ItemTemplate|null>} The template object, or null if the item does not produce a template.
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
   * Creates a preview of the region template and returns the placed region after confirmation.
   * Minimizes the actor sheet before placement and maximizes it after.
   * Uses foundry.utils and canvas.regions for region creation.
   * @returns {Promise<Region|null>} A promise that resolves with the placed region or null if cancelled.
   */
  async drawPreview(): Promise<any> {
    const regionData = this.toObject();
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
  /**
   * Helper to target tokens after region placement.
   * Call this with the placed region PlaceableObject returned from drawPreview.
   * Uses center-only targeting logic for accuracy.
   * Example:
   *   const placedRegion = await template.drawPreview();
   *   if (placedRegion) ItemTemplate.targetTokensForPlacedRegion(placedRegion);
   */
  static targetTokensForPlacedRegion(placedRegion: any): void {
    if (placedRegion && placedRegion.shape) {
      targetTokensInTemplate(placedRegion);
    }
  }

  /**
   * Check if a token's center is inside the template region using the canonical Foundry VTT v14+ method.
   * Uses only the token center for targeting (strict method).
   * @param {PlaceableObject} token - The token to check.
   * @param {PlaceableObject} region - The region PlaceableObject.
   * @returns {boolean} True if the token's center is inside the region, false otherwise.
   */
  static checkTokenInTemplate(token: PlaceableObject, region: PlaceableObject): boolean {
    const doc = (region as any).document || region;
    if (!doc || !doc.polygonTree || typeof doc.polygonTree.testPoint !== "function") {
      return false;
    }
    // Only use the token center for targeting
    const center = token.center;
    return doc.polygonTree.testPoint(center);
  }

  /**
   * Activate listeners for the template preview.
   * @param {CanvasLayer} initialLayer - The initially active CanvasLayer to re-activate after the workflow is complete.
   * @returns {Promise<any>} A promise that resolves with the final measured template if created.
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

      // Suppress the Region Legend menu if open as soon as preview listeners are activated
      if (canvas.regions.legend?.close) {
        canvas.regions.legend.close();
      }

      // Activate listeners for the new region document
      canvas.stage.on("mousemove", this.#events.move);
      canvas.stage.on("mousedown", this.#events.confirm);
      canvas.app.view.oncontextmenu = this.#events.cancel;
      canvas.app.view.onwheel = this.#events.rotate;
    });
  }

  /**
   * Rotate the template preview by 3˚ increments when the mouse wheel is rotated.
   * @param {Event} event - Triggering mouse event.
   */
  _onRotatePlacement(event: Event): Promise<void> {
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
   * @param {Event} event - Triggering mouse event.
   */
  async _onConfirmPlacement(event: Event): Promise<void> {
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
   * @param {Event} event - Triggering mouse event.
   */
  async _onCancelPlacement(event: Event): Promise<void> {
    await this._finishPlacement(event);
    this.#events.reject();
  }

  /**
   * Migrate ItemTemplate data to Region data.
   * Uses foundry.utils.deepClone and math utilities for safe conversion.
   * @param {object} template - The ItemTemplate data.
   * @param {object} [context] - The migration context.
   * @param {BaseGrid} [context.grid] - The grid.
   * @param {boolean} [context.gridTemplates] - Grid-shaped?
   * @param {"round"|"flat"} [context.coneTemplateType] - The cone curvature.
   * @returns {object|null} The Region data or null if migration fails.
   */
  static migrateItemTemplateData(template: object, {grid=canvas.scene?.grid ?? BaseScene.defaultGrid, gridTemplates=false, coneTemplateType="round"}: { grid?: BaseGrid; gridTemplates?: boolean; coneTemplateType?: "round" | "flat"; }={}): object | null {
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

  /**
   * Shared code for when template placement ends by being confirmed or canceled.
   * Cleans up event listeners and restores the initial layer and actor sheet state.
   * @param {Event} event - Triggering event that ended the placement.
   */
  async _finishPlacement(event): Promise<void> {
    // Cancel drag operation on the layer if possible
    if (this.layer && typeof this.layer._onDragLeftCancel === 'function') {
      this.layer._onDragLeftCancel(event);
    }
    // Remove event listeners
    if (this.#events) {
      canvas.stage.off("mousemove", this.#events.move);
      canvas.stage.off("mousedown", this.#events.confirm);
      canvas.app.view.oncontextmenu = null;
      canvas.app.view.onwheel = null;
    }
    // Restore the initial layer
    if (this.#initialLayer && typeof this.#initialLayer.activate === 'function') {
      this.#initialLayer.activate();
    }
    // Restore actor sheet if minimized
    if (this.actorSheet && this.actorSheet.state > 0 && typeof this.actorSheet.maximize === 'function') {
      await this.actorSheet.maximize();
    }
  }
}

/**
 * Sets all tokens within the region to targeted using center-only logic.
 * Activates the Token layer before targeting.
 * @param {any} region - The placed region PlaceableObject or document.
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
      const center = tok.center;
      if (doc.polygonTree.testPoint(center)) {
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
/**
 * Returns the center and corner points of a token for geometric checks.
 * (Currently unused, but kept for future flexibility.)
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
