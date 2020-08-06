export default function ():Promise<void> {
  const templatePaths = [
    //TODO Set up so the templates are instead loaded during build, using all html files in the templates folder
    "systems/twodsix/templates/actors/actor-sheet.html",
    "systems/twodsix/templates/actors/parts/actor-skills.html",
    "systems/twodsix/templates/actors/parts/actor-items.html",
    "systems/twodsix/templates/actors/parts/actor-info.html",
    "systems/twodsix/templates/items/item-sheet.html"
  ];

  return loadTemplates(templatePaths);
}
