# Not a lot of docs so far.
_Not a lot of ducks either._

# Twodsix System
A Foundry VTT system for running games using various 2d6-based role-playing games. (See [README.md](../README.md) and the [WIKI](https://github.com/xdy/twodsix-foundryvtt/wiki) for more information.)

Instructions on how to set up your game for some of the most common variants can be found in our [WIKI here](https://github.com/xdy/twodsix-foundryvtt/wiki/System-Configuration-Guide).

## Uncrewed ship positions

Ship positions without assigned actors can perform actions using their **Uncrewed Skill Level**, set on the position sheet and defaulting to 0. This level applies to all skill rolls; characteristic modifiers are neutral. Both ship and battle sheets use a temporary, unsaved Traveller for these actions. Ship action macros receive this temporary actor as `actor`, alongside `ship` and `component`; they should not rely on its UUID or expect changes to it to persist. Assigned crew continue to use their own skills.

Uncrewed roll chat cards identify the ship separately for permission checks; the temporary crew has no persistent actor UUID. Characteristic-only actions with a component still apply its modifiers and consumables, without adding the crew skill level.

Also, see the [PUBLISHERS.md](../PUBLISHERS.md) for details of the rpg publishers that have explicitly granted us permission to support their products.

Twodsix has been translated by users of the system into the following languages:
* English (default)
* Swedish (included)
* Spanish (included)
* German (included)
* Russian (available in the Russian translation module https://foundryvtt.com/packages/ru-ru/)
* If you would like support for some other language, send in a translation to that language and I'll add it to the system. (Or send a link to a module that includes support for your preferred language and I'll link to it.) See [CONTRIBUTING.MD](../CONTRIBUTING.md)

## Other sources of information
* [The Wiki](https://github.com/xdy/twodsix-foundryvtt/wiki) contains some guides on how to actually use the system.
* [The user_macros wiki](https://github.com/xdy/twodsix-foundryvtt/wiki/User-Macros) contains useful information about macros contained in the compendium Macros are no longer maintained on GitHub.
* The release notes in #announcements on the [Twodsix discord](https://discord.gg/KUAwPrj) may have information about new features that is not documented elsewhere.
 
