import { EC2 } from 'aws-sdk';
import { find, findIndex } from 'lodash';
import * as ora from 'ora';
import { table } from 'table';

import { InstanceFamilyType, InstanceSize, InstanceType } from './ec2-types';
import { ProductDescription } from './product-description';
import { defaultRegions, Region, regionNames } from './regions';

const sortSpotPrice = (p1: EC2.SpotPrice, p2: EC2.SpotPrice): number => {
  let rtn = 0;
  const p1SpotPrice = p1.SpotPrice || 0;
  const p2SpotPrice = p2.SpotPrice || 0;
  if (p1SpotPrice < p2SpotPrice) {
    rtn = -1;
  } else if (p1SpotPrice > p2SpotPrice) {
    rtn = 1;
  }

  // AWS SDK will always return instance type.
  // If instance type data is not returned by aws api endpoint,
  // it seems SDK will filter it out by default.
  if (rtn === 0 && p1.InstanceType && p2.InstanceType) {
    if (p1.InstanceType < p2.InstanceType) {
      rtn = -1;
    } else if (p1.InstanceType > p2.InstanceType) {
      rtn = 1;
    }
  }

  if (rtn === 0) {
    const p1AvailabilityZone = p1.AvailabilityZone || '';
    const p2AvailabilityZone = p2.AvailabilityZone || '';
    if (p1AvailabilityZone < p2AvailabilityZone) {
      rtn = -1;
    } else if (p1AvailabilityZone > p2AvailabilityZone) {
      rtn = 1;
    }
  }

  if (rtn === 0 && p1.ProductDescription && p2.ProductDescription) {
    if (p1.ProductDescription < p2.ProductDescription) {
      rtn = -1;
    } else if (p1.ProductDescription > p2.ProductDescription) {
      rtn = 1;
    }
  }

  return rtn;
};

class Ec2SpotPriceError extends Error {
  constructor(message: string, region: Region, code: string) {
    super(message);
    this.name = 'Ec2SpotPriceError';
    this.region = region;
    this.code = code;
    Object.setPrototypeOf(this, Ec2SpotPriceError.prototype);
  }

  readonly region: string;

  readonly code: string;
}

const getEc2SpotPrice = async (options: {
  region: Region;
  instanceTypes?: InstanceType[];
  productDescriptions?: ProductDescription[];
  accessKeyId?: string;
  secretAccessKey?: string;
}): Promise<EC2.SpotPrice[]> => {
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
    if (error && error.code && (error.code === 'AuthFailure' || error.code === 'OptInRequired')) {
      throw new Ec2SpotPriceError(error.message, region, error.code);
    } else {
      console.error(
        'unexpected getEc2SpotPrice error.',
        JSON.stringify({ region, instanceTypes, productDescriptions, error }, null, 2),
      );
    }
  }

  return rtn;
};

export const defaults = {
  limit: 20,
};

export const getGlobalSpotPrices = async (options?: {
  regions?: Region[];
  familyTypes?: InstanceFamilyType[];
  sizes?: InstanceSize[];
  priceMax?: number;
  instanceTypes?: InstanceType[];
  productDescriptions?: ProductDescription[];
  limit?: number;
  silent?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
}): Promise<EC2.SpotPrice[]> => {
  const {
    familyTypes,
    sizes,
    priceMax,
    productDescriptions,
    limit,
    silent,
    accessKeyId,
    secretAccessKey,
  } = options || {
    limit: defaults.limit,
  };

  let { regions, instanceTypes } = options || {};

  let rtn: EC2.SpotPrice[] = [];

  if (regions === undefined) regions = defaultRegions;

  if (familyTypes && sizes) {
    const instanceTypesGenerated: InstanceType[] = [];
    familyTypes.forEach(family => {
      sizes.forEach(size => {
        instanceTypesGenerated.push(`${family}.${size}` as InstanceType);
      });
    });
    if (!instanceTypes) {
      instanceTypes = instanceTypesGenerated;
    } else {
      instanceTypes = instanceTypes.concat(instanceTypesGenerated);
    }
  }

  let spinner: ora.Ora | undefined;
  let spinnerText: string | undefined;
  /* istanbul ignore if */
  if (!silent && process.env.NODE_ENV !== 'test') {
    spinner = ora({
      text: 'Waiting for data to be retrieved...',
      discardStdin: false,
    }).start();
  }

  await Promise.all(
    regions.map(async region => {
      try {
        const regionsPrices = await getEc2SpotPrice({
          region,
          instanceTypes,
          productDescriptions,
          accessKeyId,
          secretAccessKey,
        });
        rtn = [...rtn, ...regionsPrices];
        /* istanbul ignore if */
        if (spinner) {
          spinnerText = `Retrieved data from ${region}...`;
          spinner.text = spinnerText;
        }
      } catch (error) {
        /* istanbul ignore if */
        if (error instanceof Ec2SpotPriceError && spinner) {
          spinner.fail(`Failed to retrieve data from ${error.region}. (${error.code})`);
          spinner = ora({
            text: spinnerText || spinner.text,
            discardStdin: false,
          }).start();
        } else {
          console.error(error);
        }
      }
    }),
  );
  /* istanbul ignore if */
  if (spinner) spinner.succeed('All data retrieved!').stop();

  rtn = rtn.reduce(
    (list, cur) => {
      if (priceMax && cur.SpotPrice && parseFloat(cur.SpotPrice) > priceMax) return list;
      list.push(cur);
      return list;
    },
    [] as EC2.SpotPrice[],
  );

  // log output
  rtn = rtn.sort(sortSpotPrice).reduce(
    (list, price, idx, arr) => {
      // since price info without price or region will be pointless..
      if (!price.SpotPrice || !price.AvailabilityZone) return list;

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

      if (duplicate === undefined) list.push(price);

      // stop reduce loop if list has reached limit
      if (limit && list.length >= limit) arr.splice(0);

      return list;
    },
    [] as EC2.SpotPrice[],
  );

  if (!silent) {
    if (rtn.length > 0) {
      console.log(
        table(
          rtn.reduce(
            (list, price) => {
              list.push([
                price.InstanceType,
                price.SpotPrice,
                price.ProductDescription,
                price.AvailabilityZone,
                price.AvailabilityZone
                  ? regionNames[price.AvailabilityZone.slice(0, -1) as Region]
                  : undefined,
              ]);
              return list;
            },
            [] as (string | undefined)[][],
          ),
        ),
      );
    } else {
      console.log('no matching records found');
    }
  }

  return rtn;
};
