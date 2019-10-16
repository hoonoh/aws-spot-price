import { EC2, STS } from 'aws-sdk';
import { find, findIndex } from 'lodash';
import { table } from 'table';

import { InstanceFamily, InstanceSize, InstanceType } from './ec2-types';
import { ProductDescription } from './product-description';
import { defaultRegions, Region, regionNames } from './regions';

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
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - 3);

      const result = await ec2
        .describeSpotPriceHistory({
          NextToken: nextToken,
          StartTime: startTime,
          ProductDescriptions: productDescriptions,
          InstanceTypes: instanceTypes,
        })
        .promise();

      const nextList = result.NextToken ? await fetch(result.NextToken) : [];

      return result.SpotPriceHistory && result.SpotPriceHistory.length > 0
        ? [...result.SpotPriceHistory, ...nextList]
        : nextList;
    };

    const list = await fetch();

    if (list.length) {
      rtn = list.filter(history => history.InstanceType).sort(sortSpotPrice);
    }
  } catch (error) {
    console.error(
      'unexpected getEc2SpotPrice error.',
      JSON.stringify({ region, instanceTypes, productDescriptions, error }, null, 2),
    );
  }

  return rtn;
};

export const defaults = {
  limit: 20,
};

export const getGlobalSpotPrices = async (options?: {
  regions?: Region[];
  families?: InstanceFamily[];
  sizes?: InstanceSize[];
  priceMax?: number;
  instanceTypes?: InstanceType[];
  productDescriptions?: ProductDescription[];
  limit?: number;
  quiet?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
}) => {
  const { families, sizes, priceMax, limit, quiet, accessKeyId, secretAccessKey } = options || {
    limit: defaults.limit,
  };
  let { regions, productDescriptions, instanceTypes } = options || {};
  let rtn: EC2.SpotPrice[] = [];

  if (regions === undefined) regions = defaultRegions;

  if (productDescriptions && productDescriptions.indexOf('windows') >= 0) {
    productDescriptions = ['Windows', 'Windows (Amazon VPC)'];
  } else if (productDescriptions && productDescriptions.indexOf('linux') >= 0) {
    productDescriptions = [
      'Linux/UNIX',
      'Linux/UNIX (Amazon VPC)',
      'SUSE Linux',
      'SUSE Linux (Amazon VPC)',
      'Red Hat Enterprise Linux',
      'Red Hat Enterprise Linux (Amazon VPC)',
    ];
  }

  if (families && sizes) {
    if (!instanceTypes) instanceTypes = [];
    families.forEach(family => {
      sizes.forEach(size => {
        instanceTypes!.push(`${family}.${size}` as InstanceType);
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
      if (!quiet) process.stdout.write('.');
    }),
  );
  if (!quiet) process.stdout.write('\n');

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
  rtn = rtn.sort(sortSpotPrice).reduce(
    (list, price, idx, arr) => {
      const regionName = price.AvailabilityZone
        ? regionNames[price.AvailabilityZone.slice(0, -1) as Region]
        : undefined;

      // look for duplicate
      let duplicate = find(list, {
        InstanceType: price.InstanceType,
        ProductDescription: price.ProductDescription,
        AvailabilityZone: price.AvailabilityZone,
      });

      // if current price data timestamp is more recent, remove previous..
      if (
        duplicate &&
        duplicate.Timestamp &&
        price.Timestamp &&
        duplicate.Timestamp < price.Timestamp
      ) {
        list.splice(findIndex(list, price), 1);
        duplicate = undefined;
      }

      if (duplicate === undefined && (!limit || list.length < limit)) {
        if (!quiet) {
          tableOutput.push([
            price.InstanceType || '',
            price.SpotPrice || '',
            price.ProductDescription || '',
            price.AvailabilityZone || '',
            regionName || '',
          ]);
        }
        list.push(price);
      }

      // stop reduce loop if list has reached limit
      if (limit && list.length > limit) arr.splice(0);

      return list;
    },
    [] as EC2.SpotPrice[],
  );

  if (tableOutput.length) console.log(table(tableOutput));
  else if (!quiet) console.log('no matching records found');

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
