# Not a lot of docs so far.
_Not a lot of ducks either._

# Twodsix System
A Foundry VTT system for running games using various 2d6-based role-playing games. (See [README.md](../README.md) for more information.)

## Cepheus Engine
Right now the only compendiums are for skills and weapons (though, the ones for Cepheus Light are generally quite compatible.) Feel free to submit compendiums for the rest, or wait patiently for me to decide that I want to do data entry. Oh, and don't hold your breath... :)

## Cepheus Light
To get the system closer to Cepheus Light (which should also work fairly well for related systems like Sword of Cepheus if you don't mind the SF theming) change the following in the system settings:

* Choose the CEL difficulty list.
* Select the setting to handle difficulties by changing the target number rather than adding/subtracting modifiers.
* Use the skills and gear from the various 'ce light-something' compendiums (supplied by @marvin9257).
* Change the initiative formula to just 2d6 (i.e. you need to add the Tactics skill yourself after rolling until I or someone else figures out how to do it automatically).
* Set skills to not use any characteristic for modifiers.

## Cepheus Faster Than Light
To get the system closer to Cepheus Faster Than Light change the following in the system settings:

* Choose the CEL difficulty list.
* Select the setting to handle difficulties by changing the target number rather than adding/subtracting modifiers.
* Use the skills and gear from the various 'ce ftl-something' compendiums (supplied by @marvin9257).
* Change the initiative formula to just 2d6 (i.e. you need to add the Tactics skill yourself after rolling until I or someone else figures out how to do it automatically).
* Set skills to not use any characteristic for modifiers.

## MGT2
To get the system closer to MGT2 change the following in the system settings:

* Change the initiative formula to "2d6 -8  + max(@characteristics.dexterity.mod,@characteristics.intelligence.mod)"
* Change the modifier for a characteristic of 0 to -3 rather than -2
* Switch to handling difficulties by changing the target number rather than adding/subtracting modifiers.
* Rename 'advantage' to 'boon' and 'disadvantage' to 'bane'

Compendiums with skills and gear cannot be included for licensing reasons, so you have to enter those yourself, except that the '2e skills' compendium is sufficiently close that it should be useful, even though it is not based on MGT2. (It is for https://www.drivethrurpg.com/product/207738/Skills-List-2e which is an Open Gaming License Pay What You Want supplement for for Cepheus Engine - which is pretty much the Open Gaming License version of MGT1E - that provides a skill list that is very similar to the one in MGT2.)

## General features that really should be documented somewhere:
* A feature that's a bit too well hidden is that if you shift-click on skills or characteristics you get a popup where you can change difficulty, modifiers, used characteristic, etc for this roll only.
* A feature I like (and thus added) but most people seem to not like is to in system settings change to show the Effect of the roll rather than the raw result (by subtracting the target number.)
* You can connect a skill to any item on a character, with an optional permanent bonus, so you can do 'skill rolls' (often enough weapon attacks) by clicking the item rather than the skill, and get that bonus added automatically.
* Another feature you need to turn on in system settings if you want to use it is to automatically roll damage for items that have a connected skill, roll a success (i.e. Effect of 0 or greater) and immediately roll damage. (I.e. Weapons.)

Note that skills can be set to not use any characteristic for modifiers which is useful in some cases beyond Cepheus Light (like classic Traveller).

Twodsix has been translated into the following languages:
* English (default)
* Swedish (included)
* Spanish (included)
* German (included)
* Russian (available in the Russian translation module https://foundryvtt.com/packages/ru-RU/)
* If you would like support for some other language, send in a translation to that language and I'll add it to the system. (Or send a link to a module that includes support for your preferred language and I'll link to it.)

Also, on our discord (https://discord.gg/VNFUvjv) check out the release notes in #announcements as that is pretty much the only documentation other than this document and the text on the various system settings.
