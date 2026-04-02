import { destroyDamageDialog, renderDamageDialog } from '../utils/actorDamage';
import { destroyHealingDialog, renderHealingDialog } from '../utils/actorHealing';

Hooks.on('createDamageDialog', renderDamageDialog);
Hooks.on('destroyDamageDialog', destroyDamageDialog);
Hooks.on('createHealingDialog', renderHealingDialog);
Hooks.on('destroyHealingDialog', destroyHealingDialog);
