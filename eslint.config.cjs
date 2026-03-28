// ESLint Flat Config (ESLint v10+)
const js = require('@eslint/js');

module.exports = [
  // Ignore patterns MUST be first
  {
    ignores: [
      'node_modules/**',
      'foundry/**',
      'dist/**',
      'build/**',
      // IDE
      '.idea/',
      '.vs/',
      '*.iml',
      '/.vscode',
      'icons/!dox/',
      '.DS_Store',
      '**.env',
      'npm-debug.log',
      // Folders
      'node_modules/',
      'coverage/',
      'debug/',
      'docs/',
      'dist/',
      // Project-specific
      'foundryconfig.json',
      'foundry.js',
      '*.json',
      'client.mjs',
    ],
  },

  js.configs.recommended,

  // TypeScript-specific rules only for TS files
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    },
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
    },
    rules: {
      // Place your TypeScript rules here, e.g.:
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      // ...other TS rules...
    },
  },

  // Project-specific config
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // Fvtt support
      'no-shadow': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',

      // Personal preferences
      semi: 'warn',
      curly: 'warn',
      'brace-style': 1,
      indent: ['warn', 2, { SwitchCase: 1 }],
      'no-trailing-spaces': ['error'],
      'eol-last': ['error', 'always'],
      'key-spacing': ['error'],
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
    },
  },
];
