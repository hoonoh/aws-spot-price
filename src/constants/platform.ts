const linuxPlatforms = [
  'Linux/UNIX',
  'Linux/UNIX (Amazon VPC)',
  'SUSE Linux',
  'SUSE Linux (Amazon VPC)',
  'Red Hat Enterprise Linux',
  'Red Hat Enterprise Linux (Amazon VPC)',
] as const;

const windowsPlatforms = ['Windows', 'Windows (Amazon VPC)'] as const;

export const allPlatforms = [...linuxPlatforms, ...windowsPlatforms];

export type Platform = (typeof allPlatforms)[number];

export const platformWildcards = {
  linux: linuxPlatforms,
  windows: windowsPlatforms,
} as const;

export type PlatformsWildcards = keyof typeof platformWildcards;

export const instanceOfPlatforms = (pd: string): pd is Platform =>
  allPlatforms.includes(pd as Platform);
