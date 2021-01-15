import fse from 'fs-extra';
import readline from 'readline';

const args = process.argv.slice(2);
let force = false;
if (args.indexOf("-f") !== -1) {
  force = true;
  args.splice(args.indexOf("-f"), 1);
}

const rl = readline.createInterface(process.stdin, process.stdout);
const destDir = JSON.parse(fse.readFileSync('foundryconfig.json').toString()).dataPath;
const srcDir = args.length ? args[0] : "sample_data/default";
const templateDir = "foundry/foundry_template";
const templateLicensePath = "foundry/license.json";
const worldPath = destDir + "/Data/worlds/twodsix_dev";
const systemPath = destDir + "/Data/systems/twodsix";
const licenseFilePath = destDir + "/Config/license.json";

function copy():void {
  fse.rmdirSync(destDir, {recursive: true});
  fse.copySync(templateDir, destDir, {overwrite: true});
  fse.copySync(srcDir, worldPath, {overwrite: true});
  fse.copySync("dist", systemPath, {overwrite: true});
  if (fse.existsSync(templateLicensePath)) {
    fse.copySync(templateLicensePath, licenseFilePath, {overwrite: true});
  }
  process.exit(0);
}


async function main(): Promise<void> {
  if (fse.existsSync(srcDir)) {
    if (force) {
      copy();
    } else {
      rl.question(`Are you sure you want reset the world with ${srcDir}? N/y: `,
        function(answer) {
          if (answer === "y") {
            copy();
          } else {
            process.exit(1);
          }
        });
    }
  } else {
    console.log("Couldn't find source dir:", srcDir);
    process.exit(1);
  }
}

main();
