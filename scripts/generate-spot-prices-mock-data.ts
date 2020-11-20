import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import EC2 from 'aws-sdk/clients/ec2';
import { find, uniqWith, xorWith } from 'lodash';
import yargs from 'yargs/yargs';

import { Region, defaultRegions } from '../src/constants/regions';

let allPrices: EC2.SpotPrice[] = [];

const fetchData = async (region: Region, token?: string): Promise<void> => {
  process.stdout.write('.');
  const ec2 = new EC2({ region });
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - 3);
  const results = await ec2
    .describeSpotPriceHistory({ NextToken: token, StartTime: startTime })
    .promise();
  if (results.SpotPriceHistory) allPrices = [...allPrices, ...results.SpotPriceHistory];
  if (results.NextToken) await fetchData(region, results.NextToken);
};

const jsonPath = resolve(__dirname, '../test/spot-prices-mock.json');

const { argv } = yargs()
  .scriptName('generate-spot-prices-mock')
  .command(
    '$0',
    'generate spot prices JSON mock file.',
    {
      write: {
        alias: 'w',
        describe: 'Write to JSON file at test/spot-prices-mock.json',
        type: 'boolean',
      },
      processDetail: {
        alias: 'p',
        describe: 'Compare with previous JSON file and show details about fetched data.',
        type: 'boolean',
      },
    },
    async args => {
      await defaultRegions.reduce(
        (promise, region) =>
          promise.then(() => {
            const lastCount = allPrices.length;
            process.stdout.write(`${region} `);
            return new Promise((res): void => {
              fetchData(region).then(() => {
                process.stdout.write(` ${allPrices.length - lastCount} total\n`);
                res();
              });
            });
          }),
        Promise.resolve(),
      );

      console.log('fetched total:', allPrices.length);

      // check for any duplicates
      const unique = uniqWith(allPrices, (val1: EC2.SpotPrice, val2: EC2.SpotPrice) => {
        return (
          val1.AvailabilityZone === val2.AvailabilityZone &&
          val1.InstanceType === val2.InstanceType &&
          val1.ProductDescription === val2.ProductDescription
        );
      });
      console.log('unique total:', unique.length);

      if (args.processDetail) {
        const uniqueProductDescription = uniqWith(
          allPrices,
          (val1: EC2.SpotPrice, val2: EC2.SpotPrice) => {
            return val1.ProductDescription === val2.ProductDescription;
          },
        );
        const uniqueType = uniqWith(allPrices, (val1: EC2.SpotPrice, val2: EC2.SpotPrice) => {
          return val1.InstanceType === val2.InstanceType;
        });
        const uniqueFamily = uniqWith(allPrices, (val1: EC2.SpotPrice, val2: EC2.SpotPrice) => {
          return val1.InstanceType?.split('.').shift() === val2.InstanceType?.split('.').shift();
        });
        const uniqueSize = uniqWith(allPrices, (val1: EC2.SpotPrice, val2: EC2.SpotPrice) => {
          return val1.InstanceType?.split('.').pop() === val2.InstanceType?.split('.').pop();
        });
        console.log('uniqueType total:', uniqueType.length);
        console.log('uniqueProductDescription total:', uniqueProductDescription.length);
        console.log('uniqueFamily total:', uniqueFamily.length);
        console.log('uniqueSize total:', uniqueSize.length);

        // compare with previous
        const prevList = JSON.parse(readFileSync(jsonPath).toString('utf8'));

        const xor = xorWith(unique, prevList, (val1: EC2.SpotPrice, val2: EC2.SpotPrice) => {
          return (
            val1.AvailabilityZone === val2.AvailabilityZone &&
            val1.InstanceType === val2.InstanceType &&
            val1.ProductDescription === val2.ProductDescription
          );
        });
        console.log('xor total:', xor.length);
        const xorPrev: EC2.SpotPrice[] = [];
        const xorCur: EC2.SpotPrice[] = [];
        xor.forEach(p => {
          const isCur = find(unique, p);
          if (isCur !== undefined) xorCur.push(p);
          else xorPrev.push(p);
        });
        console.log('xorPrev:');
        console.log(JSON.stringify(xorPrev, null, 2));
        console.log('xorCur:');
        console.log(JSON.stringify(xorCur, null, 2));
      }

      if (args.write) {
        writeFileSync(jsonPath, JSON.stringify(allPrices, null, 2));
        console.log(`written JSON file to ${jsonPath}`);
      }
    },
  )
  .demandCommand()
  .help();

if (!argv) console.log(argv); // dummy to get around type error;

const cleanExit = (): void => {
  process.exit();
};
process.on('SIGINT', cleanExit); // catch ctrl-c
process.on('SIGTERM', cleanExit); // catch kill
