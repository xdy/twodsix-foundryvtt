# Ruleset Space Combat Configuration Verification

This document tracks which rulesets have verified space combat mechanics and their configurations.

## Status Summary

**✅ COMPLETE: All 10 official rulesets verified + 1 custom ruleset!**
- ✅ CE, CT, CEQ, CEFTL, CD, CDEE, AC, CEL, CLU, CU (official with space combat)
- ✅ MGT2E (custom/unofficial - for user custom options)
- ❌ CEATOM, Barbaric, SOC (no space combat)

**Phase System Breakdown**:
- **8-phase looping**: CU (unique - loops back to phase 3)
- **5-phase**: CT (unique)
- **3-phase**: CE, MGT2E (CE: Declaration/Actions/Damage, MGT2E: Manoeuvre/Attack/Actions)
- **2-phase (dynamic position)**: CEQ, CEFTL, CD, CDEE, AC, CEL, CLU (7 rulesets)
- **No space combat**: CEATOM, Barbaric, SOC

---

## ✅ VERIFIED RULESETS WITH SPACE COMBAT

#### **Cepheus Engine (CE)** - VERIFIED ✅
- **Reference**: Cepheus Engine SRD  
- **Space Combat Phases**: Declaration → Actions → Damage
- **Action Budget**: 3 minor actions OR 1 significant + 1 minor
- **Reactions**: Based on initiative (1-4)
  - Initiative 0-4: 1 reaction
  - Initiative 5-8: 2 reactions
  - Initiative 9-12: 3 reactions
  - Initiative 13+: 4 reactions
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['declaration', 'actions', 'damage'],
  actionBudget: {
    minorActions: 3,
    significantActions: 1
  },
  reactionFormula: (initiative) => {
    if (initiative <= 4) return 1;
    if (initiative <= 8) return 2;
    if (initiative <= 12) return 3;
    return 4;
  }
}
```

---

## ❌ RULESETS WITHOUT SPACE COMBAT

These rulesets do not include space combat mechanics and should NOT have spaceCombat configs added.

#### **Classic Traveller (CT)** - VERIFIED ✅
- **Reference**: User provided
- **Space Combat Type**: 5-phase sequential weapon system
- **Space Combat Phases**: Movement → Laser Fire → Enemy Return Laser Fire → Ordnance Launch → Computer Reprogramming
- **Action Budget**: 1 action per appropriate phase
- **Reactions**: None
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['movement', 'laserFire', 'enemyLaserFire', 'ordnanceLaunch', 'computerReprogramming'],
  actionBudget: {
    minorActions: 0,
    significantActions: 1  // One action per phase
  },
  reactionFormula: () => 0
}
```

**Detailed Mechanics**:
- **Phase 1 - Movement**: Ships maneuver
- **Phase 2 - Laser Fire**: Player side fires lasers
- **Phase 3 - Enemy Return Laser Fire**: Opposing side fires lasers
- **Phase 4 - Ordnance Launch**: Missiles, torpedoes, etc.
- **Phase 5 - Computer Reprogramming**: Computer system updates

**Key Differences from Other Systems**:
- Most detailed phase system (5 phases)
- Separates friendly and enemy laser fire into distinct phases
- Specific phase for ordnance (missiles/torpedoes)
- Includes computer operations as a distinct phase
- More granular than CE's 3-phase system
- Static phases (no dynamic position rolls like CEFTL/CD/CDEE)

#### **Cepheus Light (CEL)**  
- Status: ❓ NEEDS VERIFICATION
- Question: Does CEL simplify space combat? Different phases?
- Reference Needed: Cepheus Light rulebook
- Implementation: ⏳ Pending verification

#### **Cepheus Faster Than Light (CEFTL)** - VERIFIED ✅
- **Reference**: Cepheus_Faster_Than_Light!.pdf (User provided)
- **Space Combat Type**: 2-phase position/action system
- **Space Combat Phases**: Position → Action
- **Action Budget**: 1 action per turn (no minor/significant distinction)
- **Reactions**: None
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['position', 'action'],
  actionBudget: {
    minorActions: 0,
    significantActions: 1  // One action per turn
  },
  reactionFormula: () => 0
}
```

**Detailed Mechanics**:
- **Position Phase**: Ships determine position EVERY TURN (not just once at start of combat)
  - This replaces the traditional initiative roll that happens once
  - Position is re-rolled each turn, making it dynamic
- **Action Phase**: Each player may make one of several actions (more variety than CEQ's attack-only)

**Key Differences from Other Systems**:
- Similar 2-phase structure to CEQ (position then action)
- More action variety than CEQ (multiple action options vs just attack)
- Simpler than CE's 3-phase system
- No minor/significant action distinction
- No reaction system
- **Position is dynamic**: Rolled every turn, not once like traditional initiative

#### **Alpha Cephei (AC)**
- Status: ❓ NEEDS VERIFICATION
- Note: User confirms this ruleset DOES have space combat
- Question: Does it use phases like CE? Different mechanics?
- Reference Needed: Alpha Cephei rulebook
- Implementation: ⏳ Pending verification

#### **Cepheus Atom (CEATOM)**
- Status: ❌ NO SPACE COMBAT
- Note: This ruleset does NOT have space combat mechanics
- Implementation: Do NOT add spaceCombat config
- References: Confirmed by user

#### **Barbaric!**
- Status: ❌ NO SPACE COMBAT
- Note: This ruleset does NOT have space combat mechanics (fantasy/sword & sorcery setting)
- Implementation: Do NOT add spaceCombat config
- References: Confirmed by user

#### **The Sword of Cepheus (SOC)**
- Status: ❌ NO SPACE COMBAT
- Note: This ruleset does NOT have space combat mechanics (fantasy setting)
- Implementation: Do NOT add spaceCombat config
- References: Confirmed by user

#### **Cepheus Quantum (CEQ)** - VERIFIED ✅
- **Reference**: Cepheus Quantum rulebook (User provided complete rules)
- **Space Combat Type**: 2-phase dynamic position system (same as CEFTL/CD/CDEE/AC/CEL/CLU)
- **Space Combat Phases**: Position → Action
- **Action Budget**: 1 action per turn (no minor/significant distinction)
- **Reactions**: None
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['position', 'action'],
  actionBudget: {
    minorActions: 0,
    significantActions: 1  // One action per turn
  },
  reactionFormula: () => 0
}
```

**Detailed Mechanics**:
- **Position Phase**: Each side's pilot rolls 1d6 + Technical skill + ship Agility EVERY TURN (dynamic)
  - Higher roll wins Position (Pursuer wins ties)
  - Ship types:
    - Fighter: Agility +2, Unarmored, 1× Pulse Laser (Light)
    - Corsair: Agility +1, Armored, 2× Missiles (Heavy, 2 rolls per hit)
    - Frigate: Agility +0, Armored, 2× Particle Beams (Heavy)
    - Merchant/Scout: Agility -1, Unarmored, 2× Pulse Lasers (Light)

- **Action Phase**:
  - Ship with Position: Acts normally (Combat 8+, one gunner per weapon)
  - Ship without Position: Acts at -4 penalty
  - Actions include attacks, maneuvers, etc.
  - Chase scenario ends when one side disabled OR 5 turns pass without destruction

**Note**: CEQ, CEFTL, CD, CDEE, AC, CEL, and CLU all use the same 2-phase position/action system with dynamic position rolls every turn.

#### **Cepheus Deluxe (CD)** - VERIFIED ✅
- **Reference**: User confirmed - same as CEFTL/CDEE
- **Space Combat Type**: 2-phase position/action system (identical to CEFTL/CDEE)
- **Space Combat Phases**: Position → Action
- **Action Budget**: 1 action per turn (no minor/significant distinction)
- **Reactions**: None
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['position', 'action'],
  actionBudget: {
    minorActions: 0,
    significantActions: 1  // One action per turn
  },
  reactionFormula: () => 0
}
```

**Detailed Mechanics**:
- **Position Phase**: Ships determine position EVERY TURN (dynamic, not static like traditional initiative)
- **Action Phase**: Each player may make one of several actions

**Note**: CD, CDEE, and CEFTL all use the same space combat system - 2-phase position/action with one action per turn and dynamic position rolls.

#### **Cepheus Deluxe Enhanced Edition (CDEE)** - VERIFIED ✅
- **Reference**: User confirmed - same as CEFTL
- **Space Combat Type**: 2-phase position/action system (identical to CEFTL)
- **Space Combat Phases**: Position → Action
- **Action Budget**: 1 action per turn (no minor/significant distinction)
- **Reactions**: None
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['position', 'action'],
  actionBudget: {
    minorActions: 0,
    significantActions: 1  // One action per turn
  },
  reactionFormula: () => 0
}
```

**Note**: CDEE uses the exact same space combat system as CEFTL and CD - 2-phase position/action with one action per turn and dynamic position rolls every turn.

#### **Cepheus Light Upgraded (CLU)**
- Status: ❓ NEEDS VERIFICATION
- Question: Is this based on CEL? Same rules?
- Reference Needed: CLU documentation
- Implementation: ⏳ Pending verification

#### **Cepheus Universal (CU)** - VERIFIED ✅
- **Reference**: User provided - 8-phase system with loop-back
- **Space Combat Type**: 8-phase sequential system (unique - returns to phase 3 after phase 8)
- **Space Combat Phases**: Detection → Range → Tactical → Advantage → Attack → Screen → Damage → Damage Control → (loop back to Tactical)
- **Action Budget**: 1 action per appropriate phase
- **Reactions**: None
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['detection', 'range', 'tactical', 'advantage', 'attack', 'screen', 'damage', 'damageControl'],
  loopBackPhase: 'tactical',  // After phase 8, return to phase 3
  actionBudget: {
    minorActions: 0,
    significantActions: 1
  },
  reactionFormula: () => 0
}
```

**Detailed Mechanics**:
1. **Detection Phase** - Both combatants roll to detect each other (FIRST TIME ONLY)
2. **Range Phase** - Determine starting range (FIRST TIME ONLY)
3. **Tactical Phase** - Decide to stay/flee, commit weapons (REPEATS HERE)
4. **Advantage Phase** - Roll for advantage, winner changes range by one band and attacks first
5. **Attack Phase** - Combatant with advantage attacks first, then other side
6. **Screen Phase** - Successful attacks countered with Screens roll
7. **Damage Phase** - Armor absorption then ship damage assessment
8. **Damage Control Phase** - Attempt to temporarily repair disabled components

**Note**: CU is the most complex phase system - 8 phases on first iteration, then loops back to phase 3 (Tactical) for subsequent rounds, skipping Detection and Range determination.

#### **Mongoose Traveller 2nd Edition (MGT2E)** - VERIFIED ✅
- **Reference**: User provided - MGT2E Core Rulebook spacecraft combat rules
- **Space Combat Type**: 3-phase system (custom/unofficial ruleset for user options)
- **Space Combat Phases**: Manoeuvre → Attack → Actions
- **Action Budget**: 1 action per phase
- **Reactions**: Evasive action uses Thrust (not tracked as reactions)
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['manoeuvre', 'attack', 'actions'],
  actionBudget: {
    minorActions: 0,
    significantActions: 1  // One action per phase
  },
  reactionFormula: () => 0  // Evasive action uses Thrust
}
```

**Detailed Mechanics**:
1. **Manoeuvre Step**: In Initiative order, each ship:
   - Allocates Thrust to movement (closing/opening range bands)
   - OR allocates Thrust to combat manoeuvring (Aid Gunners, Evasive Action)
   - Pilot makes Pilot check for manoeuvres
   
2. **Attack Step**: In Initiative order, each ship:
   - Gunners fire weapons using Gunner skill
   - Pilot can fire single turret at DM-2
   - Range modifiers: Short +1, Long -2, Very Long -4, Distant -6
   - Target size bonus: +1 per 1,000 tons (max +6)
   
3. **Actions Step**: In Initiative order, ships can:
   - Repair damaged systems
   - Jump out of system
   - Launch craft
   - Other miscellaneous actions

**Initiative**: 2D + Pilot skill + ship's Thrust score
- Commander may make Tactics (naval) check, Effect added to Initiative

**Range Bands**: Adjacent, Close, Short, Medium, Long, Very Long, Distant
- Combat rounds are 6 minutes (not 6 seconds like personal combat)

**Note**: MGT2E is a custom/unofficial ruleset added for user customization options. It uses a similar 3-phase structure to CE but with different phase names and mechanics focused on spacecraft manoeuvring and naval tactics.

---

## ❓ PENDING VERIFICATION

These rulesets need user-provided references to verify their space combat mechanics.

#### **Cepheus Light (CEL)** - VERIFIED ✅
- **Reference**: User confirmed - same as CEFTL/CD/CDEE/AC
- **Space Combat Type**: 2-phase position/action system (identical to CEFTL/CD/CDEE/AC)
- **Space Combat Phases**: Position → Action
- **Action Budget**: 1 action per turn (no minor/significant distinction)
- **Reactions**: None
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['position', 'action'],
  actionBudget: {
    minorActions: 0,
    significantActions: 1  // One action per turn
  },
  reactionFormula: () => 0
}
```

**Detailed Mechanics**:
- **Position Phase**: Ships determine position EVERY TURN (dynamic, not static like traditional initiative)
- **Action Phase**: Each player may make one of several actions

**Note**: CEL, AC, CD, CDEE, and CEFTL all use the same space combat system - 2-phase position/action with one action per turn and dynamic position rolls.

#### **Alpha Cephei (AC)** - VERIFIED ✅
- **Reference**: User confirmed - same as CEFTL/CD/CDEE
- **Space Combat Type**: 2-phase position/action system (identical to CEFTL/CD/CDEE)
- **Space Combat Phases**: Position → Action
- **Action Budget**: 1 action per turn (no minor/significant distinction)
- **Reactions**: None
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['position', 'action'],
  actionBudget: {
    minorActions: 0,
    significantActions: 1  // One action per turn
  },
  reactionFormula: () => 0
}
```

**Detailed Mechanics**:
- **Position Phase**: Ships determine position EVERY TURN (dynamic, not static like traditional initiative)
- **Action Phase**: Each player may make one of several actions

**Note**: AC, CD, CDEE, and CEFTL all use the same space combat system - 2-phase position/action with one action per turn and dynamic position rolls.

#### **Cepheus Light Upgraded (CLU)** - VERIFIED ✅
- **Reference**: User confirmed - same as CEFTL/CD/CDEE/AC/CEL
- **Space Combat Type**: 2-phase position/action system (identical to CEFTL/CD/CDEE/AC/CEL)
- **Space Combat Phases**: Position → Action
- **Action Budget**: 1 action per turn (no minor/significant distinction)
- **Reactions**: None
- **Implementation**: ✅ Already added to config.ts
- **Config**:
```typescript
spaceCombat: {
  usePhases: true,
  phases: ['position', 'action'],
  actionBudget: {
    minorActions: 0,
    significantActions: 1  // One action per turn
  },
  reactionFormula: () => 0
}
```

**Detailed Mechanics**:
- **Position Phase**: Ships determine position EVERY TURN (dynamic, not static like traditional initiative)
- **Action Phase**: Each player may make one of several actions

**Note**: CLU, CEL, AC, CD, CDEE, and CEFTL all use the same space combat system - 2-phase position/action with one action per turn and dynamic position rolls.

---

## Verification Process

For each unverified ruleset:

1. **Identify** the ruleset's space combat mechanics from official source
2. **Determine** if it uses phases (and if so, what they are)
3. **Document** the action budgets and reaction formulas
4. **Provide** the reference (book page, SRD link, etc.)
5. **Implement** in config.ts with proper documentation

---

## Resume Instructions

**To continue this work (on any computer):**

1. Open this file: `RULESET_SPACECOMBAT_VERIFICATION.md`
2. Check the "PENDING VERIFICATION" section
3. For each pending ruleset, provide:
   - Does it have space combat? (Yes/No)
   - If Yes: What are the phases? (or is it same as another ruleset?)
   - Reference source (rulebook name/page)
4. Agent will:
   - Add spaceCombat config to `src/module/config.ts`
   - Update this verification document
   - Run build to verify
   - Move to next ruleset

**Current State:**
- 6 rulesets configured with space combat (CE, CT, CEQ, CEFTL, CD, CDEE)
- 3 rulesets confirmed without space combat (CEATOM, Barbaric, SOC)
- 4 rulesets pending (CEL, AC, CLU, CU)
- All builds passing ✅
- No errors in implementation

**Files Modified:**
- `src/module/config.ts` - Added spaceCombat configs
- `src/module/entities/TwodsixCombat.ts` - Created (phase management)
- `src/module/entities/TwodsixCombatant.ts` - Extended (action tracking)
- `src/twodsix.ts` - Registered TwodsixCombat class
- `RULESET_SPACECOMBAT_VERIFICATION.md` - This tracking document

---

## Notes

- Systems with NO space combat (like AC): Set `usePhases: false`
- Systems with SPECIAL space combat (like CEQ chase): Document separately
- Fallback behavior when not configured: Uses CE defaults
