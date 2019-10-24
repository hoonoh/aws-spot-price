import { writeFileSync } from 'fs';
import { resolve } from 'path';
import * as prettier from 'prettier';

import { getGlobalSpotPrices } from '../src/lib/lib';

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

const sortFamilies = (f1: string, f2: string): number => {
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

const sortSizes = (s1: string, s2: string): number => {
  let rtn = 0;
  const i1 = sizeOrder.indexOf(s1);
  const i2 = sizeOrder.indexOf(s2);
  if (i1 < 0) throw new Error(`unexpected instance size ${s1}`);
  if (i2 < 0) throw new Error(`unexpected instance size ${s2}`);
  if (i1 < i2) rtn = -1;
  if (i1 > i2) rtn = 1;
  return rtn;
};

const sortInstances = (i1: string, i2: string): number => {
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

const getEc2Types = async (): Promise<string> => {
  const allInstances = (await getGlobalSpotPrices({ silent: true })).reduce(
    (list, cur) => {
      if (cur.InstanceType && !list.includes(cur.InstanceType)) list.push(cur.InstanceType);
      return list;
    },
    [] as string[],
  );

  // const instanceFamilies: string[] = [];
  const instanceFamilyGeneral = new Set<string>();
  const instanceFamilyCompute = new Set<string>();
  const instanceFamilyMemory = new Set<string>();
  const instanceFamilyStorage = new Set<string>();
  const instanceFamilyAcceleratedComputing = new Set<string>();
  const instanceSizes = new Set<string>();

  allInstances.forEach(instanceType => {
    const [family, size] = instanceType.split('.');
    if (!family || !size || instanceType.split('.').length !== 2) {
      console.log('found some exceptions:', instanceType);
    }
    // instanceFamilies.push(family);
    if (familyGeneral.includes(family[0])) instanceFamilyGeneral.add(family);
    if (familyCompute.includes(family[0])) instanceFamilyCompute.add(family);
    if (familyMemory.includes(family[0])) instanceFamilyMemory.add(family);
    if (familyStorage.includes(family[0])) instanceFamilyStorage.add(family);
    if (familyAcceleratedComputing.includes(family[0]))
      instanceFamilyAcceleratedComputing.add(family);
    instanceSizes.add(size);
  });

  let output = '';

  output += `export const instanceFamilyGeneral = [ '${Array.from(instanceFamilyGeneral)
    .sort(sortFamilies)
    .join("', '")}' ] as const;\n\n`;

  output += `export const instanceFamilyCompute = [ '${Array.from(instanceFamilyCompute)
    .sort(sortFamilies)
    .join("', '")}' ] as const;\n\n`;

  output += `export const instanceFamilyMemory = [ '${Array.from(instanceFamilyMemory)
    .sort(sortFamilies)
    .join("', '")}' ] as const;\n\n`;

  output += `export const instanceFamilyStorage = [ '${Array.from(instanceFamilyStorage)
    .sort(sortFamilies)
    .join("', '")}' ] as const;\n\n`;

  output += `export const instanceFamilyAcceleratedComputing = [ '${Array.from(
    instanceFamilyAcceleratedComputing,
  )
    .sort(sortFamilies)
    .join("', '")}' ] as const;\n\n`;

  output += `export const instanceFamily = { general: instanceFamilyGeneral, compute: instanceFamilyCompute, memory: instanceFamilyMemory, storage: instanceFamilyStorage, acceleratedComputing: instanceFamilyAcceleratedComputing };\n\n`;

  output += `export type InstanceFamily = keyof typeof instanceFamily;\n\n`;

  output += `export const instanceFamilyTypes = [ ...instanceFamilyGeneral, ...instanceFamilyCompute, ...instanceFamilyMemory, ...instanceFamilyStorage, ...instanceFamilyAcceleratedComputing ];\n\n`;

  output += `export type InstanceFamilyType = typeof instanceFamilyTypes[number];\n\n`;

  output += `export const instanceSizes = [ '${Array.from(instanceSizes)
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
  (async (): Promise<void> => {
    const targetPath = resolve(__dirname, '../src/constants/ec2-types.ts');
    writeFileSync(targetPath, await getEc2Types());
  })();
}
