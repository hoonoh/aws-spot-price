import { Choice, prompt } from 'prompts/index';

import {
  InstanceFamily,
  InstanceFamilyType,
  InstanceSize,
  instanceFamily,
  instanceFamilyTypes,
  instanceSizes,
} from '../constants/ec2-types';
import { ProductDescription, allProductDescriptions } from '../constants/product-description';
import { Region, allRegions, regionNames } from '../constants/regions';
import { generateTypeSizeSetsFromFamily } from './utils';

type Answer1 = { region: Region[]; family: InstanceFamily[] };

type Answer2 = {
  familyType: InstanceFamilyType[];
  size: InstanceSize[];
  productDescription: ProductDescription[];
  priceMax: number;
  minVCPU: number;
  minMemoryGB: number;
  limit: number;
  accessKeyId: string;
  secretAccessKey: string;
};

export type Answers = Answer1 & Answer2;

/* istanbul ignore next */
const onCancel = (): void => {
  console.log('aborted');
  process.exit();
};

export const ui = async (): Promise<Answers> => {
  let inject: (string[] | string | number)[] | undefined;
  /* istanbul ignore next */
  if (process.env.UI_INJECT) {
    inject = JSON.parse(process.env.UI_INJECT);
    if (inject) prompt.inject(inject);
  }

  const question1 = [
    {
      type: 'autocompleteMultiselect',
      name: 'region',
      message: 'Select regions (select none for default regions)',
      instructions: false,
      choices: allRegions.reduce((list, region) => {
        list.push({
          title: `${regionNames[region]} - ${region}`,
          value: region,
        });
        return list;
      }, [] as Choice[]),
    },
    {
      type: 'multiselect',
      name: 'family',
      message: 'Select EC2 Family',
      instructions: false,
      choices: Object.keys(instanceFamily).reduce((list, family) => {
        list.push({
          title: family,
          value: family,
        });
        return list;
      }, [] as Choice[]),
    },
  ];

  const answer1: Answer1 = await prompt(question1, { onCancel });

  const { familyTypeSet, sizeSet } = generateTypeSizeSetsFromFamily(answer1.family);

  const familyTypePreSelected = Array.from(familyTypeSet);
  const sizePreSelected = Array.from(sizeSet);

  const generateFamilyHint = (type: string): string => {
    const familyCopy = answer1.family.concat();
    if (familyCopy.length > 0) {
      const last = familyCopy.pop();
      const list = familyCopy.length ? `${familyCopy.join(', ')} and ${last}` : last;
      return `Instance family ${type} related to '${list}' families are pre-selected`;
    }
    return 'select none to include all';
  };

  /* istanbul ignore next */
  if (inject) {
    familyTypePreSelected.forEach(type => {
      if (inject && typeof inject[2] === 'object' && !inject[2].includes(type))
        inject[2].push(type);
    });
    sizePreSelected.forEach(size => {
      if (inject && typeof inject[3] === 'object' && !inject[3].includes(size))
        inject[3].push(size);
    });
  }

  const question2 = [
    {
      type: 'autocompleteMultiselect',
      name: 'familyType',
      message: 'Select EC2 Family Type',
      hint: generateFamilyHint('types'),
      instructions: false,
      choices: instanceFamilyTypes.reduce((list, familyType) => {
        list.push({
          title: familyType,
          value: familyType,
          selected: familyTypePreSelected.includes(familyType),
        });
        return list;
      }, [] as (Choice | { selected: boolean })[]),
    },
    {
      type: 'autocompleteMultiselect',
      name: 'size',
      message: 'Select EC2 Family Size',
      hint: generateFamilyHint('sizes'),
      instructions: false,
      choices: instanceSizes.reduce((list, size) => {
        list.push({
          title: size,
          value: size,
          selected: sizePreSelected.includes(size),
        });
        return list;
      }, [] as (Choice | { selected: boolean })[]),
    },
    {
      type: 'autocompleteMultiselect',
      name: 'productDescription',
      message: `Select EC2 Product description (select none to include all)`,
      instructions: false,
      choices: allProductDescriptions.map(desc => ({
        title: desc,
        value: desc,
      })),
    },
    {
      type: 'number',
      name: 'minVCPU',
      message: `Select minimum vCPU count`,
      initial: 1,
      increment: 1,
      min: 1,
    },
    {
      type: 'number',
      name: 'minMemoryGB',
      message: `Select minimum memory (GiB)`,
      initial: 1,
      increment: 1,
      min: 1,
    },
    {
      type: 'number',
      name: 'priceMax',
      message: `Select maximum price`,
      initial: 5,
      float: true,
      round: 4,
      increment: 0.0001,
      min: 0.0015,
    },
    {
      type: 'number',
      name: 'limit',
      message: `Select result limit`,
      initial: 20,
      min: 1,
    },
    {
      type: 'text',
      name: 'accessKeyId',
      message: `Enter AWS accessKeyId (optional)`,
    },
    {
      type: (prev: string | undefined): string | undefined => (prev ? 'invisible' : undefined),
      name: 'secretAccessKey',
      message: `Enter AWS secretAccessKey`,
    },
  ];

  /* istanbul ignore next */
  const answer2: Answer2 = await prompt(question2, { onCancel });

  return { ...answer1, ...answer2 };
};
