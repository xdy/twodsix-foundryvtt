# 2d6 system
A system for running games using the world's oldest science fiction rpg system and it's various derivatives.

Note that it is *very* early in it's development. As in, it doesn't really do anything useful yet...

At first it will support doing things the way I do it using my favorite 2d6 rules variant, but I intend to make it flexible 
enough that all/most 2d6 rules variants should be possible to play using this system. Due to licensing restrictions the
user may have to enter some compendiums. 

This system may eventually claim compatibility with specific rules sets once I have:
a) completed said compatibility 
b) actually have the license to do so

Intended design:
The character is described in UCF, support import from 10001 characters and, I suppose, travellertools (extends it a bit)
Quote from the srd
	Universal Character Format
	The following format is used to represent a character’s basic game statistics in the Cepheus Engine rules.
  ```
	[Character Name, with rank and/or noble title, if appropriate] 	[Character UPP] 	Age [Character Age]
	[Character Careers, with terms listed in parentheses]	Cr[Character Funds]
	[Character Skill List, in alphabetical order, with skill levels listed after skill names]
	[Species Traits, if not human; optional]
	[Character Equipment, if available; list only significant property]
	Here is an example of a system-wide human celebrity that has been entertaining his holovid fans for almost two 	decades with his heroic action movies:
	Bruce Ayala 	786A9A 	Age 38
	Entertainer (5 terms) 	Cr70,000
	Athletics-1, Admin-1, Advocate-1, Bribery-1, Carousing-3, Computer-2, Gambling-0, Grav Vehicle-0, Liaison-2, Linguistics-0, Streetwise-0
	High passage (x2)
```

Template fields:
	UCF - just text, is the sole source of truth about the character, parsed from when tab is switched to 'character sheet'
	Current - contains a modified copy of the temporary state of the character. Exists as long as the token does.
	Notes - just text, filled in by the player
	Gear - just text, filled in by the player (maybe, eventually, something calc sheet like. Not for now.)
	Events - just text, filled in by the player.

The sheet has two tabs:
	UCF - textfield, from the template
	Character - what's been parsed from UCF (or the Current field, I guess)
		Has 'Copy To UCF' and 'Copy From UCF' that does what it says.
		Has several dynamic lists of radiobuttons formated like 'text:value'
			Attributes (attribute/value:mod)
			Skills (skillnamne:value)
			Difficulties (Average:8, Hard:10, etc)
			Modifiers (-9 to +9, I guess)
			Time Increment (seconds, rounds, minutes, etc)
			Time Increment Modifier (-8 to +8, I guess)
		Has a few checkboxes for options
			Advantage (3d6, pick highest), disadvantage (2d6 pick lowest)
		Has a 'Roll' button that rolls based on the above
		Has a 'Copy Macro' button that creates a roll macro based on the above. (Pseudocode like: "Average Admin roll 2d6+@Admin+@StrMod+@Modifier+@TimeIncrementModifier, takes 1d6*TimeIncrement")
		Has a 'Take Damage' button that pops up a dialog with a way to enter a number, and an OK button. Applies damage to data.Current
		Has a 'Heal Damage' button with +/- button next to each attribute. Can't heal above UCF value for attribute.

The system has settings for:
	Mod for attribute 0, defaults to -2
	Modifier for each Time Increment, defaults to 1
	

### Patch Notes:
See CHANGELOG.md


### Licenses
Project Licensing:
*  All HTML, CSS, Typescript and Javascript in this project is licensed under the Apache License v2.

Content Usage and Licensing:
*  Game system information and mechanics are licensed under the Open Game License, see OpenGameLicense.md for details.

Virtual Table Top Platform Licenses:
*  Foundry VTT support is covered by the following license: [Limited License Agreement for module development 09/02/2020](https://foundryvtt.com/article/license/).

### Contributing
See CONTRIBUTING.md
