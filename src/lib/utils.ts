import {
  allInstances,
  InstanceFamily,
  instanceFamily,
  InstanceFamilyType,
  InstanceSize,
  InstanceType,
} from '../constants/ec2-types';

export const generateTypeSizeSetsFromFamily = (
  families: InstanceFamily[],
): {
  familyTypeSet: Set<InstanceFamilyType>;
  sizeSet: Set<InstanceSize>;
} => {
  const familyTypeSet = new Set<InstanceFamilyType>();
  const sizeSet = new Set<InstanceSize>();
  families.forEach(family => {
    instanceFamily[family].forEach((type: InstanceFamilyType) => {
      familyTypeSet.add(type);
      allInstances
        .filter(instance => instance.startsWith(type))
        .forEach(instance => {
          sizeSet.add(instance.split('.').pop() as InstanceSize);
        });
    });
  });
  return { familyTypeSet, sizeSet };
};

export const generateInstantTypesFromFamilyTypeSize = (options: {
  familyTypes?: InstanceFamilyType[];
  sizes?: InstanceSize[];
}): { instanceTypeSet: Set<InstanceType>; instanceTypes: InstanceType[] } => {
  const { familyTypes, sizes } = options;
  const instanceTypeSet = new Set<InstanceType>();

  /* istanbul ignore next */
  if (!familyTypes && !sizes) {
    return {
      instanceTypeSet,
      instanceTypes: [],
    };
  }

  allInstances
    .filter((instance: InstanceType) => {
      let rtn = true;
      const [type, size] = instance.split('.') as [InstanceFamilyType, InstanceSize];
      if (familyTypes) rtn = familyTypes.includes(type);
      if (rtn && sizes) rtn = sizes.includes(size);
      return rtn;
    })
    .forEach((instance: InstanceType) => {
      instanceTypeSet.add(instance);
    });

  return {
    instanceTypeSet,
    instanceTypes: Array.from(instanceTypeSet),
  };
};
