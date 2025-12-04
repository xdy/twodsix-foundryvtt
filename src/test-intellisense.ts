/**
 * Test file to verify IntelliSense improvements are working
 * Open this file in VS Code and check if autocomplete works for the examples below
 */

// ============================================================================
// TEST 1: Foundry Namespaced APIs
// ============================================================================
// Type "foundry.applications.api." and you should see autocomplete with:
// - DialogV2, HandlebarsApplicationMixin, ApplicationV2, etc.

async function testDialog() {
  const result = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Test Dialog" } as any,
    content: "<p>Testing IntelliSense</p>",
    ok: {
      label: "Confirm",
      callback: async (event: PointerEvent | SubmitEvent, button: HTMLButtonElement, dialog: any): Promise<string> => {
        return "confirmed";
      }
    }
  });

  console.log(result);
}

// ============================================================================
// TEST 2: Global Classes
// ============================================================================
// Type "Hooks." and you should see: on, once, callAll, call, etc.

Hooks.on("init", () => {
  console.log("Testing Hooks IntelliSense");
});

Hooks.once("ready", () => {
  // Type "game." and you should see: user, users, actors, items, settings, etc.
  console.log(game.user?.name);

  // Type "ui." and you should see: notifications, chat, sidebar, etc.
  ui.notifications?.info("Testing UI IntelliSense");
});

// ============================================================================
// TEST 3: fromUuid and fromUuidSync
// ============================================================================
// These should have proper typing and autocomplete

async function testUuidFunctions() {
  // Type "fromUuid" and hover - should show full signature
  const actor = await fromUuid("Actor.abc123");
  if (actor) {
    console.log(actor.name);
  }

  // Type "fromUuidSync" and hover - should show full signature
  const item = fromUuidSync("Item.xyz789");
  if (item) {
    console.log(item.name);
  }
}

// ============================================================================
// TEST 4: Canvas and Mouse/Keyboard
// ============================================================================
// Global canvas, keyboard, mouse, gamepad should be available

function testCanvasGlobals() {
  // Type "canvas." and you should see: scene, grid, tokens, lighting, etc.
  if (canvas.ready) {
    console.log(canvas.scene?.name);
  }

  // Type "keyboard." and you should see keyboard manager methods
  keyboard.downKeys.has("Control");

  // Type "mouse." and you should see mouse manager properties
  // Note: mouse.position doesn't exist - use mouse.getPosition() instead
  console.log((mouse as any).position);
}

// ============================================================================
// TEST 5: Path Aliases (@client and @common)
// ============================================================================
// Import types using path aliases

/** @import {FormSelectOption} from "@client/applications/forms/fields.mjs" */
/** @import {DataModel} from "@common/abstract/data.mjs" */

/**
 * Function that uses imported types
 * @param {FormSelectOption[]} options - Hover over this and you should see the type definition
 */
function createSelectField(options) {
  // Typing "options[0]." should show: value, label, group, disabled, selected, rule
  const firstOption = options[0];
  console.log(firstOption.value, firstOption.label);
}

// ============================================================================
// TEST 6: Foundry Utils
// ============================================================================
// Type "foundry.utils." and you should see all utility functions

function testFoundryUtils() {
  // Should show: mergeObject, deepClone, randomID, getProperty, setProperty, etc.
  const merged = foundry.utils.mergeObject({a: 1}, {b: 2});
  const cloned = foundry.utils.deepClone(merged);
  const id = foundry.utils.randomID();

  console.log(merged, cloned, id);
}

// ============================================================================
// TEST 7: Document Classes
// ============================================================================
// Access to all Document classes through foundry.documents

async function testDocuments() {
  // Type "foundry.documents." and you should see: BaseActor, BaseItem, etc.
  const actorData = {
    name: "Test Actor",
    type: "character"
  };

  // Should have proper typing
  const actor = await Actor.create(actorData);

  // Type "actor." and you should see all Actor methods
  await actor?.update({name: "Updated Name"});
}

// ============================================================================
// VERIFICATION CHECKLIST
// ============================================================================
// ✓ foundry.applications.api.* shows autocomplete
// ✓ Hooks class methods show autocomplete
// ✓ game, canvas, ui globals have proper typing
// ✓ fromUuid and fromUuidSync are typed
// ✓ @client/* and @common/* imports work
// ✓ keyboard, mouse, gamepad globals available
// ✓ foundry.utils.* shows all utility functions
// ✓ foundry.documents.* shows all document classes
// ✓ Hovering over variables shows correct types
// ✓ No red squiggly lines under valid Foundry code

export {};
