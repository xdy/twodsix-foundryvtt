// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.


import { TWODSIX } from "../config";

/**
 * A helper class for building MeasuredTemplates for item AOE.  Adapted from D5e system
 */
export default class ItemTemplate extends foundry.canvas.placeables.MeasuredTemplate {

  /**
   * Track the timestamp when the last mouse move event was captured.
   * @type {number}
   */
  #moveTime = 0;

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
   * A factory method to create an AbilityTemplate instance using provided data from an Item5e instance
   * @param {TwodsixItem} item               The Item object for which to construct the template
   * @param {object} [options={}]       Options to modify the created template.
   * @returns {ItemTemplate|null}    The template object, or null if the item does not produce a template
   */
  static fromItem(item: TwodsixItem, options: object={}): Promise<ItemTemplate> {
    const target = item.system.target ?? {};
    const templateShape = TWODSIX.areaTargetTypes[target.type]?.template;
    if ( !templateShape ) {
      return null;
    }
    // Prepare template data
    const templateData = foundry.utils.mergeObject({
      t: templateShape,
      user: game.user?.id,
      distance: target.value,
      direction: 0,
      x: 0,
      y: 0,
      fillColor: game.user?.color,
      flags: { twodsix: { origin: item.uuid } }
    }, options);

    // Additional type-specific data
    switch ( templateShape ) {
      case "cone":
        templateData.angle = CONFIG.MeasuredTemplate.defaults.angle;
        break;
      case "rect": // 5e rectangular AoEs are always cubes
        templateData.distance = Math.hypot(target.value, target.value);
        templateData.width = target.value;
        templateData.direction = 45;
        break;
      case "ray": // 5e rays are most commonly 1 square (5 ft) in width
        templateData.width = target.width ?? canvas.dimensions?.distance;
        break;
      default:
        break;
    }

    // Return the template constructed from the item data
    const cls = CONFIG.MeasuredTemplate.documentClass;
    const template = new cls(foundry.utils.deepClone(templateData), {parent: canvas.scene});
    const object = new this(template);
    object.item = item;
    object.actorSheet = item.actor?.sheet || null;

    // TWODSIX DOES NOT IMPLENT TEMPLATE HOOKS AS DOES 5e
    return object;
  }

  /* -------------------------------------------- */

  /**
   * Creates a preview of the spell template.
   * @returns {Promise}  A promise that resolves with the final measured template if created.
   */
  drawPreview(): Promise<any> {
    const initialLayer = canvas.activeLayer;

    // Draw the template and switch to the template layer
    this.draw();
    this.layer.activate();
    this.layer.preview?.addChild(this);

    // Hide the sheet that originated the preview
    if (this.actorSheet?.state > 0) {
      this.actorSheet?.minimize();
    }

    // Activate interactivity
    return this.activatePreviewListeners(initialLayer);
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

      // Activate listeners
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
   * Move the template preview when the mouse moves.
   * @param {Event} event  Triggering mouse event.
   */
  _onMovePlacement(event) {
    event.stopPropagation();
    const now = Date.now(); // Apply a 20ms throttle
    if ( now - this.#moveTime <= 20 ) {
      return;
    }
    const center = event.data.getLocalPosition(this.layer);
    const snapped = this.getSnappedPosition(center);
    this.document.updateSource(snapped);
    this.refresh();
    this.#moveTime = now;
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
    await this._finishPlacement(event);
    const destination = this.getSnappedPosition(this.document);
    this.document.updateSource(destination);
    const newTemplates = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [this.document.toObject()]);
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
}

/**
 * Determines whether a token is within the template.
 * @param {Token} token  token on canvas.
 * @param {ItemTemplate} template  token on canvas.
 * @returns {boolean}   whether token in inside template
 */
function checkTokenInTemplate (token:Token, template:MeasuredTemplate):boolean {
  const grid = canvas.scene?.grid;
  const {x: tempx, y: tempy} = template;
  const startX = token.document.width >= 1 ? 0.5 : token.document.width/2;
  const startY = token.document.height >= 1 ? 0.5 : token.document.height/2;
  for (let x = startX; x < token.document.width; x++) {
    for (let y = startY; y < token.document.width; y++) {
      const curr = { x: token.document.x + x * grid.size - tempx, y: token.document.y + y * grid.size - tempy };
      const contains = template.object.shape?.contains(curr.x, curr.y);
      //const contains = template.object.testPoint({x: curr.x, y: curr.y});
      if (contains) {
        return true;
      }
    }
  }
  return false;
}
/**
 * Sets all tokens within the template to targeted.
 * @param {MeasuredTemplate} template  token on canvas.
 */
export function targetTokensInTemplate(template:MeasuredTemplate):void {
  const tokens = canvas.tokens?.placeables;
  template.object._refreshShape();
  const arrayOfTokenIds:string[] = [];
  if (tokens?.length > 0) {
    for (const tok of tokens) {
      if (checkTokenInTemplate(tok, template)) {
        arrayOfTokenIds.push(tok.id);
      }
    }
    game.user?._onUpdateTokenTargets(arrayOfTokenIds);
  }
}
