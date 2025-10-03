// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import { renderDamageDialog, destroyDamageDialog } from "../utils/actorDamage";
import { destroyHealingDialog, renderHealingDialog } from "../utils/actorHealing";

Hooks.on('createDamageDialog', renderDamageDialog);
Hooks.on('destroyDamageDialog', destroyDamageDialog);
Hooks.on('createHealingDialog', renderHealingDialog);
Hooks.on('destroyHealingDialog', destroyHealingDialog);
