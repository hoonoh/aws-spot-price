import { _InstanceType } from '@aws-sdk/client-ec2';
import assert from 'assert';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import prettier from 'prettier';

import { getGlobalSpotPrices, SpotPriceExtended } from '../src/lib/core';

const familyGeneral = [
  //
  'a', // a1 ...
  't', // t1, t2, t3a...
  'm', // m1, m2, m6g ...
  'mac', // mac, mac2 ...
];

const familyCompute = [
  //
  'c', // c1, c2, c5n, c5gn ...
];

const familyMemory = [
  //
  'r', // r3, r4, r5a ...
  'u-', // u-6tb1, u-9tb1 ...
  'x', // x1, x1e, x1edn ...
  'z', // z1d ...
  'cr1', // cr1.8xlarge ...
];

const familyStorage = [
  //
  'd', // d2, d3, d3en ...
  'h', // h1 ...
  'i', // i3, i3en, i4i ...
  'im', // im4gn ...
  'is', // is4gen ...
];

const familyAcceleratedComputing = [
  //
  'dl', // dl1 ...
  'f', // f1 ...
  'g', // g5, g4dn, g5g ...
  'inf', // inf1 ...
  'p', // p2, p3, p4 ...
  'trn', // trn1 ...
  'vt', // vt1 ...
  'cg1', // cg1.4xlarge ...
];

const familyHpcOptimized = [
  //
  'hpc', // hpc7g ...
];

const familyOrder = [
  ...familyGeneral,
  ...familyCompute,
  ...familyMemory,
  ...familyStorage,
  ...familyAcceleratedComputing,
  ...familyHpcOptimized,
];

// assert no duplicate family names
familyOrder.forEach(name => {
  assert(familyOrder.filter(f => f === name).length === 1);
});

// assume instance naming rule as:
// [family(string with no numbers)][generation or type(string starting with number)].[instanceSize(string)]
const getFamilyPrefix = (family: string) => {
  // filter all family names with matching prefixes and returns longer family prefix
  const candidates = familyOrder.filter(name => family.startsWith(name));
  return candidates.sort((a, b) => b.length - a.length)[0];
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

const getSizeOrderIndex = (size: string) => {
  const smallSizeOrder = [
    //
    'nano',
    'micro',
    'small',
    'medium',
    'large',
  ];
  if (size.startsWith('metal')) {
    // e.g. m7i.metal-24xl, m7i.metal-48xl
    const metalUnits = parseInt(size.split('-').pop() || '0');
    return 10_000 + (!isNaN(metalUnits) ? metalUnits : 0);
  }
  if (size.endsWith('xlarge')) {
    return smallSizeOrder.length - 1 + parseInt(size.match(/(\d{1,})?xlarge/)?.[1] || '0');
  }
  return smallSizeOrder.indexOf(size);
};

const sortSizes = (s1: string, s2: string): number => {
  let rtn = 0;
  const i1 = getSizeOrderIndex(s1);
  const i2 = getSizeOrderIndex(s2);
  if (i1 < 0) throw new Error(`unexpected instance size ${s1}`);
  if (i2 < 0) throw new Error(`unexpected instance size ${s2}`);
  if (i1 < i2) rtn = -1;
  if (i1 > i2) rtn = 1;
  return rtn;
};

const sortInstances = (i1: string, i2: string): number => {
  const [f1, s1] = i1.split('.');
  const [f2, s2] = i2.split('.');
  const sc1 = familyOrder.indexOf(getFamilyPrefix(f1)) * 1_000_000 + getSizeOrderIndex(s1);
  const sc2 = familyOrder.indexOf(getFamilyPrefix(f2)) * 1_000_000 + getSizeOrderIndex(s2);
  return sc1 - sc2 - sortFamilies(f2, f1) * 100_000;
};

const getEc2Types = async (): Promise<string> => {
  let prices: SpotPriceExtended[] = [];
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

  // add instance type from aws-sdk if not found in fetched list // in order to fill in instance
  // types which are unavailable as spot instance.
  Object.values(_InstanceType).forEach(t => {
    if (!allInstances.includes(t)) allInstances.push(t);
  });

  // const instanceFamilies: string[] = [];
  const instanceFamilyGeneral = new Set<string>();
  const instanceFamilyCompute = new Set<string>();
  const instanceFamilyMemory = new Set<string>();
  const instanceFamilyStorage = new Set<string>();
  const instanceFamilyAcceleratedComputing = new Set<string>();
  const instanceFamilyHpcOptimized = new Set<string>();
  const instanceSizes = new Set<string>();

  allInstances.forEach(instanceType => {
    let [family] = instanceType.split('.');
    const [, size] = instanceType.split('.');
    if (!family || !size || instanceType.split('.').length !== 2) {
      throw new Error(`unexpected instanceType: ${instanceType}`);
    }
    if (getSizeOrderIndex(size) < 0) {
      throw new Error(`unexpected instance size ${size}`);
    }

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
    family = groupByFamily(familyHpcOptimized, instanceFamilyHpcOptimized, family);

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

  output += `export const instanceFamilyHpcOptimized = [ '${Array.from(instanceFamilyHpcOptimized)
    .sort(sortFamilies)
    .join("', '")}' ] as const;\n\n`;

  output += `export const instanceFamily = { general: instanceFamilyGeneral, compute: instanceFamilyCompute, memory: instanceFamilyMemory, storage: instanceFamilyStorage, acceleratedComputing: instanceFamilyAcceleratedComputing, hpcOptimized: instanceFamilyHpcOptimized };\n\n`;

  output += `export type InstanceFamily = keyof typeof instanceFamily;\n\n`;

  output += `export const instanceFamilyTypes = [ ...instanceFamilyGeneral, ...instanceFamilyCompute, ...instanceFamilyMemory, ...instanceFamilyStorage, ...instanceFamilyAcceleratedComputing, ...instanceFamilyHpcOptimized ];\n\n`;

  output += `export type InstanceFamilyType = typeof instanceFamilyTypes[number];\n\n`;

  output += `export const instanceSizes = [ '${Array.from(instanceSizes)
    .sort(sortSizes)
    .join("', '")}' ] as const;\n\n`;

  output += `export type InstanceSize = typeof instanceSizes[number];\n\n`;

  output += `export const allInstances = [ '${allInstances
    .sort(sortInstances)
    .join("', '")}' ] as const;\n\n`;

  output += `export type InstanceType = typeof allInstances[number];`;

  output = await prettier.format(output, {
    printWidth: 100,
    trailingComma: 'all',
    singleQuote: true,
    parser: 'typescript',
  });
  return output;
};

(async (): Promise<void> => {
  const targetPath = resolve(__dirname, '../src/constants/ec2-types.ts');
  writeFileSync(targetPath, await getEc2Types());
})();
