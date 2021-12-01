module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  snapshotResolver: './test/snapshot-resolver.js',
  setupFilesAfterEnv: ['./test/jest.setup.js'],
};
