// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
Hooks.once("item-piles-ready", () => {
  /// Called once Item Piles is ready to be used
  //Set Item Piles filtered items
  game.itempiles.API.setItemFilters([
    {path: 'type', filters: 'skills'},
    {path: 'type', filters: 'trait'},
    {path: 'type', filters: 'spell'},
    {path: 'name', filters: 'Unarmed'}
  ]);
});
