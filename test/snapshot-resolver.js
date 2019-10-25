const { sep } = require('path');

module.exports = {
  resolveSnapshotPath: (testPath, snapshotExtension) =>
    testPath.replace(`src${sep}`, `test${sep}__snapshots__${sep}`) + snapshotExtension,
  resolveTestPath: (snapshotFilePath, snapshotExtension) =>
    snapshotFilePath
      .replace(`test${sep}__snapshots__${sep}`, `src${sep}`)
      .slice(0, -snapshotExtension.length),
  testPathForConsistencyCheck: `src${sep}lib${sep}lib.spec.ts`,
};
