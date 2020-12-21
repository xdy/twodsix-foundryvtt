## How to contribute to twodsix

Make an issue if you have ideas or have found bugs, or a pull request if you have code or documentation.

**Working on your first Pull Request?** You can learn how from this *free* series [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github)

## To contribute translations
Either send in a completed translation file for your language (e.g. by copying en.json to xx.json), or do as per below, making sure to also add your system to "languages" in system.json

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
        1. Mac/unix example: `ln -s /Users/shammond/Projects/FoundryVTT/twodsix-foundryvtt/dist "/Users/shammond/Library/Application Support/FoundryVTT/Data/systems/twodsix"`
        1. Windows example: `mklink /d C:\Users\jk\foundryvtt\twodsix\dist C:\Users\jk\AppData\Local\FoundryVTT\Data\systems\twodsix`
1. Do the following each time you have updated your fork and want to test your code:
    1. Builds the prerequisites
       `npm install`
    1. Runs the system in 'developer mode', watching for changes in the code as they happen
       `npm run build:dev`


* Depending on your editor/IDE you may have to install a plugin/integration for editconfig to be supported (the builds will complain if you don't format the code according to the rules set up there). See https://editorconfig.org/ for details and where to find that for your editor/IDE.

* You may also need a plugin/integration to support eslint, for pretty much the same reasons. See https://eslint.org/docs/user-guide/integrations for where to find that  for your editor/IDE. (Though, you can of course run eslint manually before committing if you prefer.)
