import unusedImports from 'eslint-plugin-unused-imports';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import jest from 'eslint-plugin-jest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ['**/dist', '**/types', 'eslint.config.mjs'],
  },
  ...compat.extends('plugin:@typescript-eslint/recommended', 'prettier'),
  {
    plugins: {
      'unused-imports': unusedImports,
      '@typescript-eslint': typescriptEslint,
      prettier,
      'simple-import-sort': simpleImportSort,
    },

    languageOptions: {
      globals: {
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: 'module',

      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },

    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts'],
      },

      'import/resolver': {
        node: {
          extensions: ['.ts'],
        },
      },
    },

    rules: {
      'import/extensions': 0,
      'import/no-extraneous-dependencies': 0,
      'import/prefer-default-export': 0,
      'no-console': 0,
      'no-param-reassign': 0,
      'prettier/prettier': 'error',
      'simple-import-sort/imports': 2,
      'simple-import-sort/exports': 2,
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'unused-imports/no-unused-imports': 'error',

      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['test/*.js'],

    rules: {
      '@typescript-eslint/explicit-function-return-type': 0,
      '@typescript-eslint/no-var-requires': 0,
    },
  },
  {
    files: ['**/*.spec.ts', 'test/jest.setup.js', 'test/**/*.ts'],

    plugins: {
      jest,
    },

    languageOptions: {
      globals: {
        ...jest.environments.globals.globals,
      },
    },
  },
  {
    files: ['**/*.spec.ts', 'util/**/*.ts', 'test/**/*.ts'],

    rules: {
      'import/no-extraneous-dependencies': 0,
      '@typescript-eslint/ban-ts-ignore': 0,
      'no-underscore-dangle': 0,
    },
  },
];
