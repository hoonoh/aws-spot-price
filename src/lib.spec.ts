import { SpotPrice } from 'aws-sdk/clients/ec2';
import mockConsole, { RestoreConsole } from 'jest-mock-console';
import { filter } from 'lodash';
import * as nock from 'nock';

import { consoleMockCallJoin, nockEndpoint } from '../test/test-utils';
import { awsCredentialsCheck, getGlobalSpotPrices } from './lib';
import { defaultRegions, Region } from './regions';

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
          familyTypes: ['c4', 'c5'],
          sizes: ['large', 'xlarge'],
          priceMax: 1,
          productDescriptions: ['Linux/UNIX'],
          limit: 20,
          silent: true,
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
          familyTypes: ['c4', 'c5'],
          sizes: ['large', 'xlarge'],
          instanceTypes: ['c5.2xlarge'],
          productDescriptions: ['Linux/UNIX'],
          limit: 200,
          silent: true,
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
          silent: true,
        });
      });

      afterAll(() => {
        nock.cleanAll();
      });

      it(`should return prices less than ${priceMax}`, () => {
        results.forEach(r => {
          expect(parseFloat(r.SpotPrice || '0')).toBeLessThanOrEqual(priceMax);
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
        expect(consoleMockCallJoin('error')).toContain('unexpected getEc2SpotPrice error');
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
