// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { handleTableRoll, handleSkillRoll } from "../utils/enrichers";
// Add hooks when clicking on rollable table link
for (const sheet of ["JournalPageSheet"]) {
  Hooks.on(`render${sheet}`, (_app, html, _options) => {
    html.on('click contextmenu', '.table-roll', handleTableRoll.bind());
    html.on('click contextmenu', '.skill-roll', handleSkillRoll.bind());
  });
}
