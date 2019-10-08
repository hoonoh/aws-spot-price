import * as yargs from 'yargs';

import { allInstances, instanceFamilies, instanceSizes } from './ec2-types';
import { getGlobalSpotPrices, ProductDescription } from './lib';

const { argv } = yargs
  .scriptName('spot-price')
  .command(
    '$0',
    'get current AWS spot instance prices',
    {
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
    },
    async args => {
      const { instanceTypes, families, sizes, limit, priceMax, productDescriptions } = args;
      if ((!families && sizes) || (families && !sizes)) {
        console.log('`families` or `sizes` attribute missing.');
        return;
      }

      try {
        // console.log('!');
        getGlobalSpotPrices({
          instanceTypes,
          families,
          sizes,
          limit,
          priceMax,
          productDescriptions: productDescriptions as ProductDescription[],
        });
      } catch (error) {
        console.log(error);
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
