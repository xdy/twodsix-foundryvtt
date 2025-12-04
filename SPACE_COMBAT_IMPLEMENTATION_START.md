# Space Combat Phases - Implementation Start Guide

**Status:** Ready for Phase 1 implementation  
**Design Document:** `SPACE_COMBAT_PHASES_DESIGN.md` (complete, 1000+ lines)  
**Last Updated:** Just now  

---

## Quick Summary

We've designed a **phase-based space combat system** for Cepheus Engine rulesets:

✅ **Pure Space Combat** (ships/space-objects only)
- Uses **3-phase turn structure**: Declaration → Actions → Damage
- Tracks **action budgets** per crew member: 3 minor OR 1 significant per turn
- Calculates **reactions** based on initiative: 1-4 available
- Fully **ruleset-configurable** (CE, CD, CEL, CU, CT, AC, CEQ)

❌ **Personal & Hybrid Combat** (includes travellers/animals/robots)
- Uses **standard Foundry VTT initiative** (no phases)
- Existing ship actions continue working normally
- Shows warning when hybrid combat detected

---

## Phase 1: Core Structure (THIS STEP)

### Task 1.1: Create `TwodsixCombat` Class ⏱️ ~30 mins

**File:** `src/module/entities/TwodsixCombat.ts` (NEW)

**What it does:**
- Detects whether combat is pure space, personal, or hybrid
- Manages phase progression (Declaration → Actions → Damage)
- Fetches ruleset-specific phase configuration
- Calculates action budgets from ruleset config
- Localizes phase names

**Quick Steps:**
```bash
# 1. Create file
touch src/module/entities/TwodsixCombat.ts

# 2. Copy the class code from SPACE_COMBAT_PHASES_DESIGN.md, 
#    section "Next Immediate Action → START HERE - STEP 1a"

# 3. Build and test
pnpm run build
```

**Code location:** [SPACE_COMBAT_PHASES_DESIGN.md - lines 970-1080](./SPACE_COMBAT_PHASES_DESIGN.md#next-immediate-action)

---

### Task 1.2: Register Class in Main Module ⏱️ ~5 mins

**File:** `src/twodsix.ts`

**What to add:**
```typescript
import { TwodsixCombat } from "./module/entities/TwodsixCombat";

// Find the initialization section and add:
CONFIG.Combat.documentClass = TwodsixCombat;
```

**Location hint:** Look for other `CONFIG.` assignments in the same file

---

### Task 1.3: Verify File Locations ⏱️ ~5 mins

Confirm these files exist:
- ✅ `src/module/entities/TwodsixCombatant.ts` - Already exists (will extend in next phase)
- ✅ `src/module/config.ts` - Already exists (will add spaceCombat config)
- ✅ `src/twodsix.ts` - Main module init file

---

## Phase 2: Action Budget Tracking (NEXT)

### Task 2.1: Extend `TwodsixCombatant` ⏱️ ~30 mins

**File:** `src/module/entities/TwodsixCombatant.ts`

**Add methods:**
- `resetPhaseCounters()` - Clears action budget at turn start
- `useMinorAction()` - Deducts from budget, returns success/fail
- `useSignificantAction()` - Deducts significant action
- `useReaction()` - Deducts reaction
- `getAvailableReactions()` - Calculates based on initiative

**Code location:** [SPACE_COMBAT_PHASES_DESIGN.md - Option 1 section](./SPACE_COMBAT_PHASES_DESIGN.md#option-1-extend-combatant-with-phase-tracking-recommended)

---

### Task 2.2: Add Phase Config to `config.ts` ⏱️ ~20 mins

**File:** `src/module/config.ts`

**What to add:** For each ruleset (CE, CD, CEL, CU, CT, AC, CEQ):
```typescript
spaceCombat: {
  usePhases: true,              // Does this ruleset use phases?
  phases: ['declaration', 'actions', 'damage'],
  actionBudget: {
    minorActions: 3,
    significantActions: 1
  },
  reactionFormula: (initiative) => {
    // Calculate available reactions based on initiative
    if (initiative <= 4) return 1;
    if (initiative <= 8) return 2;
    if (initiative <= 12) return 3;
    return 4;
  }
}
```

**Note:** CE is confirmed. Others need verification (marked with `?` in design doc).

**Code location:** [SPACE_COMBAT_PHASES_DESIGN.md - Ruleset Generalization section](./SPACE_COMBAT_PHASES_DESIGN.md#ruleset-generalization)

---

## Phase 3: UI Display (AFTER CORE WORKS)

### Task 3.1: Add Phase Indicator to Combat Tracker ⏱️ ~40 mins
### Task 3.2: Add Action Budget Display to Combatant Card ⏱️ ~30 mins
### Task 3.3: Add Phase Control Buttons ⏱️ ~30 mins

---

## Phase 4: Integration (AFTER UI WORKS)

### Task 4.1: Modify `TwodsixShipActions` ⏱️ ~20 mins
### Task 4.2: Update Battle Sheet ⏱️ ~20 mins
### Task 4.3: Add Phase Change Hooks ⏱️ ~15 mins

---

## Phase 5: Polish (AFTER INTEGRATION)

### Task 5.1: Add Localization Strings ⏱️ ~15 mins
### Task 5.2: Add Settings ⏱️ ~15 mins
### Task 5.3: Testing & Edge Cases ⏱️ Variable

---

## Detailed Phase 1 Instructions

### Step 1: Create `TwodsixCombat.ts`

1. **Create the file:**
   ```bash
   touch src/module/entities/TwodsixCombat.ts
   ```

2. **Copy full class code** from [SPACE_COMBAT_PHASES_DESIGN.md - section "Next Immediate Action"](./SPACE_COMBAT_PHASES_DESIGN.md#next-immediate-action)

3. **Key methods in the class:**
   - `getRulesetSpaceCombatConfig()` - Gets phase config for current ruleset
   - `isSpaceCombat()` - Checks if combat is ships-only
   - `isHybridCombat()` - Checks if combat has ships + non-ships
   - `getAvailablePhases()` - Returns phase array for this ruleset
   - `getCurrentPhaseName()` - Returns localized phase name
   - `getActionBudget()` - Returns action limits
   - `nextTurn()` - Overrides Foundry's turn logic to handle phases
   - `startCombat()` - Initializes phase system

### Step 2: Register in `src/twodsix.ts`

1. **Find the initialization section** where other `CONFIG.` assignments happen
   
   Look for lines like:
   ```typescript
   CONFIG.Item.documentClass = TwodsixItem;
   CONFIG.Actor.documentClass = TwodsixActor;
   CONFIG.ActiveEffect.documentClass = TwodsixActiveEffect;
   ```

2. **Add before those:**
   ```typescript
   import { TwodsixCombat } from "./module/entities/TwodsixCombat";
   ```

3. **Add with the other CONFIG assignments:**
   ```typescript
   CONFIG.Combat.documentClass = TwodsixCombat;
   ```

### Step 3: Build and Test

```bash
# Build TypeScript
pnpm run build

# Start Foundry VTT and create a test world
# Create two ships in combat:
#   - Should see phases working
#   - Debug console should show "isSpaceCombat: true"

# Test hybrid combat with ship + traveller:
#   - Should NOT show phases
#   - Should use standard initiative
```

### Step 4: Verify It Works

**Success indicators:**
- ✅ Module loads without errors
- ✅ Combat tracker shows "Declaration Phase" for ship-only combats
- ✅ `getCurrentPhaseName()` returns proper phase names
- ✅ `nextTurn()` advances phases correctly (Declaration → Actions → Damage → next ship)
- ✅ Console logs show `isSpaceCombat: true/false` correctly

**Common issues:**
- "Cannot find module" - Check import path in twodsix.ts
- "CONFIG.Combat not defined" - Foundry version issue, check compatibility
- "getRulesetSpaceCombatConfig is not a function" - Method not on class, check class definition

---

## After Phase 1 is Working

**Next: Go to Task 2.1** - Extend `TwodsixCombatant` with action tracking

This will enable:
- ✅ Tracking minor/significant actions per combatant
- ✅ Reaction counting based on initiative
- ✅ Budget enforcement before ship actions execute
- ✅ Proper reset at turn boundaries

---

## File Structure Reference

```
src/
├── twodsix.ts ..................... Main module init (register class here)
├── module/
│   ├── entities/
│   │   ├── TwodsixCombat.ts ........ NEW (create this)
│   │   └── TwodsixCombatant.ts .... Existing (extend in Phase 2)
│   ├── config.ts .................. Existing (add spaceCombat config)
│   ├── utils/
│   │   └── TwodsixShipActions.ts .. Existing (modify in Phase 4)
│   └── sheets/
│       └── TwodsixBattleSheet.ts .. Existing (update in Phase 4)
└── ...
static/
└── lang/
    └── en.json ..................... Existing (add strings in Phase 5)
```

---

## Key Design Decisions

1. **Phases ONLY for pure space combat** - Hybrid combats use standard initiative
2. **Ruleset-aware configuration** - Each ruleset can have different phases/budgets
3. **Graceful degradation** - If spaceCombat config missing, uses CE defaults
4. **Localization-first** - All phase names use i18n for multi-language support
5. **Backward compatible** - Existing ship actions work without changes initially

---

## Questions Before Starting?

- ✅ Understand the phase system (Declaration → Actions → Damage)?
- ✅ Know the difference between pure/personal/hybrid combat?
- ✅ Have access to build environment (pnpm run build)?
- ✅ Familiar with Foundry VTT combat system basics?

If all yes, **you're ready to start with Task 1.1!**

---

## Progress Tracking

Use the todo list to mark completion:
- [ ] Task 1.1 - Create TwodsixCombat class
- [ ] Task 1.2 - Register in main module
- [ ] Task 1.3 - Verify locations
- [ ] Build and test
- [ ] Task 2.1 - Extend TwodsixCombatant
- [ ] Task 2.2 - Add phase config
- [ ] ... (continue with phases 3-5)

**Current Phase:** 1 (Core Structure)  
**Ready to begin:** YES ✅

---

## Reference Documents

1. **Design Document**: `SPACE_COMBAT_PHASES_DESIGN.md` - Complete 1000+ line design with pseudocode
2. **Existing Code**: 
   - `src/module/entities/TwodsixCombatant.ts` - Base combatant class
   - `src/module/config.ts` - Ruleset configurations
   - `src/module/utils/TwodsixShipActions.ts` - Ship action implementations
3. **Cepheus SRD**: Space combat rules sections for reference

---

## Next Steps

**➜ START HERE: Follow Task 1.1 instructions above**

Create the `TwodsixCombat` class, register it, build, and test. Once working, message back and we'll move to Phase 2!
