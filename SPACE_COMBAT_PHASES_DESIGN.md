# Space Combat Phases Implementation Guide

## ⚠️ CRITICAL DESIGN DECISION

**Phases are ONLY for pure space combat (ships and/or space-objects only).**

If the combat includes ANY non-space actors (Traveller, Animal, Robot), phases are **DISABLED** and combat uses standard Foundry VTT initiative rules.

```
Pure Space Combat (Ships and/or Space-Objects) → USE PHASES ✅
├─ Ship A (Declaration → Actions → Damage)
├─ Ship B (Declaration → Actions → Damage)
└─ Space-Object A (Declaration → Actions → Damage)

Personal/Hybrid Combat                         → NO PHASES ❌
├─ Traveller (Standard Initiative)
├─ Animal (Standard Initiative)
├─ Robot (Standard Initiative)
└─ Ship (Standard Initiative, crew actions at once)
```

This aligns with Cepheus SRD, which defines **two separate combat systems**:
- **Personal Combat** for individuals and creatures (Traveller, Animal, Robot)
- **Space Combat** for ships and space-objects only

---

## Current System Understanding

The Cepheus Engine SRD defines **two distinct combat systems**:

### Personal Combat (Traveller, Animal, Robot)
- Uses **rounds** (~6 seconds)
- Standard Foundry VTT initiative system
- **NO PHASES** - all combatants act in initiative order each round
- Individual actions, no "crew position" mechanics

### Space Combat (Ships and Space-Objects)
**Space combat turns** (1 kilosecond) with the following structure:

1. **Captain's Declaration** - Captain may declare crew acting hastily
2. **Crew Actions** - All crew members resolve their actions (minor/significant)
3. **Damage Resolution** - Damage is resolved if weapons hit

Within a turn, each crew member can perform:
- **3 Minor Actions** (or 1 Significant + 1 Minor)
- **1 Significant Action** 
- **Reactions** (triggered by incoming attacks, 1-4 depending on Initiative)

### Critical Design Requirement
**Phases ONLY apply to pure space combats** (ships and/or space-objects). If any non-space actors are in combat (Traveller, Animal, Robot), use normal initiative-based combat with NO phases.

---

## Implementation Strategy for Foundry VTT

### Option 1: Extend Combatant with Phase Tracking (RECOMMENDED)

**Extend `TwodsixCombatant` to track phases:**

```typescript
// src/module/entities/TwodsixCombatant.ts

export default class TwodsixCombatant extends Combatant {
  /**
   * Space combat phase tracking for ship combats
   * @type {Object}
   */
  declare data: Combatant.Data & {
    flags: {
      twodsix: {
        spacePhase?: 'declaration' | 'actions' | 'damage';
        minorActionsUsed?: number;
        significantActionsUsed?: number;
        reactionsUsed?: number;
        reactionsAvailable?: number;
        hasty?: boolean;
      }
    }
  };

  protected _getInitiativeFormula(): string {
    if ((<TwodsixActor>this.actor).type === "ship") {
      return <string>game.settings.get("twodsix", "shipInitiativeFormula");
    } else {
      return <string>game.settings.get("twodsix", "initiativeFormula");
    }
  }

  /**
   * Calculate available reactions based on space actor initiative
   */
  getAvailableReactions(): number {
    if (!['ship', 'space-object'].includes(this.actor?.type)) return 0;
    const initiative = this.initiative ?? 0;
    if (initiative <= 4) return 1;
    if (initiative <= 8) return 2;
    if (initiative <= 12) return 3;
    return 4;
  }

  /**
   * Reset phase counters at start of turn
   */
  resetPhaseCounters(): void {
    const spaceFlags = this.flags.twodsix?.spacePhase ?? {};
    this.flags.twodsix = {
      ...this.flags.twodsix,
      spacePhase: 'declaration',
      minorActionsUsed: 0,
      significantActionsUsed: 0,
      reactionsUsed: 0,
      reactionsAvailable: this.getAvailableReactions(),
      hasty: false
    };
  }

  /**
   * Advance to next phase
   */
  async advancePhase(): Promise<void> {
    const currentPhase = this.flags.twodsix?.spacePhase ?? 'declaration';
    const phases = ['declaration', 'actions', 'damage'];
    const nextPhase = phases[(phases.indexOf(currentPhase) + 1) % phases.length];
    
    await this.update({
      'flags.twodsix.spacePhase': nextPhase
    });
  }

  /**
   * Use a minor action
   */
  async useMinorAction(): Promise<boolean> {
    const used = this.flags.twodsix?.minorActionsUsed ?? 0;
    const maxAllowed = (this.flags.twodsix?.significantActionsUsed ?? 0) > 0 ? 1 : 3;
    
    if (used < maxAllowed) {
      await this.update({
        'flags.twodsix.minorActionsUsed': used + 1
      });
      return true;
    }
    return false;
  }

  /**
   * Use a significant action
   */
  async useSignificantAction(): Promise<boolean> {
    const used = this.flags.twodsix?.significantActionsUsed ?? 0;
    const minorUsed = this.flags.twodsix?.minorActionsUsed ?? 0;
    
    if (used === 0 && minorUsed === 0) {
      await this.update({
        'flags.twodsix.significantActionsUsed': 1
      });
      return true;
    }
    return false;
  }

  /**
   * Use a reaction
   */
  async useReaction(): Promise<boolean> {
    const used = this.flags.twodsix?.reactionsUsed ?? 0;
    const available = this.flags.twodsix?.reactionsAvailable ?? 0;
    
    if (used < available) {
      await this.update({
        'flags.twodsix.reactionsUsed': used + 1
      });
      return true;
    }
    return false;
  }
}
```

### Option 2: Custom Combat Class

**Create a `TwodsixCombat` class extending `Combat`:**

```typescript
// src/module/entities/TwodsixCombat.ts

export class TwodsixCombat extends Combat {
  declare data: Combat.Data & {
    flags: {
      twodsix: {
        spacePhase?: 'declaration' | 'actions' | 'damage';
        isSpaceCombat?: boolean;
        isHybridCombat?: boolean; // Ships + non-ships
      }
    }
  };

  /**
   * Determine if this is ONLY space combat (all ships and/or space-objects)
   */
  isSpaceCombat(): boolean {
    const hasSpaceActors = this.combatants.some(c => ['ship', 'space-object'].includes(c.actor?.type));
    const hasNonSpaceActors = this.combatants.some(c => ['traveller', 'animal', 'robot'].includes(c.actor?.type));
    
    // ONLY space combat if ALL combatants are ships or space-objects
    return hasSpaceActors && !hasNonSpaceActors;
  }

  /**
   * Determine if this is hybrid combat (space actors + non-space actors)
   * In hybrid combat, use standard initiative (NO phases)
   */
  isHybridCombat(): boolean {
    const hasSpaceActors = this.combatants.some(c => ['ship', 'space-object'].includes(c.actor?.type));
    const hasNonSpaceActors = this.combatants.some(c => ['traveller', 'animal', 'robot'].includes(c.actor?.type));
    
    return hasSpaceActors && hasNonSpaceActors;
  }

  /**
   * Override nextTurn to handle phases in PURE space combat only
   */
  async nextTurn(): Promise<void> {
    // If not pure space combat, use standard Foundry combat
    if (!this.isSpaceCombat()) {
      return super.nextTurn();
    }

    const currentPhase = this.flags.twodsix?.spacePhase ?? 'declaration';
    
    if (currentPhase === 'damage') {
      // Complete turn - move to next combatant's declaration phase
      await super.nextTurn();
      
      // Reset all combatants' phase counters
      for (const combatant of this.combatants) {
        await combatant.resetPhaseCounters();
      }
      
      await this.update({ 'flags.twodsix.spacePhase': 'declaration' });
    } else {
      // Advance phase for current combatant
      const phases = ['declaration', 'actions', 'damage'];
      const nextPhase = phases[(phases.indexOf(currentPhase) + 1) % phases.length];
      await this.update({ 'flags.twodsix.spacePhase': nextPhase });
    }
  }

  /**
   * Get current phase display name
   */
  getCurrentPhaseName(): string {
    // Return empty string if not pure space combat
    if (!this.isSpaceCombat()) {
      return '';
    }
    
    const phase = this.flags.twodsix?.spacePhase ?? 'declaration';
    return {
      declaration: game.i18n.localize('TWODSIX.Combat.Phase.Declaration'),
      actions: game.i18n.localize('TWODSIX.Combat.Phase.Actions'),
      damage: game.i18n.localize('TWODSIX.Combat.Phase.Damage')
    }[phase] || phase;
  }
}
```

### Option 3: Hybrid Approach (BEST FOR UX)

Combine both:
- **TwodsixCombat**: Manages overall phase state
- **TwodsixCombatant**: Tracks individual action budgets

---

## Combat Type Detection

The system must **automatically detect** which combat type is running and apply the appropriate rules:

### Combat Type Classification

| Scenario | Combat Type | Phases? | Rules |
|----------|-------------|---------|-------|
| Only Ships | **Pure Space Combat** | ✅ YES | Use phases (Declaration → Actions → Damage) |
| Only Space-Objects | **Pure Space Combat** | ✅ YES | Use phases (Declaration → Actions → Damage) |
| Ships + Space-Objects | **Pure Space Combat** | ✅ YES | Use phases (Declaration → Actions → Damage) |
| Ships + Travellers | **Hybrid Combat** | ❌ NO | Use standard initiative (no phases) |
| Space-Objects + Travellers | **Hybrid Combat** | ❌ NO | Use standard initiative (no phases) |
| Ships + Animals | **Hybrid Combat** | ❌ NO | Use standard initiative (no phases) |
| Ships + Robots | **Hybrid Combat** | ❌ NO | Use standard initiative (no phases) |
| Only Travellers | **Personal Combat** | ❌ NO | Use standard initiative (no phases) |
| Only Animals | **Personal Combat** | ❌ NO | Use standard initiative (no phases) |
| Only Robots | **Personal Combat** | ❌ NO | Use standard initiative (no phases) |

### Implementation Logic

```typescript
// Pseudocode for combat type detection
function determineCombatType(combatants: Combatant[]): 'space' | 'personal' | 'hybrid' {
  const hasSpaceActors = combatants.some(c => ['ship', 'space-object'].includes(c.actor?.type));
  const hasPersonalActors = combatants.some(c => ['traveller', 'animal', 'robot'].includes(c.actor?.type));
  
  if (hasSpaceActors && !hasPersonalActors) return 'space';      // Pure space combat
  if (!hasSpaceActors && hasPersonalActors) return 'personal';    // Pure personal combat
  if (hasSpaceActors && hasPersonalActors) return 'hybrid';       // Mixed combat
}

function canUsePhases(combatType: string): boolean {
  return combatType === 'space';  // ONLY pure space combat uses phases
}
```

### GM Warning for Hybrid Combat

When hybrid combat is detected, show a warning:
```
⚠️ WARNING: This encounter contains both ships and non-ships.
Using standard initiative rules (no phases).
Ship crew members can still perform ship actions, but all combatants act on initiative.
```

---

## Integration with Current Code

### TwodsixCombatant Changes

The `resetPhaseCounters()` method should **only apply to ships**:

```typescript
async resetPhaseCounters(): Promise<void> {
  // Only apply to space actors (ships and space-objects) in pure space combat
  if (!['ship', 'space-object'].includes(this.actor?.type) || !this.combat?.isSpaceCombat()) {
    return;
  }
  
  const spaceFlags = this.flags.twodsix?.spacePhase ?? {};
  this.flags.twodsix = {
    ...this.flags.twodsix,
    spacePhase: 'declaration',
    minorActionsUsed: 0,
    significantActionsUsed: 0,
    reactionsUsed: 0,
    reactionsAvailable: this.getAvailableReactions(),
    hasty: false
  };
}
```

### TwodsixShipActions Check

```typescript
public static async fireEnergyWeapons(text: string, extra: ExtraData) {
  const combat = game.combat;
  
  // If this is pure space combat, check phases
  if (combat?.isSpaceCombat?.()) {
    if (!await extra.actor.combatant?.useSignificantAction()) {
      ui.notifications.warn("TWODSIX.Combat.NoSignificantActions", {localize: true});
      return;
    }
  }
  // If hybrid or personal combat, allow action (standard initiative applies)
  
  // ... rest of action
}
```

### UI Conditional Display

```handlebars
{{#if combat.isSpaceCombat}}
  {{!-- Show phase UI --}}
  <div class="space-combat-phase-indicator">
    <span class="phase-label">{{combat.getCurrentPhaseName}}</span>
    {{!-- phase bar, etc --}}
  </div>
{{else if combat.isHybridCombat}}
  {{!-- Show warning --}}
  <div class="hybrid-combat-warning">
    ⚠️ Mixed combat (Ships + Non-ships) - using standard initiative
  </div>
{{/if}}
```

---

## Updated Data Structure

### 1. Combat Tracker Enhancement

**Add to Combat Tracker display:**
```handlebars
{{#if isSpaceCombat}}
  <div class="space-combat-phase-indicator">
    <span class="phase-label">{{currentPhaseName}}</span>
    <div class="phase-bar">
      <div class="phase {{#if isDeclaration}}active{{/if}}">Declaration</div>
      <div class="phase {{#if isActions}}active{{/if}}">Actions</div>
      <div class="phase {{#if isDamage}}active{{/if}}">Damage</div>
    </div>
  </div>
{{/if}}
```

### 2. Combatant Action Tracker

**Display action budget in token/combatant UI:**
```
Combatant: Captain Smith (Ship)
├─ Minor Actions: [0/3]
├─ Significant Actions: [0/1]
├─ Reactions: [0/3]
└─ Hasty: [ ]
```

### 3. Phase Control Buttons

**Combat tracker buttons:**
- "Declare Hasty" (Captain only, during Declaration phase)
- "Execute Action" (during Actions phase)
- "Reaction" (reactive, any phase when triggered)
- "Advance Phase" (GM only)

---

## Data Structure

### Combatant Flags
```json
{
  "flags": {
    "twodsix": {
      "spacePhase": "declaration|actions|damage",
      "minorActionsUsed": 0,
      "significantActionsUsed": 0,
      "reactionsUsed": 0,
      "reactionsAvailable": 3,
      "hasty": false
    }
  }
}
```

### Combat Flags
```json
{
  "flags": {
    "twodsix": {
      "spacePhase": "declaration|actions|damage",
      "isSpaceCombat": true
    }
  }
}
```

---

## Integration Points

### 1. TwodsixShipActions
Modify to check phase/actions:
```typescript
public static async fireEnergyWeapons(text: string, extra: ExtraData) {
  // Check if actor can perform Significant Action
  if (!await extra.actor.combatant?.useSignificantAction()) {
    ui.notifications.warn("TWODSIX.Combat.NoSignificantActions", {localize: true});
    return;
  }
  
  // ... rest of action
}
```

### 2. TwodsixCombatant
Create hook for phase changes:
```typescript
Hooks.call('spaceCombatPhaseChange', {
  combatant: this,
  oldPhase: previousPhase,
  newPhase: newPhase
});
```

### 3. Battle Sheet
Add phase information:
```handlebars
<div class="space-combat-info">
  <div class="phase-display">
    Current Phase: <strong>{{combat.getCurrentPhaseName}}</strong>
  </div>
  <div class="turn-info">
    Round: {{combat.round}} | Turn: {{combat.turn}}
  </div>
</div>
```

---

## Localization Strings Needed

Add to `static/lang/en.json`:
```json
{
  "TWODSIX": {
    "Combat": {
      "Phase": {
        "Declaration": "Declaration Phase",
        "Actions": "Actions Phase",
        "Damage": "Damage Resolution Phase"
      },
      "Actions": {
        "DeclareHasty": "Declare Hasty",
        "ExecuteAction": "Execute Ship Action",
        "UseReaction": "Use Reaction",
        "AdvancePhase": "Advance to Next Phase"
      },
      "Notifications": {
        "NoMinorActions": "No minor actions remaining",
        "NoSignificantActions": "No significant actions remaining",
        "NoReactions": "No reactions remaining",
        "NotYourTurn": "It's not your turn or phase",
        "WrongPhase": "Cannot perform action in this phase"
      },
      "ShipCombat": {
        "ReactionsAvailable": "Reactions Available",
        "ActionsUsed": "Actions Used"
      }
    }
  }
}
```

---

## Implementation Priority

### Phase 1: Core Structure
- [ ] Extend `TwodsixCombatant` with phase tracking
- [ ] Create `TwodsixCombat` class (or modify existing)
- [ ] Register in main module init

### Phase 2: UI Display
- [ ] Add phase indicator to Combat Tracker
- [ ] Display action budget in combatant info
- [ ] Add phase control buttons

### Phase 3: Integration
- [ ] Modify `TwodsixShipActions` to check phases
- [ ] Update Battle Sheet with phase info
- [ ] Add phase change hooks

### Phase 4: Polish
- [ ] Add localization strings
- [ ] Create settings for phase strictness
- [ ] Add GM tools for phase management

---

## Ruleset Generalization

While the Cepheus Engine (CE) defines the phase structure, other rulesets may have different space combat mechanics:

| Ruleset | Space Combat Phases? | Notes |
|---------|----------------------|-------|
| **CE** (Cepheus Engine) | ✅ YES | Standard 3 phases (Declaration, Actions, Damage) |
| **CD** (Cepheus Deluxe) | ? | Need to verify CD phase structure |
| **CEL** (Cepheus Light) | ? | Likely simplified or different |
| **CU** (Cepheus Universal) | ? | Need to verify CU phase structure |
| **CT** (Classic Traveller) | ? | May have different turn structure |
| **AC** (Alpha Cephei) | ? | Need to verify AC phase structure |
| **CEQ** (Cepheus Quantum) | ? | Need to verify CEQ phase structure |

### Phase Configuration Strategy

Instead of hardcoding CE phases, make the phase system configurable per ruleset:

```typescript
// src/module/config.ts - Add to each ruleset configuration

interface RulesetSpaceCombatConfig {
  usePhases: boolean;           // Does this ruleset use phases?
  phases: string[];              // Names of phases
  actionBudget: {                // Action limits per turn
    minorActions: number;
    significantActions: number;
  };
  reactionFormula: string;        // How to calculate available reactions
}

const RULESETS = {
  CE: {
    // ... existing settings
    spaceCombat: {
      usePhases: true,
      phases: ['declaration', 'actions', 'damage'],
      actionBudget: {
        minorActions: 3,           // Can take 3 minor OR 1 significant
        significantActions: 1
      },
      reactionFormula: (initiative: number) => {
        if (initiative <= 4) return 1;
        if (initiative <= 8) return 2;
        if (initiative <= 12) return 3;
        return 4;
      }
    }
  },
  
  CD: {
    // ... existing CD settings
    spaceCombat: {
      usePhases: true,  // Verify if CD uses phases
      phases: ['declaration', 'actions', 'damage'],  // May differ
      actionBudget: {
        minorActions: 3,
        significantActions: 1
      },
      reactionFormula: (initiative: number) => {
        // CD reaction formula may differ
        if (initiative <= 4) return 1;
        if (initiative <= 8) return 2;
        if (initiative <= 12) return 3;
        return 4;
      }
    }
  },
  
  CEL: {
    // ... existing CEL settings
    spaceCombat: {
      usePhases: false,  // CEL may simplify space combat
      phases: [],
      actionBudget: {}
    }
  }
};
```

### Implementation for Ruleset Flexibility

Update `TwodsixCombat` to use ruleset config:

```typescript
export class TwodsixCombat extends Combat {
  /**
   * Get the current ruleset's space combat configuration
   */
  getRulesetSpaceCombatConfig() {
    const rulesetKey = game.settings.get('twodsix', 'activeRuleset');
    return RULESETS[rulesetKey]?.spaceCombat || {};
  }

  /**
   * Determine if this combat uses phases (based on ruleset)
   */
  isSpaceCombat(): boolean {
    const hasSpaceActors = this.combatants.some(c => 
      ['ship', 'space-object'].includes(c.actor?.type)
    );
    const hasNonSpaceActors = this.combatants.some(c => 
      ['traveller', 'animal', 'robot'].includes(c.actor?.type)
    );
    
    const config = this.getRulesetSpaceCombatConfig();
    const rulesetSupportsPhases = config.usePhases !== false;
    
    return hasSpaceActors && !hasNonSpaceActors && rulesetSupportsPhases;
  }

  /**
   * Get available phases for this ruleset
   */
  getAvailablePhases(): string[] {
    const config = this.getRulesetSpaceCombatConfig();
    return config.phases ?? ['declaration', 'actions', 'damage'];
  }

  /**
   * Get action budget for this ruleset
   */
  getActionBudget(): {minorActions: number; significantActions: number} {
    const config = this.getRulesetSpaceCombatConfig();
    return config.actionBudget ?? {
      minorActions: 3,
      significantActions: 1
    };
  }
}
```

Update `TwodsixCombatant` to use ruleset config:

```typescript
export default class TwodsixCombatant extends Combatant {
  /**
   * Calculate available reactions based on ruleset and initiative
   */
  getAvailableReactions(): number {
    if (!['ship', 'space-object'].includes(this.actor?.type)) return 0;
    
    const combat = this.combat as TwodsixCombat;
    const config = combat?.getRulesetSpaceCombatConfig();
    const formula = config?.reactionFormula;
    
    if (!formula || typeof formula !== 'function') {
      // Default CE formula if not specified
      const initiative = this.initiative ?? 0;
      if (initiative <= 4) return 1;
      if (initiative <= 8) return 2;
      if (initiative <= 12) return 3;
      return 4;
    }
    
    return formula(this.initiative ?? 0);
  }

  /**
   * Get action budget for this ruleset
   */
  getActionBudget() {
    const combat = this.combat as TwodsixCombat;
    return combat?.getActionBudget() ?? {
      minorActions: 3,
      significantActions: 1
    };
  }

  /**
   * Use a minor action (respecting ruleset's budget)
   */
  async useMinorAction(): Promise<boolean> {
    const budget = this.getActionBudget();
    const used = this.flags.twodsix?.minorActionsUsed ?? 0;
    const sigUsed = this.flags.twodsix?.significantActionsUsed ?? 0;
    
    const maxAllowed = sigUsed > 0 ? 1 : budget.minorActions;
    
    if (used < maxAllowed) {
      await this.update({
        'flags.twodsix.minorActionsUsed': used + 1
      });
      return true;
    }
    return false;
  }

  /**
   * Use a significant action (respecting ruleset's budget)
   */
  async useSignificantAction(): Promise<boolean> {
    const budget = this.getActionBudget();
    const used = this.flags.twodsix?.significantActionsUsed ?? 0;
    const minorUsed = this.flags.twodsix?.minorActionsUsed ?? 0;
    
    if (used < budget.significantActions && minorUsed === 0) {
      await this.update({
        'flags.twodsix.significantActionsUsed': 1
      });
      return true;
    }
    return false;
  }
}
```

### Handling Ruleset-Specific Phase Names

Some rulesets might use different phase names. Handle via localization:

```json
{
  "TWODSIX": {
    "Combat": {
      "Phase": {
        "CE": {
          "declaration": "Declaration Phase",
          "actions": "Actions Phase",
          "damage": "Damage Resolution Phase"
        },
        "CD": {
          "declaration": "Captain's Declaration",
          "actions": "Crew Actions",
          "damage": "Damage Phase"
        }
      }
    }
  }
}
```

Then fetch phase names dynamically:

```typescript
getPhaseName(phase: string): string {
  const rulesetKey = game.settings.get('twodsix', 'activeRuleset');
  const path = `TWODSIX.Combat.Phase.${rulesetKey}.${phase}`;
  const localized = game.i18n.localize(path);
  
  // Fallback to generic if ruleset-specific not found
  if (localized === path) {
    return game.i18n.localize(`TWODSIX.Combat.Phase.${phase}`);
  }
  return localized;
}
```

---

## Implementation Priority

### Phase 1: Core Structure
- [ ] Extend `TwodsixCombatant` with phase tracking
- [ ] Create `TwodsixCombat` class (or modify existing)
- [ ] Register in main module init

### Phase 2: UI Display
- [ ] Add phase indicator to Combat Tracker
- [ ] Display action budget in combatant info
- [ ] Add phase control buttons

### Phase 3: Integration
- [ ] Modify `TwodsixShipActions` to check phases
- [ ] Update Battle Sheet with phase info
- [ ] Add phase change hooks

### Phase 4: Polish
- [ ] Add localization strings
- [ ] Create settings for phase strictness
- [ ] Add GM tools for phase management

---

## Settings to Add

```typescript
// DisplaySettings.ts - Ship section
{
  name: "strictSpacePhases",
  scope: "world",
  config: true,
  type: Boolean,
  default: true,
  hint: "TWODSIX.Settings.strictSpacePhases.hint"
  // If true: enforce action limits per phase
  // If false: advisory display only
}

{
  name: "showSpaceCombatPhases",
  scope: "client",
  config: true,
  type: Boolean,
  default: true,
  hint: "TWODSIX.Settings.showSpaceCombatPhases.hint"
  // Show phase UI in combat tracker
}
```

---

## Future Enhancements

1. **Action Templates**: Pre-built action sets for common positions
2. **Reaction Triggers**: Auto-detect when reactions are available (incoming missiles, boarding, etc.)
3. **Delayed Actions**: Track which combatants have delayed their turn
4. **Extended Actions**: Actions lasting multiple turns
5. **Phase Summary Cards**: Display what happened in each phase
6. **Integration with Ship Actions**: Drag-drop actions to combat tracker

---

## Important Considerations for Hybrid Combat

### When a Traveller Boards a Ship

If personal combat erupts on a ship deck:
- The **ship** remains in space combat (continues phases with crew)
- **Boarding parties** use personal combat (standard rounds)
- They operate on different time scales:
  - 1 space combat turn = ~150 personal combat rounds
  - Boarding actions abstract personal combat (see SRD Abstract Boarding Rules)

### Mixed Personal + Ship Actions in Same Combat

Example: Combat tracker has both a Ship and a Traveller

```
ROUND 1
├─ Traveller A (Initiative 12) - Personal combat
│  └─ Attack Animal
├─ Ship A (Initiative 11) - Space combat (if pure)
│  └─ Actions Phase
└─ Animal B (Initiative 10) - Personal combat
   └─ Defend
```

In this case, **use personal combat rules** for all (hybrid = personal combat default).

For true ship-only combat:
```
TURN 1 - SHIP A (Initiative 14)
├─ Phase: Declaration
├─ Phase: Actions
└─ Phase: Damage

TURN 1 - SHIP B (Initiative 11)
├─ Phase: Declaration
├─ Phase: Actions
└─ Phase: Damage
```



---

## Example Usage Flow

```
ROUND 1
├─ SHIP A (Initiative 14)
│  ├─ Phase: Declaration
│  │  └─ Captain declares crew is NOT hasty
│  ├─ Phase: Actions
│  │  ├─ Pilot: Line Up The Shot (Significant)
│  │  ├─ Gunner 1: Attack (Significant, +1 DM from Pilot)
│  │  └─ Gunner 2: Personal Action (Minor)
│  └─ Phase: Damage
│     └─ Results: Both attacks hit, damage calculated
│
├─ SPACE-OBJECT B (Initiative 11) [e.g., Asteroid, Debris Field, Missile]
│  ├─ Phase: Declaration
│  ├─ Phase: Actions
│  │  └─ [Automated/AI actions if applicable]
│  └─ Phase: Damage
│     └─ Results: No damage this turn
│
├─ SHIP C (Initiative 9)
│  ├─ Phase: Declaration
│  ├─ Phase: Actions
│  │  ├─ Pilot: Evasive Maneuvers (Significant)
│  │  ├─ [Reaction triggered by SHIP A attack]
│  │  │  └─ Pilot: Dodge Incoming Fire (Reaction 1/3)
│  │  └─ Gunner: Reload Weapons (Significant → Minor swap)
│  └─ Phase: Damage
│     └─ Results: 1 missile incoming (arrives next turn)
│
└─ END ROUND 1
```

---

## Implementation Roadmap

### **STEP 1: Core Classes (Phase 1)**

**File: `src/module/entities/TwodsixCombat.ts` (NEW)**

Create the `TwodsixCombat` class with:
- ✅ Combat type detection (`isSpaceCombat()`, `isHybridCombat()`)
- ✅ Ruleset configuration lookup
- ✅ Phase advancement logic
- ✅ Action budget retrieval
- ✅ Phase name localization

**Modify: `src/module/entities/TwodsixCombatant.ts`**

Extend existing combatant with:
- ✅ Phase tracking flags
- ✅ Action budget methods (`useMinorAction()`, `useSignificantAction()`, `useReaction()`)
- ✅ Phase counter reset
- ✅ Reaction availability calculation
- ✅ Ruleset-aware action budget

**Modify: `src/module/config.ts`**

Add to RULESETS:
- ✅ `spaceCombat` config object for each ruleset
- ✅ Phase list
- ✅ Action budgets
- ✅ Reaction formulas

---

### **STEP 2: Integration with Combat System**

**Modify: `src/twodsix.ts`**

Register new class:
```typescript
CONFIG.Combat.documentClass = TwodsixCombat;
```

**Add Hooks:**
- ✅ `updateCombat` hook to detect combat type changes
- ✅ `spaceCombatPhaseChange` custom hook for phase changes

---

### **STEP 3: Localization**

**Modify: `static/lang/en.json`**

Add strings:
- ✅ Phase names (Declaration, Actions, Damage)
- ✅ Action names (Declare Hasty, Execute Action, etc.)
- ✅ Notifications (No actions remaining, etc.)
- ✅ Ruleset-specific phase names (optional per ruleset)

---

### **STEP 4: UI Components**

**Modify: Combat Tracker Template**

Add display for space combat:
- ✅ Phase indicator bar
- ✅ Current phase name
- ✅ Hybrid combat warning

**Modify: Combatant Card in Combat Tracker**

Add action budget display:
- ✅ Minor actions used/max
- ✅ Significant actions used/max
- ✅ Reactions used/available
- ✅ Hasty flag indicator

**Add Buttons:**
- ✅ "Declare Hasty" (Captain only, Declaration phase)
- ✅ "Advance Phase" (GM only)
- ✅ "Use Reaction" (reactive button, all phases)

---

### **STEP 5: Ship Actions Integration**

**Modify: `src/module/utils/TwodsixShipActions.ts`**

Update action methods to check phases:
- ✅ `fireEnergyWeapons()` - Check `useSignificantAction()`
- ✅ `skillRoll()` - Check action budget
- ✅ `chatMessage()` - Check phase restrictions
- ✅ Add guards for wrong phase

---

### **STEP 6: Battle Sheet Updates**

**Modify: `src/module/sheets/TwodsixBattleSheet.ts`**

Add space combat info display:
- ✅ Current phase name
- ✅ Round/Turn counter
- ✅ Phase progression buttons

---

### **STEP 7: Settings**

**Modify: `src/module/settings/DisplaySettings.ts`**

Add settings:
- ✅ `enableSpaceCombatPhases` - Turn phases on/off
- ✅ `strictSpacePhases` - Enforce action limits vs advisory
- ✅ `showSpaceCombatPhases` - UI visibility

---

### **STEP 8: Testing & Polish**

- [ ] Unit tests for phase logic
- [ ] Integration tests with combat tracker
- [ ] Test hybrid combat detection
- [ ] Test ruleset switching
- [ ] Performance testing with multiple combatants
- [ ] Edge case handling (late-joining players, mid-combat ruleset changes)

---

## Next Immediate Action

### **START HERE - STEP 1a: Create TwodsixCombat Class**

```bash
# 1. Create the file
touch src/module/entities/TwodsixCombat.ts

# 2. Implement the class (see code below)

# 3. Register in main module init (src/twodsix.ts)

# 4. Build and test
pnpm run build
```

**Code to add to `TwodsixCombat.ts`:**

```typescript
// src/module/entities/TwodsixCombat.ts
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { RULESETS } from "../config";

export class TwodsixCombat extends Combat {
  declare data: Combat.Data & {
    flags: {
      twodsix: {
        spacePhase?: 'declaration' | 'actions' | 'damage';
      }
    }
  };

  /**
   * Get the current ruleset's space combat configuration
   */
  getRulesetSpaceCombatConfig() {
    const rulesetKey = game.settings.get('twodsix', 'activeRuleset');
    return RULESETS?.[rulesetKey]?.spaceCombat || {};
  }

  /**
   * Determine if this is ONLY space combat (no personal actors)
   */
  isSpaceCombat(): boolean {
    const hasSpaceActors = this.combatants.some(c => 
      ['ship', 'space-object'].includes(c.actor?.type)
    );
    const hasNonSpaceActors = this.combatants.some(c => 
      ['traveller', 'animal', 'robot'].includes(c.actor?.type)
    );
    
    const config = this.getRulesetSpaceCombatConfig();
    const rulesetSupportsPhases = config.usePhases !== false;
    
    return hasSpaceActors && !hasNonSpaceActors && rulesetSupportsPhases;
  }

  /**
   * Determine if this is hybrid combat (space + personal actors)
   */
  isHybridCombat(): boolean {
    const hasSpaceActors = this.combatants.some(c => 
      ['ship', 'space-object'].includes(c.actor?.type)
    );
    const hasNonSpaceActors = this.combatants.some(c => 
      ['traveller', 'animal', 'robot'].includes(c.actor?.type)
    );
    
    return hasSpaceActors && hasNonSpaceActors;
  }

  /**
   * Get available phases for this ruleset
   */
  getAvailablePhases(): string[] {
    const config = this.getRulesetSpaceCombatConfig();
    return config.phases ?? ['declaration', 'actions', 'damage'];
  }

  /**
   * Get current phase display name
   */
  getCurrentPhaseName(): string {
    if (!this.isSpaceCombat()) return '';
    
    const phase = this.flags.twodsix?.spacePhase ?? 'declaration';
    const rulesetKey = game.settings.get('twodsix', 'activeRuleset');
    const path = `TWODSIX.Combat.Phase.${rulesetKey}.${phase}`;
    const localized = game.i18n.localize(path);
    
    // Fallback to generic if ruleset-specific not found
    if (localized === path) {
      return game.i18n.localize(`TWODSIX.Combat.Phase.${phase}`);
    }
    return localized;
  }

  /**
   * Get action budget for this ruleset
   */
  getActionBudget(): {minorActions: number; significantActions: number} {
    const config = this.getRulesetSpaceCombatConfig();
    return config.actionBudget ?? {
      minorActions: 3,
      significantActions: 1
    };
  }

  /**
   * Override nextTurn to handle phases in PURE space combat only
   */
  async nextTurn(): Promise<void> {
    if (!this.isSpaceCombat()) {
      return super.nextTurn();
    }

    const currentPhase = this.flags.twodsix?.spacePhase ?? 'declaration';
    const phases = this.getAvailablePhases();
    
    if (phases[phases.length - 1] === currentPhase) {
      // Move to next combatant
      await super.nextTurn();
      
      // Reset all space actors' phase counters
      for (const combatant of this.combatants) {
        if (['ship', 'space-object'].includes(combatant.actor?.type)) {
          await combatant.resetPhaseCounters?.();
        }
      }
      
      await this.update({ 'flags.twodsix.spacePhase': phases[0] });
    } else {
      // Advance phase for current combatant
      const nextPhase = phases[phases.indexOf(currentPhase) + 1];
      await this.update({ 'flags.twodsix.spacePhase': nextPhase });
    }
  }

  /**
   * Initialize space combat on first turn
   */
  async startCombat(): Promise<void> {
    if (this.isSpaceCombat()) {
      await this.update({ 'flags.twodsix.spacePhase': this.getAvailablePhases()[0] });
      
      // Initialize all combatants
      for (const combatant of this.combatants) {
        if (['ship', 'space-object'].includes(combatant.actor?.type)) {
          await combatant.resetPhaseCounters?.();
        }
      }
    }
    
    return super.startCombat();
  }
}
```

### **Then in `src/twodsix.ts`, add:**

```typescript
import { TwodsixCombat } from "./module/entities/TwodsixCombat";

// ... in the initialization section ...
CONFIG.Combat.documentClass = TwodsixCombat;
```

---

## After STEP 1 is Complete

Once TwodsixCombat works:

1. ✅ Verify phase detection works (check console for combat type)
2. ✅ Test with pure space combat (only ships)
3. ✅ Test with hybrid combat (ships + travellers)
4. ✅ Test with personal combat (only travellers)
5. ✅ Then proceed to STEP 2 (Combatant modifications)

**Expected behavior:**
- Pure space combat: Phases advance (Declaration → Actions → Damage → next turn)
- Hybrid: Behaves like normal Foundry combat (phases disabled)
- Personal: Normal behavior

