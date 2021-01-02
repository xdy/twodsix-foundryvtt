Hooks.on('createItem', async (entity) => {
  // Set flag newItem for newly created items so that we can show the "close and create new" button for new items.
  entity.setFlag('twodsix', 'newItem', true);
});
