import { DescribeRegionsCommand, EC2Client } from '@aws-sdk/client-ec2';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import prettier from 'prettier';

// https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/
// https://a0.awsstatic.com/plc/js/1.0.104/plc/plc-setup.js // find convertRegion -> regionMap
const knownRegionNames: Record<string, string> = {
  'Africa (Cape Town)': 'af-south-1',
  'Asia Pacific (Hong Kong)': 'ap-east-1',
  'Asia Pacific (Mumbai)': 'ap-south-1',
  'Asia Pacific (Osaka-Local)': 'ap-northeast-3',
  'Asia Pacific (Seoul)': 'ap-northeast-2',
  'Asia Pacific (Singapore)': 'ap-southeast-1',
  'Asia Pacific (Sydney)': 'ap-southeast-2',
  'Asia Pacific (Tokyo)': 'ap-northeast-1',
  'AWS GovCloud (US)': 'us-gov-west-1',
  'AWS GovCloud (US-West)': 'us-gov-west-1',
  'AWS GovCloud (US) East': 'us-gov-east-1',
  'AWS GovCloud (US-East)': 'us-gov-east-1',
  'Canada (Central)': 'ca-central-1',
  'China (Beijing)': 'cn-north-1',
  'China (Ningxia)': 'cn-northwest-1',
  // 'EU (Frankfurt)': 'eu-central-1',
  'Europe (Frankfurt)': 'eu-central-1',
  // 'EU (Ireland)': 'eu-west-1',
  'Europe (Ireland)': 'eu-west-1',
  // 'EU (London)': 'eu-west-2',
  'Europe (London)': 'eu-west-2',
  // 'EU (Milan)': 'eu-south-1',
  'Europe (Milan)': 'eu-south-1',
  // 'EU (Paris)': 'eu-west-3',
  'Europe (Paris)': 'eu-west-3',
  // 'EU (Stockholm)': 'eu-north-1',
  'Europe (Stockholm)': 'eu-north-1',
  'Middle East (Bahrain)': 'me-south-1',
  'South America (Sao Paulo)': 'sa-east-1',
  'US East (Ohio)': 'us-east-2',
  'US East (N. Virginia)': 'us-east-1',
  'US East (Verizon) - Atlanta': 'us-east-1-wl1-atl1',
  'US East (Verizon) - Boston': 'us-east-1-wl1',
  'US East (Verizon) - Dallas': 'us-east-1-wl1-dfw1',
  'US East (Verizon) - Miami': 'us-east-1-wl1-mia1',
  'US East (Verizon) - New York': 'us-east-1-wl1-nyc1',
  'US East (Verizon) - Washington DC': 'us-east-1-wl1-was1',
  'US West (N. California)': 'us-west-1',
  'US West (Oregon)': 'us-west-2',
  'US West (Los Angeles)': 'us-west-2-lax-1',
  'US West (Verizon) - Denver': 'us-west-2-wl1-den1',
  'US West (Verizon) - Las Vegas': 'us-west-2-wl1-las1',
  'US West (Verizon) - San Francisco Bay Area': 'us-west-2-wl1',
  'US West (Verizon) - Seattle': 'us-west-2-wl1-sea1',
  Any: 'plc2-any',
  All: 'plc2-any',
  '': 'plc2-any',
};

if (require.main && require.main.filename === module.filename) {
  (async (): Promise<void> => {
    const ec2 = new EC2Client({ region: 'us-east-1' });
    const regions =
      (await ec2.send(new DescribeRegionsCommand({ AllRegions: true }))).Regions?.sort(
        // order @ https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/
        (a, b) => {
          if (a.RegionName?.startsWith('us-') && !b.RegionName?.startsWith('us-')) return -1;
          return -((a.RegionName || '') < (b.RegionName || ''));
        },
      ) || [];
    let output = '';

    output += `export const allRegions = [
      ${regions.map(r => `'${r.RegionName}',`).join('')}
    ] as const;\n\n`;

    output += `export type Region = typeof allRegions[number];\n\n`;

    output += `export const defaultRegions: Region[] = [
      ${regions
        .map(r => {
          if (r.OptInStatus?.endsWith('not-required')) return `'${r.RegionName}',\n`;
          return `// '${r.RegionName}', // requires opt-in\n`;
        })
        .join('')}
      ];\n\n`;

    output += `export const regionNames: Record<Region, string> = {
      ${regions
        .map(r => {
          const name = Object.entries(knownRegionNames).find(
            ([, region]) => region === r.RegionName,
          )?.[0];
          if (name) return `'${r.RegionName}': '${name}',\n`;
          return `'${r.RegionName}': 'UNKNOWN', // ! TODO: UPDATE UNKNOWN REGION NAME\n`;
        })
        .join('')}
      };\n\n`;

    output = prettier.format(output, {
      printWidth: 100,
      trailingComma: 'all',
      singleQuote: true,
      parser: 'typescript',
    });

    const targetPath = resolve(__dirname, '../src/constants/regions.ts');
    writeFileSync(targetPath, output);
  })();
}
