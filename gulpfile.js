
import { rollup } from 'rollup';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import fs from 'fs-extra';
import gulp from 'gulp';
import path from 'path';
import rollupConfig from './rollup.config.js';
import semver from 'semver';
import { spawn } from 'child_process';

const argv = yargs(hideBin(process.argv)).argv;

/********************/
/*  CONFIGURATION   */
/********************/

const systemName = "twodsix";
// Used to match all style files for this system (e.g., twodsix.css, twodsix-dark.css)
const stylesBaseName = 'twodsix*';
const sourceDirectory = './src';
const staticDirectory = './static';
const templateDirectory = `${staticDirectory}/templates`;
const distDirectory = './dist';
const stylesDirectory = `${staticDirectory}/styles`;
const stylesExtension = 'css';
const sourceFileExtension = 'ts';
const templateFileExtension = 'html';
const staticFiles = ['assets', 'fonts', 'lang', 'templates', 'system.json', 'template.json'];
const buildFiles = [
  `${sourceDirectory}/**/*.${sourceFileExtension}`,
  `${templateDirectory}/**/*.${templateFileExtension}`
];
const getDownloadURL = (version) => `https://host/path/to/${version}.zip`;

/********************/
/*      BUILD       */
/********************/

/**
 * Build the distributable JavaScript code
 */
let buildStatus = {
  js: { success: false, files: 0 },
  styles: { success: false, files: 0 },
  static: { success: false, files: 0 },
  packs: { success: false, packs: 0 },
  errors: [],
  warnings: []
};

async function buildCode() {
  try {
    const config = rollupConfig();
    const rollupBuild = await rollup({input: config.input, plugins: config.plugins});
    await rollupBuild.write(config.output);
    // Count JS files in dist (specifically twodsix.bundle.js)
    let jsFiles = 0;
    if (fs.existsSync(`${distDirectory}/twodsix.bundle.js`)) {
      jsFiles = 1;
    }
    buildStatus.js.success = true;
    buildStatus.js.files = jsFiles;
    console.log(chalk.green('✅ JavaScript build completed successfully'));
  } catch (err) {
    buildStatus.js.success = false;
    buildStatus.errors.push('JavaScript build failed');
    console.error(chalk.red('❌ JavaScript build failed:'), err);
    throw err;
  }
}

/**
 * Build style sheets
 */
function buildStyles() {
  try {
    return gulp
      .src(`${stylesDirectory}/${stylesBaseName}.${stylesExtension}`)
      .pipe(gulp.dest(`${distDirectory}/styles`))
      .on('end', async () => {
        // Count CSS files in dist/styles
        let cssFiles = 0;
        if (fs.existsSync(`${distDirectory}/styles`)) {
          cssFiles = (await fs.readdir(`${distDirectory}/styles`)).filter(f => f.endsWith('.css')).length;
        }
        buildStatus.styles.success = true;
        buildStatus.styles.files = cssFiles;
        console.log(chalk.green('✅ Styles build completed successfully'));
      })
      .on('error', (err) => {
        buildStatus.styles.success = false;
        buildStatus.errors.push('Styles build failed');
        console.error(chalk.red('❌ Styles build failed:'), err);
        throw err;
      });
  } catch (err) {
    buildStatus.styles.success = false;
    buildStatus.errors.push('Styles build failed (sync)');
    console.error(chalk.red('❌ Styles build failed (sync):'), err);
    throw err;
  }
}

/**
 * Build packs from JSON source files
 */
async function buildPacks() {
  console.log(chalk.yellow('Building packs from JSON source files...'));

  return new Promise((resolve, reject) => {
    const buildProcess = spawn('npm', ['run', 'packs:build'], {
      stdio: 'inherit',
      shell: true
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ Pack building completed successfully'));
        resolve();
      } else {
        console.error(chalk.red('❌ Pack building failed with code:', code));
        reject(new Error(`Pack building failed with code ${code}`));
      }
    });

    buildProcess.on('error', (err) => {
      console.error(chalk.red('❌ Failed to start pack building process:', err));
      reject(err);
    });
  });
}

/**
 * Copy static files
 */
async function copyStaticFiles() {
  try {
    let staticCount = 0;
    for (const file of staticFiles) {
      console.log(`${staticDirectory}/${file}` + " to " + `${distDirectory}/${file}`);
      if (fs.existsSync(`${staticDirectory}/${file}`)) {
        await fs.copy(`${staticDirectory}/${file}`, `${distDirectory}/${file}`);
        staticCount++;
      }
    }
    buildStatus.static.success = true;
    buildStatus.static.files = staticCount;
    console.log(chalk.green('✅ Static files copied successfully'));
  } catch (err) {
    buildStatus.static.success = false;
    buildStatus.errors.push('Copying static files failed');
    console.error(chalk.red('❌ Copying static files failed:'), err);
    throw err;
  }
}

/**
 * Copy built packs to dist
 */
async function copyPacks() {
  try {
    const packsSource = `${staticDirectory}/packs`;
    const packsTarget = `${distDirectory}/packs`;

    if (fs.existsSync(packsSource)) {
      console.log(chalk.blue(`Copying built packs from ${packsSource} to ${packsTarget}`));
      await fs.copy(packsSource, packsTarget);
      // Count packs
      const packDirs = await fs.readdir(packsSource);
      buildStatus.packs.success = true;
      buildStatus.packs.packs = packDirs.length;
      console.log(chalk.green('✅ Packs copied successfully'));
    } else {
      buildStatus.packs.success = false;
      buildStatus.warnings.push(`No built packs found at ${packsSource}`);
      console.log(chalk.yellow(`Warning: No built packs found at ${packsSource}`));
    }
  } catch (err) {
    buildStatus.packs.success = false;
    buildStatus.errors.push('Copying packs failed');
    console.error(chalk.red('❌ Copying packs failed:'), err);
    throw err;
  }
}

/**
 * Watch for changes for each build step
 */
function buildWatch() {
  gulp.watch(buildFiles, {ignoreInitial: false}, buildCode);
  gulp.watch(`${stylesDirectory}/**/*.${stylesExtension}`, {ignoreInitial: false}, buildStyles);
  gulp.watch(
    staticFiles.map((file) => `${staticDirectory}/${file}`),
    {ignoreInitial: false},
    copyStaticFiles,
  );
  // Watch for changes in pack source files and rebuild packs
  gulp.watch('packs-src/**/*.json', {ignoreInitial: false}, gulp.series(buildPacks, copyPacks));
}

/********************/
/*      CLEAN       */
/********************/

/**
 * Remove all built files from `dist` folder for a clean build
 */
async function clean() {
  try {
    if (fs.existsSync(distDirectory)) {
      await fs.emptyDir(distDirectory);
      console.log(chalk.yellow(`Emptied ${distDirectory}`));
    }
  } catch (err) {
    buildStatus.errors.push('Clean task failed');
    console.error(chalk.red('❌ Clean task failed:'), err);
    throw err;
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
    // Always append '/Data' to the configured dataPath
    const dataDir = path.resolve(config.dataPath, 'Data');
    if (!fs.existsSync(dataDir)) {
      throw new Error('User Data path invalid, no Data directory found');
    }
    return dataDir;
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

  const linkDirectory = path.resolve(getDataPath(), destinationDirectory, systemName);
  console.log(linkDirectory);

  // Always remove the existing directory or symlink before creating the new symlink
  if (fs.existsSync(linkDirectory)) {
    console.log(chalk.yellow(`Removing existing build or link at ${chalk.blueBright(linkDirectory)}.`));
    await fs.remove(linkDirectory);
  }
  console.log(chalk.green(`Linking dist to ${chalk.blueBright(linkDirectory)}.`));
  await fs.ensureDir(path.resolve(linkDirectory, '..'));
  // Use 'junction' on Windows to avoid admin/Developer Mode requirements for directory symlinks
  const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
  await fs.symlink(path.resolve(distDirectory), linkDirectory, symlinkType);
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


async function buildSummary() {
  // Wait a moment for all async .on('end') events
  await new Promise(res => setTimeout(res, 200));
  console.log(chalk.cyan('\n==================== Build Summary ===================='));
  console.log(`${buildStatus.js.success ? chalk.green('✅') : chalk.red('❌')} JavaScript build: ${buildStatus.js.success ? 'Success' : 'Failed'} (${buildStatus.js.files} files)`);
  console.log(`${buildStatus.styles.success ? chalk.green('✅') : chalk.red('❌')} Styles build: ${buildStatus.styles.success ? 'Success' : 'Failed'} (${buildStatus.styles.files} files)`);
  console.log(`${buildStatus.static.success ? chalk.green('✅') : chalk.red('❌')} Static files copied: ${buildStatus.static.success ? 'Success' : 'Failed'} (${buildStatus.static.files} folders/files)`);
  console.log(`${buildStatus.packs.success ? chalk.green('✅') : chalk.red('❌')} Packs built/copied: ${buildStatus.packs.success ? 'Success' : 'Failed'} (${buildStatus.packs.packs} packs)`);
  if (buildStatus.errors.length > 0) {
    console.log(chalk.red('Errors:'));
    buildStatus.errors.forEach(e => console.log('  -', e));
  }
  if (buildStatus.warnings.length > 0) {
    console.log(chalk.yellow('Warnings:'));
    buildStatus.warnings.forEach(w => console.log('  -', w));
  }
  console.log(chalk.cyan('-------------------------------------------------------'));
  console.log(`📁 Output: ${chalk.blueBright(distDirectory)}`);
  console.log(`📁 Packs: ${chalk.blueBright(distDirectory + '/packs')}`);
  console.log(chalk.cyan('=======================================================\n'));
  if (buildStatus.errors.length === 0) {
    console.log(chalk.green('Next: You can now run `pnpm run link` to symlink to Foundry VTT.'));
  }
}

const execBuild = gulp.parallel(buildCode, buildStyles, copyStaticFiles);
const execBuildWithPacks = gulp.series(buildPacks, gulp.parallel(execBuild, copyPacks), buildSummary);

const build = gulp.series(clean, execBuildWithPacks);
export { build, buildPacks, buildWatch, clean, linkUserData as link, bumpVersion };
