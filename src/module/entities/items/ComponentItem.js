// Re-export BaseComponentItem under the legacy name for backward compatibility.
// The Item Proxy in twodsix.js dispatches per-subtype to the classes in components/.
export { BaseComponentItem as ComponentItem } from './components/BaseComponentItem.js';
