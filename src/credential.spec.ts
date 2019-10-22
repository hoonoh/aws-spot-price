import * as nock from 'nock';

import { mockAwsCredentials, mockAwsCredentialsClear } from '../test/mock-credential-endpoints';
import { awsCredentialsCheck } from './credential';

// eslint-disable-next-line global-require
jest.mock('fs', () => new (require('metro-memory-fs'))());

describe('credential', () => {
  describe('awsCredentialsCheck', () => {
    afterEach(() => {
      nock.cleanAll();
    });

    describe('should throw error', () => {
      beforeEach(() => {
        mockAwsCredentials({ fail: true });
      });

      afterEach(() => {
        mockAwsCredentialsClear();
      });

      it('should throw error', async () => {
        let threwError = false;
        try {
          await awsCredentialsCheck();
        } catch (error) {
          threwError = true;
        }
        expect(threwError).toBeTruthy();
      });
    });

    describe('should not throw error', () => {
      beforeEach(() => {
        mockAwsCredentials();
      });
      afterEach(() => {
        mockAwsCredentialsClear();
      });
      it('should not throw error', async () => {
        let threwError = false;
        try {
          await awsCredentialsCheck();
        } catch (error) {
          threwError = true;
        }
        expect(threwError).toBeFalsy();
      });
    });

    describe('should handle credentials unavailable', () => {
      beforeEach(() => {
        mockAwsCredentials({ disableConfig: true, disableEnv: true });
      });

      afterEach(() => {
        mockAwsCredentialsClear();
      });

      it('should handle credentials unavailable', async () => {
        let threwError = false;
        try {
          await awsCredentialsCheck();
        } catch (error) {
          threwError = true;
          expect(error.message).toEqual('AWS credentials unavailable.');
          expect(error.code).toEqual('CredentialsNotFound');
        }
        expect(threwError).toBeTruthy();
      });
    });
  });
});
