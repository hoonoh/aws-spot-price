export const allProductDescriptions = [
  'Linux/UNIX',
  'Linux/UNIX (Amazon VPC)',
  'SUSE Linux',
  'SUSE Linux (Amazon VPC)',
  'Red Hat Enterprise Linux',
  'Red Hat Enterprise Linux (Amazon VPC)',
  'Windows',
  'Windows (Amazon VPC)',
  'linux', // wildcard
  'windows', // wildcard
] as const;

export type ProductDescription = typeof allProductDescriptions[number];
