import fs from 'fs-extra';
import path from 'path';
import {blueBright, green, red, yellow} from 'yoctocolors';

const systemName = "twodsix";
const distDirectory = './dist';
const staticDirectory = './static';

function getDataPath() {
  const config = fs.readJSONSync('foundryconfig.json');

  if (config?.dataPath) {
    const dataDir = path.resolve(config.dataPath);
    if (!fs.existsSync(dataDir)) {
      throw new Error(`User Data path invalid: ${dataDir} does not exist`);
    }
    return dataDir;
  } else {
    throw new Error('No User Data path defined in foundryconfig.json');
  }
}

async function linkUserData() {
  let destinationDirectory;
  if (fs.existsSync(path.resolve(staticDirectory, 'system.json'))) {
    destinationDirectory = 'systems';
  } else {
    throw new Error(`Could not find system.json in ${staticDirectory}`);
  }

  const linkDirectory = path.resolve(getDataPath(), destinationDirectory, systemName);
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
