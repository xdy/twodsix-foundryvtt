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

## Contributing translations

To help translate an existing language, or to add support for a new language, do one of the following:

* Use our [gitlocalize](https://gitlocalize.com/repo/7105) to translate the project into your language. [See their instructions](https://docs.gitlocalize.com/how_to_contribute.html) or for a new language, ask for it to be added on the discord so you can translate it on gitlocalize.
* Post a completed translation file for your language on the [Discord](https://discord.gg/7GFVvVRQDZ) and ask us to add it to the system (e.g. by copying `en.json` to `xx.json` (replacing `xx` with the language code of the language you want to translate to), and translating only the text to the right of the colon for each line)
* If you are comfortable with Github, after translating, instead of just sending the file, make a Pull Request, making sure to also add your system to "languages" in `system.json` before you do the Pull Request (see below for instructions).

Or, if you prefer to do it as a separate module, make sure to mention it on the discord so we can link to it!

## Setting up for development

In order to develop for twodsix, you need to the following:

- A forked local copy of the [twodsix-foundryvtt] repository
- Node.js and npm installed
- Foundry VTT installed
- A Foundry VTT software license

You can purchase a Foundry VTT license on the [Foundry VTT purchase page].

### twodsix-foundryvtt repository

Fork the [twodsix-foundryvtt] repository in GitHub and clone your fork to your working directory.

### Node.js

If you don't already have it installed, you can download and install Node.js from the [Node.js download page]. You will need to install npm as well.

### Foundry VTT

You probably already have Foundry VTT installed on your system, but if you don't, you can install it by following the [Foundry VTT installation guide].

Even if you have the Foundry VTT app installed, you might want to consider installing the Node.js version. This will isolate your twodsix development environment from your main Foundry installation. See the section on [using the Node.js version of Foundry VTT](#using-the-nodejs-version-of-foundry-vtt) for instructions on doing this.

### Setting up your environment

With the above dependencies installed, you need to setup yor environment for development.

1. Symlink the twodsix `dist` directory into Foundry VTT's user data path
1. Build the twodsix system
1. Launch Foundry VTT and create a world for testing

#### Symlink the `dist` directory

A symlink (or "symbolic link") is a special file that acts as a pointer to another file. Creating a symbolic link to the twodsix `dist` directory inside Foundry's data path makes it look like the twodsix system is installed as far as Foundry is concerned. It means you can iterate on development quickly—all you need to do after making changes is re-build twodsix and reload Foundry.

On macOS and Linux you create a symbolic link using the `ln` command.

```shell
cd /path-to/your-twodsix-foundryvtt-working-copy
ln -s "$(pwd)/dist" "/Users/your-username/Library/Application Support/FoundryVTT/Data/systems/twodsix"
```

On Windows you use `mklink`.

```shell
mklink /d C:\Users\your-username\AppData\Local\FoundryVTT\Data\systems\twodsix C:\path-to\your-twodsix-foundryvtt-working-copy\dist
```

#### Build the twodsix system

Building the twodsix system is very easy. The following command will package the system into the `dist`.

```shell
cd /path-to/your-twodsix-foundryvtt-working-copy
npm install
npm build
```

Each time you make a change to the source files, you will need to rebuild twodsix and reload Foundry. You can automate the rebuild step using this instead.

```shell
cd /path-to/your-twodsix-foundryvtt-working-copy
npm install
npm build:watch
```

This will continuously monitor the twodsix source files and rebuild the system when it detects a change.

#### Launch Foundry VTT and create a world

With all the above set up you can launch the Foundry app. If this is your first time running the app it will ask you enter your license key and sign an agreement. Once you've done all that, click on "Create World" and fill out the title and select "Twodsix - Cepheus & Traveller (Unofficial)" as the game system. Click on the "Create World" button when you're done.

From here you can launch the world and start developing.

### Using the Node.js version of Foundry VTT

If you're already using the Node.js version of Foundry VTT and you're happy using it for development with it, you probably don't need to read any further. Just follow the instructions above and adjust the symlink instructions to match your Foundry VTT directory.

However, if you want to keep your twodsix development environment isolated from your main Foundry installation (or any other Foundry installation you have), then read on.

Note that the current version of twodsix-foundryvtt will not work on Foundry versions lower than 13.

The instruction below assume you are using macOS or Linux. If you are on Windows, you should be able to figure out the equivalent commands without too much trouble.

#### Download Foundry VTT

The first thing you need to do is download the Node.js version of Foundry. Sign into the [Foundry VTT website] and click on the download button near the top right of the page. Once there, select the version you want (must be 13.xxx or higher) and select "Node.js" as the operating system. Then click on the "Download" button. This will download a ZIP file named something like `Foundry-Node-13.zip`, which you should unzip.

Copy or move the unzipped Foundry folder into the `foundry` directory in your twodsix-foundryvtt project directory. You can leave the Foundry VTT directory name as-is, but I prefer to rename it to something like `foundry-app-13` or `foundry-vtt-13`. It's entirely up to you, but be aware that if you rename it to something radically different, it won't be covered by our `.gitignore` files and you might end up accidentally committing the directory to Git.

#### Create a data directory

Once you've done that, you need to create a data directory in the `foundry` directory and symlink the `dist` file into it.

```shell
cd /path-to/your-twodsix-foundryvtt-working-copy
mkdir -p foundry/foundry-data-13/Data/systems
ln -s "$(pwd)/dist" "$(pwd)/foundry/foundry-data-13/Data/systems/twodsix"
```

As with the app directory, you can name the data directory whatever you want but be aware that it may not be covered by `.gitignore` and you may end up committing it to Git if you're not careful.

#### Launch Foundry VTT

You can now launch Foundry VTT using the following command. As with the app it will ask you to enter your license key and sign an agreement. You will only need to do this the first time you launch. If you are on macOS, see the [note for macOS users](#note-for-macos-users) below about how to work around a system security hiccup you will run into.

```shell
cd /path-to/your-twodsix-foundryvtt-working-copy
node foundry/FoundryVTT-Node-13/main.js --dataPath="$(pwd)/foundry/foundry-data-13" --adminPassword=foundry --hotReload
```

Now visit https://127.0.0.1:30000 and create a game world for testing.

Note that specifying the password is not really necessary from a security viewpoint, but if you ever need to go to the setup page from them game world, it will insist on a password, even if you didn't set one.

Once you've created a game world, you can launch straight into that world by specifying the world's ID on the command line using the `--world` option. The world's ID is just a lower case version of the world's title with spaces replaced by hyphens. So if you titled your world "My 2d6 Dev World" its ID would be "my-2d6-dev-world".

```shell
cd /path-to/your-twodsix-foundryvtt-working-copy
node foundry/FoundryVTT-Node-13/main.js --dataPath="$(pwd)/foundry/foundry-data-13" --adminPassword=foundry --hotReload --world=my-2d6-dev-world
```

##### Note for macOS users

When launching the Node.js version of Foundry VTT for the first time on macOS you will probably get a system dialog saying that it is refusing to open *classic-level.node*. Just click on "Done" (you may need to do this a couple of times), then open up the system settings and go to the **Privacy & Security** section. Scroll down to the bottom of the page and you will see a message along the lines of *"classic-level.node" was blocked to protect your Mac.*. Click on the "Allow Anyway" button and relaunch Foundry. You will get another dialog, but it will have an "Allow Anyway" option. Click on that and you should be good to go.

## Coding conventions

In order to keep to sane coding standards - aka the ones I prefer :) - please use eslint with the included settings whether directly supported in your IDE, or run manually on the command line before you make your Pull Request. (See https://www.robertcooper.me/using-eslint-and-prettier-in-a-typescript-project/ for a description of eslint)

* You may also need a plugin/integration to support eslint. See https://eslint.org/docs/user-guide/integrations for where to find that  for your editor/IDE. (Though, you can of course run eslint manually before committing if you prefer.)
* Depending on your editor/IDE you may have to install a plugin/integration for .editorconfig to be supported. See https://editorconfig.org/ for details and where to find that for your editor/IDE. (It is more important that you use eslint, but if your editor only supports .editorconfig at least indenting etc will use the right setting.)

## When it's time to do your Pull Request

* Ensure that you sync your fork with the upstream repository before commencing work.
* Name the Pull Request beginning with WIP until you think it is in a good shape to be merged.
* Make sure eslint (`npm run lint`) has been run with no complaints on your code.
* Squash any merge commits and other cruft. Aim for one commit per feature or issue that your Pull Request tackles.
* If any of the checks on the Pull Request fails, try to fix them, or ask for help if you can't figure out what's wrong.
* When you're done, note in the Pull Request and/or on the Discord that there is a Pull Request that you consider ready to be merged, and remove the WIP from the beginning of the Pull Request name.
* If your Pull Request completes an issue, include a line like 'Fixes #nnn' in the description, replacing nnn with the actual issue number.

<!-- links -->

[Foundry VTT purchase page]:      https://foundryvtt.com/purchase
[Foundry VTT installation guide]: https://foundryvtt.com/article/installation
[twodsix-foundryvtt]:             https://github.com/xdy/twodsix-foundryvtt
[Node.js download page]:          https://nodejs.org/en/download
[Foundry VTT website]:            https://foundryvtt.com
