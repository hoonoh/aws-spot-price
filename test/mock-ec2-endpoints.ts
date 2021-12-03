import {
  DescribeInstanceTypesCommandInput,
  DescribeInstanceTypesCommandOutput,
  DescribeSpotPriceHistoryCommandInput,
  DescribeSpotPriceHistoryCommandOutput,
  EC2Client,
  InstanceTypeInfo,
  ServiceInputTypes,
  ServiceOutputTypes,
  SpotPrice,
} from '@aws-sdk/client-ec2';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { readFileSync } from 'fs';
import { filter } from 'lodash';
import nock from 'nock';
import { resolve } from 'path';
import { parse } from 'querystring';

import { allRegions, defaultRegions, Region } from '../src/constants/regions';
import { mockSTSClient, mockSTSClientRestore } from './mock-credential-endpoints';

const data = JSON.parse(
  readFileSync(resolve(__dirname, '../test/data/spot-prices-mock.json')).toString(),
);

type RegionalData = { [region in Region]: SpotPrice[] };

const regionalData: RegionalData = allRegions.reduce((list, region) => {
  list[region] = filter(
    data,
    (o: SpotPrice) => o.AvailabilityZone && o.AvailabilityZone.startsWith(region),
  );
  return list;
}, {} as RegionalData);

// !new
let ec2Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes> | undefined;

export const spotPriceMock = ({
  // region,
  maxLength,
  returnPartialBlankValues,
  returnRequestLimitExceededErrorCount,
}: {
  // region: Region;
  maxLength?: number;
  returnPartialBlankValues?: boolean;
  returnRequestLimitExceededErrorCount?: number;
} = {}) => {
  mockSTSClient({ loadCredentialsFrom: 'none' });
  ec2Mock = mockClient(EC2Client);
  ec2Mock.callsFake(async input => {
    const call = ec2Mock?.calls().pop();
    const commandName: string = call?.firstArg.constructor.name;
    const ec2Client: EC2Client = call?.thisValue;
    const region: string = await ec2Client.config.region();

    // process.stdout.write(`\n>>> commandName ${commandName} \n`);

    if (commandName === 'DescribeSpotPriceHistoryCommand') {
      const commandInput: DescribeSpotPriceHistoryCommandInput = input;

      const { InstanceTypes, ProductDescriptions, NextToken } = commandInput;
      const index = NextToken ? parseInt(NextToken as string, 10) : 0;

      const instanceData: SpotPrice[] = filter(regionalData[region as Region], (o: SpotPrice) => {
        let rtn = true;
        if (
          InstanceTypes?.length &&
          (!o.InstanceType || !InstanceTypes?.includes(o.InstanceType))
        ) {
          rtn = false;
        }
        if (
          ProductDescriptions?.length &&
          (!o.ProductDescription || !ProductDescriptions.includes(o.ProductDescription))
        ) {
          rtn = false;
        }
        return rtn;
      });

      const instanceDataSlice = maxLength
        ? instanceData.slice(index, index + maxLength)
        : instanceData;
      const nextIndex =
        maxLength && instanceData.length >= index + maxLength ? index + maxLength : undefined;

      const rtn: DescribeSpotPriceHistoryCommandOutput = {
        $metadata: {},
        NextToken: nextIndex?.toString(),
        SpotPriceHistory: instanceDataSlice.map(
          d => ({ ...d, Timestamp: d.Timestamp ? new Date(d.Timestamp) : undefined } as SpotPrice),
        ),
      };
      return rtn;
    } else if (commandName === 'DescribeInstanceTypesCommand') {
      const commandInput: DescribeInstanceTypesCommandInput = input;
      const { NextToken, InstanceTypes } = commandInput;

      // const instanceTypes: string[] = [];
      // Object.entries(params).forEach(([key, value]) => {
      //   if (key.match(/^InstanceType.\d{1,}$/) && typeof value === 'string') {
      //     instanceTypes.push(value.replace(new RegExp('\\.', 'g'), '-'));
      //   }
      // });

      // only support single instance type request (dummy.large, t3a.nano)
      if (InstanceTypes?.length) {
        // const mockedData = readFileSync(
        //   resolve(
        //     __dirname,
        //     '../test/data/describe-instance-types-mocks',
        //     `${InstanceTypes[0]}.xml`,
        //   ),
        // ).toString();
        // return [200, mockedData];

        const instanceTypes: InstanceTypeInfo[] = [
          {
            InstanceType: 't3a.nano',
            CurrentGeneration: true,
            FreeTierEligible: false,
            SupportedUsageClasses: ['on-demand', 'spot'],
            SupportedRootDeviceTypes: ['ebs'],
            SupportedVirtualizationTypes: ['hvm'],
            BareMetal: false,
            Hypervisor: 'nitro',
            ProcessorInfo: {
              SupportedArchitectures: ['x86_64'],
              SustainedClockSpeedInGhz: 2.2,
            },
            VCpuInfo: {
              DefaultVCpus: 2,
              DefaultCores: 1,
              DefaultThreadsPerCore: 2,
              ValidCores: [1],
              ValidThreadsPerCore: [1, 2],
            },
            MemoryInfo: {
              SizeInMiB: 512,
            },
            InstanceStorageSupported: false,
            EbsInfo: {
              EbsOptimizedSupport: 'default',
              EncryptionSupport: 'supported',
              EbsOptimizedInfo: {
                BaselineBandwidthInMbps: 45,
                BaselineThroughputInMBps: 5.625,
                BaselineIops: 250,
                MaximumBandwidthInMbps: 2085,
                MaximumThroughputInMBps: 260.625,
                MaximumIops: 11800,
              },
              NvmeSupport: 'required',
            },
            NetworkInfo: {
              NetworkPerformance: 'Up to 5 Gigabit',
              MaximumNetworkInterfaces: 2,
              MaximumNetworkCards: 1,
              DefaultNetworkCardIndex: 0,
              NetworkCards: [
                {
                  NetworkCardIndex: 0,
                  NetworkPerformance: 'Up to 5 Gigabit',
                  MaximumNetworkInterfaces: 2,
                },
              ],
              Ipv4AddressesPerInterface: 2,
              Ipv6AddressesPerInterface: 2,
              Ipv6Supported: true,
              EnaSupport: 'required',
              EfaSupported: false,
              EncryptionInTransitSupported: false,
            },
            PlacementGroupInfo: {
              SupportedStrategies: ['partition', 'spread'],
            },
            HibernationSupported: true,
            BurstablePerformanceSupported: true,
            DedicatedHostsSupported: false,
            AutoRecoverySupported: true,
            SupportedBootModes: ['legacy-bios', 'uefi'],
          },
          {
            InstanceType: 'c1.medium',
            CurrentGeneration: false,
            FreeTierEligible: false,
            SupportedUsageClasses: ['on-demand', 'spot'],
            SupportedRootDeviceTypes: ['ebs', 'instance-store'],
            SupportedVirtualizationTypes: ['hvm', 'paravirtual'],
            BareMetal: false,
            Hypervisor: 'xen',
            ProcessorInfo: {
              SupportedArchitectures: ['i386', 'x86_64'],
            },
            VCpuInfo: {
              DefaultVCpus: 2,
              DefaultCores: 2,
              DefaultThreadsPerCore: 1,
            },
            MemoryInfo: {
              SizeInMiB: 1740,
            },
            InstanceStorageSupported: true,
            InstanceStorageInfo: {
              TotalSizeInGB: 350,
              Disks: [
                {
                  SizeInGB: 350,
                  Count: 1,
                  Type: 'hdd',
                },
              ],
              NvmeSupport: 'unsupported',
            },
            EbsInfo: {
              EbsOptimizedSupport: 'unsupported',
              EncryptionSupport: 'unsupported',
              NvmeSupport: 'unsupported',
            },
            NetworkInfo: {
              NetworkPerformance: 'Moderate',
              MaximumNetworkInterfaces: 2,
              MaximumNetworkCards: 1,
              DefaultNetworkCardIndex: 0,
              NetworkCards: [
                {
                  NetworkCardIndex: 0,
                  NetworkPerformance: 'Moderate',
                  MaximumNetworkInterfaces: 2,
                },
              ],
              Ipv4AddressesPerInterface: 6,
              Ipv6AddressesPerInterface: 0,
              Ipv6Supported: false,
              EnaSupport: 'unsupported',
              EfaSupported: false,
              EncryptionInTransitSupported: false,
            },
            PlacementGroupInfo: {
              SupportedStrategies: ['partition', 'spread'],
            },
            HibernationSupported: false,
            BurstablePerformanceSupported: false,
            DedicatedHostsSupported: false,
            AutoRecoverySupported: false,
            SupportedBootModes: ['legacy-bios'],
          },
        ];

        const rtn: DescribeInstanceTypesCommandOutput = {
          $metadata: {},
          InstanceTypes: instanceTypes.filter(
            i => i.InstanceType && InstanceTypes.includes(i.InstanceType),
          ),
        };
      }

      // const mockedData = readFileSync(
      //   resolve(
      //     __dirname,
      //     '../test/data/describe-instance-types-mocks',
      //     `${NextToken || 'page1'}.xml`,
      //   ),
      // ).toString();
      // return [200, mockedData];
    }

    // ! add returnRequestLimitExceededErrorCount handling
    if (returnRequestLimitExceededErrorCount) {
      returnRequestLimitExceededErrorCount -= 1;
      throw new Error('RequestLimitExceeded');
    }
    // let client: EC2Client | undefined;
    // ec2Mock?.calls().forEach(m => {
    //   if (!client && m.calledWithNew()) {
    //     client = m as unknown as EC2Client;
    //   }
    //   process.stdout.write(`\n>>> m: ${m}`);
    // });

    // process.stdout.write(`\n>>> client ${client}`);
    // process.stdout.write(`\n>>> client config region ${await client?.config.region()}`);

    const rtn: DescribeSpotPriceHistoryCommandOutput = {
      $metadata: {},
      SpotPriceHistory: [
        {
          AvailabilityZone: 'az',
          InstanceType: 'inst.type',
          ProductDescription: 'desc',
          SpotPrice: '1.23',
          Timestamp: new Date(),
        },
      ],
    };
    return rtn;
  });
};

// (async () => {
//   const ec2 = new EC2Client({});
//   const res = await ec2.send(new DescribeSpotPriceHistoryCommand({}));
//   const reg = await ec2.config.region();
// })();

export const spotPriceMockRestore = () => {
  mockSTSClientRestore();
  ec2Mock?.restore();
};

// !new end

/**
 * @param region
 * @param returnPartialBlankValues for sortSpotPrice() coverage
 */
const nockEndpoint = ({
  region,
  maxLength,
  returnPartialBlankValues,
  returnRequestLimitExceededErrorCount,
}: {
  region: Region;
  maxLength?: number;
  returnPartialBlankValues?: boolean;
  returnRequestLimitExceededErrorCount?: number;
}): void => {
  nock(`https://ec2.${region}.amazonaws.com`)
    .persist()
    .post('/')
    .reply((uri, body) => {
      if (returnRequestLimitExceededErrorCount) {
        returnRequestLimitExceededErrorCount -= 1;
        return [
          503,
          `<Response>
            <Errors>
              <Error>
                <Code>RequestLimitExceeded</Code>
                <Message>Request limit exceeded.</Message>
              </Error>
            </Errors>
            <RequestID>RequestLimitExceededRequestID</RequestID>
          </Response>`,
        ];
      }

      const params = parse(body as string);

      if (params.Action === 'DescribeSpotPriceHistory') {
        const index = params.NextToken ? parseInt(params.NextToken as string, 10) : 0;

        const instanceTypes = Object.keys(params).reduce((prev, key) => {
          const value = params[key];
          if (key.startsWith('InstanceType') && typeof value === 'string') prev.push(value);
          return prev;
        }, [] as string[]);

        const platforms = Object.keys(params).reduce((prev, key) => {
          const value = params[key];
          if (key.startsWith('ProductDescription') && typeof value === 'string') prev.push(value);
          return prev;
        }, [] as string[]);

        const instanceData: SpotPrice[] = filter(regionalData[region], (o: SpotPrice) => {
          let rtn = true;
          if (
            instanceTypes.length &&
            (!o.InstanceType || !instanceTypes.includes(o.InstanceType))
          ) {
            rtn = false;
          }
          if (
            platforms.length &&
            (!o.ProductDescription || !platforms.includes(o.ProductDescription))
          ) {
            rtn = false;
          }
          return rtn;
        });

        const instanceDataSlice = maxLength
          ? instanceData.slice(index, index + maxLength)
          : instanceData;
        const nextIndex =
          maxLength && instanceData.length >= index + maxLength ? index + maxLength : undefined;

        const rtn = [
          200,
          `<DescribeSpotPriceHistoryResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
            <requestId>requestId</requestId>
            <spotPriceHistorySet>
              ${instanceDataSlice.map((d, idx) => {
                const returnWithBlank =
                  returnPartialBlankValues &&
                  nextIndex === undefined &&
                  idx === instanceDataSlice.length - 1;
                return `<item>
                <instanceType>${d.InstanceType}</instanceType>
                <productDescription>${d.ProductDescription}</productDescription>
                ${returnWithBlank ? '' : `<spotPrice>${d.SpotPrice}</spotPrice>`}
                <timestamp>${d.Timestamp}</timestamp>
                ${
                  returnWithBlank
                    ? ''
                    : `<availabilityZone>${d.AvailabilityZone}</availabilityZone>`
                }
              </item>`;
              })}
            </spotPriceHistorySet>
            <nextToken>${nextIndex || ''}</nextToken>
          </DescribeSpotPriceHistoryResponse>`,
          {
            'cache-control': 'no-cache, no-store',
            connection: 'keep-alive',
            'content-type': 'text/xml;charset=UTF-8',
            date: 'Thu, 02 Dec 2021 06:24:01 GMT',
            'keep-alive': 'timeout=20',
            server: 'AmazonEC2',
            'strict-transport-security': 'max-age=31536000; includeSubDomains',
            'transfer-encoding': 'chunked',
            vary: 'accept-encoding',
            'x-amzn-requestid': '01234567-03cb-4c56-bfc2-bf133ea4df45',
          },
        ];

        return rtn;
      }

      //
      // Action = DescribeInstanceTypes
      //
      const { NextToken } = params;

      const instanceTypes: string[] = [];
      Object.entries(params).forEach(([key, value]) => {
        if (key.match(/^InstanceType.\d{1,}$/) && typeof value === 'string') {
          instanceTypes.push(value.replace(new RegExp('\\.', 'g'), '-'));
        }
      });

      // only support single instance type request (dummy.large, t3a.nano)
      if (instanceTypes.length) {
        const mockedData = readFileSync(
          resolve(
            __dirname,
            '../test/data/describe-instance-types-mocks',
            `${instanceTypes[0]}.xml`,
          ),
        ).toString();
        return [200, mockedData];
      }

      const mockedData = readFileSync(
        resolve(
          __dirname,
          '../test/data/describe-instance-types-mocks',
          `${NextToken || 'page1'}.xml`,
        ),
      ).toString();
      return [200, mockedData];
    });
};

export const mockDefaultRegionEndpoints = ({
  maxLength,
  returnPartialBlankValues,
  returnRequestLimitExceededErrorCount,
}: {
  maxLength?: number;
  returnPartialBlankValues?: boolean;
  returnRequestLimitExceededErrorCount?: number;
} = {}): void => {
  mockSTSClient();
  defaultRegions.forEach(region =>
    nockEndpoint({
      region,
      maxLength,
      returnPartialBlankValues,
      returnRequestLimitExceededErrorCount,
    }),
  );
};

export const mockDefaultRegionEndpointsClear = (): void => {
  mockSTSClientRestore();
  nock.cleanAll();
};
