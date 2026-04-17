/**
 * Bulk life support cargo purchase and sale.
 */

import { BULK_LS_CARGO_ID } from '../TraderConstants.js';
import { getTraderRuleset } from '../TraderRulesetRegistry.js';
import { addExpense, addRevenue, getFreeCargoSpace } from '../TraderState.js';
import { chooseIntOption, getBulkLifeSupportCargoId } from './atWorldShared.js';

/**
 * @param {import('../TraderApp.js').TraderApp} app
 */
export async function buyBulkLifeSupport(app) {
  const s = app.state;
  const freeSpace = getFreeCargoSpace(s);
  const ruleset = getTraderRuleset(s.ruleset);

  if (!ruleset.isBulkLifeSupportEnabled()) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.BulkLifeSupportDisabled'));
    return;
  }

  const bulkCosts = ruleset.getBulkLifeSupportCosts();

  if (freeSpace <= 0) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoFreeCargoSpaceBulk'));
    return;
  }

  const options = [];
  if (s.credits >= bulkCosts.normal) {
    options.push({ value: 'normal', label: `${game.i18n.localize('TWODSIX.Trader.BulkLSNormal')} — Cr${bulkCosts.normal.toLocaleString()}/t` });
  }
  if (s.credits >= bulkCosts.luxury) {
    options.push({ value: 'luxury', label: `${game.i18n.localize('TWODSIX.Trader.BulkLSLuxury')} — Cr${bulkCosts.luxury.toLocaleString()}/t` });
  }
  options.push({ value: 'none', label: game.i18n.localize('TWODSIX.Trader.Actions.NoBuy') });

  const type = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.BuyBulkLS'), options);
  if (type === 'none') {
    return;
  }

  const costPerTon = type === 'normal' ? bulkCosts.normal : bulkCosts.luxury;
  const itemName = type === 'normal' ? 'TWODSIX.Trader.BulkLSNormal' : 'TWODSIX.Trader.BulkLSLuxury';

  const maxTons = Math.min(freeSpace, Math.floor(s.credits / costPerTon));
  const qtyOptions = [];
  for (let i = 1; i <= maxTons; i++) {
    qtyOptions.push({ value: String(i), label: `${i} tons — Cr${(i * costPerTon).toLocaleString()}` });
  }

  const qty = await chooseIntOption(app,
    game.i18n.format('TWODSIX.Trader.Prompts.BuyQuantity', { good: game.i18n.localize(itemName) }),
    qtyOptions,
    maxTons,
  );

  if (qty > 0) {
    const totalCost = qty * costPerTon;
    addExpense(s, totalCost);

    const localizedName = game.i18n.localize(itemName);
    const cargoId = type === 'normal' ? BULK_LS_CARGO_ID.NORMAL : BULK_LS_CARGO_ID.LUXURY;
    const existing = s.cargo.find(c => getBulkLifeSupportCargoId(c) === cargoId);
    if (existing) {
      existing.tons += qty;
    } else {
      s.cargo.push({
        cargoId,
        name: localizedName,
        tons: qty,
        purchasePricePerTon: costPerTon,
        purchaseWorld: s.currentWorldName,
      });
    }
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.BoughtGoods', {
      qty: qty,
      type: game.i18n.localize(itemName),
      price: costPerTon.toLocaleString(),
      total: totalCost.toLocaleString(),
    }) + ` Credits: Cr${s.credits.toLocaleString()}.`);
  }
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 */
export async function sellBulkLifeSupport(app) {
  const s = app.state;
  const bulkCargo = s.cargo.filter(c => getBulkLifeSupportCargoId(c) !== null);

  if (!bulkCargo.length) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoBulkSuppliesToSell'));
    return;
  }

  const options = bulkCargo.map((c, idx) => {
    const isSameWorld = c.purchaseWorld === s.currentWorldName;
    const label = isSameWorld
      ? `${c.name} (${c.tons}t) — Cr${c.purchasePricePerTon.toLocaleString()}/t (Refund/Cancel)`
      : `${c.name} (${c.tons}t) — Cr${c.purchasePricePerTon.toLocaleString()}/t (100% value)`;
    return {
      value: String(idx),
      label,
      isSameWorld,
    };
  });
  options.push({ value: 'none', label: game.i18n.localize('TWODSIX.Trader.Actions.NoSell') });

  const chosenIdx = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.SellBulkLS'), options);
  if (chosenIdx === 'none') {
    return;
  }

  const chosenBulkIdx = Number.parseInt(chosenIdx, 10);
  const originalCargoIdx = s.cargo.indexOf(bulkCargo[chosenBulkIdx]);
  const cargo = s.cargo[originalCargoIdx];

  const qtyOptions = [];
  qtyOptions.push({
    value: String(cargo.tons),
    label: `${cargo.tons} tons (All) — Cr${(cargo.tons * cargo.purchasePricePerTon).toLocaleString()}`,
  });

  for (let i = 1; i < cargo.tons; i++) {
    qtyOptions.push({ value: String(i), label: `${i} ton${i > 1 ? 's' : ''} — Cr${(i * cargo.purchasePricePerTon).toLocaleString()}` });
  }

  const qty = parseFloat(await app._choose(
    game.i18n.format('TWODSIX.Trader.Prompts.BuyQuantity', { good: game.i18n.localize(cargo.name) }),
    qtyOptions,
    String(cargo.tons),
  ));

  if (qty > 0) {
    const isSameWorld = cargo.purchaseWorld === s.currentWorldName;
    const revenue = qty * cargo.purchasePricePerTon;
    addRevenue(s, revenue);

    if (qty === cargo.tons) {
      s.cargo.splice(originalCargoIdx, 1);
    } else {
      cargo.tons -= qty;
    }

    const logMsg = isSameWorld
      ? `Cancelled purchase of ${qty}t ${game.i18n.localize(cargo.name)} at Cr${cargo.purchasePricePerTon.toLocaleString()}/t (Full refund).`
      : `Sold ${qty}t ${game.i18n.localize(cargo.name)} at Cr${cargo.purchasePricePerTon.toLocaleString()}/t. `
        + `Revenue: Cr${revenue.toLocaleString()}.`;

    await app.logEvent(`${logMsg} Credits: Cr${s.credits.toLocaleString()}.`);
  }
}
