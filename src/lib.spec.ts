import { SpotPrice } from 'aws-sdk/clients/ec2';
import { readFileSync } from 'fs';
import { filter } from 'lodash';
import * as nock from 'nock';
import { resolve } from 'path';
import { parse } from 'querystring';

import { getGlobalSpotPrices } from './lib';
import { defaultRegions, Region } from './regions';

describe('lib', () => {
  describe('getGlobalSpotPrices', () => {
    let results: SpotPrice[];

    beforeAll(async () => {
      const data = JSON.parse(
        readFileSync(resolve(__dirname, '../test/spot-prices-mock.json')).toString(),
      );

      const nockEndpoint = (region: Region) => {
        nock(`https://ec2.${region}.amazonaws.com`)
          .post('/')
          .reply((uri, body) => {
            const params = parse(body as string);
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
                if (key.startsWith('ProductDescription') && typeof value === 'string')
                  prev.push(value);
                return prev;
              },
              [] as string[],
            );
            const instanceData: SpotPrice[] = filter(data, (o: SpotPrice) => {
              let rtn = true;
              if (!o.AvailabilityZone || !o.AvailabilityZone.startsWith(region)) {
                rtn = false;
              }
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
            // console.log('body', params, typeof params, params.length);
            // console.log('instanceTypes', instanceTypes);
            // console.log('productDescriptions', productDescriptions);
            // console.log('instanceData', instanceData);
            return [
              200,
              `<DescribeSpotPriceHistoryResponse xmlns="http://ec2.amazonaws.com/doc/2016-11-15/">
                <requestId>requestId</requestId> 
                <spotPriceHistorySet>
                  ${instanceData.map(d => {
                    return `<item>
                    <instanceType>${d.InstanceType}</instanceType>
                    <productDescription>${d.ProductDescription}</productDescription>
                    <spotPrice>${d.SpotPrice}</spotPrice>
                    <timestamp>${d.Timestamp}</timestamp>
                    <availabilityZone>${d.AvailabilityZone}</availabilityZone>
                  </item>`;
                  })}
                </spotPriceHistorySet>
                <nextToken/>
              </DescribeSpotPriceHistoryResponse>`,
            ];
          });
      };

      defaultRegions.forEach(region => nockEndpoint(region));

      results = await getGlobalSpotPrices({
        families: ['c4', 'c5'],
        sizes: ['large', 'xlarge'],
        priceMax: 1,
        productDescriptions: ['Linux/UNIX'],
        limit: 20,
        quiet: true,
      });

      // console.log('results', JSON.stringify(results, null, 2));
    });

    it('should return expected values', async () => {
      expect(results).toMatchSnapshot();
    });
  });
});
