import * as EC2 from 'aws-sdk/clients/ec2';
import * as ora from 'ora';
import { table } from 'table';

import { InstanceFamilyType, InstanceSize, InstanceType } from '../constants/ec2-types';
import { ProductDescription } from '../constants/product-description';
import { defaultRegions, Region, regionNames } from '../constants/regions';
import { generateInstantTypesFromFamilyTypeSize } from './utils';

const sortSpotPrice = (p1: EC2.SpotPrice, p2: EC2.SpotPrice): number => {
  let rtn = 0;

  const sort = (s1?: string, s2?: string): void => {
    /* istanbul ignore else */
    if (rtn === 0 && s1 && s2) {
      if (s1 < s2) {
        rtn = -1;
      } else if (s1 > s2) {
        rtn = 1;
      }
    }
  };

  sort(p1.SpotPrice, p2.SpotPrice);
  sort(p1.InstanceType, p2.InstanceType);
  sort(p1.AvailabilityZone, p2.AvailabilityZone);
  sort(p1.ProductDescription, p2.ProductDescription);

  return rtn;
};

class Ec2SpotPriceError extends Error {
  constructor(message: string, region: Region, code: string) {
    super(message) /* istanbul ignore next */;
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

  if (regions === undefined) regions = defaultRegions;

  if (familyTypes || sizes) {
    const { instanceTypes: instanceTypesGenerated } = generateInstantTypesFromFamilyTypeSize({
      familyTypes,
      sizes,
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

  const rtn: EC2.SpotPrice[] = await Promise.all(
    regions.map(async region => {
      try {
        const regionsPrices = await getEc2SpotPrice({
          region,
          instanceTypes,
          productDescriptions,
          accessKeyId,
          secretAccessKey,
        });
        /* istanbul ignore if */
        if (spinner) {
          spinnerText = `Retrieved data from ${region}...`;
          spinner.text = spinnerText;
        }
        return regionsPrices;
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
        return [];
      }
    }),
  ).then(results => {
    /* istanbul ignore if */
    if (spinner) spinner.succeed('All data retrieved!').stop();
    return results
      .reduce(
        (finalList: EC2.SpotPrice[], curList: EC2.SpotPrice[]) => {
          const curListFiltered = curList.filter(
            // filter price info without region or price greater than priceMax
            price => {
              // 1. remove if data missing any of the required attributes
              // 2. remove if price.SpotPrice is unavailable or price is higher than priceMax
              if (
                !price.AvailabilityZone ||
                !price.SpotPrice ||
                !price.InstanceType ||
                (priceMax !== undefined && parseFloat(price.SpotPrice) > priceMax)
              )
                return false;

              return true;
            },
          );
          // look for duplicate and remove prev data if older than current
          const curListReduced = curListFiltered.reduce(
            (list, cur) => {
              const duplicates = list.filter(
                prevPrice =>
                  cur.AvailabilityZone &&
                  cur.AvailabilityZone === prevPrice.AvailabilityZone &&
                  cur.InstanceType &&
                  cur.InstanceType === prevPrice.InstanceType &&
                  cur.ProductDescription &&
                  cur.ProductDescription === prevPrice.ProductDescription,
              );
              if (duplicates.length) {
                while (duplicates.length) {
                  const dupe = duplicates.pop();
                  if (dupe && cur.Timestamp && dupe.Timestamp && cur.Timestamp > dupe.Timestamp) {
                    list.splice(list.indexOf(dupe));
                    list.push(cur);
                  }
                }
              } else {
                list.push(cur);
              }
              return list;
            },
            [] as EC2.SpotPrice[],
          );
          return finalList.concat(curListReduced);
        },
        [] as EC2.SpotPrice[],
      )
      .sort(sortSpotPrice);
  });

  // limit output
  if (limit && rtn.length > limit) rtn.splice(limit);

  // log output
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
                  : /* istanbul ignore next */ undefined,
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
