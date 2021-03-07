# Not a lot of docs so far.
_Not a lot of ducks either._

# Twodsix System
A Foundry VTT system for running games using various 2d6-based role-playing games. (See [README.md](../README.md) for more information.)

Some basic instructions on how to set up your game for some of the most common variants can be found below:

## Cepheus Engine
Complete skill and personal equipment compendiums are available (supplied by @marvin9257).
All system settings default to Cepheus Engine rules, but you may want to turn on some automation in the system settings (see General Features below).

## Cepheus Light
To get the system closer to Cepheus Light (which should also work fairly well for related systems like Sword of Cepheus if you don't mind the SF theming) select 'Cepheus Light' in the dropdown near the top of the system settings, that will set the following settings:

* Choose the CEL difficulty list.
* Select the setting to handle difficulties by changing the target number rather than adding/subtracting modifiers.
* Use the skills and gear from the various 'ce light-something' compendiums (supplied by @marvin9257).
* Change the initiative formula to just 2d6 (i.e. you need to add the Tactics skill yourself after rolling until I or someone else figures out how to do it automatically).
* Set skills to not use any characteristic for modifiers.
* Select CEL style autofire rules and make sure weapons have a single number for their 'Rate of Fire/Auto X' setting.
* Sets a natural 2/12 to be considered a failure/success regardless of actual Effect.

Reasonably complete compendiums for Cepheus Light exist.

## Cepheus Faster Than Light
To get the system closer to Cepheus Faster Than Light select 'Cepheus Faster Than Light' in the dropdown near the top of the system settings, that will set the following settings:

* Choose the CEL difficulty list.
* Select the setting to handle difficulties by changing the target number rather than adding/subtracting modifiers.
* Use the skills and gear from the various 'ce ftl-something' compendiums (supplied by @marvin9257).
* Change the initiative formula to just 2d6 (i.e. you need to add the Tactics skill yourself after rolling until I or someone else figures out how to do it automatically).
* Set skills to not use any characteristic for modifiers.
* Sets a natural 2/12 to be considered a failure/success regardless of actual Effect.

Reasonably complete compendiums for Cepheus Faster Than Light exist.

## Cepheus Atom
To get the system closer to Cepheus Atom change the following in the system settings after switching to 'Other' in the dropdown near the top of the system settings:

* Choose the CEL difficulty list.
* Set skills to not use any characteristic for modifiers.
* Change the initiative formula to just 2d6 (i.e. you need to add the Combat skill yourself after rolling until I or someone else figures out how to do it automatically).
* Set a natural 2/12 to be considered a failure/success regardless of actual Effect.

In play, handle the differences to Cepheus Engine as follow:
* Give every character JOAT-3.
* Ignore attributes other than END, except under the covers treat STR+DEX as Lifeblood. (I.e. the player splits Lifeblood between those two fields so that the the automatic damage code can handle it). (I guess 0 in one of them would work, but I'm not sure.)
* Track Contamination using, say, the PSI attribute field. (Or just note it as text in the journal field).
* Mutations exist in a compendum as items (augmentations). Any effects on the character will need to be handled manually.

Compendiums for items, mutations and robots are included, additionally the various compendiums from Cepheus FTL might be useful.

## Barbaric!
To get the system closer to Barbaric! change the following in the system settings after switching to 'Other' in the dropdown near the top of the system settings:

* See Cepheus Atom, above for most needed changes
* Races and Traits can be handled like Mutations in Cepheus Atom.
* Set "What effect (if above 0) is required for a throw to be considered a critical success/failure (i.e. be colored green/red)." to 4. (Actually only relevant for Spellcasting).

No compendiums for Barbaric! yet exist, though the ones from Cepheus Atom are somewhat useful, as examples if nothing else.

## MGT1
To get the system closer to MGT1 switch to 'Cepheus Engine' in the dropdown near the top of the system settings.

Compendiums with skills, items, etc cannot be included for licensing reasons, so you have to enter those yourself, except that the various Cepheus Engine compendium are sufficiently close that they should be useful, even though they are note for MTG1. (Cepheus Engine is pretty much the Open Gaming License version of MTG1.)

## MGT2
To get the system closer to MGT2 change the following in the system settings after switching to 'Other' in the dropdown near the top of the system settings:

* Choose the CE difficulty list.
* Change the initiative formula to "2d6 -8  + max(@characteristics.dexterity.mod,@characteristics.intelligence.mod)"
* Change the modifier for a characteristic of 0 to -3 rather than -2
* Switch to handling difficulties by changing the target number rather than adding/subtracting modifiers.
* Rename 'advantage' to 'boon' and 'disadvantage' to 'bane'
* Select CEL style autofire rules and make sure weapons have a single number for their 'Rate of Fire/Auto X' setting.
* Set "What effect (if above 0) is required for a throw to be considered a critical success/failure (i.e. be colored green/red)." to 6.

Compendiums with skills, items, etc cannot be included for licensing reasons, so you have to enter those yourself, except that the '2e skills' compendium is sufficiently close that it should be useful, even though it is not based on MGT2. (It is for https://www.drivethrurpg.com/product/207738/Skills-List-2e which is an Open Gaming License Pay What You Want supplement for for Cepheus Engine - which is pretty much the Open Gaming License version of MTG1 - that provides a skill list that is very similar to the one in MGT2.)


## General features that really should be documented somewhere:
* A feature that's a bit too well hidden is that if you shift-click on skills or characteristics you automatically roll and Average difficulty roll without modifiers. This can be set as the default behavior in the settings (making shift-click instead open the full roll dialog).
* You can connect a skill to any item on a character, with an optional permanent bonus, so you can do 'skill rolls' (often enough weapon attacks) by clicking the item rather than the skill, and get that bonus added automatically.
* Another feature you need to turn on in system settings if you want to use it is to automatically roll damage for items that have a connected skill, roll a success (i.e. Effect of 0 or greater) and immediately roll damage. (I.e. Weapons.)
* You can drag damage rolls to a character-sheet and the damage is automatically applied to the character after subtracting any armor (but do note that after END runs out the damage always goes to the currently highest of STR and DEX, the target cannot currently choose which.)

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
* [The user_macros folder](https://github.com/xdy/twodsix-foundryvtt/tree/master/user_macros) contains several useful macros.

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
Dice So Nice!, Compendium Folders, Dice Tray, Forien's Quest Log, Hey, Listen!, Hidden Initiative, Illandril's Chat Enhancements, Inline Web Viewer, MyTab, Navigation Presets, Pathfinding Ruler, PDFoundry, Permission Viewer, PopOut!, Popout Resizer, Switch to Chat, Workshop's Party Unit Frames

## The modules I really like, but guess I could do without
Autocomplete Whispers, BubbleRolls, Chat Scrolling, Combat Carousel, Combat Numbers, Combat Ready, Cursor Hider, Custom Nameplates, Default Scene, DF Scene Enhancement, DF Settings Clarity, Everybody Look, Forien's Copy Enviromment, FX Master, GM Notes, GM Screen, ModBox, Not Your Turn! Tidy UI, Token Chat Link, Token Mold.

Also, on our discord (https://discord.gg/VNFUvjv) check out the release notes in #announcements as that is pretty much the only documentation other than this document and the text on the various system settings.
