import { config } from 'aws-sdk';
import { SpotPrice } from 'aws-sdk/clients/ec2';
import { readFileSync } from 'fs';
import { filter } from 'lodash';
import * as nock from 'nock';
import { resolve } from 'path';
import { parse } from 'querystring';

import { allRegions, defaultRegions, Region } from '../src/regions';

const data = JSON.parse(
  readFileSync(resolve(__dirname, '../test/spot-prices-mock.json')).toString(),
);

type RegionalData = { [region in Region]: SpotPrice[] };

const regionalData: RegionalData = allRegions.reduce(
  (list, region) => {
    list[region] = filter(data, (o: SpotPrice) => {
      return o.AvailabilityZone && o.AvailabilityZone.startsWith(region);
    });
    return list;
  },
  {} as RegionalData,
);

/**
 * @param region
 * @param returnPartialBlankValues for sortSpotPrice() coverage
 */
const nockEndpoint = (options: {
  region: Region;
  maxLength?: number;
  returnPartialBlankValues?: boolean;
}): void => {
  const { region, returnPartialBlankValues, maxLength } = options;

  nock(`https://ec2.${region}.amazonaws.com`)
    .persist()
    .post('/')
    .reply((uri, body) => {
      const params = parse(body as string);

      const index = params.NextToken ? parseInt(params.NextToken as string, 10) : 0;

      const instanceTypes = Object.keys(params).reduce(
        (prev, key) => {
          const value = params[key];
          if (key.startsWith('InstanceType') && typeof value === 'string') prev.push(value);
          return prev;
        },
        [] as string[],
      );

      const productDescriptions = Object.keys(params).reduce(
        (prev, key) => {
          const value = params[key];
          if (key.startsWith('ProductDescription') && typeof value === 'string') prev.push(value);
          return prev;
        },
        [] as string[],
      );

      const instanceData: SpotPrice[] = filter(regionalData[region], (o: SpotPrice) => {
        let rtn = true;
        if (instanceTypes.length && (!o.InstanceType || !instanceTypes.includes(o.InstanceType))) {
          rtn = false;
        }
        if (
          productDescriptions.length &&
          (!o.ProductDescription || !productDescriptions.includes(o.ProductDescription))
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
              if (returnWithBlank)
                process.stdout.write(
                  `\n\nSKIPPED: ${JSON.stringify(
                    {
                      InstanceType: d.InstanceType,
                      ProductDescription: d.ProductDescription,
                      SpotPrice: d.SpotPrice,
                      Timestamp: d.Timestamp,
                      AvailabilityZone: d.AvailabilityZone,
                    },
                    null,
                    2,
                  )}\n\n`,
                );
              return `<item>
              <instanceType>${d.InstanceType}</instanceType>
              <productDescription>${d.ProductDescription}</productDescription>
              ${returnWithBlank ? '' : `<spotPrice>${d.SpotPrice}</spotPrice>`}
              <timestamp>${d.Timestamp}</timestamp>
              ${returnWithBlank ? '' : `<availabilityZone>${d.AvailabilityZone}</availabilityZone>`}
            </item>`;
            })}
          </spotPriceHistorySet>
          <nextToken>${nextIndex || ''}</nextToken>
        </DescribeSpotPriceHistoryResponse>`,
      ];
    });
};

export const mockAwsCredentials = (fail?: boolean): void => {
  process.env.AWS_ACCESS_KEY_ID = 'accessKeyId';
  process.env.AWS_SECRET_ACCESS_KEY = 'secretAccessKey';
  config.accessKeyId = 'accessKeyId';
  config.secretAccessKey = 'secretAccessKey';

  if (fail) {
    nock('https://sts.amazonaws.com')
      .persist()
      .post('/')
      .reply(
        403,
        `<ErrorResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
          <Error>
            <Type>Sender</Type>
            <Code>MissingAuthenticationToken</Code>
            <Message>Request is missing Authentication Token</Message>
          </Error>
          <RequestId>4fc0d3ee-efef-11e9-9282-3b7bffe54a9b</RequestId>
        </ErrorResponse>`,
      );
  } else {
    nock(`https://sts.amazonaws.com`)
      .persist()
      .post('/')
      .reply(
        200,
        `<GetCallerIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/">
          <GetCallerIdentityResult>
          <Arn>arn:aws:iam::123456789012:user/Alice</Arn>
            <UserId>EXAMPLE</UserId>
            <Account>123456789012</Account>
          </GetCallerIdentityResult>
          <ResponseMetadata>
            <RequestId>01234567-89ab-cdef-0123-456789abcdef</RequestId>
          </ResponseMetadata>
        </GetCallerIdentityResponse>`,
      );
  }
};

export const mockAwsCredentialsClear = (): void => {
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete config.accessKeyId;
  delete config.secretAccessKey;
};

export const mockDefaultRegionEndpoints = (
  options: {
    maxLength?: number;
    returnPartialBlankValues?: boolean;
  } = {},
): void => {
  const { maxLength, returnPartialBlankValues } = options;
  mockAwsCredentials();
  defaultRegions.forEach(region => nockEndpoint({ region, maxLength, returnPartialBlankValues }));
};

export const mockDefaultRegionEndpointsClear = (): void => {
  mockAwsCredentialsClear();
  nock.cleanAll();
};

export const consoleMockCallJoin = (type: 'log' | 'warn' | 'error' = 'log'): string => {
  // @ts-ignore
  const { calls }: { calls: string[][] } = console[type].mock;
  if (calls) return calls.map(sa => sa.join(' ')).join('\n');
  return '';
};
