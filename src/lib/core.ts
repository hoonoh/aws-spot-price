import EC2 from 'aws-sdk/clients/ec2';
import { ec2Info, Ec2InstanceInfo } from '../constants/ec2-info';

import { InstanceFamilyType, InstanceSize, InstanceType } from '../constants/ec2-types';
import { ProductDescription } from '../constants/product-description';
import { Region, defaultRegions } from '../constants/regions';
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

export class Ec2SpotPriceError extends Error {
  constructor(message: string, region: Region, code: string) {
    super(message) /* istanbul ignore next */;
    this.name = 'Ec2SpotPriceError';
    this.region = region;
    this.code = code;
    Object.setPrototypeOf(this, Ec2SpotPriceError.prototype);
  }

  readonly region: Region;

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
    if (
      error &&
      error.code &&
      (error.code === 'AuthFailure' ||
        error.code === 'OptInRequired' ||
        error.code === 'CredentialsError')
    ) {
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

// aws-sdk-js EC2.InstanceType is not always up to date.
type Ec2InstanceInfos = Record<InstanceType | string, { vCpu?: number; memoryGb?: number }>;

export const getEc2Info = async (
  {
    region,
    InstanceTypes,
    log,
  }: { region?: string; InstanceTypes?: (InstanceType | string)[]; log?: boolean } = {
    region: 'us-east-1',
  },
): Promise<Ec2InstanceInfos> => {
  const ec2 = new EC2({ region });

  const fetchInfo = async (NextToken?: string): Promise<Ec2InstanceInfos> => {
    const rtn: Ec2InstanceInfos = {};
    const res = await ec2
      .describeInstanceTypes({ NextToken, MaxResults: 100, InstanceTypes })
      .promise();
    res.InstanceTypes?.forEach(i => {
      if (i.InstanceType) {
        rtn[i.InstanceType] = {
          vCpu: i.VCpuInfo?.DefaultVCpus,
          memoryGb: i.MemoryInfo?.SizeInMiB ? Math.round(i.MemoryInfo.SizeInMiB / 1024) : undefined,
        };
      }
    });
    if (log) {
      console.log(
        `${region}: found ${res.InstanceTypes?.length}${res.NextToken ? ', fetching more...' : ''}`,
      );
    }
    const next = res.NextToken ? await fetchInfo(res.NextToken) : undefined;
    return { ...rtn, ...next };
  };
  return fetchInfo();
};

export const defaults = {
  limit: 20,
};

export type SpotPriceExtended = EC2.SpotPrice & Ec2InstanceInfo;

export const getGlobalSpotPrices = async (options?: {
  regions?: Region[];
  familyTypes?: InstanceFamilyType[];
  sizes?: InstanceSize[];
  priceMax?: number;
  minVCPU?: number;
  minMemoryGB?: number;
  instanceTypes?: InstanceType[];
  productDescriptions?: ProductDescription[];
  limit?: number;
  accessKeyId?: string;
  secretAccessKey?: string;
  onRegionFetch?: (region: Region) => void;
  onRegionFetchFail?: (error: Ec2SpotPriceError) => void;
  onFetchComplete?: () => void;
}): Promise<SpotPriceExtended[]> => {
  const {
    familyTypes,
    sizes,
    priceMax,
    minVCPU,
    minMemoryGB,
    productDescriptions,
    limit,
    accessKeyId,
    secretAccessKey,
    onRegionFetch,
    onRegionFetchFail,
    onFetchComplete,
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

  const rtn: SpotPriceExtended[] = await Promise.all(
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
        if (onRegionFetch) onRegionFetch(region);
        return regionsPrices;
      } catch (error) {
        /* istanbul ignore if */
        if (error instanceof Ec2SpotPriceError) {
          if (onRegionFetchFail) {
            onRegionFetchFail(error);
          } else {
            throw error;
          }
        } else {
          console.error(error);
        }
        return [];
      }
    }),
  )
    .then(results => {
      // attach ec2 instance type info
      /* istanbul ignore if */
      if (onFetchComplete) onFetchComplete();
      return Promise.all(
        results
          .flatMap(r => {
            // look for duplicate and remove prev data if older than current
            const rtn2 = r.reduce((reduced, cur) => {
              const duplicateIndex = reduced.findIndex(
                info =>
                  cur.AvailabilityZone &&
                  cur.AvailabilityZone === info.AvailabilityZone &&
                  cur.InstanceType &&
                  cur.InstanceType === info.InstanceType &&
                  cur.ProductDescription &&
                  cur.ProductDescription === info.ProductDescription &&
                  cur.Timestamp &&
                  info.Timestamp &&
                  cur.Timestamp >= info.Timestamp,
              );
              if (duplicateIndex >= 0) reduced.splice(duplicateIndex, 1);
              reduced.push(cur);
              return reduced;
            }, [] as EC2.SpotPrice[]);
            return rtn2;
          })
          .map(async r => {
            const rExtended = { ...r } as SpotPriceExtended;
            const instanceInfo = Object.entries(ec2Info).find(
              ([instanceType]) => instanceType === r.InstanceType,
            )?.[1];
            if (instanceInfo) {
              rExtended.vCpu = instanceInfo.vCpu;
              rExtended.memoryGb = instanceInfo.memoryGb;
            } else {
              // fetch intance info data from aws
              const region = rExtended.AvailabilityZone?.match(/^.+\d/)?.[0];
              if (region && rExtended.InstanceType) {
                const desc = await getEc2Info({ region, InstanceTypes: [rExtended.InstanceType] });

                if (desc[rExtended.InstanceType].vCpu && desc[rExtended.InstanceType].memoryGb) {
                  ec2Info[rExtended.InstanceType] = {
                    vCpu: desc[rExtended.InstanceType].vCpu,
                    memoryGb: desc[rExtended.InstanceType].memoryGb,
                  };
                  rExtended.vCpu = desc[rExtended.InstanceType].vCpu;
                  rExtended.memoryGb = desc[rExtended.InstanceType].memoryGb;
                }
              }
            }
            return rExtended;
          }),
      );
    })
    .then(results => {
      const rtn2 = results
        .filter(
          // filter out info without region or price greater than priceMax
          info => {
            // 1. remove if data missing any of the required attributes
            // 2. remove if price.SpotPrice is unavailable or price is higher than priceMax
            // 2. remove if minimum vcpu / memory requirements does not meet requirements
            if (!info.AvailabilityZone || !info.SpotPrice || !info.InstanceType) {
              return false;
            }
            if (priceMax !== undefined && parseFloat(info.SpotPrice) > priceMax) {
              return false;
            }

            if (minVCPU !== undefined && info.vCpu !== undefined && info.vCpu < minVCPU) {
              return false;
            }
            if (
              minMemoryGB !== undefined &&
              info.memoryGb !== undefined &&
              info.memoryGb < minMemoryGB
            ) {
              return false;
            }
            return true;
          },
        )
        .sort(sortSpotPrice);
      return rtn2;
    });

  // limit output
  if (limit && rtn.length > limit) rtn.splice(limit);

  return rtn;
};
