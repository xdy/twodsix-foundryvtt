## How to contribute to twodsix

Make an issue if you have ideas or have found bugs, or a pull request if you have code or documentation.

**Working on your first Pull Request?** You can learn how from this *free* series [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github)


## How to develop under MacOS
1. Fork project in github
1. Clone project to your local working directory
1. Symlink dist directory to your Foundry data directory. For me this was  `ln -s /Users/shammond/Projects/FoundryVTT/twodsix-foundryvtt/dist "/Users/shammond/Library/Application Support/FoundryVTT/Data/systems/twodsix"`
1. `npm install`
1. `npm run build:dev`
