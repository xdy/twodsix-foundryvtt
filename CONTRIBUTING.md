## Before getting started

Thank you for being interested in contributing to this entirely volunteer-driven project!
You will be paid in none or more of:
* Honor
* Glory
* Power
* Fame
* Riches
* Attribution in [CONTRIBUTORS.md](CONTRIBUTORS.md)

## How to contribute to twodsix

Make an issue if you have ideas or have found bugs, or a pull request if you have code or documentation.

If you see an already existing issue you would like to tackle, ask about it on the [Discord](https://discord.gg/7GFVvVRQDZ) first.

Likewise, if you need further guidance, try the [Discord](https://discord.gg/7GFVvVRQDZ).

Do note we have a [code of conduct](CODE_OF_CONDUCT.md), please follow it in all your interactions with the project. (TL/DR: [Be excellent to each other!](https://www.youtube.com/watch?v=rph_1DODXDU))

Also note that all contributions must adhere to the licenses mentioned in the [README](README.md) and not otherwise break any relevant (or irrelevant) law...

## To contribute translations
To help translate an existing language, or to add support for a new language, do one of the following:
* Use our [gitlocalize](https://gitlocalize.com/repo/7105) to translate the project into your language. [See their instructions](https://docs.gitlocalize.com/how_to_contribute.html) or for a new language, ask for it to be added on the discord so you can translate it on gitlocalize.
* Post a completed translation file for your language on the [Discord](https://discord.gg/7GFVvVRQDZ) and ask us to add it to the system (e.g. by copying en.json to xx.json (replacing xx with the language code of the language you want to translate to), and translating only the text to the right of the colon for each line)
* If you are comfortable with Github, after translating, instead of just sending the file, make a Pull Request, making sure to also add your system to "languages" in system.json before you do the Pull Request. (See below for instructions).

Or, if you prefer to do it as a separate module, make sure to mention it on the discord so we can link to it!

## How to set up for development
1. Fork project in github
1. Clone project to your local working directory
1. Do one of the following:
    1. Copy the file foundryconfig.example.json to foundryconfig.json and edit the new file to point to the appropriate directory.
        1. Windows example of foundryconfig.json contents:
        ```
        {
        "dataPath": "C:\\Users\\jk\\AppData\\Local\\FoundryVTT",
        "systemName": "twodsix"
        }
       ```
        1. Mac/unix example of foundryconfig.json contents:
        ```
        {
        "dataPath": "/Users/shammond/Library/Application Support/FoundryVTT",
        "systemName": "twodsix"
        }
        ```
    1. Symlink dist directory to your Foundry data directory.
        1. Mac/unix example:
        ```
        ln -s /Users/shammond/Projects/FoundryVTT/twodsix-foundryvtt/dist "/Users/shammond/Library/Application Support/FoundryVTT/Data/systems/twodsix"
        ```
        1. Windows example (add /h to mklink to get a hard link rather than a soft link):
        ```
        mklink /d C:\Users\jk\AppData\Local\FoundryVTT\Data\systems\twodsix C:\Users\jk\foundryvtt\twodsix\dist
        ```
    1. Patrik's development setup
        1. Download the node version of foundry vtt and place it in a folder called `foundry/foundryvtt` in your project root
        1. Copy the file foundryconfig.example.json to foundryconfig.json and edit the dataPath property to point to `foundry/foundry_dev_data` in your project root (use the full absolute path).
        1. Run `npm install`
        1. Run `npm run data:reset` which will build the project and populate a development world with sample data
        1. Run `npm run server` and go to `http://localhost:30000`. It will ask you for your license details, so please fill those in. Default password is `foundry` and will be reset each time you use the reset command
        1. Run `npm run data:license` to make the license part of the reset template so that it can be reused next time you reset the world
        1. Whenever you want to reset the world kill the server and run `npm run data:reset` (you can provide a directory with a world as an argument to recreate a certain world). To make a copy of the current world (which can also be restored using the  `npm run data:reset` command) run `npm run data:copy` which by default will create a new folder in the `sample_data/local` directory. `sample_data/local` is in the `.gitignore` so it will be ignore, but directories in `sample_data` are not and meant for sharing.
1. Do the following each time you have updated your fork and want to test your code:
    1. Builds the prerequisites
       `npm install`
    1. Runs the system in 'developer mode', watching for changes in the code as they happen
       `npm run build:dev`

## Coding conventions

In order to keep to sane coding standards - aka the ones I prefer :) - please use eslint with the included settings whether directly supported in your IDE, or run manually on the command line before you make your Pull Request. (See https://www.robertcooper.me/using-eslint-and-prettier-in-a-typescript-project/ for a description of eslint)
* You may also need a plugin/integration to support eslint. See https://eslint.org/docs/user-guide/integrations for where to find that  for your editor/IDE. (Though, you can of course run eslint manually before committing if you prefer.)
* Depending on your editor/IDE you may have to install a plugin/integration for .editorconfig to be supported. See https://editorconfig.org/ for details and where to find that for your editor/IDE. (It is more important that you use eslint, but if your editor only supports .editorconfig at least indenting etc will use the right setting.)

## When it's time to do your Pull Request
* Name the Pull Request beginning with WIP until you think it is in a good shape to be merged.
* Make sure eslint has been run with no complaints on your code.
* Squash any merge commits and other cruft. Aim for one commit per feature or issue that your Pull Request tackles.
* If any of the checks on the Pull Request fails, try to fix them, or ask for help if you can't figure out what's wrong.
* When you're done, note in the Pull Request and/or on the Discord that there is a Pull Request that you consider ready to be merged, and remove the WIP from the beginning of the Pull Request name.
* If your Pull Request completes an issue, include a line like 'Fixes #nnn' in the description, replacing nnn with the actual issue number.
