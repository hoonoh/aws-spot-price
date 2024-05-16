import { ArchitectureType } from '@aws-sdk/client-ec2';
import ora from 'ora';
import { sep } from 'path';
import { ColumnUserConfig, Indexable, table } from 'table';
import yargs from 'yargs/yargs';

import { ui } from './lib/ui';
import {
  allInstances,
  allPlatforms,
  allRegions,
  AuthError,
  awsCredentialsCheck,
  defaults,
  Ec2SpotPriceError,
  generateTypeSizeSetsFromFamily,
  getGlobalSpotPrices,
  InstanceFamily,
  instanceFamily,
  InstanceFamilyType,
  instanceFamilyTypes,
  instanceOfPlatforms,
  InstanceSize,
  instanceSizes,
  InstanceType,
  Platform,
  PlatformsWildcards,
  platformWildcards,
  Region,
  regionNames,
} from './module';

// https://github.com/yargs/yargs/issues/1519
(process.stdout as any)._handle.setBlocking(true);

export const main = (argvInput?: string[]): Promise<void> =>
  new Promise((res, rej): void => {
    const y = yargs()
      .scriptName('aws-spot-price')
      .command(
        '$0',
        'get current AWS spot instance prices',
        {
          ui: {
            describe: 'Start with UI mode',
            type: 'boolean',
            default: false,
          },
          region: {
            alias: 'r',
            describe: 'AWS regions.',
            type: 'array',
            choices: allRegions,
            string: true,
          },
          instanceType: {
            alias: 'i',
            describe: 'EC2 type',
            type: 'array',
            choices: allInstances,
            string: true,
          },
          family: {
            describe: 'EC2 instance family.',
            type: 'array',
            string: true,
            choices: Object.keys(instanceFamily),
          },
          familyType: {
            alias: 'f',
            describe: 'EC2 instance family types.',
            type: 'array',
            string: true,
            choices: instanceFamilyTypes,
          },
          size: {
            alias: 's',
            describe: 'EC2 instance sizes.',
            type: 'array',
            choices: instanceSizes,
            string: true,
          },
          minVCPU: {
            alias: 'mc',
            describe: 'Minimum VCPU count',
            type: 'number',
            default: defaults.minVCPU,
          },
          minMemoryGiB: {
            alias: 'mm',
            describe: 'Minimum memory (GiB)',
            type: 'number',
            default: defaults.minMemoryGiB,
          },
          priceLimit: {
            alias: 'pl',
            describe: 'Maximum price limit',
            type: 'number',
            default: defaults.priceLimit,
          },
          platforms: {
            alias: 'p',
            describe: 'Platforms. Choose `windows` or `linux` (all lowercase) as wildcard.',
            type: 'array',
            string: true,
            choices: [...allPlatforms, ...(Object.keys(platformWildcards) as PlatformsWildcards[])],
            default: defaults.platforms,
          },
          architectures: {
            alias: 'a',
            describe: 'Architectures',
            type: 'array',
            choices: Object.keys(ArchitectureType) as ArchitectureType[],
            string: true,
            default: defaults.architectures,
          },
          limit: {
            alias: 'l',
            describe: 'Limit results output length',
            type: 'number',
            default: defaults.limit,
            coerce: (val: number | number[]): number | undefined => {
              if (typeof val === 'object') {
                return val.pop();
              }
              return val;
            },
          },
          reduceAZ: {
            alias: 'raz',
            describe: 'Reduce results with cheapest Availability Zone within Region',
            type: 'boolean',
            default: defaults.reduceAZ,
          },
          wide: {
            alias: 'w',
            describe: 'Output results with detail (vCPU, memory, etc)',
            type: 'boolean',
            default: defaults.wide,
          },
          json: {
            alias: 'j',
            describe: 'Outputs in JSON format',
            type: 'boolean',
            default: false,
          },
          accessKeyId: {
            describe: 'AWS Access Key ID.',
            type: 'string',
          },
          secretAccessKey: {
            describe: 'AWS Secret Access Key.',
            type: 'string',
          },
        },

        async args => {
          try {
            const {
              region,
              instanceType,
              family,
              familyType,
              size,
              limit,
              reduceAZ,
              wide,
              minVCPU,
              minMemoryGiB,
              priceLimit,
              platforms,
              architectures,
              json,
              accessKeyId,
              secretAccessKey,
            } = args.ui ? { ...(await ui()), instanceType: undefined, json: false } : args;

            // process instance families
            let familyTypeSet: Set<InstanceFamilyType>;
            let sizeSet: Set<InstanceSize>;
            if (family) {
              ({ familyTypeSet, sizeSet } = generateTypeSizeSetsFromFamily(
                family as InstanceFamily[],
              ));
            } else {
              familyTypeSet = new Set<InstanceFamilyType>();
              sizeSet = new Set<InstanceSize>();
            }

            if (familyType) {
              (familyType as InstanceFamilyType[]).forEach(t => {
                familyTypeSet.add(t);
              });
            }

            if (size) {
              (size as InstanceSize[]).forEach(s => {
                sizeSet.add(s);
              });
            }

            // process platforms
            const platformsSet = new Set<Platform>();
            if (platforms && platforms.length) {
              (platforms as (Platform | PlatformsWildcards)[]).forEach(pd => {
                /* istanbul ignore else */
                if (instanceOfPlatforms(pd)) {
                  platformsSet.add(pd);
                } else if (pd === 'linux') {
                  platformWildcards.linux.forEach(desc => {
                    platformsSet.add(desc);
                  });
                } else if (pd === 'windows') {
                  platformWildcards.windows.forEach(desc => {
                    platformsSet.add(desc);
                  });
                }
              });
            } else {
              // defaults to linux product
              defaults.platforms.forEach(p => {
                platformsSet.add(p);
              });
            }

            const architecturesSet = new Set<ArchitectureType>();
            if (architectures?.length) {
              architectures.forEach(a => architecturesSet.add(a));
            }

            if (accessKeyId && !secretAccessKey) {
              console.log('`secretAccessKey` missing.');
              rej();
              return;
            }

            if (!accessKeyId && secretAccessKey) {
              console.log('`accessKeyId` missing.');
              rej();
              return;
            }

            // test credentials
            await awsCredentialsCheck({
              accessKeyId,
              secretAccessKey,
            });

            const platformsSetArray = Array.from(platformsSet);
            const architecturesSetArray = Array.from(architecturesSet);
            const familyTypeSetArray = Array.from(familyTypeSet);
            const sizeSetArray = Array.from(sizeSet);

            let spinnerText: string | undefined;
            let spinner: ora.Ora | undefined;
            let onRegionFetch: ((reg: Region) => void) | undefined;
            let onRegionFetchFail: ((error: Ec2SpotPriceError) => void) | undefined;
            let onFetchComplete: (() => void) | undefined;

            /* istanbul ignore if */
            if (!json && process.env.NODE_ENV !== 'test') {
              spinner = ora({
                text: 'Waiting for data to be retrieved...',
                discardStdin: false,
              }).start();

              onRegionFetch = (reg: Region): void => {
                spinnerText = `Retrieved data from ${reg}...`;
                if (spinner) spinner.text = spinnerText;
              };
              onRegionFetchFail = (error: Ec2SpotPriceError): void => {
                if (spinner)
                  spinner.fail(`Failed to retrieve data from ${error.region}. (${error.code})`);
                let text = spinnerText;
                if (!text && spinner) text = spinner.text;
                spinner = ora({
                  text,
                  discardStdin: false,
                }).start();
              };
              onFetchComplete = (): void => {
                if (spinner) spinner.succeed('All data retrieved!').stop();
              };
            }

            const results = await getGlobalSpotPrices({
              regions: region as Region[],
              instanceTypes: instanceType as InstanceType[],
              familyTypes: familyTypeSetArray.length ? familyTypeSetArray : undefined,
              sizes: sizeSetArray.length ? sizeSetArray : undefined,
              limit,
              reduceAZ,
              minVCPU,
              minMemoryGiB,
              priceLimit,
              platforms: platformsSetArray,
              architectures: architecturesSetArray,
              accessKeyId,
              secretAccessKey,
              onRegionFetch,
              onRegionFetchFail,
              onFetchComplete,
            });

            if (json) {
              console.log(JSON.stringify(results, null, 2));
            } else if (results.length > 0) {
              // shorten price strings
              let spotPriceToFixedLen = Number.NEGATIVE_INFINITY;
              const allPricesStr = results.map(r => r.spotPrice.toFixed(10));
              allPricesStr.forEach(priceStr => {
                const len = 10 - (priceStr.match(/0+$/)?.[0].length || 0);
                if (len !== undefined && len > spotPriceToFixedLen) spotPriceToFixedLen = len;
              });

              let tableHeader: (string | undefined)[][] | undefined;
              let tableData: (string | undefined)[][] | undefined;
              let tableFormat: Indexable<ColumnUserConfig> | undefined;

              if (!wide) {
                tableHeader = [['Type', 'Price', 'Platform', 'Architecture', 'Availability Zone']];
                tableData = results.map(info => [
                  info.instanceType,
                  info.spotPrice.toFixed(spotPriceToFixedLen),
                  info.platform,
                  info.architectures?.join(', '),
                  info.availabilityZone,
                ]);
                tableFormat = {
                  0: { alignment: 'left' },
                  1: { alignment: 'right' },
                  2: { alignment: 'left' },
                  3: { alignment: 'left' },
                  4: { alignment: 'left' },
                };
              } else {
                tableHeader = [
                  [
                    'Type',
                    'Price',
                    'vCPU',
                    'RAM',
                    'Platform',
                    'Architecture',
                    'Availability Zone',
                    'Region',
                  ],
                ];
                tableData = results.map(info => [
                  info.instanceType,
                  info.spotPrice.toFixed(spotPriceToFixedLen),
                  info.vCpu ? info.vCpu.toString() : 'unknown',
                  info.memoryGiB ? info.memoryGiB.toString() : 'unknown',
                  info.platform,
                  info.architectures?.join(', '),
                  info.availabilityZone,
                  info.availabilityZone
                    ? regionNames[info.availabilityZone.slice(0, -1) as Region]
                    : /* istanbul ignore next */ undefined,
                ]);
                tableFormat = {
                  0: { alignment: 'left' },
                  1: { alignment: 'right' },
                  2: { alignment: 'right' },
                  3: { alignment: 'right' },
                  4: { alignment: 'left' },
                  5: { alignment: 'left' },
                  6: { alignment: 'left' },
                  7: { alignment: 'left' },
                };
              }
              console.log(
                table([...tableHeader, ...tableData], {
                  drawHorizontalLine: (index, tableSize) => index <= 1 || index === tableSize,
                  columns: tableFormat,
                }),
              );
            } else {
              console.log('no matching records found');
            }

            res();
          } catch (error) {
            /* istanbul ignore else */
            if (error instanceof AuthError) {
              if (error.code === 'UnAuthorized') {
                console.log('Invalid AWS credentials provided.');
              } else {
                // error.reason === 'CredentialsNotFound'
                console.log('AWS credentials are not found.');
              }
            } else {
              console.log('unexpected getGlobalSpotPrices error:', error);
            }
            rej();
          }
        },
      )
      .demandCommand()
      .detectLocale(false)
      .help();

    if (argvInput) {
      y.exitProcess(false);
      y.parse(argvInput);
      if (argvInput.includes('--help')) res();
    } else {
      y.parse(process.argv);
    }
  });

/* istanbul ignore next */
const cleanExit = (): void => {
  process.exit();
};
process.on('SIGINT', cleanExit); // catch ctrl-c
process.on('SIGTERM', cleanExit); // catch kill

/* istanbul ignore if */
if (
  require.main &&
  (require.main.filename === module.filename ||
    require.main.filename.endsWith(`${sep}bin${sep}aws-spot-price`))
) {
  (async (): Promise<void> => {
    try {
      await main();
    } catch (error) {
      //
    }
  })();
}
