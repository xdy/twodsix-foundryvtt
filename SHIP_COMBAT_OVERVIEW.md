# Ship Combat, Damage & Actions System Overview

## Current Implementation

The Twodsix system provides comprehensive ship combat support across multiple rulesets (Traveller, Cepheus Engine variants).

### 1. Ship Actions System (`TwodsixShipActions.ts`)

Ship positions can have custom actions that crew members can execute during combat:

#### Available Action Types:
- **Chat Message**: Simple message or dice roll command (supports `/r` rolls)
- **Skill Roll**: Execute a skill check with modifiers (can reference characteristics or components)
- **Fire Energy Weapons**: Ship weapon attack roll with automatic damage on hit
- **Execute Macro**: Run a custom macro with access to actor, ship, and component context

#### Action Execution Flow:
1. Action is defined on a Ship Position with a command/formula
2. Assigned crew member executes the action
3. System parses the action command and executes appropriate handler
4. Results are posted to chat with flavor text referencing position and action name

#### Key Features:
- Actions can reference ship components (armament, engines, etc.)
- Skill checks can have custom difficulty modifiers
- Automatic damage calculation when weapons hit (configurable)
- Macro access to full context: actor, ship, component

### 2. Ship Damage System (`shipDamage.ts`)

Supports multiple damage rulesets matching different Traveller/Cepheus editions:

#### Damage Calculation Rules:
1. **Component**: Cepheus Engine style - rolls hit location tables for specific components
2. **Hull Only**: Damage only affects hull points, no component details
3. **Hull With Criticals**: Hull damage plus 10% critical hits by hull threshold
4. **Surface or Internal**: Cepheus Deluxe style - separate surface/internal damage tracks
5. **Classic Traveller**: CT style hit tables with crew damage on criticals
6. **Alpha Cephei**: AC style with armor as gate, location-based damage
7. **Cepheus Universal**: CU style with combined hull and component tracking

#### Damage Resolution:
- **Net Damage** = Weapon Damage - (Armor, except vs Meson Gun or CT rules)
- Hit locations are rolled from ruleset-specific tables
- Criticals determined by damage threshold or percentage-based
- Radiation damage calculated separately based on damage rules

#### Hit Location Tables by Ruleset:

**Classic Traveller Surface Hits:**
- Power, M-Drive, J-Drive, Fuel, Hull (x2), Cargo, Computer, Armament (x2), Special

**Classic Traveller Critical Hits:**
- Power, M-Drive, J-Drive, Crew, Computer, Destroyed

**Alpha Cephei Surface Hits:**
- Breach, Power, J-Drive, Armament, M-Drive, Armor, Cargo, Crew, Computer, Bridge, Special

**Cepheus Deluxe & Cepheus Universal:**
- Internal/External hit tables with radiation tracking

### 3. Ship Position System (`TwodsixShipPositionSheet.ts`)

Positions represent crew stations/roles on a ship:

#### Position Features:
- **Actions**: Custom combat actions specific to that position
- **Assigned Actors**: Crew members assigned to the position
- **Components**: Can link to ship components (weapons, engines, etc.)
- **Skill Binding**: Actions auto-created from dropped skills with pre-calculated DCs

#### Creating Actions:
1. **Manually**: Click "New Action" and configure command/type
2. **From Skills**: Drop a skill onto position to auto-create skill check action
3. **From Components**: Link components for weapon/system actions

### 4. Battle Sheet (`TwodsixBattleSheet.ts`)

Specialized view for ship combat tracking:

#### Display Features:
- Ship positions with assigned crew
- Combat position tracker (if enabled in settings)
- Component status display
- Cargo/storage management
- Position-based actions with one-click execution

### 5. Configuration & Settings

**Key Settings:**
- `shipDamageType`: Which ruleset's damage calculation to use
- `automateDamageRollOnHit`: Auto-roll damage when weapon hits
- `addEffectForShipDamage`: Add effect die result as bonus damage
- `maxComponentHits`: Maximum hits a component can take before destruction
- `showCombatPosition`: Display combat position tracking

## Typical Combat Round Flow

1. **Setup**: Positions populated with crew, positions have actions configured
2. **Round Actions**: Each crew member selects an action from their position
3. **Action Resolution**:
   - Skill check made (with difficulty/modifiers from action formula)
   - If successful, weapon fires and damage calculated
   - Hit locations determined by damage rules
   - Results posted to chat with flavor
4. **Damage Application**: Components/hull damaged, status updated

## Addressing Common Naval Combat Concerns

### Issue: Missing features or incorrect mechanics?

**Check these areas:**

1. **Damage Type Selection** (`shipDamageType` setting)
   - Ensure correct ruleset is selected for your game
   - Different rulesets use different tables and calculations

2. **Action Command Format**
   - Skill rolls: `SkillName/CHARACTERISTIC DifficultyTarget+`
   - Energy weapons: `SkillName/CHARACTERISTIC DifficultyTarget+ = ComponentId`
   - Chat messages: Can use dice rolls `/r 2d6` or plain text

3. **Component Linking**
   - Weapons must be components with `armament` subtype
   - Ammo can be linked via `ammoLink` property
   - Check `automateDamageRollOnHit` setting to enable auto-damage

4. **Hit Location Tables**
   - Each ruleset has specific hit tables
   - Criticals calculated differently per ruleset
   - Radiation handled separately (CE, CD, CU)

### Potential Areas for Enhancement

1. **Action Templates Library**: Pre-built action sets for common positions (Pilot, Gunner, Engineer, etc.)
2. **Multi-Target Damage**: Some rulesets support area-effect weapons
3. **Advanced Maneuvers**: Integration with ship maneuver modifiers
4. **Damage Reports**: Already implemented - comprehensive damage logging
5. **Reaction Rolls**: Could integrate with reaction system for NPC ships
6. **Shield Systems**: Could expand component damage to track shield separately

## Files to Review

- `src/module/utils/TwodsixShipActions.ts` - Action execution logic
- `src/module/utils/shipDamage.ts` - Damage calculation and hit tables
- `src/module/sheets/TwodsixShipSheet.ts` - Main ship sheet management
- `src/module/sheets/TwodsixShipPositionSheet.ts` - Position configuration
- `src/module/sheets/TwodsixBattleSheet.ts` - Battle view
- `static/lang/en.json` - UI strings and localization
- `src/types/template.d.ts` - Data structure definitions

## Settings References

Check `src/module/settings/` for:
- `DisplaySettings.ts` - Visual settings including ship options
- Default values and available options for ship combat settings
