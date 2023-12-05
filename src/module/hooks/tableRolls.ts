// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { handleTableRoll } from "../utils/enrichers";

for (const sheet of ["JournalPageSheet"]) {
  Hooks.on(`render${sheet}`, (_app, html, _options) => {
    html.on('click contextmenu', '.table-roll', handleTableRoll.bind());
  });
}
