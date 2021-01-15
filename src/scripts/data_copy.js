const fse = require('fs-extra');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function main() {

  const tagOutput = await exec('git describe --tags');
  const branchOutput = await exec('git branch --show-current');
  const dateString = (new Date()).toISOString().replaceAll(":", "_");

  const srcDir = JSON.parse(fse.readFileSync('foundryconfig.json')).dataPath +
                 "/Data/worlds/twodsix_dev";
  const destDir = `sample_data/local/${branchOutput["stdout"].trim()}_${
      tagOutput["stdout"].trim()}_${dateString}`;

  fse.copySync(srcDir, destDir, {overwrite : true});
  console.log(`success! copied to ${destDir}`);
}

main();
