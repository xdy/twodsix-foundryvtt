import {twodsixItemSheet} from './item/item-sheet';

export default function registerItemSheets() {
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("twodsix", twodsixItemSheet, {makeDefault: true});
}
