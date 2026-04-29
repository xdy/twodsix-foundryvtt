import fs from 'fs-extra';
import path from 'path';

const configFile = 'foundryconfig.json';

function readFoundryConfig() {
  if (!fs.existsSync(configFile)) {
    throw new Error(`Could not find ${configFile}`);
  }

  return fs.readJSONSync(configFile);
}

function isDirectory(directoryPath) {
  return fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory();
}

function looksLikeDataDirectory(directoryPath) {
  return isDirectory(directoryPath) && (
    path.basename(directoryPath) === 'Data' ||
    ['modules', 'systems', 'worlds'].some(entry => isDirectory(path.join(directoryPath, entry)))
  );
}

export function getFoundryPaths({warnOnLegacyParent = false} = {}) {
  const config = readFoundryConfig();

  if (!config?.dataPath) {
    throw new Error(`No User Data path defined in ${configFile}`);
  }

  const configuredPath = path.resolve(config.dataPath);
  if (!isDirectory(configuredPath)) {
    throw new Error(`User Data path invalid: ${configuredPath} does not exist`);
  }

  if (looksLikeDataDirectory(configuredPath)) {
    return {
      config,
      dataDir: configuredPath,
      dataRoot: path.dirname(configuredPath),
    };
  }

  const nestedDataDir = path.join(configuredPath, 'Data');
  if (looksLikeDataDirectory(nestedDataDir)) {
    if (warnOnLegacyParent) {
      console.warn(
        `Warning: foundryconfig.json dataPath should point to ${nestedDataDir}. ` +
        `Using that directory for compatibility.`
      );
    }

    return {
      config,
      dataDir: nestedDataDir,
      dataRoot: configuredPath,
    };
  }

  throw new Error(
    `User Data path invalid: ${configuredPath} is not a Foundry data directory and does not contain a Data directory`
  );
}
