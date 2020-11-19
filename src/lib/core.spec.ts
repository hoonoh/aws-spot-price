import { SpotPrice } from 'aws-sdk/clients/ec2';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { filter } from 'lodash';
import nock from 'nock';

import { mockAwsCredentials, mockAwsCredentialsClear } from '../../test/mock-credential-endpoints';
import {
  mockDefaultRegionEndpoints,
  mockDefaultRegionEndpointsClear,
} from '../../test/mock-ec2-endpoints';
import { consoleMockCallJoin } from '../../test/utils';
import { ec2Info, Ec2InstanceInfo } from '../constants/ec2-info';
import { InstanceFamilyType, InstanceSize } from '../constants/ec2-types';
import { ProductDescription } from '../constants/product-description';
import { Region } from '../constants/regions';
import { getEc2Info, getGlobalSpotPrices } from './core';

describe('lib', () => {
  describe('getGlobalSpotPrices', () => {
    describe('run with default options', () => {
      let results: SpotPrice[];
      let restoreConsole: RestoreConsole;

      beforeAll(async () => {
        restoreConsole = mockConsole();
        mockDefaultRegionEndpoints();
        results = await getGlobalSpotPrices();
      });

      afterAll(() => {
        restoreConsole();
        mockDefaultRegionEndpointsClear();
      });

      it('should return expected values', () => {
        expect(results).toMatchSnapshot();
      });
    });

    describe('run with specific options', () => {
      let results: SpotPrice[];
      const familyTypes: InstanceFamilyType[] = ['c4', 'c5'];
      const sizes: InstanceSize[] = ['large', 'xlarge'];
      const productDescriptions: ProductDescription[] = ['Linux/UNIX'];

      beforeAll(async () => {
        mockDefaultRegionEndpoints({ maxLength: 5, returnPartialBlankValues: true });

        results = await getGlobalSpotPrices({
          familyTypes,
          sizes,
          productDescriptions,
          limit: 20,
          reduceAZ: false,
        });
      });

      afterAll(() => {
        mockDefaultRegionEndpointsClear();
      });

      it('should return expected values', () => {
        expect(results).toBeDefined();
        expect(results.length).toEqual(20);
        if (results) {
          results.forEach(result => {
            expect(result.InstanceType).toBeDefined();
            expect(result.ProductDescription).toBeDefined();
            if (result.InstanceType && result.ProductDescription) {
              expect(
                familyTypes.includes(result.InstanceType.split('.').shift() as InstanceFamilyType),
              ).toBeTruthy();
              expect(
                sizes.includes(result.InstanceType.split('.').pop() as InstanceSize),
              ).toBeTruthy();
              expect(
                productDescriptions.includes(result.ProductDescription as ProductDescription),
              ).toBeTruthy();
            }
          });
        }
      });
    });

    describe('run with family type only', () => {
      let results: SpotPrice[];
      const familyTypes: InstanceFamilyType[] = ['c1', 'c3', 'c4'];

      beforeAll(async () => {
        mockDefaultRegionEndpoints({ maxLength: 5, returnPartialBlankValues: true });

        results = await getGlobalSpotPrices({
          familyTypes,
          limit: 20,
          reduceAZ: false,
        });
      });

      afterAll(() => {
        mockDefaultRegionEndpointsClear();
      });

      it('should return expected values', () => {
        expect(results).toBeDefined();
        expect(results.length).toEqual(20);
        if (results) {
          results.forEach(result => {
            expect(result.InstanceType).toBeDefined();
            if (result.InstanceType) {
              expect(
                familyTypes.includes(result.InstanceType.split('.').shift() as InstanceFamilyType),
              ).toBeTruthy();
            }
          });
        }
      });
    });

    describe('run with family sizes only', () => {
      let results: SpotPrice[];
      const sizes: InstanceSize[] = ['small', 'medium', 'large'];

      beforeAll(async () => {
        mockDefaultRegionEndpoints({ maxLength: 5, returnPartialBlankValues: true });

        results = await getGlobalSpotPrices({
          sizes,
          limit: 20,
          reduceAZ: false,
        });
      });

      afterAll(() => {
        mockDefaultRegionEndpointsClear();
      });

      it('should return expected values', () => {
        expect(results).toBeDefined();
        expect(results.length).toEqual(20);
        if (results) {
          results.forEach(result => {
            expect(result.InstanceType).toBeDefined();
            if (result.InstanceType) {
              expect(
                sizes.includes(result.InstanceType.split('.').pop() as InstanceSize),
              ).toBeTruthy();
            }
          });
        }
      });
    });

    describe('check instance types mix', () => {
      let results: SpotPrice[];

      beforeAll(async () => {
        mockDefaultRegionEndpoints();

        results = await getGlobalSpotPrices({
          familyTypes: ['c4', 'c5'],
          sizes: ['large', 'xlarge'],
          instanceTypes: ['c5.2xlarge'],
          productDescriptions: ['Linux/UNIX'],
          limit: 200,
          reduceAZ: false,
        });
      });

      afterAll(() => {
        mockDefaultRegionEndpointsClear();
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
      const priceLimit = 0.0018;
      let results: SpotPrice[];

      beforeAll(async () => {
        mockDefaultRegionEndpoints();

        results = await getGlobalSpotPrices({
          priceLimit,
          reduceAZ: false,
        });
      });

      afterAll(() => {
        mockDefaultRegionEndpointsClear();
      });

      it(`should return prices less than ${priceLimit}`, () => {
        results.forEach(r => {
          expect(parseFloat(r.SpotPrice || '0')).toBeLessThanOrEqual(priceLimit);
        });
      });
    });

    describe('should handle error', () => {
      const region: Region = 'ap-east-1';
      let restoreConsole: RestoreConsole;

      beforeAll(() => {
        restoreConsole = mockConsole();
        mockAwsCredentials();
        nock(`https://ec2.${region}.amazonaws.com`).persist().post('/').reply(400, '');
      });
      afterAll(() => {
        restoreConsole();
        mockAwsCredentialsClear();
        nock.cleanAll();
      });
      it('should console log error', async () => {
        await getGlobalSpotPrices({ regions: [region], reduceAZ: false });
        expect(console.error).toHaveBeenCalled();
        expect(consoleMockCallJoin('error')).toContain('unexpected getEc2SpotPrice error');
      });
    });

    describe('should handle auth error', () => {
      const region: Region = 'ap-east-1';
      beforeAll(() => {
        mockAwsCredentials();
        nock(`https://ec2.${region}.amazonaws.com`).persist().post('/').reply(
          401,
          `<?xml version="1.0" encoding="UTF-8"?>
            <Response>
              <Errors>
                <Error>
                  <Code>AuthFailure</Code>
                  <Message>AWS was not able to validate the provided access credentials</Message>
                </Error>
              </Errors>
              <RequestID>e359d062-474b-4621-888c-e269b594de4a</RequestID>
            </Response>`,
        );
      });
      afterAll(() => {
        mockAwsCredentialsClear();
        nock.cleanAll();
      });
      it('should console log error', async () => {
        try {
          await getGlobalSpotPrices({ regions: [region], reduceAZ: false });
          expect(true).toBeFalsy();
        } catch (error) {
          expect(error.name).toEqual('Ec2SpotPriceError');
          expect(error.region).toEqual(region);
          expect(error.code).toEqual('AuthFailure');
        }
      });
    });

    describe('should fetch ec2 instance type info dynamically if not found from constants', () => {
      let results: SpotPrice[];
      let restoreConsole: RestoreConsole;
      let t3aNanoInfo: Ec2InstanceInfo | undefined;

      beforeAll(async () => {
        t3aNanoInfo = ec2Info['t3a.nano'];
        delete ec2Info['t3a.nano'];
        restoreConsole = mockConsole();
        mockDefaultRegionEndpoints();
        results = await getGlobalSpotPrices({ limit: 20 });
      });

      afterAll(() => {
        if (t3aNanoInfo) ec2Info['t3a.nano'] = t3aNanoInfo;
        restoreConsole();
        mockDefaultRegionEndpointsClear();
      });

      it('should return expected values', () => {
        expect(results).toMatchSnapshot();
      });
    });

    describe('should filter by minVCPU & minMemoryGiB', () => {
      let results: SpotPrice[];
      let restoreConsole: RestoreConsole;

      beforeAll(async () => {
        restoreConsole = mockConsole();
        mockDefaultRegionEndpoints();
        results = await getGlobalSpotPrices({ limit: 5, minVCPU: 4, minMemoryGiB: 16 });
      });

      afterAll(() => {
        restoreConsole();
        mockDefaultRegionEndpointsClear();
      });

      it('should return expected values', () => {
        expect(results).toMatchSnapshot();
      });
    });
  });

  describe('getEc2Info', () => {
    type GetEc2InfoResults = Record<
      string,
      { vCpu?: number | undefined; memoryGiB?: number | undefined }
    >;

    describe('run with default options', () => {
      let results: GetEc2InfoResults;

      beforeAll(async () => {
        mockDefaultRegionEndpoints({ maxLength: 5, returnPartialBlankValues: true });
        results = await getEc2Info();
      });

      afterAll(() => {
        mockDefaultRegionEndpointsClear();
      });

      it('should return expected values', () => {
        expect(Object.keys(results).length).toEqual(341);
        expect(results).toMatchSnapshot();
      });
    });

    describe('run with targeted instance type', () => {
      let results: GetEc2InfoResults;

      beforeAll(async () => {
        mockDefaultRegionEndpoints({ maxLength: 5, returnPartialBlankValues: true });
        results = await getEc2Info({ InstanceTypes: ['dummy.large'] });
      });

      afterAll(() => {
        mockDefaultRegionEndpointsClear();
      });

      it('should return expected values', () => {
        expect(Object.keys(results).length).toEqual(1);
        expect(results).toMatchSnapshot();
      });
    });
  });
});
