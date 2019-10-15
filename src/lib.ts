import { EC2, STS } from 'aws-sdk';
import { table } from 'table';

import { defaultRegions, Region, regionNames } from './regions';

// https://aws.amazon.com/ec2/instance-types/

export enum ProductDescription {
  'Linux/UNIX' = 'Linux/UNIX',
  'Linux/UNIX (Amazon VPC)' = 'Linux/UNIX (Amazon VPC)',
  'SUSE Linux' = 'SUSE Linux',
  'SUSE Linux (Amazon VPC)' = 'SUSE Linux (Amazon VPC)',
  'Red Hat Enterprise Linux' = 'Red Hat Enterprise Linux',
  'Red Hat Enterprise Linux (Amazon VPC)' = 'Red Hat Enterprise Linux (Amazon VPC)',
  'Windows' = 'Windows',
  'Windows (Amazon VPC)' = 'Windows (Amazon VPC)',
  'linux' = 'linux', // wildcard
  'windows' = 'windows', // wildcard
}

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
  instanceTypes?: string[];
  productDescriptions?: ProductDescription[];
  accessKeyId?: string;
  secretAccessKey?: string;
}) => {
  const { region, instanceTypes, productDescriptions, accessKeyId, secretAccessKey } = options;

  let rtn: EC2.SpotPrice[] = [];

  try {
    const ec2 = new EC2({
      region,
      accessKeyId,
      secretAccessKey,
    });

    const fetch = async (nextToken?: string): Promise<EC2.SpotPrice[]> => {
      const result = await ec2
        .describeSpotPriceHistory({
          NextToken: nextToken,
          StartTime: new Date(),
          ProductDescriptions: productDescriptions,
          InstanceTypes: instanceTypes,
        })
        .promise();
      const nextList = result.NextToken ? await fetch(result.NextToken) : [];
      return [...(result.SpotPriceHistory || []), ...nextList];
    };

    const list = await fetch();

    if (list.length) {
      rtn = list.filter(history => history.InstanceType).sort(sortSpotPrice);
    }
  } catch (error) {
    console.log(
      'unexpected getEc2SpotPrice error.',
      JSON.stringify({ region, instanceTypes, productDescriptions, error }, null, 2),
    );
  }

  return rtn;
};

export const getGlobalSpotPrices = async (
  options: {
    regions?: Region[];
    families?: string[];
    sizes?: string[];
    priceMax?: number;
    instanceTypes?: string[];
    productDescriptions?: ProductDescription[];
    limit?: number;
    quiet?: boolean;
    accessKeyId?: string;
    secretAccessKey?: string;
  } = {},
) => {
  const { families, sizes, priceMax, limit, quiet, accessKeyId, secretAccessKey } = options;
  let { regions, productDescriptions, instanceTypes } = options;
  let rtn: EC2.SpotPrice[] = [];

  if (regions === undefined) regions = defaultRegions;

  if (productDescriptions && productDescriptions.indexOf(ProductDescription.windows) >= 0) {
    productDescriptions = [ProductDescription.Windows, ProductDescription['Windows (Amazon VPC)']];
  } else if (productDescriptions && productDescriptions.indexOf(ProductDescription.linux) >= 0) {
    productDescriptions = [
      ProductDescription['Linux/UNIX'],
      ProductDescription['Linux/UNIX (Amazon VPC)'],
      ProductDescription['SUSE Linux'],
      ProductDescription['SUSE Linux (Amazon VPC)'],
      ProductDescription['Red Hat Enterprise Linux'],
      ProductDescription['Red Hat Enterprise Linux (Amazon VPC)'],
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

  await Promise.all(
    regions.map(async region => {
      const regionsPrices = await getEc2SpotPrice({
        region,
        instanceTypes,
        productDescriptions,
        accessKeyId,
        secretAccessKey,
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
  if (!quiet) {
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
  }

  return rtn;
};

export const awsCredentialsCheck = async (
  options: {
    accessKeyId?: string;
    secretAccessKey?: string;
  } = {},
) => {
  const { accessKeyId, secretAccessKey } = options;

  let isValid = true;
  try {
    const sts = new STS({
      accessKeyId,
      secretAccessKey,
    });
    await sts.getCallerIdentity().promise();
  } catch (error) {
    isValid = false;
  }
  return isValid;
};
