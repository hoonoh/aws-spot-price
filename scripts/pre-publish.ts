// cleanup package.json

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const packageJsonPath = resolve(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath).toString());
writeFileSync(
  packageJsonPath,
  JSON.stringify(
    {
      ...packageJson,
      scripts: undefined,
      dependencies: undefined,
      devDependencies: undefined,
    },
    null,
    2,
  ),
);
