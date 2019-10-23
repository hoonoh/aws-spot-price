import {
  allInstances,
  instanceFamily,
  InstanceFamilyType,
  InstanceSize,
} from '../constants/ec2-types';

export const generateTypeSizeSetsFromFamily = (
  families: (keyof typeof instanceFamily)[],
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
