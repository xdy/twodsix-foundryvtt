const commonjs = require("@rollup/plugin-commonjs");

const {nodeResolve} = require('@rollup/plugin-node-resolve');
const esbuild = require('rollup-plugin-esbuild');
const dynamicImportVars = require('@rollup/plugin-dynamic-import-vars');
const fs = require("fs");
const glob = require("glob");
const plugins = [
  nodeResolve(),
  commonjs(),
  esbuild.default({
    include: /\.[jt]sx?$/, // TODO Might have to include d.ts here
    sourceMap: true,
    keepNames: true,
    minify: process.env.NODE_ENV === 'production'
  }),
  dynamicImportVars.default({}),
];

module.exports = function() {
  const migrations = JSON.stringify(fs.readdirSync("src/migrations").filter(name => name.slice(0, 1) !== "." ).map(name => name.slice(0, -3)));
  const hooks = JSON.stringify(fs.readdirSync('src/module/hooks').filter(name => name.slice(0, 1) !== "." ).map(name => name.slice(0, -3)));
  const templates = JSON.stringify(glob.sync('static/templates/**/*.hbs').filter(name => name.slice(0, 1) !== "." ).map(file => file.replace("static", "systems/twodsix")));

  return {
    input: 'src/twodsix.ts',
    output: {
      file: 'dist/twodsix.bundle.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true,
      intro: `const migrationFileNames = ${migrations};\nconst handlebarsTemplateFiles = ${templates};\nconst hookScriptFiles = ${hooks};`
    },
    plugins: plugins,
    strictDeprecation: true
  };
}
