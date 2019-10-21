import { Choice, prompt } from 'prompts';

import {
  allInstances,
  instanceFamily,
  InstanceFamilyType,
  instanceFamilyTypes,
  InstanceSize,
  instanceSizes,
} from './ec2-types';
import { allProductDescriptions, ProductDescription } from './product-description';
import { allRegions, Region, regionNames } from './regions';

type Answer1 = { region: Region[]; family: (keyof typeof instanceFamily)[] };

type Answer2 = {
  familyType: InstanceFamilyType[];
  size: InstanceSize[];
  productDescription: ProductDescription[];
  maxPrice: number;
  limit: number;
  accessKeyId: string;
  secretAccessKey: string;
};

export type Answers = Answer1 & Answer2;

const onCancel = (): void => {
  console.log('aborted');
  process.exit();
};

export const ui = async (): Promise<Answers | undefined> => {
  try {
    const question1 = [
      {
        type: 'autocompleteMultiselect',
        name: 'region',
        message: 'Select regions (select none for default regions)',
        instructions: false,
        choices: allRegions.reduce(
          (list, region) => {
            list.push({
              title: `${regionNames[region]} - ${region}`,
              value: region,
            });
            return list;
          },
          [] as Choice[],
        ),
      },
      {
        type: 'multiselect',
        name: 'family',
        message: 'Select EC2 Family',
        instructions: false,
        choices: Object.keys(instanceFamily).reduce(
          (list, family) => {
            list.push({
              title: family,
              value: family,
            });
            return list;
          },
          [] as Choice[],
        ),
      },
    ];

    const answer1: Answer1 = await prompt(question1, { onCancel });

    const familyTypePreSelectedSet = new Set<InstanceFamilyType>();
    const sizePreSelectedSet = new Set<InstanceSize>();
    if (answer1.family.length > 0) {
      answer1.family.forEach(family => {
        instanceFamily[family].forEach((type: InstanceFamilyType) => {
          familyTypePreSelectedSet.add(type);
          allInstances
            .filter(instance => instance.startsWith(type))
            .forEach(instance => {
              sizePreSelectedSet.add(instance.split('.').pop() as InstanceSize);
            });
        });
      });
    }
    const familyTypePreSelected = Array.from(familyTypePreSelectedSet);
    const sizePreSelected = Array.from(sizePreSelectedSet);

    let familyTypePreSelectMessage = '(select none to include all)';
    if (answer1.family.length > 0) {
      const last = answer1.family.pop();
      const list = answer1.family.length ? `${answer1.family.join(', ')} and ${last}` : last;
      familyTypePreSelectMessage = `(${list} sizes are pre-selected)`;
    }

    const question2 = [
      {
        type: 'autocompleteMultiselect',
        name: 'familyType',
        message: `Select EC2 Family Type ${familyTypePreSelectMessage}`,
        instructions: false,
        choices: instanceFamilyTypes.reduce(
          (list, familyType) => {
            list.push({
              title: familyType,
              value: familyType,
              selected: familyTypePreSelected.includes(familyType),
            });
            return list;
          },
          [] as (Choice | { selected: boolean })[],
        ),
      },
      {
        type: 'autocompleteMultiselect',
        name: 'size',
        message: `Select EC2 Family Size ${familyTypePreSelectMessage}`,
        instructions: false,
        choices: instanceSizes.reduce(
          (list, size) => {
            list.push({
              title: size,
              value: size,
              selected: sizePreSelected.includes(size),
            });
            return list;
          },
          [] as (Choice | { selected: boolean })[],
        ),
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
        name: 'maxPrice',
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
        type: 'invisible',
        name: 'secretAccessKey',
        message: `Enter AWS secretAccessKey (optional)`,
      },
    ];

    const answer2: Answer2 = await prompt(question2, { onCancel });

    return { ...answer1, ...answer2 };
  } catch (error) {
    return undefined;
  }
};
