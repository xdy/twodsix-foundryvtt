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

If you see an already existing issue you would like to tackle, ask about it on the [Discord](https://discord.gg/VNFUvjv) first.

Likewise, if you need further guidance, try the [Discord](https://discord.gg/VNFUvjv).

Do note we have a [code of conduct](CODE_OF_CONDUCT.md), please follow it in all your interactions with the project. (TL/DR: [Be excellent to each other!](https://www.youtube.com/watch?v=rph_1DODXDU))

## To contribute translations
Either post a completed translation file for your language on the [Discord](https://discord.gg/VNFUvjv) (e.g. by copying en.json to xx.json (replacing xx with the language code of the language you want to translate to), and translating only the text to the right of the colon for each line), or if you are comfortable with it, after translating, instead of sending the file, make a Pull Request, making sure to also add your system to "languages" in system.json before you do the Pull Request. (See below for instructions).

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
        1. TODO: Mac/unix example not verified to work:
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
        mklink /d C:\Users\jk\foundryvtt\twodsix\dist C:\Users\jk\AppData\Local\FoundryVTT\Data\systems\twodsix
        ```
1. Do the following each time you have updated your fork and want to test your code:
    1. Builds the prerequisites
       `npm install`
    1. Runs the system in 'developer mode', watching for changes in the code as they happen
       `npm run build:dev`

## Coding conventions

In order to keep to sane coding standards - aka the ones I prefer :), please use eslint with the included settings either directly supported in your IDE, or at least run eslint before you make your Pull Request. (See https://www.robertcooper.me/using-eslint-and-prettier-in-a-typescript-project/ for a description of eslint)
* You may also need a plugin/integration to support eslint. See https://eslint.org/docs/user-guide/integrations for where to find that  for your editor/IDE. (Though, you can of course run eslint manually before committing if you prefer.)
* Depending on your editor/IDE you may have to install a plugin/integration for .editorconfig to be supported. See https://editorconfig.org/ for details and where to find that for your editor/IDE. (It is more important that you use eslint, but if your editor only supports .editorconfig at least indenting etc will use the right setting.)

## When it's time to do your Pull Request
* Name the Pull Request beginning with WIP until you think it is in a good shape to be merged.
* Make sure eslint has been run with no complaints on your code.
* Squash any merge commits and other cruft. Aim for one commit per feature or issue that your Pull Request tackles.
* If any of the checks on the Pull Request fails, try to fix them, or ask for help if you can't figure out what's wrong.
* When you're done, note in the Pull Request and/or on the Discord that there is a Pull Request that you consider ready to be merged, and remove the WIP from the beginning of the Pull Request name.
* If your Pull Request completes an issue, include a line like 'Fixes #nnn' in the description, replacing nnn with the actual issue number.
