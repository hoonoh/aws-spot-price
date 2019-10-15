import * as yargs from 'yargs';

import { allInstances, instanceFamilies, instanceSizes } from './ec2-types';
import { awsCredentialsCheck, getGlobalSpotPrices, ProductDescription } from './lib';
import { defaultRegions, Region } from './regions';

const { argv } = yargs
  .scriptName('spot-price')
  .command(
    '$0',
    'get current AWS spot instance prices',
    {
      regions: {
        alias: 'r',
        describe: 'AWS regions.',
        type: 'array',
        choices: defaultRegions,
        string: true,
      },
      instanceTypes: {
        alias: 'i',
        describe: 'EC2 type',
        type: 'array',
        choices: allInstances,
        string: true,
      },
      families: {
        alias: 'f',
        describe: 'EC2 instance families. Requires `sizes` parameter.',
        type: 'array',
        string: true,
        choices: instanceFamilies,
      },
      sizes: {
        alias: 's',
        describe: 'EC2 instance sizes. Requires `families` parameter.',
        type: 'array',
        choices: instanceSizes,
        string: true,
        // demandOption: true, // TEMP
      },
      limit: {
        alias: 'l',
        describe: 'Limit results output length',
        type: 'number',
        default: 20,
        coerce: (val: number | number[]) => {
          if (typeof val === 'object') {
            return val.pop();
          }
          return val;
        },
      },
      priceMax: {
        alias: 'p',
        describe: 'Maximum price',
        type: 'number',
      },
      productDescriptions: {
        alias: 'd',
        describe: 'Product descriptions. Choose `windows` or `linux` (all lowercase) as wildcard.',
        type: 'array',
        string: true,
        choices: Object.keys(ProductDescription),
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
      const {
        regions,
        instanceTypes,
        families,
        sizes,
        limit,
        priceMax,
        productDescriptions,
        accessKeyId,
        secretAccessKey,
      } = args;

      if ((!families && sizes) || (families && !sizes)) {
        console.log('`families` or `sizes` attribute missing.');
        return;
      }

      if (
        (accessKeyId !== undefined && secretAccessKey === undefined) ||
        (accessKeyId === undefined && secretAccessKey !== undefined)
      ) {
        console.log('`accessKeyId` & `secretAccessKey` should always be used together.');
        return;
      }

      // test credentials
      const awsCredentialValidity = await awsCredentialsCheck({ accessKeyId, secretAccessKey });
      if (!awsCredentialValidity) {
        console.log('Invalid AWS credentials provided.');
        return;
      }

      try {
        console.log('Querying current spot prices with options:');
        console.group();
        if (regions) console.log('regions:', regions);
        if (instanceTypes) console.log('instanceTypes:', instanceTypes);
        if (families) console.log('families:', families);
        if (sizes) console.log('sizes:', sizes);
        if (limit) console.log('limit:', limit);
        if (priceMax) console.log('priceMax:', priceMax);
        if (productDescriptions) console.log('productDescriptions:', productDescriptions);
        console.groupEnd();

        getGlobalSpotPrices({
          regions: regions as Region[],
          instanceTypes,
          families,
          sizes,
          limit,
          priceMax,
          productDescriptions: productDescriptions as ProductDescription[],
          accessKeyId,
          secretAccessKey,
        });
      } catch (error) {
        console.log('unexpected getGlobalSpotPrices error:', JSON.stringify(error, null, 2));
      }
    },
  )
  .demandCommand()
  .help();

if (!argv) console.log(argv); // dummy to get around type error;

const cleanExit = () => {
  process.exit();
};
process.on('SIGINT', cleanExit); // catch ctrl-c
process.on('SIGTERM', cleanExit); // catch kill
