Hooks.on("renderPause", (app, html, options) => {
  if (options.paused) {
    html.find("img")[0].src = "./systems/twodsix/assets/pause/sunburst.svg";
  }
});
