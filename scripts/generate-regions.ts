import EC2 from 'aws-sdk/clients/ec2';
import SSM from 'aws-sdk/clients/ssm';
import { readFileSync, writeFileSync } from 'fs';
import { diff } from 'jest-diff';
import { resolve } from 'path';
import prettier from 'prettier';

if (require.main && require.main.filename === module.filename) {
  const tsContentBefore = readFileSync(
    resolve(__dirname, '../src/constants/regions.ts'),
  ).toString();

  (async (): Promise<void> => {
    const ec2 = new EC2({ region: 'us-east-1' });
    const regions =
      (await ec2.describeRegions({ AllRegions: true }).promise()).Regions?.sort(
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

    const ssm = new SSM({ region: 'us-east-1' });
    const regionLongNames = (
      await Promise.all(
        regions.map(async r => {
          if (!r.RegionName) return undefined;
          return {
            region: r.RegionName,
            longName: (
              await ssm
                .getParameter({
                  Name: `/aws/service/global-infrastructure/regions/${r.RegionName}/longName`,
                })
                .promise()
            ).Parameter?.Value,
          };
        }),
      )
    ).filter(r => !!r?.longName && !!r.longName);

    output += `export const regionNames: Record<Region, string> = {
      ${regions
        .map(r => {
          const name = regionLongNames.find(
            ln => ln?.region && ln.longName && ln?.region === r.RegionName,
          )?.longName;
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

    const tsContentAfter = readFileSync(
      resolve(__dirname, '../src/constants/regions.ts'),
    ).toString();

    const difference = diff(tsContentBefore, tsContentAfter, { omitAnnotationLines: true });

    if (difference?.toLowerCase().endsWith('difference')) {
      // jest-diff returns string 'Compared values have no visual difference' if no difference found
      console.log(difference);
    } else {
      console.log('regions file changed:\n' + difference);
    }
  })();
}
