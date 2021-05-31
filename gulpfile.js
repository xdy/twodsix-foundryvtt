// eslint-disable-next-line @typescript-eslint/no-var-requires
const {rollup} = require('rollup');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const argv = require('yargs').argv;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const chalk = require('chalk');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs-extra');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const gulp = require('gulp');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rollupConfig = require('./rollup.config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const semver = require('semver');

/********************/
/*  CONFIGURATION   */
/********************/

// eslint-disable-next-line @typescript-eslint/no-shadow
const name = "twodsix"
const sourceDirectory = './src';
const staticDirectory = './static';
const distDirectory = './dist';
const stylesDirectory = `${staticDirectory}/styles`;
const stylesExtension = 'css';
const sourceFileExtension = 'ts';
const staticFiles = ['assets', 'fonts', 'lang', 'packs', 'templates', 'system.json', 'template.json'];
const getDownloadURL = (version) => `https://host/path/to/${version}.zip`;

/********************/
/*      BUILD       */

/********************/

/**
 * Build the distributable JavaScript code
 */
async function buildCode() {
  const build = await rollup({input: rollupConfig.input, plugins: rollupConfig.plugins});
  return build.write(rollupConfig.output);
}

/**
 * Build style sheets
 */
function buildStyles() {
  return gulp.src(`${stylesDirectory}/${name}.${stylesExtension}`).pipe(gulp.dest(`${distDirectory}/styles`));
}

/**
 * Copy static files
 */
async function copyStaticFiles() {
  for (const file of staticFiles) {
    console.log(`${staticDirectory}/${file}` + " to " + `${distDirectory}/${file}`)
    if (fs.existsSync(`${staticDirectory}/${file}`)) {
      await fs.copy(`${staticDirectory}/${file}`, `${distDirectory}/${file}`);
    }
  }
}

/**
 * Watch for changes for each build step
 */
function buildWatch() {
  gulp.watch(`${sourceDirectory}/**/*.${sourceFileExtension}`, {ignoreInitial: false}, buildCode);
  gulp.watch(`${stylesDirectory}/**/*.${stylesExtension}`, {ignoreInitial: false}, buildStyles);
  gulp.watch(
    staticFiles.map((file) => `${staticDirectory}/${file}`),
    {ignoreInitial: false},
    copyStaticFiles,
  );
}

/********************/
/*      CLEAN       */

/********************/

/**
 * Remove built files from `dist` folder while ignoring source files
 */
async function clean() {
  const files = [...staticFiles, 'module'];

  if (fs.existsSync(`${stylesDirectory}/${name}.${stylesExtension}`)) {
    files.push('styles');
  }

  console.log(' ', chalk.yellow('Files to clean:'));
  console.log('   ', chalk.blueBright(files.join('\n    ')));

  for (const filePath of files) {
    await fs.remove(`${distDirectory}/${filePath}`);
  }
}

/********************/
/*       LINK       */

/********************/

/**
 * Get the data path of Foundry VTT based on what is configured in `foundryconfig.json`
 */
function getDataPath() {
  const config = fs.readJSONSync('foundryconfig.json');

  if (config?.dataPath) {
    if (!fs.existsSync(path.resolve(config.dataPath))) {
      throw new Error('User Data path invalid, no Data directory found');
    }

    return path.resolve(config.dataPath);
  } else {
    throw new Error('No User Data path defined in foundryconfig.json');
  }
}

/**
 * Link build to User Data folder
 */
async function linkUserData() {
  let destinationDirectory;
  if (fs.existsSync(path.resolve(staticDirectory, 'system.json'))) {
    destinationDirectory = 'systems';
  } else {
    throw new Error(`Could not find ${chalk.blueBright('system.json')}`);
  }

  const linkDirectory = path.resolve(getDataPath(), destinationDirectory, name);
  console.log(linkDirectory)

  if (argv.clean || argv.c) {
    console.log(chalk.yellow(`Removing build in ${chalk.blueBright(linkDirectory)}.`));

    await fs.remove(linkDirectory);
  } else if (!fs.existsSync(linkDirectory)) {
    console.log(chalk.green(`Linking dist to ${chalk.blueBright(linkDirectory)}.`));
    await fs.ensureDir(path.resolve(linkDirectory, '..'));
    await fs.symlink(path.resolve(distDirectory), linkDirectory);
  }
}

/********************/
/*    VERSIONING    */

/********************/

/**
 * Get the contents of the manifest file as object.
 */
function getManifest() {
  const manifestPath = `${sourceDirectory}/system.json`;

  if (fs.existsSync(manifestPath)) {
    return {
      file: fs.readJSONSync(manifestPath),
      name: 'system.json',
    };
  }
}

/**
 * Get the target version based on on the current version and the argument passed as release.
 */
function getTargetVersion(currentVersion, release) {
  if (['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'].includes(release)) {
    return semver.inc(currentVersion, release);
  } else {
    return semver.valid(release);
  }
}

/**
 * Update version and download URL.
 */
function bumpVersion(cb) {
  const packageJson = fs.readJSONSync('package.json');
  const packageLockJson = fs.existsSync('package-lock.json') ? fs.readJSONSync('package-lock.json') : undefined;
  const manifest = getManifest();

  if (!manifest) {
    cb(Error(chalk.red('Manifest JSON not found')));
  }

  try {
    const release = argv.release || argv.r;

    const currentVersion = packageJson.version;

    if (!release) {
      return cb(Error('Missing release type'));
    }

    const targetVersion = getTargetVersion(currentVersion, release);

    if (!targetVersion) {
      return cb(new Error(chalk.red('Error: Incorrect version arguments')));
    }

    if (targetVersion === currentVersion) {
      return cb(new Error(chalk.red('Error: Target version is identical to current version')));
    }

    console.log(`Updating version number to '${targetVersion}'`);

    packageJson.version = targetVersion;
    fs.writeJSONSync('package.json', packageJson, {spaces: 2});

    if (packageLockJson) {
      packageLockJson.version = targetVersion;
      fs.writeJSONSync('package-lock.json', packageLockJson, {spaces: 2});
    }

    manifest.file.version = targetVersion;
    manifest.file.download = getDownloadURL(targetVersion);
    fs.writeJSONSync(`${sourceDirectory}/${manifest.name}`, manifest.file, {spaces: 2});

    return cb();
  } catch (err) {
    cb(err);
  }
}

const execBuild = gulp.parallel(buildCode, buildStyles, copyStaticFiles);

exports.build = gulp.series(clean, execBuild);
exports.watch = buildWatch;
exports.clean = clean;
exports.link = linkUserData;
exports.bumpVersion = bumpVersion;
