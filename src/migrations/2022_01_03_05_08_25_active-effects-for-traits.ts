async function applyActiveEffects(p, actor) {
  await p;
  return Promise.all(actor.items.filter(item => item.type === "trait").map(async item => {
    if (!item.data.data.effectId) {
      const effects = await actor.createEmbeddedDocuments("ActiveEffect", [{
        origin: item.uuid,
        icon: item.img
      }]);
      await item.update({ "data.effectId": effects[0].id });
    }
    return Promise.resolve();
  }));
}

export async function migrate(): Promise<void> {
  const tokenActor = game.scenes?.reduce((memo: TokenDocument[], scene: Scene) => memo.concat(scene.tokens.contents), [])
    .filter((token: TokenDocument) => token.actor?.type === "traveller" && !token.data.actorLink)
    .map((token: TokenDocument) => token.actor);
  await game.actors?.filter(actor => actor.type === "traveller").reduce(applyActiveEffects, Promise.resolve());
  await tokenActor?.reduce(applyActiveEffects, Promise.resolve());
}
