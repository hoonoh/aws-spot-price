const path = require('path');

module.exports = {
  env: {
    es6: true,
    node: true,
  },
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts'],
    },
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  extends: [
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'no-console': 0,
    'import/prefer-default-export': 0,
    'no-param-reassign': 0,
    'prettier/prettier': 'error',
  },
  overrides: [
    {
      files: ['test/*.js'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/no-var-requires': 0,
      },
    },
    {
      files: ['**/*.spec.ts', 'test/jest.setup.js', 'test/**/*.ts'],
      env: {
        'jest/globals': true,
      },
      plugins: ['jest'],
    },
    {
      files: ['**/*.spec.ts', 'util/**/*.ts', 'test/**/*.ts'],
      rules: {
        'import/no-extraneous-dependencies': 0,
        '@typescript-eslint/ban-ts-ignore': 0,
        'no-underscore-dangle': 0,
      },
    },
  ],
};
