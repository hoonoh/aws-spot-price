import {
  DescribeInstanceTypesCommand,
  DescribeInstanceTypesCommandInput,
  DescribeInstanceTypesCommandOutput,
  DescribeSpotPriceHistoryCommand,
  DescribeSpotPriceHistoryCommandInput,
  DescribeSpotPriceHistoryCommandOutput,
  EC2Client,
  EC2ServiceException,
  SpotPrice,
} from '@aws-sdk/client-ec2';
import { mockClient } from 'aws-sdk-client-mock';
import { existsSync, readFileSync } from 'fs';
import { filter } from 'lodash';
import { resolve } from 'path';

import { allRegions, Region } from '../src/constants/regions';
import { mockAwsCredentials, mockAwsCredentialsClear } from './mock-credential-endpoints';

const data = JSON.parse(
  readFileSync(resolve(__dirname, '../test/data/spot-prices-mock.json'), 'utf-8'),
  (k, v) =>
    typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      ? new Date(v)
      : v,
);

type RegionalData = { [region in Region]: SpotPrice[] };

const regionalData: RegionalData = allRegions.reduce((list, region) => {
  list[region] = filter(
    data,
    (o: SpotPrice) => o.AvailabilityZone && o.AvailabilityZone.startsWith(region),
  );
  return list;
}, {} as RegionalData);

let ec2Mock: ReturnType<typeof mockClient> | undefined;

export const mockDefaultRegionEndpoints = (
  options: {
    maxLength?: number;
    returnPartialBlankValues?: boolean;
    returnRequestLimitExceededErrorCount?: number;
  } = {},
): void => {
  const { maxLength, returnPartialBlankValues } = options;
  let { returnRequestLimitExceededErrorCount } = options;
  mockAwsCredentials();

  ec2Mock = mockClient(EC2Client);
  ec2Mock
    .on(DescribeSpotPriceHistoryCommand)
    .callsFake(async (input: DescribeSpotPriceHistoryCommandInput, getClient) => {
      if (returnRequestLimitExceededErrorCount) {
        returnRequestLimitExceededErrorCount -= 1;
        throw new EC2ServiceException({
          $fault: 'client',
          $metadata: {},
          name: 'RequestLimitExceeded',
        });
      }

      const index = input.NextToken ? parseInt(input.NextToken as string, 10) : 0;

      const { InstanceTypes, ProductDescriptions } = input;

      const instanceData: SpotPrice[] = filter(
        regionalData[(await (getClient() as EC2Client).config.region()) as Region],
        (o: SpotPrice) => {
          let rtn = true;
          if (
            InstanceTypes?.length &&
            (!o.InstanceType || !InstanceTypes.includes(o.InstanceType))
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
        },
      );

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
            InstanceType: d.InstanceType,
            ProductDescription: d.ProductDescription,
            SpotPrice: returnWithBlank ? undefined : d.SpotPrice,
            Timestamp: d.Timestamp,
            AvailabilityZone: returnWithBlank ? undefined : d.AvailabilityZone,
          };
        }),
      };
      return rtn;
    });

  ec2Mock
    .on(DescribeInstanceTypesCommand)
    .callsFake(async (input: DescribeInstanceTypesCommandInput) => {
      if (returnRequestLimitExceededErrorCount) {
        returnRequestLimitExceededErrorCount -= 1;
        throw new EC2ServiceException({
          $fault: 'client',
          $metadata: {},
          name: 'RequestLimitExceeded',
        });
      }

      const { InstanceTypes, NextToken } = input;

      const mockDataRoot = resolve(__dirname, '../test/data/describe-instance-types-mocks');

      if (InstanceTypes?.length) {
        try {
          const mockedDataJson = readFileSync(
            resolve(mockDataRoot, `${InstanceTypes[0].replace('.', '-')}.json`),
          ).toString();
          const mockedData = JSON.parse(mockedDataJson);
          const rtn: DescribeInstanceTypesCommandOutput = {
            $metadata: {},
            InstanceTypes: mockedData,
          };
          return rtn;
        } catch {
          // handle c1.medium type runtime error mock
          if (InstanceTypes.includes('c1.medium'))
            throw new EC2ServiceException({
              $fault: 'client',
              $metadata: {},
              name: 'InvalidInstanceType',
              message: `The following supplied instance types do not exist: [c1.medium]`,
            });
        }
      }

      const tokenIdCur = NextToken || 'page1';
      const jsonFileName = `${tokenIdCur}.json`;
      const mockedDataJson = readFileSync(resolve(mockDataRoot, jsonFileName)).toString();
      const mockedData = JSON.parse(mockedDataJson);
      const tokenIdNumCur = parseInt(tokenIdCur.match(/\d$/)?.[0] || '');
      const tokenIdNumNext = tokenIdCur ? `page${tokenIdNumCur + 1}` : undefined;
      const jsonFileNameNext = tokenIdNumNext ? `${tokenIdNumNext}.json` : undefined;
      const rtn: DescribeInstanceTypesCommandOutput = {
        $metadata: {},
        InstanceTypes: mockedData,
        NextToken:
          jsonFileNameNext && existsSync(resolve(mockDataRoot, jsonFileNameNext))
            ? tokenIdNumNext
            : undefined,
      };
      return rtn;
    });
};

export const mockDefaultRegionEndpointsClear = (): void => {
  mockAwsCredentialsClear();
  ec2Mock?.restore();
};
