# Not a lot of docs so far.
_Not a lot of ducks either._

# Twodsix System
A Foundry VTT system for running games using various 2d6-based role-playing games. (See [README.md](../README.md) and the [WIKI](https://github.com/xdy/twodsix-foundryvtt/wiki) for more information.)

Some basic instructions on how to set up your game for some of the most common variants can be found below.
Also, see the [PUBLISHERS.md](../PUBLISHERS.md) for details of the rpg publishers that have explicitly granted us permission to support their products.

# Supported variants

## Cepheus Engine
Complete skill and personal equipment compendiums are available (supplied by @marvin9257).
All system settings default to Cepheus Engine rules, but you may want to turn on some automation in the system settings (see General Features below).

## Cepheus Deluxe
To get the system closer to Cepheus Deluxe select 'Cepheus Deluxe' in the dropdown near the top of the system settings.
* Turn on "Show 'Lifeblood' and 'Stamina' characteristics and use for damage."  This option displays lifeblood and stamina inputs at the bottom of the biography section of the actor sheet.  The battery icon is stamina and the heart-beat icon is lifeblood.  For each pair, the blue number is the maximum value and the red is the corresponding damage.  So, a blue value of 7 and a red value of 3 means that the current value is 4.  Note that this setting also overrides how damage is implemented - applying it to LFB and STA rather than the standard characteristics.

Support for Traits was added to the system with version 0.8.14

Basic support for new Lifeblood and Stamina characteristics added in version 0.8.26.  Lifeblood and Stamina are supported along with wounded status (if enabled by option).

Compendiums for Cepheus Deluxe excluding ship, vehicle, and robot information are included with the system.


## Cepheus Light
To get the system closer to Cepheus Light (which should also work fairly well for related systems like Sword of Cepheus if you don't mind the SF theming) select 'Cepheus Light' in the dropdown near the top of the system settings, that will set the following settings:
* Choose the CEL difficulty list.
* Select the setting to handle difficulties by changing the target number rather than adding/subtracting modifiers.
* Change the initiative formula to just 2d6 (i.e. you need to add the Tactics skill yourself after rolling , or use the 'Update Initiative' macro found here: https://github.com/xdy/twodsix-foundryvtt/wiki/User-Macros)
* Select CEL style autofire rules
* Sets a natural 2/12 to be considered a failure/success regardless of actual Effect.

In play, handle the differences to Cepheus Engine as follows:
* Use the skills, items, etc from the various 'ce light-something' compendiums (supplied by @marvin9257).
* Set skills to not use any characteristic for modifiers.

## Cepheus Light Upgraded
As Cepheus Light above, but choose 'Cepheus Light Upgraded' instead.

## Cepheus Faster Than Light
To get the system closer to Cepheus Faster Than Light select 'Cepheus Faster Than Light' in the dropdown near the top of the system settings, that will set the following settings:

* Choose the CEL difficulty list.
* Select the setting to handle difficulties by changing the target number rather than adding/subtracting modifiers.
* Change the initiative formula to just 2d6 (i.e. you need to add the Tactics skill yourself after rolling, or use the 'Update Initiative' macro found here: https://github.com/xdy/twodsix-foundryvtt/wiki/User-Macros)
* Sets a natural 2/12 to be considered a failure/success regardless of actual Effect.

In play, handle the differences to Cepheus Engine as follows:
* Use the skills, items, etc from the various 'ce ftl-something' compendiums (supplied by @marvin9257).
* Set skills to not use any characteristic for modifiers (this is already done in the above compendiums).

Reasonably complete compendiums for Cepheus Faster Than Light exist.

## Cepheus Atom
To get the system closer to Cepheus Atom select 'Cepheus Atom' in the dropdown near the top of the system settings, that will set the following settings:
* Choose the CEL difficulty list.
* Change the initiative formula to just 2d6 (i.e. you need to add the Combat skill yourself after rolling ,or use the 'Update Initiative' macro found here: https://github.com/xdy/twodsix-foundryvtt/wiki/User-Macros - though you need to change line 5 of the macro to use the 'Combat' skill rather than the 'Tactics' skill).
* Set a natural 2/12 to be considered a failure/success regardless of actual Effect.
* Turn on "Show END and 'Lifeblood' (STR) as characteristics" (which also makes Contamination show)

In play, handle the differences to Cepheus Engine as follows:
* Use the skills, items, etc from the various 'cepheus atom-something' compendiums (supplied by @marvin9257).
* Set skills to not use any characteristic for modifiers (this is already done in the above compendiums).
* Give every character JOAT-3 on the skills tab.
* Mutations exist in a compendum as items (augmentations). Any effects on the character will need to be handled manually.

Compendiums containing skills, items, mutations, robots and monsters are included, additionally the various compendiums from Cepheus FTL might be useful.
There is also a gm screen compendium suitable for use with the https://foundryvtt.com/packages/gm-screen module.

## Barbaric!
To get the system closer to Barbaric! select 'Barbaric!' in the dropdown near the top of the system settings, that will set the following settings:
* Choose the CEL difficulty list.
* Change the initiative formula to just 2d6 (i.e. you need to add the Combat skill yourself after rolling ,or use the 'Update Initiative' macro found here: https://github.com/xdy/twodsix-foundryvtt/wiki/User-Macros - though you need to change line 5 of the macro to use the 'Combat' skill rather than the 'Tactics' skill).
* Set a natural 2/12 to be considered a failure/success regardless of actual Effect.
* Set "What effect (if above 0) is required for a throw to be considered a critical success/failure (i.e. be colored green/red)." to 4. (Actually only relevant for Spellcasting).
* Turn on "Show END and 'Lifeblood' (STR) as characteristics" (which also makes Contamination show)
* Turn off "Show Contamination below Lifeblood"

In play, handle the differences to Cepheus Engine as follows:
* Set skills to not use any characteristic for modifiers (this is already done in the above compendiums).
* Give every character JOAT-3 on the skills tab.
* Races and Traits can be handled like Mutations in Cepheus Atom.

No compendiums for Barbaric! yet exist, though the ones from Cepheus Atom are somewhat useful, as examples if nothing else.

## Cepheus Quantum
To get the system closer to Cepheus Quantum select 'Cepheus Quantum' in the dropdown near the top of the system settings, that will set the following settings:

* Choose the CEL difficulty list.
* Set skills to not use any characteristic for modifiers.
* Use the careers, items, etc from the 'cepheus quantum-something' compendiums (supplied by @marvin9257).
* Change the initiative formula to just 1d1
* Turn on "Show END and 'Lifeblood' (STR) as characteristics"
* Turn off "Show Contamination below Lifeblood"

In play, handle the differences to Cepheus Engine as follows:
* Create a character by importing one of the careers from the career compendium and renaming it to your character's name, then changing the attributes.
* Give every character JOAT-3 on the skills tab.
* Ignore the initiative that gets rolled, everyone gets the same initiative (optionally, you might want to take a look at the https://foundryvtt.com/packages/Popcorn module if you want some structure to the initiative)

Reasonably complete compendiums for Cepheus Quantum exist, additionally the various compendiums from Cepheus FTL might be useful.
There is also a gm screen compendium suitable for use with the https://foundryvtt.com/packages/gm-screen module.

## MGT1
To get the system closer to MGT1 switch to 'Cepheus Engine' in the dropdown near the top of the system settings.

Compendiums with skills, items, etc cannot be included for licensing reasons, so you have to enter those yourself, but the various Cepheus Engine compendium are sufficiently close that they should be useful, even though they are not for MTG1. (Cepheus Engine is pretty much the Open Gaming License version of MTG1.)

## MGT2
To get the system closer to MGT2 change the following in the system settings after switching to 'Other' in the dropdown near the top of the system settings:

* Choose the CE difficulty list.
* Change the initiative formula to "2d6 -8  + max(@characteristics.dexterity.mod,@characteristics.intelligence.mod)"
* Change the modifier for a characteristic of 0 to -3 rather than -2
* Switch to handling difficulties by changing the target number rather than adding/subtracting modifiers.
* Rename 'advantage' to 'boon' and 'disadvantage' to 'bane'
* Select CEL style autofire rules and make sure weapons have a single number for their 'Rate of Fire/Auto X' setting.
* Set "What effect (if above 0) is required for a throw to be considered a critical success/failure (i.e. be colored green/red)." to 6.
* Set encumbrance formula to "@characteristics.endurance.current + @characteristics.strength.current + max(0, @skills.AthleticsEndurance) + max(0, @skills.AthleticsStrength)".

Compendiums with skills, items, etc cannot be included for licensing reasons, so you have to enter those yourself, except that the '2e skills' compendium is sufficiently close that it should be useful, even though it is not based on MGT2. (It is for https://www.drivethrurpg.com/product/207738/Skills-List-2e which is an Open Gaming License Pay What You Want supplement for for Cepheus Engine - which is pretty much the Open Gaming License version of MTG1 - that provides a skill list that is very similar to the one in MGT2.)

## Classic Traveller
Can probably be done, but, I haven't tried it. If you have, tell us on the Discord what you needed to change!

## General features that really should be documented somewhere:
* A feature that's a bit too well hidden is that if you shift-click on skills or characteristics you automatically roll and Average difficulty roll without modifiers. This can be set as the default behavior in the settings (making shift-click instead open the full roll dialog).
* You can connect a skill to any item on a character, with an optional permanent bonus, so you can do 'skill rolls' (often enough weapon attacks) by clicking the item rather than the skill, and get that bonus added automatically.
* Another feature you need to turn on in system settings if you want to use it is to automatically roll damage for items that have a connected skill, roll a success (i.e. Effect of 0 or greater) and immediately roll damage. (I.e. Weapons.)
* You can drag damage rolls to a character-sheet or token (if option is enabled) and the damage is automatically applied to the character after subtracting any armor (but do note that after END runs out the damage always goes to the currently highest of STR and DEX, the target cannot currently choose which.) Or, by clicking shift when dragging you get a dialog that allows you to spread the damage manually.
* You can right-click on an actor on the map, and select as target (round button in the lower left corner). Now when you do an attack it will automatically bring up the damage dialog for that actor (i.e. you don't need to drag and drop the damage)
* There is built in support for PDF Pager and Drag Ruler Modules.
* Can drag a scene to ship actor to act as an attached deck plan.
* Option to use ProseMirror editor for larger text input fields.
* Dragging a vehicle actor to a ship component list creats a component copy of the vehicle.  Name links to actor.
* Automatic wounded status indicators (along with roll modifiers) can be optional added through a setting
* There is an NPC sheet that can be used for any traveller.  Select under sheet settings
* If using the show untrained skill, any roll that depends on a skill will default to untrained if no specific skill is selected.

Note that skills can be set to not use any characteristic for modifiers which is useful in some cases beyond Cepheus Light (like classic Traveller).

Twodsix has been translated by users of the system into the following languages:
* English (default)
* Swedish (included)
* Spanish (included)
* German (included)
* Russian (available in the Russian translation module https://foundryvtt.com/packages/ru-RU/)
* If you would like support for some other language, send in a translation to that language and I'll add it to the system. (Or send a link to a module that includes support for your preferred language and I'll link to it.) See [CONTRIBUTING.MD](../CONTRIBUTING.md)

## Other sources of information
* [The Wiki](https://github.com/xdy/twodsix-foundryvtt/wiki) contains some guides on how to actually use the system.
* [The user_macros wiki](https://github.com/xdy/twodsix-foundryvtt/wiki/User-Macros) contains useful information about macros contained in the compendium Macros are no longer maintained on GitHub.

## The settings I (xdy) use
Fwiw, this is how I have set up the system - i.e. the setting combination that is the most tested by me... (Showing the system setting key, and the value I have changed it to. Any setting not mentioned has the default value.)
* automateDamageRollOnHit:true
* difficultiesAsTargetNumber:true
* effectOrTotal:true
* ExperimentalFeatures:true
* modifierForZeroCharacteristic:-3
* termForAdvantage:Boon
* termForDisadvantage:Bane

## The modules I consider essential
Dice So Nice!, Compendium Folders, DF Settings Clarity, Dice Tray, Forien's Quest Log, Illandril's Chat Enhancements, Inline Web Viewer, PDFoundry, Permission Viewer, PopOut!, Tidy UI

## The modules I really like, but guess I could do without
Autocomplete Whispers, Combat Numbers, DF Scene Enhancement, Forien's Copy Enviromment, FX Master, GM Notes, GM Screen, ModBox, Token Mold.

Also, on our discord (https://discord.gg/KUAwPrj) check out the release notes in #announcements as that is pretty much the only documentation other than this document and the text on the various system settings.
 
 