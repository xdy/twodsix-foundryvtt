import {green, red} from 'yoctocolors';
import fs from 'fs-extra';
import semver from 'semver';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';

const argv = yargs(hideBin(process.argv)).argv;
const sourceDirectory = './src';

function getDownloadURL(version) {
  return `https://host/path/to/${version}.zip`;
}

function getManifest() {
  const manifestPath = `${sourceDirectory}/system.json`;
  if (fs.existsSync(manifestPath)) {
    return {
      file: fs.readJSONSync(manifestPath),
      name: 'system.json',
    };
  }
}

function getTargetVersion(currentVersion, release) {
  if (['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'].includes(release)) {
    return semver.inc(currentVersion, release);
  } else {
    return semver.valid(release);
  }
}

async function bumpVersion() {
  const packageJson = fs.readJSONSync('package.json');
  const manifest = getManifest();

  if (!manifest) {
    throw new Error('Manifest JSON not found');
  }

  const release = argv.release || argv.r;
  const currentVersion = packageJson.version;

  if (!release) {
    throw new Error('Missing release type');
  }

  const targetVersion = getTargetVersion(currentVersion, release);

  if (!targetVersion) {
    throw new Error('Error: Incorrect version arguments');
  }

  if (targetVersion === currentVersion) {
    throw new Error('Error: Target version is identical to current version');
  }

  console.log(`Updating version number to '${targetVersion}'`);

  packageJson.version = targetVersion;
  fs.writeJSONSync('package.json', packageJson, {spaces: 2});

  if (fs.existsSync('package-lock.json')) {
    const packageLockJson = fs.readJSONSync('package-lock.json');
    packageLockJson.version = targetVersion;
    fs.writeJSONSync('package-lock.json', packageLockJson, {spaces: 2});
  }

  manifest.file.version = targetVersion;
  manifest.file.download = getDownloadURL(targetVersion);
  fs.writeJSONSync(`${sourceDirectory}/${manifest.name}`, manifest.file, {spaces: 2});

  console.log(green('Version bumped successfully'));
}

bumpVersion().catch(err => {
  console.error(red(err.message));
  process.exit(1);
});
