import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

import { getGlobalSpotPrices } from '../src/lib';

const targetPath = resolve(__dirname, '../src/ec2-types.ts');

const getEc2Types = async () => {
  const allInstances = (await getGlobalSpotPrices({ quiet: true })).reduce(
    (list, cur) => {
      if (cur.InstanceType && list.indexOf(cur.InstanceType) < 0) list.push(cur.InstanceType);
      return list;
    },
    [] as string[],
  );

  const instanceFamilies: string[] = [];
  const instanceSizes: string[] = [];

  allInstances.forEach(instanceType => {
    const [type, size] = instanceType.split('.');
    if (!type || !size || instanceType.split('.').length !== 2) {
      console.log('found some exceptions:', instanceType);
    }
    if (instanceFamilies.indexOf(type) < 0) instanceFamilies.push(type);
    if (instanceSizes.indexOf(size) < 0) instanceSizes.push(size);
  });

  // console.log(list);
  let output = '';
  output += `export const instanceFamilies = [ '${instanceFamilies
    .sort()
    .join("', '")}' ] as const;`;
  output += `export type InstanceFamily = typeof instanceFamilies[number];`;
  output += `export const instanceSizes = [ '${instanceSizes.sort().join("', '")}' ] as const;`;
  output += `export type InstanceSize = typeof instanceSizes[number];`;
  output += `export const allInstances = [ '${allInstances.sort().join("', '")}' ] as const;`;
  output += `export type InstanceType = typeof allInstances[number];`;

  writeFileSync(targetPath, output);

  await new Promise(res => {
    console.log('prettier starting...');
    const prettierPath = resolve(__dirname, '../node_modules/.bin/prettier');
    const prettierArgs = [targetPath, '--write'];
    const prettier = spawn(prettierPath, prettierArgs);
    prettier.on('close', () => {
      console.log('prettier complete');
      res();
    });
    prettier.stderr.on('data', (data: Buffer) => {
      console.log(data.toString());
    });
    prettier.stderr.on('data', (data: Buffer) => {
      console.log('prettier error', data.toString());
    });
  });
};

getEc2Types();
