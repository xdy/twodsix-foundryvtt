// ESLint Flat Config (ESLint v10+)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const js = require('@eslint/js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const tsPlugin = require('@typescript-eslint/eslint-plugin');

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
      // Foundry symlinks
      'foundry/**/*',
    ],
  },

  js.configs.recommended,

  // TypeScript ESLint recommended (flat config format in v8+)
  ...tsPlugin.configs['flat/recommended'],

  // Project-specific config
  {
    rules: {
      // Fvtt support
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': [
        'error',
        { builtinGlobals: true, hoist: 'all', allow: ['event'] },
      ],
      // The following rules should be turned on later
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-undef': 'off',

      // Personal preferences
      semi: 'warn',
      curly: 'warn',
      'brace-style': 1,
      indent: ['warn', 2, { SwitchCase: 1 }],
      'no-trailing-spaces': ['error'],
      'eol-last': ['error', 'always'],
      'key-spacing': ['error'],
      '@typescript-eslint/ban-ts-comment': ['warn'],
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
    },
  },
];
