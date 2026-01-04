# Foundry VTT Utilities Improvements

**Date:** January 4, 2026
**Status:** Implemented, Not Yet Tested

## Summary
Systematic improvements to better leverage Foundry VTT's built-in utility methods across the codebase.

## Changes Implemented

### ✅ #1: Removed Dead Code
**File:** `src/module/utils/utils.ts`
- Removed unused `mergeDeep()` function
- Removed unused `isObject()` function
- **Status:** Complete

### ✅ #2: Replaced Object.keys().length with isEmpty()
**Files Modified:** 8 replacements across 5 files
1. `src/module/entities/TwodsixActor.ts` - 3 replacements (charDiff, financeDiff checks)
2. `src/module/hooks/addGMControlButtons.ts` - 1 replacement (tokenData check)
3. `src/module/sheets/TwodsixItemSheet.ts` - 1 replacement (updates check)
4. `src/module/hooks/updateFinances.ts` - 2 replacements
5. `src/migrations/2024_04_01_08_28_migrate_data.ts` - 1 replacement
- **Pattern:** `Object.keys(obj).length > 0` → `!foundry.utils.isEmpty(obj)`
- **Status:** Complete

### ✅ #3: Replaced typeof/Array.isArray with getType()
**Files Modified:** 6 replacements across 6 files
1. `src/module/entities/TwodsixCombatant.ts` - `typeof formula === 'function'` → `foundry.utils.getType(formula) === 'function'`
2. `src/migrations/6_2025_11_23_10_09_v14_Migrations.ts` - Array.isArray check
3. `src/module/entities/TwodsixActiveEffect.ts` - Array.isArray check
4. `src/migrations/2023_04_01_014_41_00_refactor_damageTypes.ts` - Array.isArray check
5. `src/module/sheets/AbstractTwodsixActorSheet.ts` - Array.isArray check
6. `src/module/utils/shipDamage.ts` - Array.isArray check
- **Status:** Complete

### ⏭️ #4: expandObject/flattenObject
- **Decision:** Skipped - already optimally used in codebase
- **Status:** N/A

### ✅ #5: Implemented localeCompare() for Sorting
**Files Modified:** 3 functions
1. `src/module/utils/utils.ts` - `sortByItemName()` now uses `localeCompare(b.name, game.i18n.lang, {sensitivity: 'base'})`
2. `src/module/entities/TwodsixItem.ts` - `sortByName()` method updated
3. `src/module/settings.ts` - ruleset options sorting updated
- **Note:** `sortObj()` analysis showed it sorts technical IDs, not user-facing text, so localeCompare wasn't appropriate there
- **Bug Fixed:** Restored missing `result[key] = obj[key]` assignment in sortObj()
- **Status:** Complete

### 🔄 #6: Added debounce() for Performance
**Files Modified:** 3 files

#### actorDamage.ts
- **Class:** `DamageDialogHandler`
- **Changes:**
  - Added `debouncedRefresh: () => void` property
  - Created debounced function in constructor: `foundry.utils.debounce(() => this.refresh(), 150)`
  - Replaced `this.refresh()` with `this.debouncedRefresh()` in 3 input handlers:
    * `.damage` input handler
    * `.armor` input handler
    * `.damage-input` input handler
  - **Added cleanup:** Cancel debounced function in `unRegisterListeners()` to prevent stale updates
- **Delay:** 150ms (reduced from initial 300ms after user testing showed laggy feel)
- **Benefit:** Typing "100" now triggers 1 refresh instead of 3; prevents 15-35+ DOM manipulations per keystroke

#### actorHealing.ts
- **Class:** `HealingDialogHandler`
- **Changes:**
  - Added `debouncedRefresh: () => void` property
  - Created debounced function in constructor: `foundry.utils.debounce(() => this.refresh(), 150)`
  - Replaced `this.refresh()` with `this.debouncedRefresh()` in `.healing-input` handler
  - **Added cleanup:** Cancel debounced function in `unRegisterListeners()` to prevent stale updates
  - **Fixed validation order:** Ensure `getNumericValueFromEvent()` runs before setting stat value
- **Delay:** 150ms (reduced from initial 300ms after user testing)
#### showStatusIcons.ts
- **Functions:** `applyEncumberedEffect()`, `performEncumbranceUpdate()`, `setWoundedState()`
- **Changes:**
  - Added per-actor locks: `encumbranceUpdateInProgress` and `woundedStateUpdateInProgress` Sets
  - Early return if update already in progress prevents concurrent modifications
  - Re-fetch effects right before deletion/update to avoid stale references
  - Filter effect IDs before deletion to handle race conditions
- **Critical fix:** Lock pattern prevents race condition where concurrent calls try to modify effects simultaneously
- **Benefit:** Prevents "ActiveEffect does not exist" errors during rapid damage changes
- **Pattern:** Mutex/lock for exclusive access during actor effect updates

## Additional Fixes

### TwodsixActor.ts - Linter Compliance
Added required braces to 4 single-line if statements:
- `_checkCrewTitles()` - crewLabel guard
- `_updateCharacteristics()` - characteristics guard
- `_prepareActorDerivedData()` - system data guard
- `_prepareShipDerivedData()` - shipStats/financeValues guard

### settings.ts - Syntax Error
Fixed orphaned `return 0; });` code from sorting function

### tsconfig.json - Deprecation Warnings
Changed `ignoreDeprecations` from "5.0" to "6.0" for TypeScript 6.x compatibility

## Testing Results

### #6: Debounce Implementation - TESTED ✅
- **Damage Dialog:** Responsive at 150ms delay ✅
- **Healing Dialog:** Working correctly with 150ms delay ✅
- **Encumbrance:** Fixed with per-actor lock pattern ✅
- **Race conditions:** Eliminated with mutex pattern ✅
- **ActiveEffect errors:** No longer occurring ✅

## Next Steps (Not Yet Implemented)

### #7: Replace duplicate() with deepClone()
- **Priority:** High (duplicate() is deprecated in Foundry v12+)
- **Action:** Search for all `foundry.utils.duplicate()` or `.duplicate()` calls
- **Replace with:** `foundry.utils.deepClone()`

### #8-10: Additional Opportunities
To be evaluated after testing debouncing changes.

## Notes
- All changes follow Foundry VTT v12+ API conventions
- Debouncing for input dialogs uses Foundry's built-in `foundry.utils.debounce()` utility (150ms delay)
- Concurrency control for effect updates uses per-actor lock pattern (mutex)
- Original lock pattern was correct - concurrency requires mutual exclusion, not just batching
