import { writeFileSync } from 'fs';
import { resolve } from 'path';
import prettier from 'prettier';

import { defaultRegions } from '../src/constants/regions';
import { getEc2Info } from '../src/lib/core';

(async () => {
  const res = (
    await Promise.all(defaultRegions.map(async region => getEc2Info({ region, log: true })))
  ).reduce((rtn, cur) => ({ ...rtn, ...cur }), {} as { vCpu?: number; memoryGiB?: number });
  const sorted = Object.fromEntries(Object.entries(res).sort(([a], [b]) => -(a < b)));
  console.log(`found ${Object.keys(sorted).length} instance types`);

  let output =
    `import { _InstanceType } from '@aws-sdk/client-ec2';\n\n` +
    `export type Ec2InstanceInfo = { vCpu?: number; memoryGiB?: number };\n\n`;
  output += `export const ec2Info: Record<_InstanceType | string, Ec2InstanceInfo> = ${JSON.stringify(
    sorted,
  )};`;
  output = prettier.format(output, {
    printWidth: 100,
    trailingComma: 'all',
    singleQuote: true,
    parser: 'typescript',
  });

  const targetPath = resolve(__dirname, '../src/constants/ec2-info.ts');
  writeFileSync(targetPath, output);
})();
