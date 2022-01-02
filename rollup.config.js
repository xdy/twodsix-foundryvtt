const commonjs = require("@rollup/plugin-commonjs");

const {nodeResolve} = require('@rollup/plugin-node-resolve');
const esbuild = require('rollup-plugin-esbuild');

module.exports = {
  input: 'src/twodsix.ts',
  output: {
    file: 'dist/twodsix.bundle.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    esbuild.default({
      include: /\.[jt]sx?$/, // TODO Might have to include d.ts here
      sourceMap: true,
      minify: process.env.NODE_ENV === 'production',
    }),
  ],
};
