## [0.2.10](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.9...v0.2.10) (2020-08-05)


### Bug Fixes

* Fixed cut and paste that broke psi modifier. ([0454664](https://github.com/xdy/twodsix-foundryvtt/commit/045466470ba2031ff097b3c307b85ea7d2b5edc8))

## [0.2.9](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.8...v0.2.9) (2020-08-05)


### Bug Fixes

* Added Kevin's CSS/Template changes ([554b4c3](https://github.com/xdy/twodsix-foundryvtt/commit/554b4c3ab70517c212f42264d432182825456a1f))

## [0.2.8](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.7...v0.2.8) (2020-08-04)


### Bug Fixes

* Forgot psi damage. ([58ef6a9](https://github.com/xdy/twodsix-foundryvtt/commit/58ef6a9241df6775a03ae1f5427d416332bb1235))
* Replace some sample data with data from template. Still doesn't work. ([3d1d0da](https://github.com/xdy/twodsix-foundryvtt/commit/3d1d0da8976f1a5a93d74dbf7e8a50ef2eea5e9f))

## [0.2.7](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.6...v0.2.7) (2020-08-04)


### Bug Fixes

* Make the release script executable at the new location... ([64bc0e7](https://github.com/xdy/twodsix-foundryvtt/commit/64bc0e727fb1f6db1177cb2afb86f0770df9ed67))
* Working on adding css and graphics from Kevin. ([41719bb](https://github.com/xdy/twodsix-foundryvtt/commit/41719bbfb1c090799eea0fce8c3478460f284368))

## [0.2.6](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.5...v0.2.6) (2020-07-26)


### Bug Fixes

* Show actor skills, not data items in skills list. Not sure this is the way I want to go, need to read up on the data model. ([f44fe27](https://github.com/xdy/twodsix-foundryvtt/commit/f44fe27832ef631cabd6a5975737c8aa942266a1))

## [0.2.5](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.4...v0.2.5) (2020-07-25)


### Bug Fixes

* Made characterstics editable, calculate current value and mod as damage (and value, which really should be locked for edit by default) change. Added dropdown for skill level (still called value, should probably change that.) ([5a6c54d](https://github.com/xdy/twodsix-foundryvtt/commit/5a6c54d03f17fd256c6e62873b539446dd62e831))

## [0.2.4](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.3...v0.2.4) (2020-07-22)


### Bug Fixes

* Skill rolls now support difficulty and 'roll type' (e.g. advantage/disadvantage, 3d6kh2/3d6kl2) ([c25ccee](https://github.com/xdy/twodsix-foundryvtt/commit/c25ccee7c8c99a6c4e503267abc1f2734edb58c5))

## [0.2.3](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.2...v0.2.3) (2020-07-21)


### Bug Fixes

* Skills can now be rolled, with the selected characteristic's modifier. Not pretty, but it works. ([1a27f1b](https://github.com/xdy/twodsix-foundryvtt/commit/1a27f1b7eb2b90b80c86cb597b5b740451110a03))

## [0.2.2](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.1...v0.2.2) (2020-07-21)


### Bug Fixes

* Fixed drag and drop of skills, had broken it while messing around with _onDrop earlier, commented that out for now, wasn't anywhere near complete anyway. ([34858ad](https://github.com/xdy/twodsix-foundryvtt/commit/34858ad3af41035cbb071fea9804eb54be690c23))

## [0.2.1](https://github.com/xdy/twodsix-foundryvtt/compare/v0.2.0...v0.2.1) (2020-07-20)


### Bug Fixes

* Cleaning up, working on skills, fixing messed up template ([f236f44](https://github.com/xdy/twodsix-foundryvtt/commit/f236f44bf83a154fbf26bbb0660f83bc97bf4035))

# [0.2.0](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.16...v0.2.0) (2020-07-19)


### Features

* Another new (old) direction, this time with some help incoming. ([6e5f7af](https://github.com/xdy/twodsix-foundryvtt/commit/6e5f7af539346095f1af03da60ce5eba6e00fafd))

## [0.1.16](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.15...v0.1.16) (2020-07-10)


### Bug Fixes

* Most things show up on the sheet, but it turns out radios are real wonky in foundry right now. ([df6fdb8](https://github.com/xdy/twodsix-foundryvtt/commit/df6fdb8afcaa92a85303e46dfc145be5fc88ebd7))
* Removing unused stuff as I'm heading in a new direction. ([01af0e8](https://github.com/xdy/twodsix-foundryvtt/commit/01af0e889935e9c95976edc21fc3ceb3ba228065))
* Updated ts-loader, removed bogus tsconfig.json setting. ([c809312](https://github.com/xdy/twodsix-foundryvtt/commit/c809312dc1df76aa6f9db7c2d7d163836f17e747))

## [0.1.15](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.14...v0.1.15) (2020-07-05)


### Bug Fixes

* CE and it's predecessor uses different modifier for characteristic value of 0, use CE modifier for now, make into an option later. ([269e383](https://github.com/xdy/twodsix-foundryvtt/commit/269e38380af7925662cd5c0a533ccf210fc9f68f))

## [0.1.14](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.13...v0.1.14) (2020-07-05)


### Bug Fixes

* Exception on empty skill list. Wrong names for new tabs. ([e243fe6](https://github.com/xdy/twodsix-foundryvtt/commit/e243fe635c76b99734d185abfc7afc0613e28087))

## [0.1.13](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.12...v0.1.13) (2020-07-04)


### Bug Fixes

* Characteristics and mods visible. Ugly, but visible. ([94ffd9c](https://github.com/xdy/twodsix-foundryvtt/commit/94ffd9cfc42e974b35ede8d7b594c28131903c7c))
* turn off bars as I don't know what to show in them anyway. ([507786e](https://github.com/xdy/twodsix-foundryvtt/commit/507786e1c30b07c07c2e3aa619d1727f3802ba5c))

## [0.1.12](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.11...v0.1.12) (2020-07-02)


### Bug Fixes

* Fix one problem, cause another. ([8670bc6](https://github.com/xdy/twodsix-foundryvtt/commit/8670bc62d9f63e74f2b1b65ecd51773d7904ea5f))

## [0.1.11](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.10...v0.1.11) (2020-07-02)


### Bug Fixes

* Another bad path fixed, commented out code that doesn't work. ([c4e2140](https://github.com/xdy/twodsix-foundryvtt/commit/c4e21406d179d6c669f46c9390be57f2ef73f0f4))

## [0.1.10](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.9...v0.1.10) (2020-07-02)


### Bug Fixes

* Sheet and style fixes ([f5bdb4f](https://github.com/xdy/twodsix-foundryvtt/commit/f5bdb4f5395efe685aba254f4a4b8e3352c4f5b2))
* Sheet fixes ([61508be](https://github.com/xdy/twodsix-foundryvtt/commit/61508be52e9bddc8692be9cea9da3711c8e8c11c))
* Sheet fixes ([57ba2df](https://github.com/xdy/twodsix-foundryvtt/commit/57ba2df2a5d25a2b428b668dd6f6fe2f13a40be9))

## [0.1.9](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.8...v0.1.9) (2020-07-02)


### Bug Fixes

* wrong sheet name ([3db1fff](https://github.com/xdy/twodsix-foundryvtt/commit/3db1fff0cac2f4677bd974d4ad54ca9900b7aa8f))

## [0.1.8](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.7...v0.1.8) (2020-07-02)


### Bug Fixes

* reformat and fix some sheet warnings ([75f21a7](https://github.com/xdy/twodsix-foundryvtt/commit/75f21a7a7d32594ec0aaf02ba21b25d4e4ab58e6))

## [0.1.7](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.6...v0.1.7) (2020-07-02)


### Bug Fixes

* No idea where npm got typescript 3.9.6 from, but it's not officially released, so reverting. ([a925a9e](https://github.com/xdy/twodsix-foundryvtt/commit/a925a9e4387a08af8306dfc9135a7d8fc6bd2868))
* Working on template.json and actor.ts. ([ff825be](https://github.com/xdy/twodsix-foundryvtt/commit/ff825be6f3bad291948440cb06b82a6d2c523cc2))

## [0.1.6](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.5...v0.1.6) (2020-07-01)


### Bug Fixes

* git update-index --chmod=+x release.sh ([1c61a1f](https://github.com/xdy/twodsix-foundryvtt/commit/1c61a1f3eab6483bcb11525055c30e4d6a590b56))
* Stupid is as stupid does... ([ea99099](https://github.com/xdy/twodsix-foundryvtt/commit/ea99099843ea02f6bd18f027c4bdf250ea96523b))

## [0.1.5](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.4...v0.1.5) (2020-07-01)


### Bug Fixes

* Hopefully fixed the zip file problems ([27c469c](https://github.com/xdy/twodsix-foundryvtt/commit/27c469c7dd6417aa1409e3de116ff66cc317e8e2))

## [0.1.4](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.3...v0.1.4) (2020-07-01)


### Bug Fixes

* Assorted cleanup, added text to licenses and README.md. Filled out template.json a bit. ([b67eb48](https://github.com/xdy/twodsix-foundryvtt/commit/b67eb48ded5d3888f305ad47a16839a8ea3f2470))
* Hacked the package-lock.json so that the low severity vulnerability found by npm audit goes away. ([0cb6271](https://github.com/xdy/twodsix-foundryvtt/commit/0cb62717ad711e2d3dd3ad0e37c273a461d2a567))
* Make release ignore if zip is not updated. ([b4cbec5](https://github.com/xdy/twodsix-foundryvtt/commit/b4cbec5967a6563ed1d7bac9835a4c0461c73be7))
* Remove todo workflow I was playing around with. ([a800ea5](https://github.com/xdy/twodsix-foundryvtt/commit/a800ea59b54932c09eb58e6691ac691d03df437d))
* scss > styles ([0ca6bfe](https://github.com/xdy/twodsix-foundryvtt/commit/0ca6bfeb8c98e533702990bef62d8c0589dd84da))

## [0.1.3](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.2...v0.1.3) (2020-06-29)


### Bug Fixes

* Cleaning up dependencies a bit. ([c850a58](https://github.com/xdy/twodsix-foundryvtt/commit/c850a58d7b64c3f3a7241a001727710dab307340))

## [0.1.2](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.1...v0.1.2) (2020-06-29)


### Bug Fixes

* Well, you could update. Albeit not to the latest version. Kind of. Maybe this ugly hack will make it possible? ([a8c29d4](https://github.com/xdy/twodsix-foundryvtt/commit/a8c29d49b731895dccb779f5ea5f3aed110da30d))
* Welp, that broke the build, so: ([cf23010](https://github.com/xdy/twodsix-foundryvtt/commit/cf230107740b8ff92f822356f54faf0a17299e69))

## [0.1.1](https://github.com/xdy/twodsix-foundryvtt/compare/v0.1.0...v0.1.1) (2020-06-29)


### Bug Fixes

* Now you can even *update* the system. ([2ef4fda](https://github.com/xdy/twodsix-foundryvtt/commit/2ef4fdac29a44cda281e0065f096b48bd85e56fa))

# [0.1.0](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.12...v0.1.0) (2020-06-29)


### Features

* The automatic releases work, and the system is installable. Useless, but installable. ([00fd256](https://github.com/xdy/twodsix-foundryvtt/commit/00fd2565f4a38ff87e01caa40ee36dd2cff90fd7))

## [0.0.12](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.11...v0.0.12) (2020-06-29)


### Bug Fixes

* npm install after I've updated the package.json file. ([daddd47](https://github.com/xdy/twodsix-foundryvtt/commit/daddd475a5934c0a803d78ecf96e7de072046eab))

## [0.0.11](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.10...v0.0.11) (2020-06-29)


### Bug Fixes

* Use default configuration for @semantic-release/git to make sure all changed files are committed. Separate install and build steps again. ([ca20c47](https://github.com/xdy/twodsix-foundryvtt/commit/ca20c47a06dc0bb91ca3747ad6b0a80227134567))

## [0.0.10](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.9...v0.0.10) (2020-06-29)


### Bug Fixes

* actions/checkout@v2 defaults to not checkout submodules... ([929701c](https://github.com/xdy/twodsix-foundryvtt/commit/929701c4fd34c7b23dfc339867367650c17db7ea))
* Actually do build in the release, not just install... ([1d9aa4b](https://github.com/xdy/twodsix-foundryvtt/commit/1d9aa4bc3415fe6a2c98716c8ba9915cf10b8f28))
* Just flailing around, really. ([c5d325a](https://github.com/xdy/twodsix-foundryvtt/commit/c5d325a44ceec38ddfc70a25b12f0a479525a834))
* npm install rather than ci, fix paths, and commit package-lock.json ([fb51042](https://github.com/xdy/twodsix-foundryvtt/commit/fb5104256420f096216eecd0aea73aa0bfa18a2e))
* Trying npm install and npm run build in same step ([2a14a0a](https://github.com/xdy/twodsix-foundryvtt/commit/2a14a0adc36a01e0b067f1e4164ac44e8e673411))
* Use submodules in both steps that checkout... ([889d6c2](https://github.com/xdy/twodsix-foundryvtt/commit/889d6c2f4c48fd56f63d8c11707b6ba3a3f120e3))

## [0.0.9](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.8...v0.0.9) (2020-06-29)


### Bug Fixes

* Now to get the zip file into the release, with a better name. ([44b9a5d](https://github.com/xdy/twodsix-foundryvtt/commit/44b9a5d7db394fb589a079e8a6327e731f65ad32))

## [0.0.8](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.7...v0.0.8) (2020-06-29)


### Bug Fixes

* Sigh. If this doesn't work I guess I'll have to read the documentation... ([349bea9](https://github.com/xdy/twodsix-foundryvtt/commit/349bea91a16f1cc2daf27187aae595df2da6a491))

## [0.0.7](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.6...v0.0.7) (2020-06-29)


### Bug Fixes

* Fix even more release problems. ([a8a3407](https://github.com/xdy/twodsix-foundryvtt/commit/a8a3407ec26244b0023de8b595b0472b945e3646))

## [0.0.6](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.5...v0.0.6) (2020-06-29)


### Bug Fixes

* Fix yet another release problem. ([76ff822](https://github.com/xdy/twodsix-foundryvtt/commit/76ff82294e92c5c910368d92eb4ddfa441ccf0e0))

## [0.0.5](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.4...v0.0.5) (2020-06-29)


### Bug Fixes

* Assorted hacking to make it work less bad ([36ff159](https://github.com/xdy/twodsix-foundryvtt/commit/36ff159547e65ef776371d6d3bf86c0de77ff005))
* Fix another release problem. ([7e2ca4c](https://github.com/xdy/twodsix-foundryvtt/commit/7e2ca4c11996ee33a64a9561ddb9073cedf0f453))
* Fix one release problem ([86db09f](https://github.com/xdy/twodsix-foundryvtt/commit/86db09fbc1f61db0e14f062f448c6449e7cf33ad))

## [0.0.4](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.3...v0.0.4) (2020-06-28)


### Bug Fixes

* revert changes from when playing around with sheets. ([ff7f5ae](https://github.com/xdy/twodsix-foundryvtt/commit/ff7f5aea92236c85b243576b11450bb433f51c34))

## [0.0.3](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.2...v0.0.3) (2020-06-28)


### Bug Fixes

* Another attempt at fixing package.json and system.json ([9c76efb](https://github.com/xdy/twodsix-foundryvtt/commit/9c76efbc42f24aef43efa57a2fb90fc550319361))

## [0.0.2](https://github.com/xdy/twodsix-foundryvtt/compare/v0.0.1...v0.0.2) (2020-06-28)


### Bug Fixes

* Set myself as author ([0a30375](https://github.com/xdy/twodsix-foundryvtt/commit/0a303759def22f137fbd9b464f0fb4a146b314b4))

# Patch Notes:
## Version 0.0.1
### New Features
* (@xdy) Initial version of, well, everything. Or, more accurately, nothing yet.

### Content Changes
* (@xdy) Inital version of, well, everything. Or, more accurately, nothing yet.

### Bug Fixes
* (@xdy) None so far...

### Core System Improvements
* (@xdy) Inital version of, well, everything. Or, more accurately, nothing yet.
