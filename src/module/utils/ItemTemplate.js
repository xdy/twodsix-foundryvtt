var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
  if (kind === "m") {
    throw new TypeError("Private method is not writable");
  }
  if (kind === "a" && !f) {
    throw new TypeError("Private accessor was defined without a setter");
  }
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) {
    throw new TypeError("Cannot write private member to an object whose class did not declare it");
  }
  return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
  if (kind === "a" && !f) {
    throw new TypeError("Private accessor was defined without a getter");
  }
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) {
    throw new TypeError("Cannot read private member from an object whose class did not declare it");
  }
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _ItemTemplate_moveTime, _ItemTemplate_initialLayer, _ItemTemplate_events;
import {TWODSIX} from "../config";

/**
 * A helper class for building MeasuredTemplates for item AOE.  Adapted from D5e system
 */
export default class ItemTemplate extends MeasuredTemplate {
  constructor() {
    super(...arguments);
    /**
     * Track the timestamp when the last mouse move event was captured.
     * @type {number}
     */
    _ItemTemplate_moveTime.set(this, 0);
    /* -------------------------------------------- */
    /**
     * The initially active CanvasLayer to re-activate after the workflow is complete.
     * @type {CanvasLayer}
     */
    _ItemTemplate_initialLayer.set(this, void 0);
    /* -------------------------------------------- */
    /**
     * Track the bound event handlers so they can be properly canceled later.
     * @type {object}
     */
    _ItemTemplate_events.set(this, void 0);
  }

  /* -------------------------------------------- */
  /**
   * A factory method to create an AbilityTemplate instance using provided data from an Item5e instance
   * @param {TwodsixItem} item               The Item object for which to construct the template
   * @returns {ItemTemplate|null}    The template object, or null if the item does not produce a template
   */
  static fromItem(item) {
    const target = item.system.target ?? {};
    const templateShape = TWODSIX.areaTargetTypes[target.type]?.template;
    if (!templateShape) {
      return null;
    }
    // Prepare template data
    const templateData = {
      t: templateShape,
      user: game.user?.id,
      distance: target.value,
      direction: 0,
      x: 0,
      y: 0,
      fillColor: game.user?.color,
      flags: {twodsix: {origin: item.uuid}}
    };
    // Additional type-specific data
    switch (templateShape) {
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
    const template = new cls(templateData, {parent: canvas.scene});
    const object = new this(template);
    object.item = item;
    object.actorSheet = item.actor?.sheet || null;
    return object;
  }

  /* -------------------------------------------- */
  /**
   * Creates a preview of the spell template.
   * @returns {Promise}  A promise that resolves with the final measured template if created.
   */
  drawPreview() {
    const initialLayer = canvas.activeLayer;
    // Draw the template and switch to the template layer
    this.draw();
    this.layer.activate();
    this.layer.preview?.addChild(this);
    // Hide the sheet that originated the preview
    this.actorSheet?.minimize();
    // Activate interactivity
    return this.activatePreviewListeners(initialLayer);
  }

  /* -------------------------------------------- */
  /**
   * Activate listeners for the template preview
   * @param {CanvasLayer} initialLayer  The initially active CanvasLayer to re-activate after the workflow is complete
   * @returns {Promise}                 A promise that resolves with the final measured template if created.
   */
  activatePreviewListeners(initialLayer) {
    return new Promise((resolve, reject) => {
      __classPrivateFieldSet(this, _ItemTemplate_initialLayer, initialLayer, "f");
      __classPrivateFieldSet(this, _ItemTemplate_events, {
        cancel: this._onCancelPlacement.bind(this),
        confirm: this._onConfirmPlacement.bind(this),
        move: this._onMovePlacement.bind(this),
        resolve,
        reject,
        rotate: this._onRotatePlacement.bind(this)
      }, "f");
      // Activate listeners
      canvas.stage.on("mousemove", __classPrivateFieldGet(this, _ItemTemplate_events, "f").move);
      canvas.stage.on("mousedown", __classPrivateFieldGet(this, _ItemTemplate_events, "f").confirm);
      canvas.app.view.oncontextmenu = __classPrivateFieldGet(this, _ItemTemplate_events, "f").cancel;
      canvas.app.view.onwheel = __classPrivateFieldGet(this, _ItemTemplate_events, "f").rotate;
    });
  }

  /* -------------------------------------------- */
  /**
   * Shared code for when template placement ends by being confirmed or canceled.
   * @param {Event} event  Triggering event that ended the placement.
   */
  async _finishPlacement(event) {
    this.layer._onDragLeftCancel(event);
    canvas.stage.off("mousemove", __classPrivateFieldGet(this, _ItemTemplate_events, "f").move);
    canvas.stage.off("mousedown", __classPrivateFieldGet(this, _ItemTemplate_events, "f").confirm);
    canvas.app.view.oncontextmenu = null;
    canvas.app.view.onwheel = null;
    __classPrivateFieldGet(this, _ItemTemplate_initialLayer, "f").activate();
    await this.actorSheet?.maximize();
  }

  /* -------------------------------------------- */
  /**
   * Move the template preview when the mouse moves.
   * @param {Event} event  Triggering mouse event.
   */
  _onMovePlacement(event) {
    event.stopPropagation();
    const now = Date.now(); // Apply a 20ms throttle
    if (now - __classPrivateFieldGet(this, _ItemTemplate_moveTime, "f") <= 20) {
      return;
    }
    const center = event.data.getLocalPosition(this.layer);
    const interval = canvas.grid.type === CONST.GRID_TYPES.GRIDLESS ? 0 : 2;
    const snapped = canvas.grid.getSnappedPosition(center.x, center.y, interval);
    this.document.updateSource({x: snapped.x, y: snapped.y});
    this.refresh();
    __classPrivateFieldSet(this, _ItemTemplate_moveTime, now, "f");
  }

  /* -------------------------------------------- */
  /**
   * Rotate the template preview by 3˚ increments when the mouse wheel is rotated.
   * @param {Event} event  Triggering mouse event.
   */
  _onRotatePlacement(event) {
    if (event.ctrlKey) {
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
    const interval = canvas.grid.type === CONST.GRID_TYPES.GRIDLESS ? 0 : 2;
    const destination = canvas.grid.getSnappedPosition(this.document.x, this.document.y, interval);
    this.document.updateSource(destination);
    __classPrivateFieldGet(this, _ItemTemplate_events, "f").resolve(canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [this.document.toObject()]));
  }

  /* -------------------------------------------- */
  /**
   * Cancel placement when the right mouse button is clicked.
   * @param {Event} event  Triggering mouse event.
   */
  async _onCancelPlacement(event) {
    await this._finishPlacement(event);
    __classPrivateFieldGet(this, _ItemTemplate_events, "f").reject();
  }
}
_ItemTemplate_moveTime = new WeakMap(), _ItemTemplate_initialLayer = new WeakMap(), _ItemTemplate_events = new WeakMap();

/**
 * Determines whether a token is within the template.
 * @param {Token} token  token on canvas.
 * @param {ItemTemplate} template  token on canvas.
 * @returns {boolean}   whether token in inside template
 */
function checkTokenInTemplate(token, template) {
  const grid = canvas.scene?.grid;
  const {x: tempx, y: tempy} = template;
  const startX = token.document.width >= 1 ? 0.5 : token.document.width / 2;
  const startY = token.document.height >= 1 ? 0.5 : token.document.height / 2;
  for (let x = startX; x < token.document.width; x++) {
    for (let y = startY; y < token.document.width; y++) {
      const curr = {x: token.document.x + x * grid.size - tempx, y: token.document.y + y * grid.size - tempy};
      const contains = template.object.shape?.contains(curr.x, curr.y);
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
export function targetTokensInTemplate(template) {
  const tokens = canvas.tokens?.placeables;
  const arrayOfTokenIds = [];
  if (tokens?.length > 0) {
    for (const tok of tokens) {
      if (checkTokenInTemplate(tok, template)) {
        arrayOfTokenIds.push(tok.id);
      }
      game.user?.updateTokenTargets(arrayOfTokenIds);
    }
  }
}
