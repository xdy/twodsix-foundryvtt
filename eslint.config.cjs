// ESLint Flat Config (ESLint v9+)
// Migrated ignores from .eslintignore and legacy rules via FlatCompat

// Note: Requires devDependencies: @eslint/eslintrc and @eslint/js
// Run: pnpm add -D @eslint/eslintrc @eslint/js

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FlatCompat } = require('@eslint/eslintrc');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const js = require('@eslint/js');

// FlatCompat v3+ (with ESLint v9) requires passing base configs
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = [
  // Files/paths to ignore (replaces .eslintignore)
  {
    ignores: [
      // IDE
      '.idea/',
      '.vs/',
      '*.iml',
      '/.vscode',
      'icons/!dox/',
      '/node_modules/',
      '.DS_Store',
      '**.env',
      'npm-debug.log',
      // Folders
      'coverage/',
      'debug/',
      'docs/',
      'node_modules/',
      'dist/',
      // Project-specific
      'foundryconfig.json',
      'foundry.js',
      '*.json',
      'client.mjs',
      // Foundry symlinks
      'foundry/**/*',
    ],
  },

  // Convert legacy .eslintrc.yml settings using FlatCompat to keep behavior
  ...compat.config({
    env: {
      jquery: true,
      browser: true,
      es2020: true,
    },
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'eslint-config-prettier',
      'plugin:prettier/recommended',
      '@typhonjs-fvtt/eslint-config-foundry.js',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      // Must be an absolute path for ESLint v9 + @typescript-eslint
      tsconfigRootDir: __dirname,
    },
    plugins: ['prettier', '@typescript-eslint'],
    rules: {
      // Fvtt support
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': [
        'error',
        { builtinGlobals: true, hoist: 'all', allow: ['event'] },
      ],
      // The following rule should be turned on later
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off',

      // Personal preferences
      'prettier/prettier': 'error',
      semi: 'warn',
      curly: 'warn',
      'brace-style': 1,
      indent: ['warn', 2, { SwitchCase: 1 }],
      'no-trailing-spaces': ['error'],
      'eol-last': ['error', 'always'],
      'key-spacing': ['error'],
      '@typescript-eslint/ban-ts-comment': ['warn'],
    },
  }),
];
