export default function ():Promise<void> {
  const templatePaths = [
    //TODO Set up so the templates are instead loaded during build, using all html files in the templates folder
    "systems/twodsix/templates/actors/actor-sheet.html",
    "systems/twodsix/templates/actors/parts/actor/actor-skills.html",
    "systems/twodsix/templates/actors/parts/actor/actor-items.html",
    "systems/twodsix/templates/actors/parts/actor/actor-finances.html",
    "systems/twodsix/templates/actors/parts/actor/actor-items.html",
    "systems/twodsix/templates/actors/parts/actor/actor-notes.html",
    "systems/twodsix/templates/actors/parts/actor/actor-info.html",
    "systems/twodsix/templates/actors/ship-sheet.html",
    "systems/twodsix/templates/actors/parts/ship/ship-crew.html",
    "systems/twodsix/templates/actors/parts/ship/ship-storage.html",
    "systems/twodsix/templates/actors/parts/ship/ship-cargo.html",
    "systems/twodsix/templates/actors/parts/ship/ship-notes.html",
    "systems/twodsix/templates/items/item-sheet.html",
    "systems/twodsix/templates/items/skills-sheet.html",
    "systems/twodsix/templates/items/armor-sheet.html",
    "systems/twodsix/templates/items/augment-sheet.html",
    "systems/twodsix/templates/items/tool-sheet.html",
    "systems/twodsix/templates/items/junk-sheet.html",
    "systems/twodsix/templates/items/equipment-sheet.html",
    "systems/twodsix/templates/items/storage-sheet.html"

  ];

  return loadTemplates(templatePaths);
}
