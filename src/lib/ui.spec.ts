import {
  allInstances,
  instanceFamily,
  instanceFamilyCompute,
  instanceFamilyGeneral,
  instanceFamilyMemory,
  InstanceSize,
} from '../constants/ec2-types';
import { ui } from './ui';

const getFamilySize = (family: string[]): string[] => {
  const types = Object.keys(instanceFamily).reduce((list, f) => {
    // @ts-ignore
    if (family.includes(f)) return list.concat(instanceFamily[f] as string[]);
    return list;
  }, [] as string[]);
  const instances = allInstances.filter(i => types.includes(i.split('.').shift() as string));
  const sizes = new Set<InstanceSize>();
  instances.forEach(i => {
    sizes.add(i.split('.').pop() as InstanceSize);
  });
  return Array.from(sizes);
};

describe('cli-ui', () => {
  describe('compute family', () => {
    beforeAll(() => {
      process.env.UI_INJECT = JSON.stringify([
        [],
        ['compute'],
        [],
        [],
        [],
        undefined,
        undefined,
        undefined,
      ]);
    });

    afterAll(() => {
      delete process.env.UI_INJECT;
    });

    it('should return expected object', async () => {
      const result = await ui();
      expect(result).toBeDefined();
      if (result) {
        expect(result.region).toHaveLength(0);
        expect(result.family).toEqual(['compute']);
        expect(result.familyType.sort()).toEqual(Array.from(instanceFamilyCompute).sort());
        expect(result.size.sort()).toEqual(getFamilySize(['compute']).sort());
        expect(result.productDescription).toHaveLength(0);
        expect(result.priceMax).toBeFalsy();
        expect(result.limit).toBeFalsy();
        expect(result.accessKeyId).toBeFalsy();
      }
    });
  });

  describe('general and memory family', () => {
    beforeAll(() => {
      process.env.UI_INJECT = JSON.stringify([
        [],
        ['general', 'memory'],
        [],
        [],
        [],
        undefined,
        undefined,
        undefined,
      ]);
    });

    afterAll(() => {
      delete process.env.UI_INJECT;
    });

    it('should return expected object', async () => {
      const result = await ui();
      expect(result).toBeDefined();
      if (result) {
        expect(result.region).toHaveLength(0);
        expect(result.family.sort()).toEqual(['general', 'memory'].sort());
        expect(result.familyType.sort()).toEqual(
          (Array.from(instanceFamilyGeneral) as string[]).concat(instanceFamilyMemory).sort(),
        );
        expect(result.size.sort()).toEqual(getFamilySize(['general', 'memory']).sort());
        expect(result.productDescription).toHaveLength(0);
        expect(result.priceMax).toBeFalsy();
        expect(result.limit).toBeFalsy();
        expect(result.accessKeyId).toBeFalsy();
      }
    });
  });

  describe('no family selected', () => {
    beforeAll(() => {
      process.env.UI_INJECT = JSON.stringify([
        ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'],
        [],
        ['c4', 'r5', 'f1'],
        ['nano', 'micro', 'small', 'medium', 'large'],
        ['Linux/UNIX', 'SUSE Linux'],
        0.5,
        21,
        'accessKeyId',
        'secretAccessKey',
      ]);
    });

    afterAll(() => {
      delete process.env.UI_INJECT;
    });

    it('should return expected object', async () => {
      const result = await ui();
      expect(result).toBeDefined();
      if (result) {
        expect(result.region.sort()).toEqual(
          ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'].sort(),
        );
        expect(result.family.sort()).toHaveLength(0);
        expect(result.familyType.sort()).toEqual(['c4', 'r5', 'f1'].sort());
        expect(result.size.sort()).toEqual(['nano', 'micro', 'small', 'medium', 'large'].sort());
        expect(result.productDescription.sort()).toEqual(['Linux/UNIX', 'SUSE Linux'].sort());
        expect(result.priceMax).toEqual(0.5);
        expect(result.limit).toEqual(21);
        expect(result.accessKeyId).toEqual('accessKeyId');
        expect(result.secretAccessKey).toEqual('secretAccessKey');
      }
    });
  });
});
