import mockConsole, { RestoreConsole } from 'jest-mock-console';
import * as nock from 'nock';

import { mockAwsCredentials, mockAwsCredentialsClear } from '../test/mock-credential-endpoints';
import { consoleMockCallJoin } from '../test/utils';
import { main } from './cli';
import { awsCredentialsCheck } from './credential';

// mock fs to disable ~/.aws/credentials
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
        mockAwsCredentials({ disableEnv: true });
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

  describe('cli credential', () => {
    let restoreConsole: RestoreConsole;

    describe('handle no credential found', () => {
      beforeEach(() => {
        mockAwsCredentials({ disableEnv: true });
        restoreConsole = mockConsole();
      });

      afterEach(() => {
        mockAwsCredentialsClear();
        restoreConsole();
      });

      it('should print no credential found', async () => {
        try {
          await main();
        } catch (error) {
          expect(consoleMockCallJoin()).toContain('AWS credentials are not found.');
        }
      });
    });

    describe('handle no credential found', () => {
      beforeEach(() => {
        mockAwsCredentials({ disableEnv: true, fail: true });
        restoreConsole = mockConsole();
      });

      afterEach(() => {
        mockAwsCredentialsClear();
        restoreConsole();
      });

      it('should print invalid credential', async () => {
        try {
          await main(['--accessKeyId', 'temp', '--secretAccessKey', 'temp2']);
        } catch (error) {
          expect(consoleMockCallJoin()).toContain('Invalid AWS credentials provided.');
        }
      });
    });
  });
});
