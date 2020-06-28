export const templates = async function() {
	const templatePaths = [
		// Add paths to "systems/twodsix/templates"
		"systems/twodsix/src/templates/actors/actor-sheet.html",
		"systems/twodsix/src/templates/items/item-sheet.html"
	];

	return loadTemplates(templatePaths);
}
