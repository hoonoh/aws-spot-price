import { sep } from 'path';
import * as yargs from 'yargs';

import {
  allInstances,
  instanceFamily,
  InstanceFamily,
  InstanceFamilyType,
  instanceFamilyTypes,
  InstanceSize,
  instanceSizes,
  InstanceType,
} from './constants/ec2-types';
import {
  allProductDescriptions,
  instanceOfProductDescription,
  ProductDescription,
  productDescriptionWildcards,
  ProductDescriptionWildcards,
} from './constants/product-description';
import { allRegions, Region } from './constants/regions';
import { AuthError, awsCredentialsCheck } from './lib/credential';
import { defaults, getGlobalSpotPrices } from './lib/lib';
import { ui } from './lib/ui';
import { generateTypeSizeSetsFromFamily } from './lib/utils';

export const main = (argvInput?: string[]): Promise<void> =>
  new Promise((res, rej): void => {
    const y = yargs
      .scriptName('spot-price')
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
          priceMax: {
            alias: 'p',
            describe: 'Maximum price',
            type: 'number',
          },
          productDescription: {
            alias: 'd',
            describe:
              'Product descriptions. Choose `windows` or `linux` (all lowercase) as wildcard.',
            type: 'array',
            string: true,
            choices: [
              ...allProductDescriptions,
              ...(Object.keys(productDescriptionWildcards) as ProductDescriptionWildcards[]),
            ],
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
              priceMax,
              productDescription,
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

            // process product description
            const productDescriptionsSet = new Set<ProductDescription>();
            if (productDescription) {
              (productDescription as (ProductDescription | ProductDescriptionWildcards)[]).forEach(
                pd => {
                  /* istanbul ignore else */
                  if (instanceOfProductDescription(pd)) {
                    productDescriptionsSet.add(pd);
                  } else if (pd === 'linux') {
                    productDescriptionWildcards.linux.forEach(desc => {
                      productDescriptionsSet.add(desc);
                    });
                  } else if (pd === 'windows') {
                    productDescriptionWildcards.windows.forEach(desc => {
                      productDescriptionsSet.add(desc);
                    });
                  }
                },
              );
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

            const productDescriptionsSetArray = Array.from(productDescriptionsSet);
            const familyTypeSetArray = Array.from(familyTypeSet);
            const sizeSetArray = Array.from(sizeSet);

            const results = await getGlobalSpotPrices({
              regions: region as Region[],
              instanceTypes: instanceType as InstanceType[],
              familyTypes: familyTypeSetArray.length ? familyTypeSetArray : undefined,
              sizes: sizeSetArray.length ? sizeSetArray : undefined,
              limit,
              priceMax,
              productDescriptions: productDescriptionsSetArray.length
                ? productDescriptionsSetArray
                : undefined,
              accessKeyId,
              secretAccessKey,
              silent: json,
            });

            if (json) console.log(JSON.stringify(results, null, 2));

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
              console.log('unexpected getGlobalSpotPrices error:', JSON.stringify(error, null, 2));
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
