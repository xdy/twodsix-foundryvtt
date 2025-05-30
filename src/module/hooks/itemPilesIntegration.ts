// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
Hooks.once("item-piles-ready", async function() {
  /// Called once Item Piles is ready to be used
  game.itempiles.API.addSystemIntegration({
    "VERSION": "4.1.2",

    // The actor class type is the type of actor that will be used for the default item pile actor that is created on first item drop.
    "ACTOR_CLASS_TYPE": "traveller",

    // The item quantity attribute is the path to the attribute on items that denote how many of that item that exists
    "ITEM_QUANTITY_ATTRIBUTE": "system.quantity",

    // The item price attribute is the path to the attribute on each item that determine how much it costs
    "ITEM_PRICE_ATTRIBUTE": "system.price",

    // Item filters actively remove items from the item pile inventory UI that users cannot loot, such as spells, feats, and classes
    "ITEM_FILTERS": [
      {
        "path": "type",
        "filters": "skills,trait,spell,ship_position,psiAbility"
      },
      {
        "path": "name",
        "filters": game.i18n.localize("TWODSIX.Items.Weapon.Unarmed")
      }
    ],

    "PILE_DEFAULTS": {
      "merchantColumns": [{
        "label": "TWODSIX.Actor.Items.TL",
        "path": "system.techLevel",
        "formatting": "{#}",
        "mapping": {}
      }]
    },

    // Item similarities determines how item piles detect similarities and differences in the system
    "ITEM_SIMILARITIES": ["name", "type", "techLevel"],

    // Currencies in item piles is a versatile system that can accept actor attributes (a number field on the actor's sheet) or items (actual items in their inventory)
    // In the case of attributes, the path is relative to the "actor.system"
    // In the case of items, it is recommended you export the item with `.toObject()` and strip out any module data
    "CURRENCIES": [
      {
        type: "attribute",
        name: "TWODSIX.Credits",
        img: "systems/twodsix/assets/icons/id-card.svg",
        abbreviation: "Cr {#}",
        data: {
          path: "system.financeValues.cash"
        },
        primary: true,
        exchangeRate: 1
      }
    ],

    "CURRENCY_DECIMAL_DIGITS": 0.01
    /*"CSS_VARIABLES": {
      "even-color": "#00000080",
      "odd-color": "#00000000",
    }*/
  });
});
