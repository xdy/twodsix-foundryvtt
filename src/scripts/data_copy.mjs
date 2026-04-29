#!/usr/bin/env node

import fse from 'fs-extra';
import simpleGit from 'simple-git';
import path from 'path';
import {getFoundryPaths} from '../../scripts/foundry-paths.mjs';

async function main() {
  const git = simpleGit();
  const tagString = (await git.tags()).latest;
  const branchString = (await git.branch()).current;
  const dateString = (new Date()).toISOString().replaceAll(":", "_");

  const {dataDir} = getFoundryPaths({warnOnLegacyParent: true});
  const srcDir = path.join(dataDir, 'worlds', 'twodsix_dev');
  const destDir = `sample_data/local/${branchString}_${tagString}_${dateString}`;
  fse.copySync(srcDir, destDir, {overwrite: true});
  console.log(`success! copied to ${destDir}`);
}

main();
