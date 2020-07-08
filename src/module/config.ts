// Namespace TWODSIX Configuration Values
export const TWODSIX: any = {
};

/**
 * The sets of rules variants one can use
 * @type {Object}
 */
TWODSIX.variant = {
    "ce": "Cepheus Engine",
}


//TODO Start with skills, should do for others as well I guess
export class TwodsixItemList {
    static async getItems(itemType?: string, metadataName?: string, labels_only = true): Promise<string[] | Item[]> {
        // First, retrieve any custom or overridden items so that we can prioritize those.
        let allItems = game.items.entities.filter(item => item.type == itemType);
        // Next, retrieve compendium items and merge them in.
        let c: any;
        for (c of game.packs) {
            if (c.metadata.entity && c.metadata.entity == 'Item' && c.metadata.name == metadataName) {
                allItems = allItems.concat(c ? await c.getContent() : []);
            }
        }
        // Reduce duplicates. Because item classes happen first, this will prevent
        // duplicate compendium entries from overriding the items.
        let charItemNames: string[] = [];
        for (let charItem of allItems) {
            let charItemName = charItem.data.name;
            if (charItemNames.includes(charItemName) !== false) {
                allItems = allItems.filter(item => item._id != charItem._id);
            } else {
                charItemNames.push(charItemName);
            }
        }

        // Sort the charItemNames list.
        if (labels_only) {
            charItemNames.sort((a, b) => {
                const aSort = a.toLowerCase();
                const bSort = b.toLowerCase();
                if (aSort < bSort) {
                    return -1;
                }
                if (aSort > bSort) {
                    return 1;
                }
                return 0;
            });

            return charItemNames;
        }
        // Sort the class objects list.
        else {
            allItems.sort((a, b) => {
                const aSort = a.data.name.toLowerCase();
                const bSort = b.data.name.toLowerCase();
                if (aSort < bSort) {
                    return -1;
                }
                if (aSort > bSort) {
                    return 1;
                }
                return 0;
            });

            return allItems;
        }
    }
}