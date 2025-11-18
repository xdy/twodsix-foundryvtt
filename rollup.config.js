import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';
import dynamicImportVars from '@rollup/plugin-dynamic-import-vars';
import fs from "fs";
import * as glob from "glob";

const plugins = [
  nodeResolve(),
  commonjs(),
  esbuild({
    include: /\.[jt]sx?$/, // TODO Might have to include d.ts here
    sourceMap: true,
    keepNames: true,
    minify: process.env.NODE_ENV === 'production'
  }),
  dynamicImportVars({}),
];

export default function rollupConfig() {
  const migrations = JSON.stringify(fs.readdirSync("src/migrations").filter(nm => nm.slice(0, 1) !== "." ).map(nm => nm.slice(0, -3)));
  const hooks = JSON.stringify(fs.readdirSync('src/module/hooks').filter(nm => nm.slice(0, 1) !== "." ).map(nm => nm.slice(0, -3)));
  // Ensure forward slashes in template paths so Foundry can resolve them cross-platform
  const templates = JSON.stringify(
    glob
      .sync('static/templates/**/*.hbs')
      .filter(nm => nm.slice(0, 1) !== ".")
      .map(file => file.replace(/\\/g, "/"))
      .map(file => file.replace("static", "systems/twodsix"))
  );

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
