//This macro forces all packs o migrate
game.packs.contents.forEach( async (pack) => {
  const priorLock = pack.locked;
  await pack.configure({locked: false});
  await pack.migrate();
  await pack.configure({locked: priorLock});
});
