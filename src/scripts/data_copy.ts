import fse from 'fs-extra';
import simpleGit, {SimpleGit} from 'simple-git';

async function main() {
  const git: SimpleGit = simpleGit();
  const tagString = (await git.tags()).latest;
  const branchString = (await git.branch()).current;
  const dateString = (new Date()).toISOString().replaceAll(":", "_");

  const srcDir = JSON.parse(fse.readFileSync('foundryconfig.json').toString()).dataPath + "/Data/worlds/twodsix_dev";
  const destDir = `sample_data/local/${branchString}_${tagString}_${dateString}`;
  fse.copySync(srcDir, destDir, {overwrite: true});
  console.log(`success! copied to ${destDir}`);
}

main();
