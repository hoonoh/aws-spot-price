import EC2 from 'aws-sdk/clients/ec2';
import { ec2Info, Ec2InstanceInfo } from '../constants/ec2-info';

import { InstanceFamilyType, InstanceSize, InstanceType } from '../constants/ec2-types';
import { Platform } from '../constants/platform';
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

const sortSpotPriceExtended = (p1: SpotPriceExtended, p2: SpotPriceExtended): number => {
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

  sort(p1.spotPrice, p2.spotPrice);
  sort(p1.instanceType, p2.instanceType);
  sort(p1.availabilityZone, p2.availabilityZone);
  sort(p1.platform, p2.platform);

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
  platforms?: Platform[];
  accessKeyId?: string;
  secretAccessKey?: string;
}): Promise<EC2.SpotPrice[]> => {
  const { region, instanceTypes, platforms, accessKeyId, secretAccessKey } = options;

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
          ProductDescriptions: platforms,
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
        JSON.stringify({ region, instanceTypes, platforms, error }, null, 2),
      );
    }
  }

  return rtn;
};

// aws-sdk-js EC2.InstanceType is not always up to date.
type Ec2InstanceInfos = Record<InstanceType | string, { vCpu?: number; memoryGiB?: number }>;

export const getEc2Info = async ({
  region,
  InstanceTypes,
  log,
}: {
  region?: string;
  InstanceTypes?: (InstanceType | string)[];
  log?: boolean;
} = {}): Promise<Ec2InstanceInfos> => {
  if (!region) region = 'us-east-1';

  const ec2 = new EC2({ region });

  const fetchInfo = async (NextToken?: string): Promise<Ec2InstanceInfos> => {
    const rtn: Ec2InstanceInfos = {};
    const res = await ec2
      .describeInstanceTypes({
        NextToken,
        MaxResults: InstanceTypes ? undefined : 100,
        InstanceTypes,
      })
      .promise();
    res.InstanceTypes?.forEach(i => {
      if (i.InstanceType) {
        rtn[i.InstanceType] = {
          vCpu: i.VCpuInfo?.DefaultVCpus,
          memoryGiB: i.MemoryInfo?.SizeInMiB
            ? Math.ceil((i.MemoryInfo.SizeInMiB / 1024) * 1000) / 1000 // ceil to 3rd decimal place
            : undefined,
        };
      }
    });
    /* istanbul ignore if */
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
  limit: 30,
  wide: false,
  reduceAZ: true,
  minVCPU: 1,
  minMemoryGiB: 0.5,
  priceLimit: 5,
};

export type SpotPriceExtended = {
  availabilityZone: string;
  instanceType: string;
  platform: string;
  spotPrice: string;
  timestamp: Date;
} & Ec2InstanceInfo;

const SpotPriceToExtended = (cur: EC2.SpotPrice) =>
  ({
    availabilityZone: cur.AvailabilityZone,
    instanceType: cur.InstanceType,
    platform: cur.ProductDescription,
    spotPrice: cur.SpotPrice,
    timestamp: cur.Timestamp,
  } as SpotPriceExtended);

export const getGlobalSpotPrices = async (options?: {
  regions?: Region[];
  familyTypes?: InstanceFamilyType[];
  sizes?: InstanceSize[];
  priceLimit?: number;
  minVCPU?: number;
  minMemoryGiB?: number;
  instanceTypes?: InstanceType[];
  platforms?: Platform[];
  limit?: number;
  reduceAZ?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  onRegionFetch?: (region: Region) => void;
  onRegionFetchFail?: (error: Ec2SpotPriceError) => void;
  onFetchComplete?: () => void;
}): Promise<SpotPriceExtended[]> => {
  const {
    familyTypes,
    sizes,
    priceLimit,
    minVCPU,
    minMemoryGiB,
    platforms,
    limit,
    reduceAZ,
    accessKeyId,
    secretAccessKey,
    onRegionFetch,
    onRegionFetchFail,
    onFetchComplete,
  } = options || {
    limit: defaults.limit,
  };

  let { regions, instanceTypes } = options || {};

  if (regions === undefined || !regions.length) regions = defaultRegions;

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
          platforms,
          accessKeyId,
          secretAccessKey,
        });
        /* istanbul ignore if */
        if (onRegionFetch) onRegionFetch(region);
        return regionsPrices;
      } catch (error) {
        /* istanbul ignore if */
        if (onRegionFetchFail) {
          onRegionFetchFail(error);
        } else {
          throw error;
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
            const reduceToLatest = r.reduce((reduced, cur) => {
              const duplicateIndex = reduced.findIndex(
                info =>
                  cur.AvailabilityZone &&
                  cur.AvailabilityZone === info.availabilityZone &&
                  cur.InstanceType &&
                  cur.InstanceType === info.instanceType &&
                  cur.ProductDescription &&
                  cur.ProductDescription === info.platform,
              );
              if (duplicateIndex >= 0) {
                const dupeTimestamp = reduced[duplicateIndex].timestamp;
                if (cur.Timestamp && dupeTimestamp && cur.Timestamp > dupeTimestamp) {
                  reduced.splice(duplicateIndex, 1);
                  reduced.push(SpotPriceToExtended(cur));
                }
              } else {
                reduced.push(SpotPriceToExtended(cur));
              }
              return reduced;
            }, [] as SpotPriceExtended[]);

            if (!reduceAZ) return reduceToLatest;

            // reduce results by region, choosing by cheapest record
            return reduceToLatest.reduce((reduced, cur) => {
              const duplicateIndex = reduced.findIndex(info => {
                const curRegion = cur.availabilityZone?.match(/^.+\d{1,}/)?.[0];
                const infoRegion = cur.availabilityZone?.match(/^.+\d{1,}/)?.[0];
                return (
                  curRegion &&
                  curRegion === infoRegion &&
                  cur.instanceType &&
                  cur.instanceType === info.instanceType &&
                  cur.platform &&
                  cur.platform === info.platform
                );
              });
              // since items have already been sorted by price from getEc2SpotPrice()
              // simply look for duplicates and add if non found
              if (duplicateIndex < 0) reduced.push(cur);
              return reduced;
            }, [] as SpotPriceExtended[]);
          })
          .map(async r => {
            const rExtended = { ...r } as SpotPriceExtended;
            const instanceInfo = Object.entries(ec2Info).find(
              ([instanceType]) => instanceType === r.instanceType,
            )?.[1];
            if (instanceInfo) {
              rExtended.vCpu = instanceInfo.vCpu;
              rExtended.memoryGiB = instanceInfo.memoryGiB;
            } else {
              // fetch intance info data from aws
              const region = rExtended.availabilityZone.match(/^.+\d/)?.[0];
              if (region && rExtended.instanceType) {
                const desc = await getEc2Info({ region, InstanceTypes: [rExtended.instanceType] });

                if (
                  desc[rExtended.instanceType] &&
                  desc[rExtended.instanceType].vCpu &&
                  desc[rExtended.instanceType].memoryGiB
                ) {
                  ec2Info[rExtended.instanceType] = {
                    vCpu: desc[rExtended.instanceType].vCpu,
                    memoryGiB: desc[rExtended.instanceType].memoryGiB,
                  };
                  rExtended.vCpu = desc[rExtended.instanceType].vCpu;
                  rExtended.memoryGiB = desc[rExtended.instanceType].memoryGiB;
                }
              }
            }
            return rExtended;
          }),
      );
    })
    .then(results => {
      return results
        .filter(
          // filter out info without region or price greater than priceLimit
          info => {
            // 1. remove if data missing any of the required attributes
            // 2. remove if price.SpotPrice is unavailable or price is higher than priceLimit
            // 2. remove if minimum vcpu / memory requirements does not meet requirements
            if (!info.availabilityZone || !info.spotPrice || !info.instanceType) {
              return false;
            }
            if (priceLimit !== undefined && parseFloat(info.spotPrice) > priceLimit) {
              return false;
            }

            if (minVCPU !== undefined && info.vCpu !== undefined && info.vCpu < minVCPU) {
              return false;
            }
            if (
              minMemoryGiB !== undefined &&
              info.memoryGiB !== undefined &&
              info.memoryGiB < minMemoryGiB
            ) {
              return false;
            }
            return true;
          },
        )
        .sort(sortSpotPriceExtended);
    });

  // limit output
  if (limit && rtn.length > limit) rtn.splice(limit);

  return rtn;
};
