# Not a lot of docs so far.
_Not a lot of ducks either._

# Twodsix System
A Foundry VTT system for running games using various 2d6-based role-playing games. (See [README.md](../README.md) for more information.)

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

## MGT2
To get the system closer to MGT2 change the following in the system settings (after switching to 'Other' in the dropdown near the top of the system settings:

* Change the initiative formula to "2d6 -8  + max(@characteristics.dexterity.mod,@characteristics.intelligence.mod)"
* Change the modifier for a characteristic of 0 to -3 rather than -2
* Switch to handling difficulties by changing the target number rather than adding/subtracting modifiers.
* Rename 'advantage' to 'boon' and 'disadvantage' to 'bane'
* Select CEL style autofire rules and make sure weapons have a single number for their 'Rate of Fire/Auto X' setting.
* Set "What effect (if above 0) is required for a throw to be considered a critical success/failure (i.e. be colored green/red)." to 6.

Compendiums with skills and gear cannot be included for licensing reasons, so you have to enter those yourself, except that the '2e skills' compendium is sufficiently close that it should be useful, even though it is not based on MGT2. (It is for https://www.drivethrurpg.com/product/207738/Skills-List-2e which is an Open Gaming License Pay What You Want supplement for for Cepheus Engine - which is pretty much the Open Gaming License version of MGT1E - that provides a skill list that is very similar to the one in MGT2.)

## General features that really should be documented somewhere:
* A feature that's a bit too well hidden is that if you shift-click on skills or characteristics you automatically roll without modifiers with a difficulty of 8. This can be set as the default behavior in the settings.
* A feature I like (and thus added) but most people seem to not like is to in system settings change to show the Effect of the roll rather than the raw result (by subtracting the target number.)
* You can connect a skill to any item on a character, with an optional permanent bonus, so you can do 'skill rolls' (often enough weapon attacks) by clicking the item rather than the skill, and get that bonus added automatically.
* Another feature you need to turn on in system settings if you want to use it is to automatically roll damage for items that have a connected skill, roll a success (i.e. Effect of 0 or greater) and immediately roll damage. (I.e. Weapons.)
* A recently added feature is that you can drag damage rolls to a character-sheet and the damage is automatically applied to the character after subtracting any armor (but do note that after END runs out the damage always goes to the currently highest of STR and DEX, the target cannot currently choose which.)

Note that skills can be set to not use any characteristic for modifiers which is useful in some cases beyond Cepheus Light (like classic Traveller).

Twodsix has been translated by users of the system into the following languages:
* English (default)
* Swedish (included)
* Spanish (included)
* German (included)
* Russian (available in the Russian translation module https://foundryvtt.com/packages/ru-RU/)
* If you would like support for some other language, send in a translation to that language and I'll add it to the system. (Or send a link to a module that includes support for your preferred language and I'll link to it.) See [CONTRIBUTING.MD](../CONTRIBUTING.md)

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
