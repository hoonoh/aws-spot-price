module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: ['default'],
  collectCoverageFrom: ['src/**/*.ts'],
  globals: {
    'ts-jest': {
      tsConfig: './tsconfig.jest.json',
    },
  },
  setupFilesAfterEnv: ['jest-extended'],
  snapshotResolver: './test/snapshot-resolver.js',
};
