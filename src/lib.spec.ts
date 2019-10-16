import { SpotPrice } from 'aws-sdk/clients/ec2';
import { readFileSync } from 'fs';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { filter } from 'lodash';
import * as nock from 'nock';
import { resolve } from 'path';
import { parse } from 'querystring';

import { getGlobalSpotPrices } from './lib';
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
              return `<item>
              <instanceType>${d.InstanceType}</instanceType>
              <productDescription>${d.ProductDescription}</productDescription>
              <spotPrice>${
                returnPartialBlankValues &&
                nextIndex === undefined &&
                idx === instanceDataSlice.length - 1
                  ? ''
                  : d.SpotPrice
              }</spotPrice>
              <timestamp>${d.Timestamp}</timestamp>
              <availabilityZone>${d.AvailabilityZone}</availabilityZone>
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
        defaultRegions.forEach(region =>
          nockEndpoint({ region, returnPartialBlankValues: region === 'sa-east-1' }),
        );
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
        defaultRegions.forEach(region => nockEndpoint({ region, maxLength: 5 }));

        results = await getGlobalSpotPrices({
          families: ['c4', 'c5'],
          sizes: ['large', 'xlarge'],
          priceMax: 1,
          productDescriptions: ['Linux/UNIX'],
          limit: 20,
          quiet: true,
        });
      });

      afterAll(() => {
        nock.cleanAll();
      });

      it('should return expected values', () => {
        expect(results).toMatchSnapshot();
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
});
