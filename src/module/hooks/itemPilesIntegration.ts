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
