export const allRegions = [
  'us-east-1',
  'us-east-2',
  'af-south-1',
  'ap-east-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-southeast-1',
  'ap-southeast-3',
  'us-west-1',
  'us-west-2',
  'ap-south-1',
  'ap-south-2',
  'ap-southeast-2',
  'ap-southeast-4',
  'ca-central-1',
  'eu-central-1',
  'eu-central-2',
  'eu-north-1',
  'eu-south-1',
  'eu-south-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'il-central-1',
  'me-central-1',
  'me-south-1',
  'sa-east-1',
] as const;

export type Region = (typeof allRegions)[number];

export const defaultRegions: Region[] = [
  'us-east-1',
  'us-east-2',
  // 'af-south-1', // requires opt-in
  // 'ap-east-1', // requires opt-in
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-southeast-1',
  // 'ap-southeast-3', // requires opt-in
  'us-west-1',
  'us-west-2',
  'ap-south-1',
  // 'ap-south-2', // requires opt-in
  'ap-southeast-2',
  // 'ap-southeast-4', // requires opt-in
  'ca-central-1',
  'eu-central-1',
  // 'eu-central-2', // requires opt-in
  'eu-north-1',
  // 'eu-south-1', // requires opt-in
  // 'eu-south-2', // requires opt-in
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  // 'il-central-1', // requires opt-in
  // 'me-central-1', // requires opt-in
  // 'me-south-1', // requires opt-in
  'sa-east-1',
];

export const regionNames: Record<Region, string> = {
  'us-east-1': 'US East (N. Virginia)',
  'us-east-2': 'US East (Ohio)',
  'af-south-1': 'Africa (Cape Town)',
  'ap-east-1': 'Asia Pacific (Hong Kong)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-northeast-2': 'Asia Pacific (Seoul)',
  'ap-northeast-3': 'Asia Pacific (Osaka)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-3': 'Asia Pacific (Jakarta)',
  'us-west-1': 'US West (N. California)',
  'us-west-2': 'US West (Oregon)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'ap-south-2': 'Asia Pacific (Hyderabad)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-southeast-4': 'Asia Pacific (Melbourne)',
  'ca-central-1': 'Canada (Central)',
  'eu-central-1': 'Europe (Frankfurt)',
  'eu-central-2': 'Europe (Zurich)',
  'eu-north-1': 'Europe (Stockholm)',
  'eu-south-1': 'Europe (Milan)',
  'eu-south-2': 'Europe (Spain)',
  'eu-west-1': 'Europe (Ireland)',
  'eu-west-2': 'Europe (London)',
  'eu-west-3': 'Europe (Paris)',
  'il-central-1': 'Israel (Tel Aviv)',
  'me-central-1': 'Middle East (UAE)',
  'me-south-1': 'Middle East (Bahrain)',
  'sa-east-1': 'South America (Sao Paulo)',
};
