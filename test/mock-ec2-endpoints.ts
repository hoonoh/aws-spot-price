import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'querystring';

import { SpotPrice } from 'aws-sdk/clients/ec2';
import { filter } from 'lodash';
import nock from 'nock';

import { Region, allRegions, defaultRegions } from '../src/constants/regions';
import { mockAwsCredentials, mockAwsCredentialsClear } from './mock-credential-endpoints';

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

/**
 * @param region
 * @param returnPartialBlankValues for sortSpotPrice() coverage
 */
const nockEndpoint = (options: {
  region: Region;
  maxLength?: number;
  returnPartialBlankValues?: boolean;
  returnRequestLimitExceededErrorCount?: number;
}): void => {
  const { region, returnPartialBlankValues, maxLength } = options;
  let { returnRequestLimitExceededErrorCount } = options;

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

        return [
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
        ];
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

export const mockDefaultRegionEndpoints = (
  options: {
    maxLength?: number;
    returnPartialBlankValues?: boolean;
    returnRequestLimitExceededErrorCount?: number;
  } = {},
): void => {
  const { maxLength, returnPartialBlankValues, returnRequestLimitExceededErrorCount } = options;
  mockAwsCredentials();
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
  mockAwsCredentialsClear();
  nock.cleanAll();
};
