const linuxProductDescriptions = [
  'Linux/UNIX',
  'Linux/UNIX (Amazon VPC)',
  'SUSE Linux',
  'SUSE Linux (Amazon VPC)',
  'Red Hat Enterprise Linux',
  'Red Hat Enterprise Linux (Amazon VPC)',
] as const;

const windowsProductDescriptions = ['Windows', 'Windows (Amazon VPC)'] as const;

export const allProductDescriptions = [...linuxProductDescriptions, ...windowsProductDescriptions];

export type ProductDescription = typeof allProductDescriptions[number];

export const productDescriptionWildcards = {
  linux: linuxProductDescriptions,
  windows: windowsProductDescriptions,
} as const;

export type ProductDescriptionWildcards = keyof typeof productDescriptionWildcards;

export const instanceOfProductDescription = (pd: string): pd is ProductDescription => {
  return allProductDescriptions.includes(pd as ProductDescription);
};
