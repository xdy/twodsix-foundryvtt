// eslint-disable-next-line @typescript-eslint/no-unused-vars
Hooks.on('createItem', async (entity, options, userId) => {
  // Set flag newItem for newly created items so that we can show the "close and create new" button for new items.
  entity.setFlag('twodsix', 'newItem', true);
});
