import { writeFileSync } from 'fs';
import { resolve } from 'path';

import prettier from 'prettier';

import { getGlobalSpotPrices } from '../src/lib/core';

const familyGeneral = ['a', 't', 'm', 'mac'];

const familyCompute = ['c'];

const familyMemory = ['r', 'u-', 'x', 'z'];

const familyStorage = ['d', 'h', 'i'];

const familyAcceleratedComputing = ['f', 'g', 'inf', 'p'];

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

// assume instance naming rule as:
// [family(string)][generation/size(high-memory, aka`u-*`)(int)].[instanceSize(string)]
const getFamilyPrefix = (family: string) => {
  let rtn = '';
  while (!'0123456789'.includes(family.substr(0, 1))) {
    rtn += family.substr(0, 1);
    family = family.substr(1);
  }
  return rtn;
};

const sortFamilies = (f1: string, f2: string): number => {
  let rtn = 0;
  if (f1[0] === f2[0]) {
    if (f1 < f2) rtn = -1;
    if (f1 > f2) rtn = 1;
    return rtn;
  }
  const i1 = familyOrder.indexOf(getFamilyPrefix(f1));
  const i2 = familyOrder.indexOf(getFamilyPrefix(f2));
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
    sc1 += familyOrder.indexOf(getFamilyPrefix(f1)) * 100;
    sc2 += familyOrder.indexOf(getFamilyPrefix(f2)) * 100;
  }
  if (sc1 < sc2) rtn = -1;
  if (sc1 > sc2) rtn = 1;
  return rtn;
};

const getEc2Types = async (): Promise<string> => {
  let prices;
  try {
    prices = await getGlobalSpotPrices({ limit: Number.POSITIVE_INFINITY });
  } catch (error) {
    console.log(`getGlobalSpotPrices error: ${error}`);
    process.exit(1);
  }
  const allInstances = prices.reduce((list, cur) => {
    if (cur.instanceType && !list.includes(cur.instanceType)) list.push(cur.instanceType);
    return list;
  }, [] as string[]);

  // const instanceFamilies: string[] = [];
  const instanceFamilyGeneral = new Set<string>();
  const instanceFamilyCompute = new Set<string>();
  const instanceFamilyMemory = new Set<string>();
  const instanceFamilyStorage = new Set<string>();
  const instanceFamilyAcceleratedComputing = new Set<string>();
  const instanceSizes = new Set<string>();

  allInstances.forEach(instanceType => {
    let [family] = instanceType.split('.');
    const [, size] = instanceType.split('.');
    if (!family || !size || instanceType.split('.').length !== 2) {
      throw new Error(`unexpected instanceType: ${instanceType}`);
    }
    if (!sizeOrder.includes(size)) throw new Error(`unexpected instance size ${size}`);

    // instanceFamilies.push(family);
    const groupByFamily = (refArray: string[], targSet: Set<string>, familyName: string) => {
      if (!familyName) return '';
      if (refArray.includes(getFamilyPrefix(familyName))) {
        targSet.add(familyName);
        return '';
      }
      return familyName;
    };
    family = groupByFamily(familyGeneral, instanceFamilyGeneral, family);
    family = groupByFamily(familyCompute, instanceFamilyCompute, family);
    family = groupByFamily(familyMemory, instanceFamilyMemory, family);
    family = groupByFamily(familyStorage, instanceFamilyStorage, family);
    family = groupByFamily(familyAcceleratedComputing, instanceFamilyAcceleratedComputing, family);

    if (family) throw new Error(`unexpected instance family type ${family}`);

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
