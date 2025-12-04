# Space Combat Phase System - Implementation Progress

## Project Overview

Implementing phase-based space combat for Twodsix Foundry VTT system to support multiple Traveller/Cepheus rulesets with different combat mechanics.

**Key Concept**: Phases ONLY apply to pure space combat (ships/space-objects only). Personal combat and hybrid combats use standard initiative.

---

## Current Status: Phase 2 Complete ✅

### ✅ Completed Phases

#### Phase 1: Core Structure (COMPLETE)
- ✅ Created `TwodsixCombat` class
  - Phase detection (pure space vs personal vs hybrid)
  - Ruleset config lookup
  - Phase advancement logic
  - File: `src/module/entities/TwodsixCombat.ts` (169 lines)
  
- ✅ Registered TwodsixCombat
  - Modified `src/twodsix.ts` to use custom Combat class
  - `CONFIG.Combat.documentClass = TwodsixCombat`

#### Phase 2: Action Budget Tracking (COMPLETE)
- ✅ Extended `TwodsixCombatant` class
  - Action budget tracking (minor, significant, reactions)
  - 9 new methods for action management
  - File: `src/module/entities/TwodsixCombatant.ts` (217 lines)
  
- ✅ Ruleset Configurations (6 of 10 verified)
  - Added spaceCombat configs to `src/module/config.ts`
  - Each config defines phases, action budgets, reaction formulas
  
- ✅ Verification Tracking
  - Created `RULESET_SPACECOMBAT_VERIFICATION.md`
  - Documents all ruleset mechanics and configurations

---

## Ruleset Configuration Status

### ✅ Configured (6 rulesets)

1. **Cepheus Engine (CE)**
   - 3 phases: Declaration → Actions → Damage
   - Action Budget: 3 minor OR 1 significant + 1 minor
   - Reactions: 1-4 based on initiative

2. **Classic Traveller (CT)**
   - 5 phases: Movement → Laser Fire → Enemy Laser Fire → Ordnance → Computer
   - Action Budget: 1 per phase
   - Reactions: None

3. **Cepheus Quantum (CEQ)**
   - 2 phases: Position → Attack (chase system)
   - Action Budget: 1 attack per weapon
   - Reactions: None
   - Special: Position determines attack penalty

4. **Cepheus Faster Than Light (CEFTL)**
   - 2 phases: Position → Action
   - Action Budget: 1 action per turn
   - Reactions: None
   - Special: Position rolled every turn (dynamic)

5. **Cepheus Deluxe (CD)**
   - Same as CEFTL (2-phase position/action, dynamic)

6. **Cepheus Deluxe Enhanced Edition (CDEE)**
   - Same as CEFTL (2-phase position/action, dynamic)

### ❌ No Space Combat (3 rulesets)

- **Cepheus Atom (CEATOM)** - Post-apocalyptic setting
- **Barbaric!** - Fantasy/sword & sorcery
- **The Sword of Cepheus (SOC)** - Fantasy

### ❓ Pending Verification (4 rulesets)

- **Cepheus Light (CEL)** - Needs reference
- **Alpha Cephei (AC)** - Has space combat, needs mechanics
- **Cepheus Light Upgraded (CLU)** - Needs reference
- **Cepheus Universal (CU)** - Needs reference

---

## Technical Implementation

### Key Files Created/Modified

**New Files:**
- `src/module/entities/TwodsixCombat.ts` (169 lines)
- `RULESET_SPACECOMBAT_VERIFICATION.md` (verification tracking)
- `SPACE_COMBAT_PHASES_DESIGN.md` (design document)
- `SPACE_COMBAT_IMPLEMENTATION_START.md` (quick start)

**Modified Files:**
- `src/module/config.ts` - Added spaceCombat configs
- `src/module/entities/TwodsixCombatant.ts` - Extended with 9 methods
- `src/twodsix.ts` - Registered custom Combat class

### Architecture

```typescript
// Combat Type Detection
TwodsixCombat.isSpaceCombat() // true if ALL combatants are ships/space-objects
TwodsixCombat.isHybridCombat() // true if mixed ship + personal

// Phase Management
combat.getAvailablePhases() // Returns ruleset's phase array
combat.getCurrentPhaseName() // Returns localized phase name
combat.nextTurn() // Advances to next phase or next round

// Action Budget
combatant.useMinorAction() // Deduct minor action, returns success
combatant.useSignificantAction() // Deduct significant action
combatant.useReaction() // Deduct reaction
combatant.getAvailableReactions() // Calculate based on initiative

// Data Structure (stored in combatant flags)
{
  spacePhase: 'declaration' | 'actions' | 'damage' | 'position' | 'attack' | ...,
  minorActionsUsed: number,
  significantActionsUsed: number,
  reactionsUsed: number,
  reactionsAvailable: number,
  hasty: boolean
}
```

### Build Status

All builds passing ✅
```
✅ JavaScript build: Success (1 files)
✅ Styles build: Success (7 files)
✅ Static files copied: Success (5 folders/files)
✅ Packs built/copied: Success (28 packs)
```

---

## Remaining Work

### Phase 3: UI Display (NOT STARTED)
- [ ] Add phase indicator to combat tracker
- [ ] Display action budgets on combatant cards
- [ ] Show current phase name and progress
- [ ] Hybrid combat warning display

### Phase 4: Integration (NOT STARTED)
- [ ] Modify `TwodsixShipActions.ts` to check action budgets
- [ ] Update Battle Sheet with phase info
- [ ] Add phase progression buttons for GMs

### Phase 5: Localization & Settings (NOT STARTED)
- [ ] Add localization strings to `static/lang/en.json`
- [ ] Add settings for phase management
- [ ] Create phase change hooks

### Phase 6: Testing (NOT STARTED)
- [ ] Test pure space combat (phases work)
- [ ] Test personal combat (no phases)
- [ ] Test hybrid combat (no phases, warning shown)
- [ ] Test action budget enforcement
- [ ] Test across different rulesets

---

## How to Resume This Work

### On Same Computer
1. Open project: `/Users/Mark/Documents/GitHub/twodsix-foundryvtt`
2. Check `RULESET_SPACECOMBAT_VERIFICATION.md` for pending rulesets
3. Continue verification or move to Phase 3 (UI Display)

### On Different Computer
1. Clone repository
2. Read this file (`SPACE_COMBAT_PROGRESS.md`) for overview
3. Read `RULESET_SPACECOMBAT_VERIFICATION.md` for verification status
4. Read `SPACE_COMBAT_PHASES_DESIGN.md` for design details
5. Continue from "Remaining Work" section above

### To Continue Ruleset Verification
See `RULESET_SPACECOMBAT_VERIFICATION.md` → "Resume Instructions" section

For each pending ruleset (CEL, AC, CLU, CU):
1. Determine if it has space combat
2. If yes, identify phase structure
3. Provide reference (rulebook/SRD)
4. Agent will add config and verify build

### To Start UI Work (Phase 3)
1. See `SPACE_COMBAT_PHASES_DESIGN.md` for UI specifications
2. Start with combat tracker phase indicator
3. Then add action budget displays
4. All UI should only show for pure space combat

---

## Design Decisions & Important Notes

### Combat Type Rules
- **Pure Space** (only ships/space-objects) → USE PHASES ✅
- **Personal** (only travellers/animals/robots) → NO PHASES ❌
- **Hybrid** (mixed) → NO PHASES ❌ (show warning to GM)

### Phase System Variations
Different rulesets use different phase counts:
- **5 phases**: CT (most detailed)
- **3 phases**: CE (declaration/actions/damage)
- **2 phases**: CEQ, CEFTL, CD, CDEE (position/action or position/attack)

### Position vs Initiative
- **Traditional Initiative** (CE): Rolled once, determines turn order
- **Position Phase** (CEFTL/CD/CDEE): Rolled every turn, dynamic advantage

### Configuration-Driven
All phase mechanics defined in `TWODSIX.RULESETS.{ruleset}.spaceCombat`:
- `usePhases`: boolean
- `phases`: string array
- `actionBudget`: { minorActions, significantActions }
- `reactionFormula`: (initiative) => number

### Graceful Fallback
If ruleset has no spaceCombat config, system falls back to CE defaults.

---

## Questions or Issues?

See these files for details:
- `RULESET_SPACECOMBAT_VERIFICATION.md` - Verification status
- `SPACE_COMBAT_PHASES_DESIGN.md` - Full design (1000+ lines)
- `SPACE_COMBAT_IMPLEMENTATION_START.md` - Quick start guide
- `src/module/entities/TwodsixCombat.ts` - Combat implementation
- `src/module/entities/TwodsixCombatant.ts` - Action tracking

**Last Updated**: December 4, 2025
**Status**: Phase 2 Complete, Ready for Phase 3 (UI) or Ruleset Verification Continuation
