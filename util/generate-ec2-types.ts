import { writeFileSync } from 'fs';
import { resolve } from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import * as prettier from 'prettier';

import { getGlobalSpotPrices } from '../src/lib';
import { defaultRegions } from '../src/regions';
import { nockEndpoint } from '../test/test-utils';

const familyGeneral = ['a', 't', 'm'];

const familyCompute = ['c'];

const familyMemory = ['r', 'x', 'z'];

const familyStorage = ['d', 'h', 'i'];

const familyAcceleratedComputing = ['f', 'g', 'p'];

const familyOrder = [
  ...familyGeneral,
  ...familyCompute,
  ...familyMemory,
  ...familyStorage,
  ...familyAcceleratedComputing,
];

const sizeOrder = [
  'nano',
  'micro',
  'small',
  'medium',
  'large',
  'xlarge',
  '2xlarge',
  '3xlarge',
  '4xlarge',
  '6xlarge',
  '8xlarge',
  '9xlarge',
  '10xlarge',
  '12xlarge',
  '16xlarge',
  '18xlarge',
  '24xlarge',
  '32xlarge',
  'metal',
];

const sortFamilies = (f1: string, f2: string) => {
  let rtn = 0;
  if (f1[0] === f2[0]) {
    if (f1 < f2) rtn = -1;
    if (f1 > f2) rtn = 1;
    return rtn;
  }
  const i1 = familyOrder.indexOf(f1[0]);
  const i2 = familyOrder.indexOf(f2[0]);
  if (i1 < 0) throw new Error(`unexpected instance family ${f1}`);
  if (i2 < 0) throw new Error(`unexpected instance family ${f2}`);
  if (i1 < i2) rtn = -1;
  if (i1 > i2) rtn = 1;
  return rtn;
};

const sortSizes = (s1: string, s2: string) => {
  let rtn = 0;
  const i1 = sizeOrder.indexOf(s1);
  const i2 = sizeOrder.indexOf(s2);
  if (i1 < 0) throw new Error(`unexpected instance size ${s1}`);
  if (i2 < 0) throw new Error(`unexpected instance size ${s2}`);
  if (i1 < i2) rtn = -1;
  if (i1 > i2) rtn = 1;
  return rtn;
};

const sortInstances = (i1: string, i2: string) => {
  let rtn = 0;
  const [f1, s1] = i1.split('.');
  const [f2, s2] = i2.split('.');
  let sc1 = sizeOrder.indexOf(s1);
  let sc2 = sizeOrder.indexOf(s2);
  if (f1[0] === f2[0]) {
    if (f1 < f2) sc1 -= 100;
    if (f1 > f2) sc1 += 100;
  } else {
    sc1 += familyOrder.indexOf(f1[0]) * 100;
    sc2 += familyOrder.indexOf(f2[0]) * 100;
  }
  if (sc1 < sc2) rtn = -1;
  if (sc1 > sc2) rtn = 1;
  return rtn;
};

export const getEc2Types = async () => {
  defaultRegions.forEach(region => nockEndpoint({ region })); // TEMP FOR TESTING

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

  let output = '';
  output += `export const instanceFamilies = [ '${instanceFamilies
    .sort(sortFamilies)
    .join("', '")}' ] as const;\n\n`;
  output += `export type InstanceFamily = typeof instanceFamilies[number];\n\n`;
  output += `export const instanceSizes = [ '${instanceSizes
    .sort(sortSizes)
    .join("', '")}' ] as const;\n\n`;
  output += `export type InstanceSize = typeof instanceSizes[number];\n\n`;
  output += `export const allInstances = [ '${allInstances
    .sort(sortInstances)
    .join("', '")}' ] as const;\n\n`;
  output += `export type InstanceType = typeof allInstances[number];`;

  output = prettier.format(output, {
    printWidth: 100,
    trailingComma: 'all',
    singleQuote: true,
    parser: 'typescript',
  });
  return output;
};

if (require.main && require.main.filename === module.filename) {
  (async () => {
    const targetPath = resolve(__dirname, '../src/ec2-types.ts');
    writeFileSync(targetPath, await getEc2Types());
  })();
}
