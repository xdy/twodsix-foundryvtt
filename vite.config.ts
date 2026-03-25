import {defineConfig} from 'vite';
import fs from 'fs';
import {glob} from 'glob';

export default defineConfig(({mode}) => {
  const isProduction = mode === 'production';

  // Ensure forward slashes in template paths so Foundry can resolve them cross-platform
  const templates = glob
    .sync('static/templates/**/*.hbs')
    .filter(nm => nm.slice(0, 1) !== ".")
    .map(file => file.replace(/\\/g, "/"))
    .map(file => file.replace("static", "systems/twodsix"));

  const migrations = fs.readdirSync("./src/migrations")
    .filter(nm => nm.slice(0, 1) !== ".")
    .map(nm => nm.slice(0, -3));

  const hooks = fs.readdirSync('./src/module/hooks')
    .filter(nm => nm.slice(0, 1) !== ".")
    .map(nm => nm.slice(0, -3));

  return {
    root: 'src',
    base: './',
    publicDir: '../static',
    define: {
      migrationFileNames: JSON.stringify(migrations),
      hookScriptFiles: JSON.stringify(hooks),
      handlebarsTemplateFiles: JSON.stringify(templates),
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      sourcemap: true,
      minify: isProduction,
      lib: {
        entry: 'twodsix.ts',
        formats: ['es'],
        fileName: () => 'twodsix.bundle.js',
      },
      rollupOptions: {
        output: {
          manualChunks: undefined,
          codeSplitting: false,
        },
      },
    },
    plugins: [],
    css: {
      devSourcemap: true,
    },
  };
});
