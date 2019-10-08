import { EC2 } from 'aws-sdk';
import { table } from 'table';
import * as yargs from 'yargs';

import { instanceFamilies, instanceSizes } from './instance-types';

// https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html
// https://aws.amazon.com/ec2/instance-types/

enum ProductDescription {
  'Linux/UNIX' = 'Linux/UNIX',
  'SUSE Linux' = 'SUSE Linux',
  'Windows' = 'Windows',
  'Linux/UNIX (Amazon VPC)' = 'Linux/UNIX (Amazon VPC)',
  'SUSE Linux (Amazon VPC)' = 'SUSE Linux (Amazon VPC)',
  'Windows (Amazon VPC)' = 'Windows (Amazon VPC)',
  'linux' = 'linux', // wildcard
  'windows' = 'windows', // wildcard
}

type Region =
  | 'us-east-1'
  | 'us-east-2'
  | 'us-west-1'
  | 'us-west-2'
  | 'ca-central-1'
  | 'eu-central-1'
  | 'eu-west-1'
  | 'eu-west-2'
  | 'eu-west-3'
  | 'eu-north-1'
  | 'ap-east-1'
  | 'ap-northeast-1'
  | 'ap-northeast-2'
  | 'ap-northeast-3'
  | 'ap-southeast-1'
  | 'ap-southeast-2'
  | 'ap-south-1'
  | 'me-south-1'
  | 'sa-east-1';

const regions: Region[] = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  // 'ap-east-1',       // requires opt-in
  'ap-northeast-1',
  'ap-northeast-2',
  // 'ap-northeast-3',  // requires opt-in
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-south-1',
  // 'me-south-1',      // requires opt-in
  'sa-east-1',
];

const regionNames: Record<Region, string> = {
  'us-east-1': 'US East (N. Virginia)',
  'us-east-2': 'US East (Ohio)',
  'us-west-1': 'US West (N. California)',
  'us-west-2': 'US West (Oregon)',
  'ca-central-1': 'Canada (Central)',
  'eu-central-1': 'EU (Frankfurt)',
  'eu-west-1': 'EU (Ireland)',
  'eu-west-2': 'EU (London)',
  'eu-west-3': 'EU (Paris)',
  'eu-north-1': 'EU (Stockholm)',
  'ap-east-1': 'Asia Pacific (Hong Kong)',
  'ap-northeast-1': 'Asia Pacific (Tokyo)',
  'ap-northeast-2': 'Asia Pacific (Seoul)',
  'ap-northeast-3': 'Asia Pacific (Osaka-Local)',
  'ap-southeast-1': 'Asia Pacific (Singapore)',
  'ap-southeast-2': 'Asia Pacific (Sydney)',
  'ap-south-1': 'Asia Pacific (Mumbai)',
  'me-south-1': 'Middle East (Bahrain)',
  'sa-east-1': 'South America (São Paulo)',
};

const sortSpotPrice = (p1: EC2.SpotPrice, p2: EC2.SpotPrice) => {
  let rtn = 0;
  if (p1.SpotPrice && p2.SpotPrice) {
    if (p1.SpotPrice < p2.SpotPrice) {
      rtn = -1;
    } else if (p1.SpotPrice > p2.SpotPrice) {
      rtn = 1;
    }
  }
  if (rtn === 0 && p1.InstanceType && p2.InstanceType) {
    if (p1.InstanceType < p2.InstanceType) {
      rtn = -1;
    } else if (p1.InstanceType > p2.InstanceType) {
      rtn = 1;
    }
  }
  if (rtn === 0 && p1.AvailabilityZone && p2.AvailabilityZone) {
    if (p1.AvailabilityZone < p2.AvailabilityZone) {
      rtn = -1;
    } else if (p1.AvailabilityZone > p2.AvailabilityZone) {
      rtn = 1;
    }
  }
  return rtn;
};

const getEc2SpotPrice = async (options: {
  region: string;
  prefix?: string;
  suffix?: string;
  instanceTypes?: string[];
  productDescriptions?: ProductDescription[];
}) => {
  const { region, prefix, suffix, instanceTypes, productDescriptions } = options;

  let rtn: EC2.SpotPrice[] = [];

  try {
    const ec2 = new EC2({ region });

    const fetch = async (nextToken?: string): Promise<EC2.SpotPrice[]> => {
      const minuteAgo = new Date();
      minuteAgo.setMinutes(minuteAgo.getMinutes() - 1);
      const result = await ec2
        .describeSpotPriceHistory({
          NextToken: nextToken,
          StartTime: minuteAgo,
          ProductDescriptions: productDescriptions,
          InstanceTypes: instanceTypes,
        })
        .promise();
      const nextList = result.NextToken ? await fetch(result.NextToken) : [];
      return [...(result.SpotPriceHistory || []), ...nextList];
    };

    const list = await fetch();

    if (list.length) {
      rtn = list
        .filter(
          history =>
            history.InstanceType &&
            (!prefix || history.InstanceType.toLowerCase().startsWith(prefix)) &&
            (!suffix || history.InstanceType.toLowerCase().endsWith(suffix)),
          // history.ProductDescription &&
          // history.ProductDescription.toLowerCase().includes('linux'),
        )
        .sort(sortSpotPrice);
    }
  } catch (error) {
    console.log(region, prefix, error);
  }

  return rtn;
};

const getGlobalSpotPrices = async (options: {
  prefix?: string;
  suffix?: string;
  families?: string[];
  sizes?: string[];
  priceMax?: number;
  instanceTypes?: string[];
  productDescriptions?: ProductDescription[];
  limit?: number;
}) => {
  const { prefix, suffix, families, sizes, priceMax, limit } = options;
  let { productDescriptions, instanceTypes } = options;
  let rtn: EC2.SpotPrice[] = [];
  if (productDescriptions && productDescriptions.indexOf(ProductDescription.windows) >= 0) {
    productDescriptions = [ProductDescription.Windows, ProductDescription['Windows (Amazon VPC)']];
  } else if (productDescriptions && productDescriptions.indexOf(ProductDescription.linux) >= 0) {
    productDescriptions = [
      ProductDescription['Linux/UNIX'],
      ProductDescription['Linux/UNIX (Amazon VPC)'],
      ProductDescription['SUSE Linux'],
      ProductDescription['SUSE Linux (Amazon VPC)'],
    ];
  }

  if (families && sizes) {
    if (!instanceTypes) instanceTypes = [];
    families.forEach(family => {
      sizes.forEach(size => {
        instanceTypes!.push(`${family}.${size}`);
      });
    });
  }

  console.log('>>>', instanceTypes);

  await Promise.all(
    regions.map(async region => {
      const regionsPrices = await getEc2SpotPrice({
        region,
        prefix,
        suffix,
        instanceTypes,
        productDescriptions,
      });
      rtn = [...rtn, ...regionsPrices];
      process.stdout.write('.');
    }),
  );
  process.stdout.write('\n');

  rtn = rtn.reduce(
    (list, cur) => {
      if (priceMax && cur.SpotPrice && parseFloat(cur.SpotPrice) > priceMax) return list;
      list.push(cur);
      return list;
    },
    [] as EC2.SpotPrice[],
  );

  // log output
  const tableOutput: string[][] = [];
  rtn.sort(sortSpotPrice).reduce(
    (list, price) => {
      const regionName = price.AvailabilityZone
        ? regionNames[price.AvailabilityZone.slice(0, -1) as Region]
        : undefined;
      const str = `${price.InstanceType}\t${price.SpotPrice}\t${price.ProductDescription}\t${
        price.AvailabilityZone
      } ${regionName ? `(${regionName})` : ''}`;
      if (list.indexOf(str) < 0 && (!limit || tableOutput.length < limit)) {
        // console.log(str);
        tableOutput.push([
          price.InstanceType || '',
          price.SpotPrice || '',
          price.ProductDescription || '',
          price.AvailabilityZone || '',
          regionName || '',
        ]);
        list.push(str);
      }
      return list;
    },
    [] as string[],
  );
  if (tableOutput.length) console.log(table(tableOutput));
  else console.log('no matching records found');
};

// getGlobalSpotPrices({
//   // prefix: 'c4',
//   suffix: 'xlarge',
//   instanceTypes: ['c5.large', 'c5.xlarge'],
//   maxPrice: 1.04,
//   limit: 50,
//   productDescriptions: [ProductDescription['Linux/UNIX']],
// });

// const argv = yargs.command(
//   '$0',
//   'the default command',
//   () => {},
//   argv => {
//     console.log('this command will be run by default', argv);
//   },
// );

const { argv } = yargs
  .scriptName('user')
  .command(
    '$0',
    'the default command',
    {
      instanceTypes: {
        alias: 'i',
        describe: 'EC2 type',
        type: 'array',
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
        describe: 'EC2 sizes. Requires `families` parameter.',
        type: 'array',
        choices: instanceSizes,
        string: true,
        // demandOption: true, // TEMP
      },
      limit: {
        alias: 'l',
        describe: 'Limit results length',
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
        describe:
          'Product descriptions. Choose `windows` or `linux` (with all lowercase) as wildcard.',
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
      console.log('>>>', instanceTypes, families, sizes, limit, priceMax, productDescriptions);
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
