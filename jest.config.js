module.exports = {
  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript' } }, sourceMaps: 'inline' },
    ],
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*.ts'],
  snapshotResolver: './test/snapshot-resolver.js',
  setupFilesAfterEnv: ['./test/jest.setup.js'],
};
