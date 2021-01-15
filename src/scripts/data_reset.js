const fse = require('fs-extra');
var readline = require('readline');

const args = process.argv.slice(2);
let force = false;
if (args.indexOf("-f") !== -1) {
  force = true;
  args.splice(args.indexOf("-f"), 1);
}

var rl = readline.createInterface(process.stdin, process.stdout);
const tmpDataPath = JSON.parse(fse.readFileSync('foundryconfig.json')).dataPath;
const dataPath = tmpDataPath.substring(0, tmpDataPath.lastIndexOf('/'));
const srcDir = args.length ? args[0] : "sample_data/default";

function copy() {
  const destDir = dataPath + "/foundry_dev_data";
  const templateDir = dataPath + "/foundry_template";
  const licensePath = dataPath + "/license.json";

  fse.rmdirSync(destDir, {recursive : true});
  fse.copySync(templateDir, destDir, {overwrite : true});
  fse.copySync(srcDir, destDir + "/Data/worlds/twodsix_dev",
               {overwrite : true});
  fse.copySync("dist", destDir + "/Data/systems/twodsix", {overwrite : true});
  if (fse.existsSync(licensePath)) {
    fse.copySync(licensePath, destDir + "/Config/license.json",
                 {overwrite : true});
  }
  process.exit(0);
}

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
