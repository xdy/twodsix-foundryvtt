import { renderDamageDialog, destroyDamageDialog } from "../utils/actorDamage";

Hooks.on('createDamageDialog', renderDamageDialog);
Hooks.on('destroyDamageDialog', destroyDamageDialog);
