// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { renderDamageDialog, destroyDamageDialog } from "../utils/actorDamage";

Hooks.on('createDamageDialog', renderDamageDialog);
Hooks.on('destroyDamageDialog', destroyDamageDialog);
