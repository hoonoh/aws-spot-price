import { EC2Client, EC2ServiceException } from '@aws-sdk/client-ec2';
import { mockClient } from 'aws-sdk-client-mock';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { filter } from 'lodash';

import { mockAwsCredentials, mockAwsCredentialsClear } from '../../test/mock-credential-endpoints';
import {
  mockDefaultRegionEndpoints,
  mockDefaultRegionEndpointsClear,
} from '../../test/mock-ec2-endpoints';
import { consoleMockCallJoin } from '../../test/utils';
import { ec2Info, Ec2InstanceInfo } from '../constants/ec2-info';
import { InstanceFamilyType, InstanceSize } from '../constants/ec2-types';
import { Platform } from '../constants/platform';
import { Region } from '../constants/regions';
import { Ec2SpotPriceError, getEc2Info, getGlobalSpotPrices, SpotPriceExtended } from './core';

describe('lib', () => {
  describe('getGlobalSpotPrices', () => {
    describe('run with default options', () => {
      let results: SpotPriceExtended[];
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
      let results: SpotPriceExtended[];
      const familyTypes: InstanceFamilyType[] = ['c4', 'c5'];
      const sizes: InstanceSize[] = ['large', 'xlarge'];
      const platforms: Platform[] = ['Linux/UNIX'];

      beforeAll(async () => {
        mockDefaultRegionEndpoints({ maxLength: 5, returnPartialBlankValues: true });

        results = await getGlobalSpotPrices({
          familyTypes,
          sizes,
          platforms,
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
            expect(result.instanceType).toBeDefined();
            expect(result.platform).toBeDefined();
            if (result.instanceType && result.platform) {
              expect(
                familyTypes.includes(result.instanceType.split('.').shift() as InstanceFamilyType),
              ).toBeTruthy();
              expect(
                sizes.includes(result.instanceType.split('.').pop() as InstanceSize),
              ).toBeTruthy();
              expect(platforms.includes(result.platform as Platform)).toBeTruthy();
            }
          });
        }
      });
    });

    describe('run with family type only', () => {
      let results: SpotPriceExtended[];
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
            expect(result.instanceType).toBeDefined();
            if (result.instanceType) {
              expect(
                familyTypes.includes(result.instanceType.split('.').shift() as InstanceFamilyType),
              ).toBeTruthy();
            }
          });
        }
      });
    });

    describe('run with family sizes only', () => {
      let results: SpotPriceExtended[];
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
            expect(result.instanceType).toBeDefined();
            if (result.instanceType) {
              expect(
                sizes.includes(result.instanceType.split('.').pop() as InstanceSize),
              ).toBeTruthy();
            }
          });
        }
      });
    });

    describe('check instance types mix', () => {
      let results: SpotPriceExtended[];

      beforeAll(async () => {
        mockDefaultRegionEndpoints();

        results = await getGlobalSpotPrices({
          familyTypes: ['c4', 'c5'],
          sizes: ['large', 'xlarge'],
          instanceTypes: ['c5.2xlarge'],
          platforms: ['Linux/UNIX'],
          limit: 200,
          reduceAZ: false,
        });
      });

      afterAll(() => {
        mockDefaultRegionEndpointsClear();
      });

      it('should contain all instance types', () => {
        const c4large = filter(results, { instanceType: 'c4.large' });
        const c5large = filter(results, { instanceType: 'c5.large' });
        const c4xlarge = filter(results, { instanceType: 'c4.xlarge' });
        const c5xlarge = filter(results, { instanceType: 'c5.xlarge' });
        const c52xlarge = filter(results, { instanceType: 'c5.2xlarge' });
        expect(c4large.length).toBeGreaterThan(0);
        expect(c5large.length).toBeGreaterThan(0);
        expect(c4xlarge.length).toBeGreaterThan(0);
        expect(c5xlarge.length).toBeGreaterThan(0);
        expect(c52xlarge.length).toBeGreaterThan(0);
      });
    });

    describe('filter max price', () => {
      const priceLimit = 0.0018;
      let results: SpotPriceExtended[];

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
          expect(r.spotPrice).toBeLessThanOrEqual(priceLimit);
        });
      });
    });

    describe('should handle error', () => {
      const region: Region = 'ap-east-1';
      let restoreConsole: RestoreConsole;
      let ec2Mock: ReturnType<typeof mockClient> | undefined;

      beforeAll(() => {
        restoreConsole = mockConsole();
        mockAwsCredentials();
        ec2Mock = mockClient(EC2Client);
        ec2Mock.rejectsOnce();
      });
      afterAll(() => {
        restoreConsole();
        mockAwsCredentialsClear();
        ec2Mock?.restore();
      });
      it('should console log error', async () => {
        await getGlobalSpotPrices({ regions: [region], reduceAZ: false });
        expect(console.error).toHaveBeenCalled();
        expect(consoleMockCallJoin('error')).toContain('unexpected getEc2SpotPrice error');
      });
    });

    describe('should handle auth error', () => {
      const region: Region = 'ap-east-1';
      let ec2Mock: ReturnType<typeof mockClient> | undefined;

      beforeAll(() => {
        mockAwsCredentials();
        ec2Mock = mockClient(EC2Client);
        ec2Mock.rejectsOnce(
          new EC2ServiceException({
            $fault: 'server',
            $metadata: {
              requestId: 'e359d062-474b-4621-888c-e269b594de4a',
            },
            name: 'AuthFailure',
            message: 'AWS was not able to validate the provided access credentials',
          }),
        );
      });
      afterAll(() => {
        mockAwsCredentialsClear();
        ec2Mock?.restore();
      });
      it('should console log error', async () => {
        try {
          await getGlobalSpotPrices({ regions: [region], reduceAZ: false });
          expect(true).toBeFalsy();
        } catch (error) {
          if (!Ec2SpotPriceError.isEc2SpotPriceError(error)) throw new Error('expected AWSError');
          expect(error.name).toEqual('Ec2SpotPriceError');
          expect(error.region).toEqual(region);
          expect(error.code).toEqual('AuthFailure');
        }
      });
    });

    describe('should handle RequestLimitExceeded error', () => {
      const region = 'us-east-1';
      let results: SpotPriceExtended[];
      let restoreConsole: RestoreConsole;

      beforeAll(async () => {
        restoreConsole = mockConsole();
        mockDefaultRegionEndpoints({ returnRequestLimitExceededErrorCount: 5 });
        results = await getGlobalSpotPrices({ regions: [region] });
      });

      afterAll(() => {
        restoreConsole();
        mockDefaultRegionEndpointsClear();
      });

      it('should return expected values', async () => {
        expect(results).toMatchSnapshot();
      });
    });

    describe('should fetch ec2 instance type info dynamically if not found from constants', () => {
      let results: SpotPriceExtended[];
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
      let results: SpotPriceExtended[];
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

    describe('should filter architecture', () => {
      describe('x86_64', () => {
        let results: SpotPriceExtended[];
        let restoreConsole: RestoreConsole;

        beforeAll(async () => {
          restoreConsole = mockConsole();
          mockDefaultRegionEndpoints();
          results = await getGlobalSpotPrices({ architectures: ['x86_64'] });
        });

        afterAll(() => {
          restoreConsole();
          mockDefaultRegionEndpointsClear();
        });

        it('should return expected values', () => {
          expect(results).toMatchSnapshot();
        });
      });

      describe('arm64', () => {
        let results: SpotPriceExtended[];
        let restoreConsole: RestoreConsole;

        beforeAll(async () => {
          restoreConsole = mockConsole();
          mockDefaultRegionEndpoints();
          results = await getGlobalSpotPrices({ architectures: ['arm64'] });
        });

        afterAll(() => {
          restoreConsole();
          mockDefaultRegionEndpointsClear();
        });

        it('should return expected values', () => {
          expect(results).toMatchSnapshot();
        });
      });

      describe('x86_64 with platform option', () => {
        let results: SpotPriceExtended[];
        let restoreConsole: RestoreConsole;

        beforeAll(async () => {
          restoreConsole = mockConsole();
          mockDefaultRegionEndpoints();
          results = await getGlobalSpotPrices({
            architectures: ['x86_64'],
            platforms: ['Windows'],
          });
        });

        afterAll(() => {
          restoreConsole();
          mockDefaultRegionEndpointsClear();
        });

        it('should return expected values', () => {
          expect(results).toMatchSnapshot();
        });
      });

      describe('arm64 with familyType option resulting no matching instance types', () => {
        let results: SpotPriceExtended[];
        let restoreConsole: RestoreConsole;

        beforeAll(async () => {
          restoreConsole = mockConsole();
          mockDefaultRegionEndpoints();
          results = await getGlobalSpotPrices({
            architectures: ['arm64'],
            familyTypes: ['g4ad'],
          });
        });

        afterAll(() => {
          restoreConsole();
          mockDefaultRegionEndpointsClear();
        });

        it('should return expected values', () => {
          expect(results.length).toEqual(0);
        });
      });
    });
  });

  describe('getEc2Info', () => {
    type GetEc2InfoResults = Record<string, Ec2InstanceInfo>;

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
        expect(Object.keys(results).length).toEqual(865);
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

    describe('should handle RequestLimitExceeded error', () => {
      let results: GetEc2InfoResults;

      beforeAll(async () => {
        mockDefaultRegionEndpoints({
          returnRequestLimitExceededErrorCount: 5,
          maxLength: 5,
          returnPartialBlankValues: true,
        });
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
