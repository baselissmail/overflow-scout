// @ts-check
import js from '@eslint/js';
import { fixupPluginRules } from '@eslint/compat';
import eslintReact from '@eslint-react/eslint-plugin';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architecture layers (docs/REFACTOR_PLAN.md §2.4). Each layer may import only
 * from the layers listed in its policy; everything else is an error.
 */
const LAYERS = [
  { type: 'core', pattern: 'src/core' },
  { type: 'messaging', pattern: 'src/messaging' },
  { type: 'storage', pattern: 'src/storage' },
  { type: 'runtime', pattern: 'src/runtime' },
  { type: 'ui', pattern: 'src/ui' },
  { type: 'features', pattern: 'src/features' },
  { type: 'entrypoints', pattern: 'src/entrypoints' },
];

/** @param {string} from @param {string[]} to */
const allow = (from, to) => ({
  from: { element: { type: from } },
  allow: { to: { element: { types: [from, ...to] } } },
});

export default defineConfig(
  globalIgnores([
    '.output/',
    '.wxt/',
    'coverage/',
    'playwright-report/',
    'test-results/',
    'stats.html',
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // Security: never turn untrusted strings into HTML (plan §6.3).
  noUnsanitized.configs.recommended,

  // React side panel.
  {
    files: ['src/**/*.tsx'],
    extends: [eslintReact.configs['strict-type-checked'], reactHooks.configs.flat.recommended],
    rules: {
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
    },
  },
  {
    files: ['src/**/*.tsx'],
    ...jsxA11y.flatConfigs.strict,
    // jsx-a11y predates ESLint 10; the official compat shim adapts its rules.
    plugins: { 'jsx-a11y': fixupPluginRules(jsxA11y) },
  },

  // Architecture boundaries.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': LAYERS,
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            allow('core', []),
            allow('messaging', ['core']),
            allow('storage', ['core']),
            allow('runtime', ['core', 'messaging']),
            allow('ui', ['core']),
            allow('features', ['ui', 'core', 'messaging', 'storage']),
            allow('entrypoints', ['features', 'ui', 'core', 'messaging', 'storage', 'runtime']),
          ],
        },
      ],
    },
  },

  // `core` is environment-free: no extension APIs, no UI framework (plan §2.4).
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-globals': ['error', 'chrome', 'browser'],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'wxt',
                'wxt/*',
                '#imports',
                '#i18n',
                'react',
                'react/*',
                'react-dom',
                'react-dom/*',
              ],
              message: 'core must stay free of extension and UI APIs; inject them from the caller.',
            },
          ],
        },
      ],
    },
  },

  // Tests and tooling.
  {
    files: ['**/*.test.{ts,tsx}', 'tests/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Suites print metrics (precision/recall, timings) on purpose.
      'no-console': 'off',
    },
  },

  // Formatting is Prettier's job; this must stay last.
  prettier,
);
