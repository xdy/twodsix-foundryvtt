import {twodsixItemSheet} from './items/item-sheet';

export default function registerItemSheets() {
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("twodsix", twodsixItemSheet, {makeDefault: true});
}
