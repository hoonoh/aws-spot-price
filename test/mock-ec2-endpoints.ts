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
import { SdkError } from '@aws-sdk/types';
import { AwsStub, mockClient } from 'aws-sdk-client-mock';
import { readFileSync } from 'fs';
import { filter } from 'lodash';
import { resolve } from 'path';

import { allRegions, Region } from '../src/constants/regions';
import { dummyLarge } from './data/describe-instance-types-mocks/dummy-large';
import { page1 } from './data/describe-instance-types-mocks/page1';
import { page2 } from './data/describe-instance-types-mocks/page2';
import { page3 } from './data/describe-instance-types-mocks/page3';
import { page4 } from './data/describe-instance-types-mocks/page4';
import { page5 } from './data/describe-instance-types-mocks/page5';
import { t3aNano } from './data/describe-instance-types-mocks/t3a-nano';
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

let ec2Mock: AwsStub<ServiceInputTypes, ServiceOutputTypes> | undefined;

export const spotPriceMock = ({
  maxLength,
  returnPartialBlankValues,
  returnRequestLimitExceededErrorCount,
}: {
  maxLength?: number;
  returnPartialBlankValues?: boolean;
  returnRequestLimitExceededErrorCount?: number;
} = {}) => {
  mockSTSClient();
  ec2Mock = mockClient(EC2Client);
  ec2Mock.callsFake(async input => {
    const call = ec2Mock?.calls().pop();
    const commandName: string = call?.firstArg.constructor.name;
    const ec2Client: EC2Client = call?.thisValue;
    const region: string = await ec2Client.config.region();

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
        SpotPriceHistory: instanceDataSlice.map((d, idx) => {
          const returnWithBlank =
            returnPartialBlankValues &&
            nextIndex === undefined &&
            idx === instanceDataSlice.length - 1;
          return {
            ...d,
            Timestamp: d.Timestamp ? new Date(d.Timestamp) : undefined,
            SpotPrice: returnWithBlank ? undefined : d.SpotPrice,
            AvailabilityZone: returnWithBlank ? undefined : d.AvailabilityZone,
          } as SpotPrice;
        }),
      };
      return rtn;
    } else if (commandName === 'DescribeInstanceTypesCommand') {
      const commandInput: DescribeInstanceTypesCommandInput = input;
      const { NextToken, InstanceTypes } = commandInput;

      if (InstanceTypes?.length) {
        const instanceTypes: InstanceTypeInfo[] = [
          //
          t3aNano,
          dummyLarge,
        ];

        const rtn: DescribeInstanceTypesCommandOutput = {
          $metadata: {},
          InstanceTypes: instanceTypes.filter(
            i => i.InstanceType && InstanceTypes.includes(i.InstanceType),
          ),
        };

        return rtn;
      }

      // paginated res
      const pages = [page1, page2, page3, page4, page5];
      const page = NextToken || 'page1';
      const pageIndex = parseInt(page.split('').pop() || '1') - 1;
      const nextNextToken = pageIndex < pages.length ? `page${pageIndex + 2}` : undefined;
      const rtn: DescribeInstanceTypesCommandOutput = {
        $metadata: {},
        NextToken: nextNextToken,
        InstanceTypes: pages[pageIndex],
      };
      return rtn;
    }

    if (returnRequestLimitExceededErrorCount) {
      returnRequestLimitExceededErrorCount -= 1;
      const error: SdkError = new Error();
      error.name = 'RequestLimitExceeded';
      throw error;
    }

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

export const spotPriceMockRestore = () => {
  mockSTSClientRestore();
  ec2Mock?.restore();
};
