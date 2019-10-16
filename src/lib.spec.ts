import { SpotPrice } from 'aws-sdk/clients/ec2';
import { readFileSync } from 'fs';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { filter } from 'lodash';
import * as nock from 'nock';
import { resolve } from 'path';
import { parse } from 'querystring';

import { awsCredentialsCheck, getGlobalSpotPrices } from './lib';
import { allRegions, defaultRegions, Region } from './regions';

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
}) => {
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
        if (
          instanceTypes.length &&
          (!o.InstanceType || instanceTypes.indexOf(o.InstanceType) < 0)
        ) {
          rtn = false;
        }
        if (
          productDescriptions.length &&
          (!o.ProductDescription || productDescriptions.indexOf(o.ProductDescription) < 0)
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
              ${returnWithBlank ? '' : `<availabilityZone>${d.AvailabilityZone}</availabilityZone>`}
            </item>`;
            })}
          </spotPriceHistorySet>
          <nextToken>${nextIndex || ''}</nextToken>
        </DescribeSpotPriceHistoryResponse>`,
      ];
    });
};

describe('lib', () => {
  describe('getGlobalSpotPrices', () => {
    describe('run with default options', () => {
      let results: SpotPrice[];
      let restoreConsole: RestoreConsole;

      beforeAll(async () => {
        jest.setTimeout(30000);
        restoreConsole = mockConsole();
        defaultRegions.forEach(region => nockEndpoint({ region }));
        results = await getGlobalSpotPrices();
      });

      afterAll(() => {
        jest.setTimeout(5000);
        restoreConsole();
        nock.cleanAll();
      });

      it('should return expected values', () => {
        expect(results).toMatchSnapshot();
      });
    });

    describe('run with specific options', () => {
      let results: SpotPrice[];

      beforeAll(async () => {
        defaultRegions.forEach(region =>
          nockEndpoint({ region, maxLength: 5, returnPartialBlankValues: true }),
        );

        results = await getGlobalSpotPrices({
          families: ['c4', 'c5'],
          sizes: ['large', 'xlarge'],
          priceMax: 1,
          productDescriptions: ['Linux/UNIX'],
          limit: 20,
          // quiet: true,
        });
      });

      afterAll(() => {
        nock.cleanAll();
      });

      it('should return expected values', () => {
        expect(results).toMatchSnapshot();
      });
    });

    describe('check instance types mix', () => {
      let results: SpotPrice[];

      beforeAll(async () => {
        defaultRegions.forEach(region => nockEndpoint({ region }));

        results = await getGlobalSpotPrices({
          families: ['c4', 'c5'],
          sizes: ['large', 'xlarge'],
          instanceTypes: ['c5.2xlarge'],
          productDescriptions: ['Linux/UNIX'],
          limit: 200,
          quiet: true,
        });
      });

      afterAll(() => {
        nock.cleanAll();
      });

      it('should contain all instance types', () => {
        const c4large = filter(results, { InstanceType: 'c4.large' });
        const c5large = filter(results, { InstanceType: 'c5.large' });
        const c4xlarge = filter(results, { InstanceType: 'c4.xlarge' });
        const c5xlarge = filter(results, { InstanceType: 'c5.xlarge' });
        const c52xlarge = filter(results, { InstanceType: 'c5.2xlarge' });
        expect(c4large.length).toBeGreaterThan(0);
        expect(c5large.length).toBeGreaterThan(0);
        expect(c4xlarge.length).toBeGreaterThan(0);
        expect(c5xlarge.length).toBeGreaterThan(0);
        expect(c52xlarge.length).toBeGreaterThan(0);
      });
    });

    describe('filter max price', () => {
      const priceMax = 0.0018;
      let results: SpotPrice[];

      beforeAll(async () => {
        defaultRegions.forEach(region => nockEndpoint({ region }));

        results = await getGlobalSpotPrices({
          priceMax,
          quiet: true,
        });
      });

      afterAll(() => {
        nock.cleanAll();
      });

      it(`should return prices less than ${priceMax}`, () => {
        results.forEach(r => {
          expect(parseFloat(r.SpotPrice!)).toBeLessThanOrEqual(priceMax);
        });
      });
    });

    describe('should handle error', () => {
      const region: Region = 'ap-east-1';
      let restoreConsole: RestoreConsole;

      beforeAll(() => {
        restoreConsole = mockConsole();
        nock(`https://ec2.${region}.amazonaws.com`)
          .persist()
          .post('/')
          .reply(400, '');
      });
      afterAll(() => {
        restoreConsole();
        nock.cleanAll();
      });
      it('should console log error', async () => {
        await getGlobalSpotPrices({ regions: [region] });
        expect(console.error).toHaveBeenCalled();
        // @ts-ignore
        expect(console.error.mock.calls[0][0]).toContain('unexpected getEc2SpotPrice error');
      });
    });
  });

  describe('awsCredentialsCheck', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    it('should return false', async () => {
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
      const results = await awsCredentialsCheck();
      expect(results).toBeFalsy();
    });

    it('should return true', async () => {
      nock('https://sts.amazonaws.com')
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
      const results = await awsCredentialsCheck({
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
      });
      expect(results).toBeTruthy();
    });
  });
});
