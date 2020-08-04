export const registerSettings = function ():void {
    // Register any custom system settings here
    game.settings.register('twodsix', 'defaultTokenSettings', {
        name: 'Default Prototype Token Settings',
        hint: "Automatically set advised prototype token settings to newly created Actors.",
        scope: 'world',
        config: true,
        default: true,
        type: Boolean,
    });

    //TODO Tons of settings to come. Initiative rule, skill-list to use, assorted rules that differ between different 2d6 rules sets (CE, CE FTL, etc)

}
