// Re-export BaseConsumableItem under the legacy name for backward compatibility.
// The Item Proxy in twodsix.js dispatches per-subtype to the classes in consumables/.
export { BaseConsumableItem as ConsumableItem } from './consumables/BaseConsumableItem.js';
