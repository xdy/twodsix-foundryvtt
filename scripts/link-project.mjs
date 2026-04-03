import fs from 'fs-extra';
import path from 'path';
import {blueBright, green, red, yellow} from 'yoctocolors';
import {getFoundryPaths} from './foundry-paths.mjs';

const systemName = "twodsix";
const distDirectory = './dist';
const staticDirectory = './static';

async function linkUserData() {
  let destinationDirectory;
  if (fs.existsSync(path.resolve(staticDirectory, 'system.json'))) {
    destinationDirectory = 'systems';
  } else {
    throw new Error(`Could not find system.json in ${staticDirectory}`);
  }

  const {dataDir} = getFoundryPaths({warnOnLegacyParent: true});
  const linkDirectory = path.resolve(dataDir, destinationDirectory, systemName);
  console.log(`Target link: ${linkDirectory}`);

  if (fs.existsSync(linkDirectory)) {
    console.log(yellow(`Removing existing build or link at ${blueBright(linkDirectory)}.`));
    await fs.remove(linkDirectory);
  }

  console.log(green(`Linking dist to ${blueBright(linkDirectory)}.`));
  await fs.ensureDir(path.resolve(linkDirectory, '..'));

  const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
  await fs.symlink(path.resolve(distDirectory), linkDirectory, symlinkType);
}

linkUserData().catch(err => {
  console.error(red(err.message));
  process.exit(1);
});
