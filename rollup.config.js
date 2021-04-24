const typescript = require('rollup-plugin-typescript2');
const {nodeResolve} = require('@rollup/plugin-node-resolve');

module.exports = {
  input: 'src/twodsix.ts',
  output: {
    file: 'dist/twodsix.bundle.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [nodeResolve(), typescript({})],
};
