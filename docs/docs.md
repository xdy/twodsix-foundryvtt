# Not a lot of docs so far.
_Not a lot of ducks either._

# Twodsix System
A Foundry VTT system for running games using various 2d6-based role-playing games. (See [README.md](../README.md) for more information.

#Cepheus Engine
Right now the only compendiums are for skills and weapons (though, the ones for Cepheus Light are generally quite compatible.) Feel free to submit compendiums for the rest, or wait patiently for me to decide that I want to do data entry. Oh, and don't hold your breath... :)

## Cepheus Light
To get the system closer to Cepheus Light (which should also work fairly well for Cepheus Faster Than Light, and even Sword of Cepheus if you don't mind the SF theming):
In system settings:
a) Choose the CEL difficulty list.
b) Select the setting to handle difficulties by changing the target number rather than adding/subtracting modifiers.
c) Use the skills and gear from the various 'ce light-something' compendiums (supplied by @marvin9257).
d) Change the initiative formula to just 2d6 (i.e. you need to add the Tactics skill yourself after rolling until I or someone else figures out how to do it automatically).
e) Set skills to not use any characteristic for modifiers.

## Cepheus Faster Than Light
To get the system closer to Cepheus Faster Than Light:
In system settings:
a) Choose the CEL difficulty list.
b) Select the setting to handle difficulties by changing the target number rather than adding/subtracting modifiers.
c) Use the skills and gear from the various 'ce ftl-something' compendiums (supplied by @marvin9257).
d) Change the initiative formula to just 2d6 (i.e. you need to add the Tactics skill yourself after rolling until I or someone else figures out how to do it automatically).
e) Set skills to not use any characteristic for modifiers.

## MGT2
The things I know that can be done to make the system more compatible with MGT2 are:
a) Change the initiative formula to "2d6 -8  + max(@characteristics.dexterity.mod,@characteristics.intelligence.mod)" in system settings
b) Also in system settings, change the modifier for a characteristic of 0 to -3 rather than -2
c) Also in system settings, switch to handling difficulties by changing the target number rather than adding/subtracting modifiers.
d) Also in system settings, rename 'advantage' to 'boon' and 'disadvantage' to 'bane'

Compendiums with skills and gear cannot be included for licensing reasons.

## General features that really should be documented somewhere:
* A feature that's a bit too well hidden is that if you shift-click on skills or characteristics you get a popup where you can change difficulty, modifiers, used characteristic, etc for this roll only.
* A feature I like (and thus added) but most people seem to not like is to in system settings change to show the Effect of the roll rather than the raw result (by subtracting the target number.)
* You can connect a skill to any item on a character, with an optional permanent bonus, so you can do 'skill rolls' (often enough weapon attacks) by clicking the item rather than the skill, and get that bonus added automatically.
* Another feature you need to turn on in system settings if you want to use it is to automatically roll damage for items that have a connected skill, roll a success (i.e. Effect of 0 or greater) and immediately roll damage. (I.e. Weapons.)

Note that skills can be set to not use any characteristic for modifiers which is useful in some cases beyond Cepheus Light (like classic Traveller).

If you prefer Spanish, Swedish or German, switch to those languages in Foundry settings. If you prefer some other language, send in a translation to that language and I'll add it to the system.

Also, on our discord (https://discord.gg/VNFUvjv) check out the release notes in #announcements as that is pretty much the only documentation other than the text on the various system settings.
