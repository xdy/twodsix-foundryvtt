/**
 * Global type declarations for Foundry VTT
 * This file provides IntelliSense support for globally available Foundry classes and utilities
 * that are not included in Foundry's own global.d.mts file
 */

declare global {
  /**
   * A simple event framework used throughout Foundry Virtual Tabletop.
   * When key actions or events occur, a "hook" is defined where user-defined callback functions can execute.
   * This class manages the registration and execution of hooked callback functions.
   */
  class Hooks {
    /**
     * Register a callback handler which should be triggered when a hook is triggered.
     * @param hook - The unique name of the hooked event
     * @param fn - The callback function which should be triggered when the hook event occurs
     * @param options - Options which customize hook registration
     * @returns An ID number of the hooked function which can be used to turn off the hook later
     */
    static on(hook: string, fn: (...args: any[]) => any, options?: {once?: boolean}): number;

    /**
     * Register a callback handler for an event which is only triggered once the first time the event occurs.
     * An alias for Hooks.on with {once: true}
     * @param hook - The unique name of the hooked event
     * @param fn - The callback function which should be triggered when the hook event occurs
     * @returns An ID number of the hooked function which can be used to turn off the hook later
     */
    static once(hook: string, fn: (...args: any[]) => any): number;

    /**
     * Unregister a callback handler for a particular hook event
     * @param hook - The unique name of the hooked event
     * @param fn - The function, or ID number for the function, that should be turned off
     */
    static off(hook: string, fn: ((...args: any[]) => any) | number): void;

    /**
     * Call all hook listeners in the order in which they were registered
     * Hooks called this way can not be handled by returning false and will always trigger every hook callback.
     * @param hook - The hook being triggered
     * @param args - Arguments passed to the hook callback functions
     */
    static callAll(hook: string, ...args: any[]): boolean;

    /**
     * Call hook listeners in the order in which they were registered.
     * Continue calling hooks until either all have been called or one returns false.
     * @param hook - The hook being triggered
     * @param args - Arguments passed to the hook callback functions
     */
    static call(hook: string, ...args: any[]): boolean;
  }

  /**
   * Retrieve a Document by its Universally Unique Identifier (uuid).
   * @param uuid - The uuid of the Document to retrieve
   * @param options - Options to configure how the document is retrieved
   * @returns The Document if it could be found, otherwise null
   */
  const fromUuid: typeof foundry.utils.fromUuid;

  /**
   * Synchronously retrieve a Document by its Universally Unique Identifier (uuid).
   * @param uuid - The uuid of the Document to retrieve
   * @param options - Options to configure how the document is retrieved
   * @returns The Document if it could be found, otherwise null
   */
  const fromUuidSync: typeof foundry.utils.fromUuidSync;

  /**
   * The singleton Keyboard Manager instance.
   */
  const keyboard: KeyboardManager;

  /**
   * The singleton MouseManager instance.
   */
  const mouse: MouseManager;

  /**
   * The singleton Gamepad Manager instance.
   */
  const gamepad: GamepadManager;

  // Document classes available globally
  const Actor: typeof foundry.documents.BaseActor;
  const Cards: typeof foundry.documents.BaseCards;
  const ChatMessage: typeof foundry.documents.BaseChatMessage;
  const Combat: typeof foundry.documents.BaseCombat;
  const Combatant: typeof foundry.documents.BaseCombatant;
  const FogExploration: typeof foundry.documents.BaseFogExploration;
  const Folder: typeof foundry.documents.BaseFolder;
  const Item: typeof foundry.documents.BaseItem;
  const JournalEntry: typeof foundry.documents.BaseJournalEntry;
  const JournalEntryPage: typeof foundry.documents.BaseJournalEntryPage;
  const Macro: typeof foundry.documents.BaseMacro;
  const Playlist: typeof foundry.documents.BasePlaylist;
  const PlaylistSound: typeof foundry.documents.BasePlaylistSound;
  const RollTable: typeof foundry.documents.BaseRollTable;
  const Scene: typeof foundry.documents.BaseScene;
  const Setting: typeof foundry.documents.BaseSetting;
  const TableResult: typeof foundry.documents.BaseTableResult;
  const User: typeof foundry.documents.BaseUser;

  // Canvas layer classes
  const Token: typeof foundry.documents.BaseToken;
  const AmbientLight: typeof foundry.documents.BaseAmbientLight;
  const AmbientSound: typeof foundry.documents.BaseAmbientSound;
  const Drawing: typeof foundry.documents.BaseDrawing;
  const MeasuredTemplate: typeof foundry.documents.BaseMeasuredTemplate;
  const Note: typeof foundry.documents.BaseNote;
  const Tile: typeof foundry.documents.BaseTile;
  const Wall: typeof foundry.documents.BaseWall;

  // Active effect
  const ActiveEffect: typeof foundry.documents.BaseActiveEffect;

  // Roll classes
  const Roll: typeof foundry.dice.Roll;
  const Die: typeof foundry.dice.terms.Die;
  const DiceTerm: typeof foundry.dice.terms.DiceTerm;

  // Other commonly used classes
  const FilePicker: typeof foundry.applications.api.FilePicker;
  const Dialog: typeof foundry.applications.api.DialogV2;

  // Helper functions
  const mergeObject: typeof foundry.utils.mergeObject;
  const duplicate: typeof foundry.utils.deepClone;
  const randomID: typeof foundry.utils.randomID;
  const getProperty: typeof foundry.utils.getProperty;
  const setProperty: typeof foundry.utils.setProperty;
  const hasProperty: typeof foundry.utils.hasProperty;
  const expandObject: typeof foundry.utils.expandObject;
  const flattenObject: typeof foundry.utils.flattenObject;
  const diffObject: typeof foundry.utils.diffObject;
  const isEmpty: typeof foundry.utils.isEmpty;
  const isObjectEmpty: typeof foundry.utils.isObjectEmpty;

  // Socket
  const socketlib: any; // If using socketlib module
}

export {};
